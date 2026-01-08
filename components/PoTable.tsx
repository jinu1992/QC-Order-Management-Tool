import React, { useState, useEffect, Fragment, useMemo, useRef } from 'react';
import { POStatus, type PurchaseOrder, POItem, InventoryItem } from '../types';
import StatusBadge from './StatusBadge';
import { 
    DotsVerticalIcon, 
    ChevronDownIcon, 
    ChevronRightIcon, 
    CloudDownloadIcon, 
    CubeIcon, 
    CheckCircleIcon, 
    UploadIcon, 
    XCircleIcon, 
    InfoIcon, 
    CalendarIcon, 
    PaperclipIcon, 
    BuildingIcon, 
    RefreshIcon, 
    SearchIcon, 
    FilterIcon 
} from './icons/Icons';
import { pushToEasyEcom, requestZohoSync } from '../services/api';

interface PoTableProps {
    activeFilter: string;
    setActiveFilter: (filter: string) => void;
    purchaseOrders: PurchaseOrder[];
    setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
    tabCounts: { [key: string]: number };
    addLog: (action: string, details: string) => void;
    addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    onSync: () => void;
    isSyncing: boolean;
    inventoryItems?: InventoryItem[];
}

const parseDate = (dateStr: string): number => {
    try {
        if (!dateStr) return 0;
        const parts = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)/);
        if (parts && parts.length === 4) {
            const day = parts[1];
            const month = parts[2];
            let year = parts[3];
            if (year.length === 2) year = '20' + year;
            return new Date(`${day} ${month} ${year}`).getTime();
        }
        return new Date(dateStr).getTime() || 0;
    } catch (e) { return 0; }
};

const getCalculatedStatus = (po: PurchaseOrder): POStatus => {
    const items = po.items || [];
    if (po.status === POStatus.Cancelled) return POStatus.Cancelled;
    const pushedCount = items.filter(i => !!i.eeOrderRefId).length;
    if (items.length > 0 && pushedCount === items.length) return POStatus.Pushed;
    if (pushedCount > 0) return POStatus.PartiallyProcessed;
    return POStatus.NewPO;
};

const PoTable: React.FC<PoTableProps> = ({ 
    activeFilter, 
    setActiveFilter, 
    purchaseOrders, 
    tabCounts, 
    onSync, 
    isSyncing, 
    addLog, 
    addNotification 
}) => {
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [selectedPoItems, setSelectedPoItems] = useState<{ [key: string]: string[] }>({});
    const [pushingToEasyEcom, setPushingToEasyEcom] = useState<{ [key: string]: boolean }>({});
    const [isSyncingZoho, setIsSyncingZoho] = useState<string | null>(null);

    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    const tabs = [
        { name: 'New POs' },
        { name: 'Pushed POs' },
        { name: 'Partially Pushed POs' },
        { name: 'Cancelled POs' },
        { name: 'All POs' }
    ];

    const uniqueChannels = useMemo(() => Array.from(new Set(purchaseOrders.map(p => p.channel))), [purchaseOrders]);

    const processedOrders = useMemo(() => {
        let orders = [...purchaseOrders];

        if (activeFilter !== 'All POs') {
            orders = orders.filter(po => {
                const status = getCalculatedStatus(po);
                if (activeFilter === 'New POs') return status === POStatus.NewPO;
                if (activeFilter === 'Pushed POs') return status === POStatus.Pushed;
                if (activeFilter === 'Partially Pushed POs') return status === POStatus.PartiallyProcessed;
                if (activeFilter === 'Cancelled POs') return status === POStatus.Cancelled;
                return true;
            });
        }

        Object.keys(columnFilters).forEach(key => {
            const val = columnFilters[key].toLowerCase();
            if (!val) return;
            orders = orders.filter(po => String((po as any)[key] || '').toLowerCase().includes(val));
        });

        orders.sort((a, b) => parseDate(b.orderDate) - parseDate(a.orderDate));
        return orders;
    }, [activeFilter, purchaseOrders, columnFilters]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setActiveFilterColumn(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleRowExpansion = (poId: string) => setExpandedRowId(expandedRowId === poId ? null : poId);

    const handleItemSelect = (poId: string, articleCode: string) => {
        setSelectedPoItems(prev => {
            const currentSelected = prev[poId] || [];
            const isSelected = currentSelected.includes(articleCode);
            return { 
                ...prev, 
                [poId]: isSelected ? currentSelected.filter(code => code !== articleCode) : [...currentSelected, articleCode] 
            };
        });
    };

    const handleSelectAllItems = (po: PurchaseOrder) => {
        const selectableArticleCodes = (po.items || [])
            .filter(i => !i.eeOrderRefId && (i.fulfillableQty ?? 0) >= i.qty)
            .map(item => item.articleCode);
        const currentSelected = selectedPoItems[po.id] || [];
        const allSelected = selectableArticleCodes.length > 0 && currentSelected.length === selectableArticleCodes.length;
        setSelectedPoItems(prev => ({ ...prev, [po.id]: allSelected ? [] : selectableArticleCodes }));
    };

    const handlePushToEasyEcomAction = async (po: PurchaseOrder) => {
        const selected = selectedPoItems[po.id] || [];
        if (selected.length === 0) return;
        setPushingToEasyEcom(prev => ({ ...prev, [po.id]: true }));
        try {
            const res = await pushToEasyEcom(po, selected);
            if (res.status === 'success') {
                addNotification(res.message, 'success');
                addLog('EasyEcom Sync', `Pushed ${selected.length} items from PO ${po.poNumber} to EasyEcom.`);
                setSelectedPoItems(prev => ({ ...prev, [po.id]: [] }));
                onSync();
            } else { addNotification('Failed: ' + res.message, 'error'); }
        } catch (e) { addNotification('Network error pushing to EasyEcom', 'error'); }
        finally { setPushingToEasyEcom(prev => ({ ...prev, [po.id]: false })); }
    };

    const handleSyncZohoToEE = async (po: PurchaseOrder) => {
        if (!po.zohoContactId) { addNotification('Missing Zoho Contact ID for this order.', 'warning'); return; }
        setIsSyncingZoho(po.id);
        try {
            const res = await requestZohoSync(po.zohoContactId);
            if (res.status === 'success') {
                addNotification('Zoho Contact mapped to EasyEcom successfully', 'success');
                addLog('Customer Sync', `Mapped Zoho Contact ${po.zohoContactId}`);
                onSync();
            } else { addNotification(`Backend Error: ${res.message}`, 'error'); }
        } catch (e: any) { addNotification(`Sync Exception: ${e.message}`, 'error'); }
        finally { setIsSyncingZoho(null); }
    };

    const getPrimaryAction = (po: PurchaseOrder) => {
        const status = getCalculatedStatus(po);
        if (status === POStatus.Cancelled) return { label: 'Cancelled', color: 'bg-gray-100 text-gray-400 border-gray-200', onClick: () => {} };
        if (status === POStatus.Pushed) return { label: 'Track in Sales', color: 'bg-partners-blue text-white hover:bg-blue-700', onClick: () => addNotification('Navigate to Sales Orders to track fulfillment.', 'info') };
        if (!po.eeCustomerId) return { label: 'Sync Zoho', color: 'bg-indigo-600 text-white hover:bg-indigo-700', onClick: () => handleSyncZohoToEE(po) };
        if (status === POStatus.NewPO || status === POStatus.PartiallyProcessed) return { label: 'Push to EE', color: 'bg-partners-green text-white hover:bg-green-700', onClick: () => toggleRowExpansion(po.id) };
        return { label: 'View Details', color: 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100', onClick: () => toggleRowExpansion(po.id) };
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map(tab => (
                        <button key={tab.name} onClick={() => setActiveFilter(tab.name)}
                            className={`px-3 py-1.5 text-sm font-semibold rounded-full border transition-colors ${
                                activeFilter === tab.name ? 'bg-partners-green text-white border-partners-green' : 'bg-white text-gray-600 border-partners-border hover:bg-gray-50'
                            }`}
                        >
                            {tab.name} {tabCounts[tab.name] > 0 && <span className="ml-1 text-xs opacity-80">({tabCounts[tab.name]})</span>}
                        </button>
                    ))}
                </div>
                <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                    <CloudDownloadIcon className={`h-4 w-4 ${isSyncing ? 'animate-bounce' : ''}`} /> Sync Data
                </button>
            </div>

            <div className="mt-6 overflow-x-auto border border-gray-100 rounded-xl shadow-inner max-h-[70vh]">
                <table className="w-full text-sm text-left text-gray-600 border-collapse">
                    <thead className="text-[11px] text-gray-500 uppercase bg-gray-50/95 border-b border-gray-100 sticky top-0 z-20">
                        <tr>
                            <th className="p-4 w-4 sticky left-0 bg-gray-50 z-30 border-r border-gray-100"></th>
                            <th className="px-6 py-4 sticky left-12 bg-gray-50 z-30 border-r border-gray-100 group min-w-[150px]">
                                <div className="flex items-center gap-2">
                                    PO Number
                                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'poNumber' ? null : 'poNumber')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.poNumber ? 'text-partners-green' : 'text-gray-400'}`}><SearchIcon className="h-3 w-3"/></button>
                                </div>
                                {activeFilterColumn === 'poNumber' && (
                                    <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case">
                                        <input type="text" autoFocus placeholder="Search PO..." className="w-full px-3 py-1.5 text-xs border rounded-md focus:ring-1 focus:ring-partners-green" value={columnFilters.poNumber || ''} onChange={(e) => setColumnFilters({...columnFilters, poNumber: e.target.value})} />
                                    </div>
                                )}
                            </th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 min-w-[140px]">
                                <div className="flex items-center gap-2">
                                    Channel
                                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'channel' ? null : 'channel')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.channel ? 'text-partners-green' : 'text-gray-400'}`}><FilterIcon className="h-3 w-3"/></button>
                                </div>
                                {activeFilterColumn === 'channel' && (
                                    <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case">
                                        <select className="w-full px-2 py-1.5 text-xs border rounded-md" value={columnFilters.channel || ''} onChange={(e) => setColumnFilters({...columnFilters, channel: e.target.value})}>
                                            <option value="">All Channels</option>
                                            {uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                            </th>
                            <th className="px-6 py-4 min-w-[120px]">
                                <div className="flex items-center gap-2">
                                    Store
                                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'storeCode' ? null : 'storeCode')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.storeCode ? 'text-partners-green' : 'text-gray-400'}`}><SearchIcon className="h-3 w-3"/></button>
                                </div>
                                {activeFilterColumn === 'storeCode' && (
                                    <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case">
                                        <input type="text" autoFocus placeholder="Filter Store..." className="w-full px-3 py-1.5 text-xs border rounded-md" value={columnFilters.storeCode || ''} onChange={(e) => setColumnFilters({...columnFilters, storeCode: e.target.value})} />
                                    </div>
                                )}
                            </th>
                            <th className="px-6 py-4">Qty / Total (Inc. 5% GST)</th>
                            <th className="px-6 py-4">Order Date</th>
                            <th className="px-6 py-4 text-center sticky right-0 bg-gray-50 z-30 border-l border-gray-100 min-w-[200px]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50">
                        {processedOrders.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">No purchase orders found matching your criteria.</td></tr>
                        ) : (
                        processedOrders.map((po) => {
                            const isExpanded = expandedRowId === po.id;
                            const poSelectedItems = selectedPoItems[po.id] || [];
                            const items = po.items || [];
                            const selectableItems = items.filter(i => !i.eeOrderRefId && (i.fulfillableQty ?? 0) >= i.qty);
                            const stockShortageItems = items.filter(i => !i.eeOrderRefId && (i.fulfillableQty ?? 0) < i.qty);
                            const allSelectableSelected = selectableItems.length > 0 && poSelectedItems.length === selectableItems.length;
                            const poStatus = getCalculatedStatus(po);
                            const amountIncTax = po.amount * 1.05;
                            const action = getPrimaryAction(po);

                            return (
                                <Fragment key={po.id}>
                                    <tr className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${isExpanded ? 'bg-partners-light-green/30' : 'bg-white'}`} onClick={() => toggleRowExpansion(po.id)}>
                                        <td className="p-4 text-center sticky left-0 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                                            <div className="text-gray-400 hover:text-partners-green transition-colors">
                                                {isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-partners-green whitespace-nowrap sticky left-12 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{po.poNumber}</td>
                                        <td className="px-6 py-4"><StatusBadge status={poStatus} /></td>
                                        <td className="px-6 py-4 font-medium text-gray-700">{po.channel}</td>
                                        <td className="px-6 py-4 text-gray-500">{po.storeCode}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{po.qty} / ₹{amountIncTax.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-400">{po.orderDate}</td>
                                        <td className="px-6 py-4 text-center sticky right-0 z-10 bg-inherit border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.02)]" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                                                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap ${action.color}`}
                                                >
                                                    {action.label}
                                                </button>
                                                <button className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-full transition-colors"><DotsVerticalIcon className="h-4 w-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-50/50">
                                            <td colSpan={8} className="px-4 py-8 sm:px-12">
                                                <div className="bg-white border border-partners-border rounded-xl p-6 space-y-6 shadow-sm ring-1 ring-black/5">
                                                    <div className="pb-6 border-b border-gray-100">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-blue-500" /> Fulfillment Ref</h4>
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                            <div><p className="text-[10px] uppercase font-bold text-gray-400">PO Ref</p><p className="text-xs font-bold text-partners-green truncate">{po.poNumber}</p></div>
                                                            <div><p className="text-[10px] uppercase font-bold text-gray-400">PO Date</p><p className="text-xs font-bold text-gray-700">{po.orderDate || 'N/A'}</p></div>
                                                            <div><p className="text-[10px] uppercase font-bold text-gray-400">EasyEcom Cust ID</p><p className={`text-xs font-bold ${po.eeCustomerId ? 'text-blue-600' : 'text-red-500 italic'}`}>{po.eeCustomerId || 'Not Mapped'}</p></div>
                                                            <div><p className="text-[10px] uppercase font-bold text-gray-400">Expiry Date</p><p className="text-xs font-bold text-red-600">{po.poExpiryDate || 'N/A'}</p></div>
                                                            <div><p className="text-[10px] uppercase font-bold text-gray-400">PO PDF</p>{po.poPdfUrl ? <a href={po.poPdfUrl} target="_blank" rel="noopener noreferrer" className="text-partners-green hover:underline flex items-center gap-1 text-xs font-bold mt-0.5"><PaperclipIcon className="h-3 w-3" /> View PO PDF</a> : <p className="text-xs text-gray-300 font-bold italic mt-0.5">Not Uploaded</p>}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2"><CubeIcon className="h-4 w-4 text-partners-green" /> Item List & Stock Status</h4>
                                                        <div className="flex items-center gap-3">
                                                             <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">{selectableItems.length} Ready to Push</span>
                                                        </div>
                                                    </div>
                                                    <div className="overflow-x-auto border border-gray-100 rounded-lg">
                                                        <table className="w-full text-xs text-left">
                                                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-tight">
                                                                <tr>
                                                                    <th className="py-3 w-8 text-center"><input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-partners-green focus:ring-partners-green cursor-pointer disabled:opacity-30" checked={allSelectableSelected} onChange={() => handleSelectAllItems(po)} disabled={selectableItems.length === 0 || poStatus === POStatus.Cancelled}/></th>
                                                                    <th className="py-3 px-3">Item Name / SKU</th>
                                                                    <th className="py-3 text-right">PO Qty</th>
                                                                    <th className="py-3 text-right">Fulfillable</th>
                                                                    <th className="py-3 px-3 text-center">Price Check</th>
                                                                    <th className="py-3 text-right">Unit Cost (Inc. 5% Tax)</th>
                                                                    <th className="py-3 text-center">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {items.map((item, idx) => {
                                                                    const isMismatch = item.priceCheckStatus === 'Mismatch';
                                                                    const isPushed = !!item.eeOrderRefId;
                                                                    const isFullyFulfillable = (item.fulfillableQty ?? 0) >= item.qty;
                                                                    const isPartiallyFulfillable = !isFullyFulfillable && (item.fulfillableQty ?? 0) > 0;
                                                                    const isOutOfStock = (item.fulfillableQty ?? 0) === 0;
                                                                    const unitPriceIncTax = ((item.unitCost || 0) * 1.05).toFixed(2);
                                                                    return (
                                                                        <tr key={`${po.id}-item-${idx}`} className={`${isPushed ? 'bg-gray-50/50' : 'hover:bg-gray-50/30'} ${!isPushed && !isFullyFulfillable ? 'bg-orange-50/20' : ''}`}>
                                                                            <td className="py-4 text-center">{isPushed ? <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" /> : <input type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-partners-green focus:ring-partners-green cursor-pointer" checked={poSelectedItems.includes(item.articleCode)} onChange={() => handleItemSelect(po.id, item.articleCode)} disabled={!isFullyFulfillable || poStatus === POStatus.Cancelled}/>}</td>
                                                                            <td className="py-4 px-3"><div className="flex flex-col"><p className={`font-bold ${isPushed ? 'text-gray-400' : 'text-gray-800'}`}>{item.itemName}</p><div className="flex items-center gap-2 mt-0.5"><p className="text-[10px] text-gray-400 truncate max-w-[150px] font-mono">{item.masterSku || item.articleCode}</p>{!isPushed && isPartiallyFulfillable && <span className="text-[8px] font-bold bg-amber-100 text-amber-600 px-1 rounded uppercase">Partial Stock</span>}{!isPushed && isOutOfStock && <span className="text-[8px] font-bold bg-red-100 text-red-600 px-1 rounded uppercase">Stock Out</span>}</div></div></td>
                                                                            <td className={`py-4 text-right font-medium ${isPushed ? 'text-gray-400' : 'text-gray-700'}`}>{item.qty}</td>
                                                                            <td className={`py-4 text-right font-bold ${isPushed ? 'text-gray-400' : isFullyFulfillable ? 'text-green-600' : isPartiallyFulfillable ? 'text-amber-600' : 'text-red-600'}`}>{item.fulfillableQty ?? '0'}</td>
                                                                            <td className="py-4 px-3 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${isMismatch ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>{item.priceCheckStatus || 'OK'}</span></td>
                                                                            <td className={`py-4 text-right font-bold ${isPushed ? 'text-gray-400' : 'text-blue-600'}`}>₹{unitPriceIncTax}</td>
                                                                            <td className="py-4 text-center">{isPushed ? <span className="text-[9px] font-bold text-green-700 bg-green-100/50 px-2 py-0.5 rounded border border-green-200 uppercase">Pushed</span> : poStatus === POStatus.Cancelled ? <span className="text-[9px] font-bold text-gray-500 uppercase">Cancelled</span> : !isFullyFulfillable ? <span className="text-[9px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 uppercase">{isOutOfStock ? 'Shortage' : 'Partial'}</span> : <span className="text-gray-300 text-[10px] font-medium">-</span>}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="flex justify-end pt-4 border-t border-gray-100 items-center gap-4">
                                                        {poStatus === POStatus.Cancelled && (
                                                            <p className="text-sm font-bold text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                                                                This PO has been cancelled and cannot be processed.
                                                            </p>
                                                        )}
                                                        {poStatus !== POStatus.Cancelled && !po.eeCustomerId && (
                                                            <div className="flex flex-col items-end gap-1">
                                                                <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 uppercase tracking-tighter">
                                                                    <InfoIcon className="h-3 w-3"/> Step 1: Mapping Required
                                                                </span>
                                                                <button 
                                                                    onClick={() => handleSyncZohoToEE(po)} 
                                                                    disabled={!!isSyncingZoho} 
                                                                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl transition-all shadow-sm active:scale-95 bg-blue-600 hover:bg-blue-700 shadow-blue-100"
                                                                >
                                                                    {isSyncingZoho === po.id ? <RefreshIcon className="h-4 w-4 animate-spin"/> : <BuildingIcon className="h-4 w-4" />}
                                                                    {isSyncingZoho === po.id ? 'Syncing...' : 'Sync Zoho to EasyEcom'}
                                                                </button>
                                                            </div>
                                                        )}
                                                        {poStatus !== POStatus.Cancelled && po.eeCustomerId && (
                                                            <div className="flex flex-col items-end gap-2">
                                                                {selectableItems.length === 0 && stockShortageItems.length > 0 && (
                                                                    <p className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-md border border-orange-100">
                                                                        Push disabled for items with partial/zero stock.
                                                                    </p>
                                                                )}
                                                                <button 
                                                                    onClick={() => handlePushToEasyEcomAction(po)} 
                                                                    disabled={poSelectedItems.length === 0 || pushingToEasyEcom[po.id]} 
                                                                    className={`flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl transition-all shadow-sm active:scale-95 ${poSelectedItems.length > 0 ? 'bg-partners-green hover:bg-green-700 shadow-green-200' : 'bg-gray-300 cursor-not-allowed grayscale'}`}
                                                                >
                                                                    <UploadIcon className={`h-4 w-4 ${pushingToEasyEcom[po.id] ? 'animate-bounce' : ''}`} />
                                                                    {pushingToEasyEcom[po.id] ? 'Processing...' : `Push ${poSelectedItems.length > 0 ? poSelectedItems.length : ''} Items`}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PoTable;