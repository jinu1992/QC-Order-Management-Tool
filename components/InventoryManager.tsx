import React, { useState, useMemo } from 'react';
import { InventoryItem, PurchaseOrder, POStatus } from '../types';
import { SearchIcon, FilterIcon, RefreshIcon, CubeIcon, PlusIcon, CheckCircleIcon, XCircleIcon, PencilIcon, AlertIcon, ClipboardListIcon } from './icons/Icons';
import { createInventoryItem, updateInventoryPrice, syncInventoryFromEasyEcom } from '../services/api';
import LoadingCube from './LoadingCube';

interface InventoryManagerProps {
    addLog: (action: string, details: string) => void;
    inventoryItems: InventoryItem[];
    purchaseOrders: PurchaseOrder[];
    setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    onSync: () => void;
    isSyncing: boolean;
    activeTab: 'mapping' | 'shortfall';
    setActiveTab: (tab: 'mapping' | 'shortfall') => void;
}

const inputClassName = "mt-1 block w-full rounded-lg border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-partners-green focus:ring-partners-green sm:text-sm py-3 px-3";

// Modal for creating new item
const CreateItemModal = ({ onClose, onSave, uniqueChannels }: { onClose: () => void, onSave: (data: any) => void, uniqueChannels: string[] }) => {
    const [formData, setFormData] = useState({
        channel: uniqueChannels[0] || 'Blinkit',
        articleCode: '',
        sku: '',
        spIncTax: ''
    });

    const handleSubmit = () => {
        if (!formData.articleCode || !formData.sku || !formData.spIncTax) return;
        onSave({
            ...formData,
            spIncTax: parseFloat(formData.spIncTax)
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Create New Inventory Mapping</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Channel</label>
                        <select 
                            className={inputClassName}
                            value={formData.channel}
                            onChange={e => setFormData({...formData, channel: e.target.value})}
                        >
                            <option value="Blinkit">Blinkit</option>
                            <option value="Zepto">Zepto</option>
                            <option value="Swiggy Instamart">Swiggy Instamart</option>
                            <option value="Flipkart Minutes">Flipkart Minutes</option>
                            <option value="Hamleys">Hamleys</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Channel SKU (Article Code)</label>
                        <input 
                            type="text" 
                            className={inputClassName}
                            value={formData.articleCode}
                            onChange={e => setFormData({...formData, articleCode: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Master SKU (EasyEcom)</label>
                        <input 
                            type="text" 
                            className={inputClassName}
                            placeholder="e.g. 1030500"
                            value={formData.sku}
                            onChange={e => setFormData({...formData, sku: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Selling Price</label>
                        <input 
                            type="number" 
                            className={inputClassName}
                            value={formData.spIncTax}
                            onChange={e => setFormData({...formData, spIncTax: e.target.value})}
                        />
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-partners-green border border-transparent rounded-md hover:bg-green-700">Create</button>
                </div>
            </div>
        </div>
    );
};

const InventoryManager: React.FC<InventoryManagerProps> = ({ addLog, inventoryItems, purchaseOrders, setInventoryItems, onSync, isSyncing, activeTab, setActiveTab }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChannel, setSelectedChannel] = useState<string>('All Channels');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isInternalSyncing, setIsInternalSyncing] = useState(false);
    
    // Price Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');

    // --- Aggregated Shortfall Logic (By Master SKU, with Channel Columns) ---
    const { shortfallData, shortfallChannels } = useMemo(() => {
        const skuMap: Record<string, { sku: string, itemName: string, stock: number, totalShortfall: number, channelShortfalls: Record<string, number> }> = {};
        const channelsWithShortfall = new Set<string>();
        
        // 1. Initialize with current inventory stock
        inventoryItems.forEach(item => {
            const sku = String(item.sku).trim();
            if (!skuMap[sku]) {
                skuMap[sku] = { sku, itemName: item.itemName, stock: item.stock, totalShortfall: 0, channelShortfalls: {} };
            } else {
                // Take highest reported stock for the master SKU across channels
                skuMap[sku].stock = Math.max(skuMap[sku].stock, item.stock);
                if (item.itemName && item.itemName !== 'Syncing...') skuMap[sku].itemName = item.itemName;
            }
        });

        // 2. Calculate shortfall only from POs in "New", "Waiting", or "Confirmed" section
        const newPOStatuses = [POStatus.NewPO, POStatus.WaitingForConfirmation, POStatus.ConfirmedToSend];
        
        purchaseOrders.forEach(po => {
            if (!newPOStatuses.includes(po.status)) return;
            
            (po.items || []).forEach(item => {
                if (!item.eeOrderRefId && (item.itemStatus || '').toLowerCase() !== 'cancelled') {
                    const sku = String(item.masterSku || item.articleCode).trim();
                    const shortfall = Math.max(0, (item.qty || 0) - (item.fulfillableQty || 0));
                    
                    if (shortfall > 0) {
                        const channel = po.channel || 'Unknown';
                        channelsWithShortfall.add(channel);

                        if (!skuMap[sku]) {
                            skuMap[sku] = { sku, itemName: item.itemName || 'Unknown Item', stock: 0, totalShortfall: 0, channelShortfalls: {} };
                        }
                        skuMap[sku].totalShortfall += shortfall;
                        skuMap[sku].channelShortfalls[channel] = (skuMap[sku].channelShortfalls[channel] || 0) + shortfall;
                    }
                }
            });
        });

        const data = Object.values(skuMap).filter(item => item.totalShortfall > 0).sort((a, b) => b.totalShortfall - a.totalShortfall);
        return { shortfallData: data, shortfallChannels: Array.from(channelsWithShortfall).sort() };
    }, [inventoryItems, purchaseOrders]);

    const inventoryStats = useMemo(() => {
        const totalMappings = inventoryItems.length;
        const lowStockCount = inventoryItems.filter(i => i.stock < 50).length;
        const totalShortfallUnits = shortfallData.reduce((acc, item) => acc + item.totalShortfall, 0);
        const shortfallSkus = shortfallData.length;

        return { totalMappings, lowStockCount, totalShortfallUnits, shortfallSkus };
    }, [inventoryItems, shortfallData]);

    const filteredInventory = useMemo(() => {
        return inventoryItems.filter(item => {
            const matchesSearch = 
                (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (item.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.articleCode || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesChannel = selectedChannel === 'All Channels' || item.channel === selectedChannel;
            return matchesSearch && matchesChannel;
        });
    }, [inventoryItems, searchQuery, selectedChannel]);

    const filteredShortfall = useMemo(() => {
        return shortfallData.filter(item => 
            item.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [shortfallData, searchQuery]);

    const uniqueChannels = useMemo(() => {
        return ['All Channels', ...Array.from(new Set(inventoryItems.map(item => item.channel)))];
    }, [inventoryItems]);

    const handleInternalSync = async () => {
        setIsInternalSyncing(true);
        addLog('Inventory Sync', 'Triggering Master SKU inventory update...');
        try {
            const result = await syncInventoryFromEasyEcom();
            if (result.status === 'success') {
                addLog('Inventory Sync', 'EasyEcom inventory fetch complete.');
                onSync();
            } else {
                alert('Sync failed: ' + result.message);
            }
        } catch (e) {
            addLog('Sync Error', 'Network failure during inventory sync');
        } finally {
            setIsInternalSyncing(false);
        }
    };

    const handleCreateItem = async (newItem: any) => {
        setShowCreateModal(false);
        addLog('Create Item', `Creating mapping for ${newItem.articleCode}`);
        try {
            const result = await createInventoryItem(newItem);
            if (result && result.status === 'success') {
                onSync();
            }
        } catch (e) {
            addLog('Error', 'Failed to create item mapping');
        }
    };

    const savePrice = async (item: InventoryItem) => {
        if (!editPrice) return;
        const newPrice = parseFloat(editPrice);
        setEditingId(null);
        try {
            const result = await updateInventoryPrice(item.channel, item.articleCode, newPrice);
            if (result && result.status === 'success') {
                setInventoryItems(prev => prev.map(i => i.id === item.id ? { ...i, spIncTax: newPrice } : i));
                addLog('Update Price', `Updated price for ${item.articleCode} to ₹${newPrice}`);
            }
        } catch (e) {
            alert('Failed to save updated price');
        }
    };

    const totalLoading = isSyncing || isInternalSyncing;

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
            {showCreateModal && (
                <CreateItemModal 
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateItem}
                    uniqueChannels={uniqueChannels.filter(c => c !== 'All Channels')}
                />
            )}

            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Inventory & Mapping</h1>
                    <p className="text-gray-500 mt-1">Manage SKU mappings and track procurement shortfalls from new orders.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        New Mapping
                    </button>
                    <button 
                        onClick={handleInternalSync}
                        disabled={totalLoading}
                        className={`flex items-center gap-2 px-4 py-2.5 bg-partners-green text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm ${totalLoading ? 'opacity-75 cursor-wait' : ''}`}
                    >
                        <RefreshIcon className={`h-4 w-4 ${totalLoading ? 'animate-spin' : ''}`} />
                        {totalLoading ? 'Syncing...' : 'Sync Stock'}
                    </button>
                </div>
            </header>

            {/* Sub Tabs */}
            <div className="flex gap-6 border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('mapping')}
                    className={`pb-3 text-sm font-bold transition-all border-b-2 px-2 ${activeTab === 'mapping' ? 'border-partners-green text-partners-green' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Item Mappings <span className="ml-1 opacity-60">({inventoryStats.totalMappings})</span>
                </button>
                <button 
                    onClick={() => setActiveTab('shortfall')}
                    className={`pb-3 text-sm font-bold transition-all border-b-2 px-2 flex items-center gap-2 ${activeTab === 'shortfall' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Shortfall Analysis
                    {inventoryStats.shortfallSkus > 0 && (
                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200">{inventoryStats.shortfallSkus}</span>
                    )}
                </button>
            </div>

            {/* KPI Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Mappings</p>
                    <p className="text-2xl font-black text-gray-800 mt-1">{inventoryStats.totalMappings}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-amber-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Low Stock Alert</p>
                    <p className="text-2xl font-black text-amber-600 mt-1">{inventoryStats.lowStockCount}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Shortfall Units (New POs)</p>
                    <p className="text-2xl font-black text-red-600 mt-1">{inventoryStats.totalShortfallUnits}</p>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-purple-500">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Critical SKUs</p>
                    <p className="text-2xl font-black text-purple-600 mt-1">{inventoryStats.shortfallSkus}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder={activeTab === 'mapping' ? "Search SKU, Item Name, Article..." : "Search Master SKU or Item..."}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-partners-green sm:text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {activeTab === 'mapping' && (
                        <div className="flex items-center gap-2">
                            <FilterIcon className="h-4 w-4 text-gray-500" />
                            <select 
                                value={selectedChannel} 
                                onChange={(e) => setSelectedChannel(e.target.value)}
                                className="block w-48 pl-3 pr-10 py-2 text-base border-gray-200 focus:outline-none focus:ring-partners-green sm:text-sm rounded-lg"
                            >
                                {uniqueChannels.map(channel => (
                                    <option key={channel} value={channel}>{channel}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'mapping' ? (
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-[11px] text-gray-400 uppercase bg-gray-50 border-b border-gray-200 font-bold tracking-wider">
                                <tr>
                                    <th scope="col" className="px-6 py-4">Channel</th>
                                    <th scope="col" className="px-6 py-4">Article Code</th>
                                    <th scope="col" className="px-6 py-4">Master SKU</th>
                                    <th scope="col" className="px-6 py-4">Item Name</th>
                                    <th scope="col" className="px-6 py-4 text-right">MRP</th>
                                    <th scope="col" className="px-6 py-4 text-right">Stock</th>
                                    <th scope="col" className="px-6 py-4 text-right">Selling Price</th>
                                    <th scope="col" className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInventory.length === 0 ? (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-500 italic">No mappings found.</td></tr>
                                ) : (
                                    filteredInventory.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${
                                                    item.channel === 'Blinkit' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                    item.channel === 'Zepto' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                    item.channel === 'Swiggy Instamart' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {item.channel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-400">{item.articleCode}</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{item.sku}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.itemName}</div>
                                                <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.ean}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-gray-400">₹{item.mrp}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`font-bold ${item.stock < 50 ? 'text-red-600' : 'text-emerald-600'}`}>{item.stock}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-blue-800">
                                                {editingId === item.id ? (
                                                    <input 
                                                        type="number"
                                                        className="w-20 p-1 border rounded text-right font-bold text-sm"
                                                        value={editPrice}
                                                        onChange={e => setEditPrice(e.target.value)}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    `₹${item.spIncTax}`
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {editingId === item.id ? (
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><XCircleIcon className="h-5 w-5"/></button>
                                                        <button onClick={() => savePrice(item)} className="text-green-500 hover:text-green-700"><CheckCircleIcon className="h-5 w-5"/></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setEditingId(item.id); setEditPrice(item.spIncTax.toString()); }} className="text-gray-400 hover:text-blue-600 transition-colors p-2 hover:bg-gray-100 rounded-lg">
                                                        <PencilIcon className="h-4 w-4"/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        // Shortfall Analysis Table (Dynamic Channel Columns)
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-[11px] text-gray-400 uppercase bg-gray-50 border-b border-gray-200 font-bold tracking-wider">
                                <tr>
                                    <th scope="col" className="px-6 py-4 sticky left-0 bg-gray-50 z-10">Master SKU</th>
                                    <th scope="col" className="px-6 py-4">Item Name</th>
                                    <th scope="col" className="px-6 py-4 text-right">Available Stock</th>
                                    {shortfallChannels.map(channel => (
                                        <th key={channel} scope="col" className="px-4 py-4 text-center border-l border-gray-100 bg-gray-50/50">{channel}</th>
                                    ))}
                                    <th scope="col" className="px-6 py-4 text-right text-red-600 border-l border-gray-100 bg-red-50/30">Total Shortfall</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredShortfall.length === 0 ? (
                                    <tr><td colSpan={4 + shortfallChannels.length} className="px-6 py-20 text-center text-gray-500 italic flex flex-col items-center gap-2"><CheckCircleIcon className="h-10 w-10 text-emerald-500" /><p>No shortfall detected in new purchase orders.</p></td></tr>
                                ) : (
                                    filteredShortfall.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-red-50/10 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900 sticky left-0 bg-white z-10 group-hover:bg-gray-50 border-r border-gray-50">{item.sku}</td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900 line-clamp-1">{item.itemName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <span className={`font-bold ${item.stock <= 0 ? 'text-red-500' : 'text-gray-700'}`}>{item.stock}</span>
                                            </td>
                                            {shortfallChannels.map(channel => {
                                                const val = item.channelShortfalls[channel] || 0;
                                                return (
                                                    <td key={channel} className="px-4 py-4 text-center border-l border-gray-50 whitespace-nowrap">
                                                        {val > 0 ? (
                                                            <span className="text-red-500 font-bold">{val}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-4 whitespace-nowrap text-right border-l border-red-50 bg-red-50/10">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-black text-red-600 text-base">{item.totalShortfall}</span>
                                                    <span className="text-[8px] font-bold text-red-400 uppercase tracking-tighter">Units Needed</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase flex justify-between items-center tracking-widest">
                    <span>{activeTab === 'mapping' ? `Total Mappings: ${filteredInventory.length}` : `Pending Shortfalls: ${filteredShortfall.length} SKUs`}</span>
                    <span>Last Synced: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};

export default InventoryManager;