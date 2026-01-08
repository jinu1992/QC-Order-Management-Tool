
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem } from '../types';
import { SearchIcon, FilterIcon, RefreshIcon, CubeIcon, PlusIcon, CheckCircleIcon, XCircleIcon, PencilIcon } from './icons/Icons';
import { createInventoryItem, updateInventoryPrice } from '../services/api';

interface InventoryManagerProps {
    addLog: (action: string, details: string) => void;
    inventoryItems: InventoryItem[];
    setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    onSync: () => void;
    isSyncing: boolean;
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
                        <p className="text-xs text-red-500 mt-1">Cannot be changed after creation.</p>
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

const InventoryManager: React.FC<InventoryManagerProps> = ({ addLog, inventoryItems, setInventoryItems, onSync, isSyncing }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChannel, setSelectedChannel] = useState<string>('All Channels');
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // Price Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editPrice, setEditPrice] = useState<string>('');

    const uniqueChannels = useMemo(() => {
        return ['All Channels', ...Array.from(new Set(inventoryItems.map(item => item.channel)))];
    }, [inventoryItems]);

    const filteredInventory = useMemo(() => {
        return inventoryItems.filter(item => {
            const matchesSearch = 
                (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                (item.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.articleCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(item.ean || '').includes(searchQuery);
            const matchesChannel = selectedChannel === 'All Channels' || item.channel === selectedChannel;
            return matchesSearch && matchesChannel;
        });
    }, [inventoryItems, searchQuery, selectedChannel]);

    const handleCreateItem = async (newItem: any) => {
        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        const newInventoryItem: InventoryItem = {
            id: tempId,
            ...newItem,
            ean: 'Syncing...',
            itemName: 'Syncing...',
            mrp: 0,
            basicPrice: 0,
            stock: 0
        };

        setInventoryItems(prev => [newInventoryItem, ...prev]);
        setShowCreateModal(false);
        addLog('Create Item', `Creating mapping for ${newItem.articleCode}`);

        try {
            const result = await createInventoryItem(newItem);
            if (result && result.status === 'success') {
                addLog('Success', 'Item saved to database. Refreshing...');
                onSync(); // Refresh to get real ID and EasyEcom details
            } else {
                addLog('Error', 'Failed to save item to database.');
            }
        } catch (e) {
            console.error(e);
            addLog('Error', 'Network error creating item.');
        }
    };

    const startEditing = (item: InventoryItem) => {
        setEditingId(item.id);
        setEditPrice(item.spIncTax.toString());
    };

    const savePrice = async (item: InventoryItem) => {
        if (!editPrice) return;
        const newPrice = parseFloat(editPrice);
        
        // Optimistic Update
        setInventoryItems(prev => prev.map(i => i.id === item.id ? { ...i, spIncTax: newPrice } : i));
        setEditingId(null);
        addLog('Update Price', `Updating price for ${item.articleCode} to ${newPrice}`);

        try {
            const result = await updateInventoryPrice(item.channel, item.articleCode, newPrice);
            if (result && result.status !== 'success') {
                 addLog('Error', 'Failed to update price in database.');
                 // Revert if needed, but simple alert for now
                 alert('Failed to save price to Google Sheet');
            }
        } catch (e) {
            console.error(e);
            alert('Network error saving price');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
            {showCreateModal && (
                <CreateItemModal 
                    onClose={() => setShowCreateModal(false)}
                    onSave={handleCreateItem}
                    uniqueChannels={uniqueChannels.filter(c => c !== 'All Channels')}
                />
            )}

            <header className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
                    <p className="text-gray-500 mt-1">View channel SKU mappings and real-time stock levels synced from EasyEcom.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Create New Item
                    </button>
                    <button 
                        onClick={onSync}
                        disabled={isSyncing}
                        className={`flex items-center gap-2 px-4 py-2.5 bg-partners-green text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm ${isSyncing ? 'opacity-75 cursor-wait' : ''}`}
                    >
                        <RefreshIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Data'}
                    </button>
                </div>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by SKU, Item Name, EAN..."
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:placeholder-gray-300 focus:border-partners-green focus:ring-1 focus:ring-partners-green sm:text-sm transition duration-150 ease-in-out"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <FilterIcon className="h-4 w-4 text-gray-500" />
                        <select 
                            value={selectedChannel} 
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="block w-48 pl-3 pr-10 py-2 text-base border-gray-200 focus:outline-none focus:ring-partners-green focus:border-partners-green sm:text-sm rounded-lg"
                        >
                            {uniqueChannels.map(channel => (
                                <option key={channel} value={channel}>{channel}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-semibold">Channel</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Channel SKU (Article)</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Master SKU</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Item Name</th>
                                <th scope="col" className="px-6 py-3 font-semibold text-right">MRP</th>
                                <th scope="col" className="px-6 py-3 font-semibold text-right">Stock</th>
                                <th scope="col" className="px-6 py-3 font-semibold text-right">Selling Price</th>
                                <th scope="col" className="px-6 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <CubeIcon className="h-10 w-10 text-gray-300 mb-2" />
                                            <p>{isSyncing ? 'Loading data...' : 'No inventory items found matching your filters.'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredInventory.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                item.channel === 'Blinkit' ? 'bg-yellow-100 text-yellow-800' :
                                                item.channel === 'Zepto' ? 'bg-purple-100 text-purple-800' :
                                                item.channel === 'Swiggy Instamart' ? 'bg-orange-100 text-orange-800' :
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {item.channel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-500">{item.articleCode}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 bg-gray-50 select-all" title="Mapped - Cannot Change">
                                            {item.sku}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 line-clamp-2" title={item.itemName}>{item.itemName}</div>
                                            <div className="text-xs text-gray-400 mt-0.5">EAN: {item.ean}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">₹{item.mrp}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className={`font-bold ${item.stock < 50 ? 'text-red-600' : 'text-green-600'}`}>
                                                {item.stock}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-blue-800">
                                            {editingId === item.id ? (
                                                <input 
                                                    type="number"
                                                    className="w-20 p-1 border rounded text-right focus:ring-partners-green focus:border-partners-green"
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
                                                <button onClick={() => startEditing(item)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Edit Price">
                                                    <PencilIcon className="h-4 w-4"/>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
                    <span>Showing {filteredInventory.length} items</span>
                    <span>Last Synced: {new Date().toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    );
};

export default InventoryManager;
