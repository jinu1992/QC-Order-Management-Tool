
import React, { useState, Fragment, useMemo, FC, useRef, useEffect } from 'react';
import { type PurchaseOrder, type InventoryItem, POItem } from '../types';
import { 
    DotsVerticalIcon, 
    CloudDownloadIcon, 
    ChevronDownIcon, 
    ChevronRightIcon, 
    TruckIcon, 
    CalendarIcon, 
    CheckCircleIcon, 
    CubeIcon, 
    InvoiceIcon, 
    ClipboardListIcon, 
    ExternalLinkIcon, 
    PaperclipIcon, 
    RefreshIcon, 
    PlusIcon, 
    SendIcon, 
    LockClosedIcon, 
    GlobeIcon, 
    InfoIcon,
    XCircleIcon,
    CurrencyIcon,
    SearchIcon,
    FilterIcon
} from './icons/Icons';
import { createZohoInvoice, pushToNimbusPost } from '../services/api';

interface SalesOrderTableProps {
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

interface GroupedSalesOrder {
    id: string;
    poReference: string;
    status: string;
    originalEeStatus: string;
    channel: string;
    storeCode: string;
    orderDate: string;
    poEdd?: string;
    poExpiryDate?: string;
    poPdfUrl?: string;
    qty: number;
    amount: number;
    items: POItem[];
    batchCreatedAt?: string;
    invoiceDate?: string;
    manifestDate?: string;
    invoiceId?: string;
    invoiceStatus?: string;
    invoiceNumber?: string;
    invoiceTotal?: number;
    invoiceUrl?: string;
    invoicePdfUrl?: string;
    carrier?: string;
    awb?: string;
    trackingStatus?: string;
    edd?: string;
    latestStatus?: string;
    latestStatusDate?: string;
    currentLocation?: string;
    deliveredDate?: string;
    rtoStatus?: string;
    rtoAwb?: string;
    boxCount: number;
}

const CopyField = ({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        if (!value || value === 'N/A') return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div onClick={handleCopy} className="flex flex-col gap-1.5 p-3 bg-white border border-gray-200 rounded-xl hover:border-partners-green transition-colors group cursor-pointer active:bg-gray-50 select-none">
            <div className="flex justify-between items-center pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">{icon} {label}</span>
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 group-hover:bg-partners-green group-hover:text-white'}`}>{copied ? 'COPIED!' : 'COPY'}</div>
            </div>
            <p className="text-sm font-bold text-gray-800 break-all pointer-events-none">{value || 'N/A'}</p>
        </div>
    );
};

const BlinkitAppointmentModal: FC<{ so: GroupedSalesOrder, onClose: () => void }> = ({ so, onClose }) => {
    const amountWithTax = (so.amount * 1.05).toFixed(0);
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-partners-gray-bg rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white">
                <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-yellow-100"><span className="font-black italic text-xl">b</span></div>
                        <div><h3 className="text-lg font-bold text-gray-800">Blinkit Appointment Helper</h3><p className="text-xs text-gray-500">Portal: <span className="font-bold text-partners-green">partnersbiz.com</span></p></div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-partners-light-green border-2 border-dashed border-partners-green/30 p-4 rounded-2xl flex gap-4 items-start">
                        <div className="bg-partners-green p-2 rounded-lg text-white"><CalendarIcon className="h-5 w-5" /></div>
                        <div><p className="text-sm font-bold text-partners-green uppercase tracking-tight">Scheduling Instructions</p><p className="text-sm text-gray-700 mt-1 leading-relaxed">Take the <span className="font-bold underline">earliest available slot</span> on the suggested date in the portal.<br/><span className="text-red-600 font-extrabold uppercase">Important: Do not select Sundays.</span></p></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CopyField label="PO Number" value={so.poReference} icon={<ClipboardListIcon className="h-3 w-3"/>} />
                        <CopyField label="Courier Name" value={so.carrier || 'Standard'} icon={<TruckIcon className="h-3 w-3"/>} />
                        <CopyField label="AWB Number" value={so.awb || 'N/A'} icon={<GlobeIcon className="h-3 w-3"/>} />
                        <CopyField label="Invoice Number" value={so.invoiceNumber || 'N/A'} icon={<InvoiceIcon className="h-3 w-3"/>} />
                        <CopyField label="Total Amount (Inc. Tax)" value={`₹${amountWithTax}`} icon={<CurrencyIcon className="h-3 w-3"/>} />
                        <div className="md:col-span-2"><CopyField label="Invoice PDF URL" value={so.invoicePdfUrl || 'N/A'} icon={<ExternalLinkIcon className="h-3 w-3"/>} /></div>
                    </div>
                    <div className="flex flex-col items-center pt-2">
                        <button onClick={() => window.open('https://partnersbiz.com/login', '_blank')} className="w-full py-4 bg-partners-green text-white font-bold rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-95"><ExternalLinkIcon className="h-5 w-5" /> Open Blinkit Partners Portal</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const parseDateString = (dateStr: string): number => {
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

const SalesOrderTable: FC<SalesOrderTableProps> = ({ activeFilter, setActiveFilter, purchaseOrders, onSync, isSyncing, addLog, addNotification }) => {
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState<string | null>(null);
    const [isPushingNimbus, setIsPushingNimbus] = useState<string | null>(null);
    const [blinkitModal, setBlinkitModal] = useState<{ isOpen: boolean, so: GroupedSalesOrder | null }>({ isOpen: false, so: null });
    
    const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    const tabs = [
        { id: 'All POs', name: 'All POs' },
        { id: 'Confirmed', name: 'Confirmed' },
        { id: 'Batch Created', name: 'Batch Created' },
        { id: 'Invoiced', name: 'Invoiced' },
        { id: 'Label Generated', name: 'Label Generated' },
        { id: 'Box Data Upload Pending', name: 'Box Data Pending' },
        { id: 'Shipped', name: 'Shipped' },
        { id: 'RTO', name: 'RTO' },
        { id: 'Closed', name: 'Closed' },
    ];

    const { salesOrders, salesTabCounts } = useMemo(() => {
        const groups: Record<string, GroupedSalesOrder> = {};
        const counts: Record<string, number> = { 'All POs': 0, 'Confirmed': 0, 'Batch Created': 0, 'Invoiced': 0, 'Label Generated': 0, 'Box Data Upload Pending': 0, 'Shipped': 0, 'RTO': 0, 'Closed': 0 };

        purchaseOrders.forEach(po => {
            (po.items || []).forEach(item => {
                const rawRef = item.eeReferenceCode;
                if (!rawRef || String(rawRef).trim() === "") return;
                const refCode = String(rawRef).trim();
                
                const effectiveQty = (item.itemQuantity !== undefined && item.itemQuantity !== 0) ? item.itemQuantity : item.qty;
                const effectiveLineAmount = effectiveQty * (item.unitCost || 0);
                
                const eeBoxCount = Number(item.eeBoxCount || 0);
                const carrier = item.carrier || po.carrier;
                const awb = item.awb || po.awb;
                const trackingStatus = item.trackingStatus || po.trackingStatus;

                const batchDate = item.eeBatchCreatedAt || po.eeBatchCreatedAt;
                const invNum = item.invoiceNumber;
                const maniDate = item.eeManifestDate || po.eeManifestDate;
                const eeStatus = (item.eeOrderStatus || po.eeOrderStatus || 'Processing').trim();
                const effectiveOrderDate = po.eeOrderDate || po.orderDate;
                
                let displayStatus = eeStatus;
                if (maniDate) {
                    displayStatus = 'Shipped';
                } else if (invNum && awb) {
                    displayStatus = 'Label Generated';
                } else if (invNum && eeBoxCount === 0) {
                    displayStatus = 'Box Data Upload Pending';
                } else if (invNum) {
                    displayStatus = 'Invoiced';
                } else if (batchDate) {
                    displayStatus = 'Batch Created';
                } else if (eeStatus.toLowerCase() === 'confirmed' || eeStatus.toLowerCase() === 'open') {
                    displayStatus = 'Confirmed';
                } else if (eeStatus.toLowerCase() === 'closed') {
                    displayStatus = 'Closed';
                }

                if (!groups[refCode]) {
                    groups[refCode] = { 
                        id: refCode, 
                        poReference: String(po.id || ''), 
                        status: displayStatus, 
                        originalEeStatus: eeStatus, 
                        channel: po.channel, 
                        storeCode: po.storeCode, 
                        orderDate: effectiveOrderDate, 
                        poEdd: po.poEdd, 
                        poExpiryDate: po.poExpiryDate, 
                        poPdfUrl: po.poPdfUrl, 
                        qty: 0, 
                        amount: 0, 
                        items: [], 
                        batchCreatedAt: batchDate, 
                        invoiceDate: item.invoiceDate, 
                        manifestDate: maniDate, 
                        invoiceId: item.invoiceId, 
                        invoiceStatus: item.invoiceStatus, 
                        invoiceNumber: invNum, 
                        invoiceTotal: item.invoiceTotal, 
                        invoiceUrl: item.invoiceUrl, 
                        invoicePdfUrl: item.invoicePdfUrl, 
                        carrier: carrier, 
                        awb: awb, 
                        trackingStatus: trackingStatus, 
                        edd: item.edd || po.edd, 
                        latestStatus: item.latestStatus || po.latestStatus, 
                        latestStatusDate: item.latestStatusDate || po.latestStatusDate, 
                        currentLocation: item.currentLocation || po.currentLocation, 
                        deliveredDate: item.deliveredDate || po.deliveredDate, 
                        rtoStatus: item.rtoStatus || po.rtoStatus, 
                        rtoAwb: item.rtoAwb || po.rtoAwb, 
                        boxCount: eeBoxCount
                    };
                } else {
                    const curPo = String(po.id || '');
                    if (!groups[refCode].poReference.includes(curPo)) groups[refCode].poReference += `, ${curPo}`;
                    const statusRank = (s: string) => { 
                        if (s === 'Shipped') return 7; 
                        if (s === 'Label Generated') return 6;
                        if (s === 'Box Data Upload Pending') return 5;
                        if (s === 'Invoiced') return 4; 
                        if (s === 'Batch Created') return 3; 
                        if (s === 'Confirmed') return 2; 
                        return 1; 
                    };
                    if (statusRank(displayStatus) > statusRank(groups[refCode].status)) groups[refCode].status = displayStatus;
                    if (!groups[refCode].batchCreatedAt) groups[refCode].batchCreatedAt = batchDate;
                    if (!groups[refCode].invoiceDate) groups[refCode].invoiceDate = item.invoiceDate;
                    if (!groups[refCode].manifestDate) groups[refCode].manifestDate = maniDate;
                    if (!groups[refCode].invoiceId) groups[refCode].invoiceId = item.invoiceId;
                    if (!groups[refCode].invoiceStatus) groups[refCode].invoiceStatus = item.invoiceStatus;
                    if (!groups[refCode].invoiceNumber) groups[refCode].invoiceNumber = invNum;
                    if (!groups[refCode].invoiceTotal) groups[refCode].invoiceTotal = item.invoiceTotal;
                    if (!groups[refCode].invoiceUrl) groups[refCode].invoiceUrl = item.invoiceUrl;
                    if (!groups[refCode].invoicePdfUrl) groups[refCode].invoicePdfUrl = item.invoicePdfUrl;
                    
                    groups[refCode].boxCount = Math.max(groups[refCode].boxCount, eeBoxCount);
                    
                    if (!groups[refCode].awb && awb) groups[refCode].awb = awb;
                    if (!groups[refCode].carrier && carrier) groups[refCode].carrier = carrier;
                    if (!groups[refCode].trackingStatus && trackingStatus) groups[refCode].trackingStatus = trackingStatus;
                    if (!groups[refCode].edd && item.edd) groups[refCode].edd = item.edd;
                    if (!groups[refCode].deliveredDate && item.deliveredDate) groups[refCode].deliveredDate = item.deliveredDate;
                }
                groups[refCode].items.push(item);
                groups[refCode].qty += effectiveQty;
                groups[refCode].amount += effectiveLineAmount;
            });
        });

        const results = Object.values(groups);
        results.forEach(so => {
            counts['All POs']++;
            if (counts[so.status] !== undefined) counts[so.status]++;
            if (so.rtoStatus) counts['RTO']++;
        });

        let filteredResults = results;
        if (activeFilter !== 'All POs') {
             filteredResults = results.filter(so => {
                 if (activeFilter === 'RTO') return !!so.rtoStatus;
                 return so.status === activeFilter;
             });
        }

        Object.keys(columnFilters).forEach(key => {
            const val = columnFilters[key].toLowerCase();
            if (!val) return;
            filteredResults = filteredResults.filter(so => String((so as any)[key] || '').toLowerCase().includes(val));
        });

        filteredResults.sort((a, b) => parseDateString(b.orderDate) - parseDateString(a.orderDate));
        return { salesOrders: filteredResults, salesTabCounts: counts };
    }, [purchaseOrders, activeFilter, columnFilters]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setActiveFilterColumn(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateZohoInvoiceAction = async (eeRef: string) => {
        setIsCreatingInvoice(eeRef);
        try {
            const res = await createZohoInvoice(eeRef);
            if (res.status === 'success') {
                addNotification(res.message || 'Invoice triggered.', 'success');
                addLog('Invoice Creation', `EE Ref: ${eeRef}`);
                onSync();
            } else {
                addNotification('Error: ' + res.message, 'error');
            }
        } catch (e) {
            addNotification('Network error.', 'error');
        } finally {
            setIsCreatingInvoice(null);
        }
    };

    const handlePushToNimbusAction = async (eeRef: string) => {
        setIsPushingNimbus(eeRef);
        try {
            const res = await pushToNimbusPost(eeRef);
            if (res.status === 'success') {
                addNotification(res.message || 'Pushed to Nimbus.', 'success');
                addLog('Nimbus Shipping', `EE Ref: ${eeRef}`);
                onSync();
            } else {
                addNotification('Shipping Error: ' + res.message, 'error');
            }
        } catch (e) {
            addNotification('Network error.', 'error');
        } finally {
            setIsPushingNimbus(null);
        }
    };

    const TimelineStep = ({ label, date, icon, isLast = false }: { label: string, date?: string, icon: React.ReactNode, isLast?: boolean }) => {
        const isActive = !!date;
        return (
            <div className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${isActive ? 'bg-partners-green border-partners-green text-white shadow-sm' : 'bg-white border-gray-200 text-gray-300'}`}>{icon}</div>
                    <div className="mt-2 text-center"><p className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{label}</p><p className="text-[11px] font-medium text-gray-500 whitespace-nowrap mt-0.5">{date || 'Pending'}</p></div>
                </div>
                {!isLast && <div className={`h-0.5 flex-1 mx-4 -mt-6 transition-colors ${isActive ? 'bg-partners-green' : 'bg-gray-200'}`}></div>}
            </div>
        );
    };

    const uniqueChannels = useMemo(() => Array.from(new Set(salesOrders.map(s => s.channel))), [salesOrders]);

    const getPrimaryAction = (so: GroupedSalesOrder) => {
        const isExecuting = isCreatingInvoice === so.id || isPushingNimbus === so.id;
        
        // Strictly Gate: Only Batch Created orders can generate invoices
        if (!so.invoiceNumber && so.status === 'Batch Created') {
            return { 
                label: isCreatingInvoice === so.id ? 'Creating...' : 'Create Invoice', 
                color: 'bg-purple-600 text-white hover:bg-purple-700', 
                onClick: () => handleCreateZohoInvoiceAction(so.id),
                disabled: isExecuting
            };
        }
        
        if (so.status === 'Invoiced' && !so.awb && so.boxCount > 0) {
            return { 
                label: isPushingNimbus === so.id ? 'Shipping...' : 'Ship Nimbus', 
                color: 'bg-blue-600 text-white hover:bg-blue-700', 
                onClick: () => handlePushToNimbusAction(so.id),
                disabled: isExecuting
            };
        }
        
        if (so.status === 'Label Generated') {
            return { label: 'Track Dispatch', color: 'bg-amber-500 text-white hover:bg-amber-600', onClick: () => setExpandedRowId(so.id), disabled: isExecuting };
        }
        
        if (so.awb) {
            return { label: 'Track Order', color: 'bg-partners-green text-white hover:bg-green-700', onClick: () => setExpandedRowId(so.id), disabled: isExecuting };
        }
        
        return { label: 'Details', color: 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100', onClick: () => setExpandedRowId(so.id), disabled: isExecuting };
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            {blinkitModal.isOpen && blinkitModal.so && <BlinkitAppointmentModal so={blinkitModal.so} onClose={() => setBlinkitModal({ isOpen: false, so: null })} />}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveFilter(tab.id)} 
                            className={`px-3 py-1.5 text-sm font-semibold rounded-full border transition-all ${activeFilter === tab.id ? 'bg-partners-green text-white border-partners-green shadow-sm' : 'bg-white text-gray-600 border-partners-border hover:bg-gray-50'}`}
                        >
                            {tab.name} <span className="ml-1 text-[10px] opacity-70">({salesTabCounts[tab.id] || 0})</span>
                        </button>
                    ))}
                </div>
                <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-all"><CloudDownloadIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Data</button>
            </div>

            <div className="mt-6 overflow-x-auto border border-gray-100 rounded-xl shadow-inner max-h-[70vh]">
                <table className="w-full text-sm text-left text-gray-600 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th className="p-4 w-4 sticky left-0 bg-gray-50 z-30 border-r border-gray-100"></th>
                            <th className="px-6 py-3 text-blue-600 sticky left-12 bg-gray-50 z-30 border-r border-gray-100 min-w-[150px]">
                                <div className="flex items-center gap-2">
                                    SO ID (EE Ref)
                                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'id' ? null : 'id')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.id ? 'text-partners-green' : 'text-gray-400'}`}><SearchIcon className="h-3 w-3"/></button>
                                </div>
                                {activeFilterColumn === 'id' && (
                                    <div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case">
                                        <input type="text" autoFocus placeholder="Search ID..." className="w-full px-3 py-1.5 text-xs border rounded-md focus:ring-1 focus:ring-partners-green" value={columnFilters.id || ''} onChange={(e) => setColumnFilters({...columnFilters, id: e.target.value})} />
                                    </div>
                                )}
                            </th>
                            <th className="px-6 py-3">EE Status</th>
                            <th className="px-6 py-3 min-w-[140px]">
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
                            <th className="px-6 py-3">Store</th>
                            <th className="px-6 py-3">Qty / Total</th>
                            <th className="px-6 py-3">Order Date (EE)</th>
                            <th className="px-6 py-3 text-center sticky right-0 bg-gray-50 z-30 border-l border-gray-100 min-w-[200px]">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100/50">
                        {salesOrders.length === 0 ? (
                            <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-500 italic">No sales orders found matching current criteria.</td></tr>
                        ) : (
                            salesOrders.map((so) => {
                                const isExpanded = expandedRowId === so.id;
                                const totalAmountIncTax = so.amount * 1.05;
                                const action = getPrimaryAction(so);
                                const isRTO = !!so.rtoStatus;

                                return (
                                    <Fragment key={so.id}>
                                        <tr className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : 'bg-white'}`} onClick={() => setExpandedRowId(isExpanded ? null : so.id)}>
                                            <td className="p-4 text-center sticky left-0 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]"><div className="text-gray-400 hover:text-partners-green">{isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</div></td>
                                            <td className="px-6 py-4 font-bold text-blue-600 whitespace-nowrap sticky left-12 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{so.id}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    so.status === 'Shipped' ? 'bg-emerald-100 text-emerald-700' : 
                                                    so.status === 'Label Generated' ? 'bg-amber-100 text-amber-700' :
                                                    so.status === 'Box Data Upload Pending' ? 'bg-red-50 text-red-700 border border-red-100' :
                                                    so.status === 'Invoiced' ? 'bg-indigo-100 text-indigo-700' : 
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {isRTO ? `RTO: ${so.rtoStatus}` : so.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{so.channel}</td>
                                            <td className="px-6 py-4">{so.storeCode}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{so.qty} / ₹{totalAmountIncTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-400">{so.orderDate}</td>
                                            <td className="px-6 py-4 text-center sticky right-0 z-10 bg-inherit border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.02)]" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); action.onClick?.(); }} 
                                                        disabled={action.disabled}
                                                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap ${action.color} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                    <button className="text-gray-400 hover:text-gray-600 p-1"><DotsVerticalIcon className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={8} className="px-4 py-8 sm:px-12">
                                                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-8">
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-blue-500" /> Fulfillment Ref</h4>
                                                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                                    <div><p className="text-[10px] uppercase font-bold text-gray-400">PO Ref</p><p className="text-xs font-bold text-partners-green truncate" title={so.poReference}>{so.poReference}</p></div>
                                                                    <div><p className="text-[10px] uppercase font-bold text-gray-400">Order Date (EE)</p><p className="text-xs font-bold text-gray-700">{so.orderDate || 'N/A'}</p></div>
                                                                    <div><p className="text-[10px] uppercase font-bold text-gray-400">EE Status</p><p className="text-xs font-bold text-cyan-600">{so.originalEeStatus || 'Processing'}</p></div>
                                                                    <div className="col-span-1"><p className="text-[10px] uppercase font-bold text-gray-400">PO PDF</p>{so.poPdfUrl ? <a href={so.poPdfUrl} target="_blank" rel="noopener noreferrer" className="text-partners-green hover:underline flex items-center gap-1 text-xs font-bold mt-0.5"><PaperclipIcon className="h-3 w-3" /> View</a> : <p className="text-xs text-gray-300 font-bold italic mt-0.5">N/A</p>}</div>
                                                                </div>
                                                            </div>
                                                            <div className="lg:col-span-1">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><InvoiceIcon className="h-4 w-4 text-partners-purple" /> Invoice Information</h4>
                                                                <div className={`grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-lg border min-h-[140px] transition-all ${so.invoiceNumber ? 'bg-purple-50 border-purple-100' : 'bg-gray-50 border-gray-200'}`}>
                                                                    {so.invoiceNumber ? <>
                                                                        <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-purple-400">Invoice ID</p><p className="text-xs font-bold text-purple-700 font-mono truncate" title={so.invoiceId}>{so.invoiceId || 'N/A'}</p></div>
                                                                        <div><p className="text-[10px] uppercase font-bold text-purple-400">Invoice Number</p><p className="text-xs font-bold text-purple-700">{so.invoiceNumber || 'N/A'}</p></div>
                                                                        <div><p className="text-[10px] uppercase font-bold text-purple-400">Status</p><p className="text-xs font-bold text-purple-700">{so.invoiceStatus || 'N/A'}</p></div>
                                                                        <div><p className="text-[10px] uppercase font-bold text-purple-400">Total (Inc. Tax)</p><p className="text-xs font-bold text-purple-700">₹{so.invoiceTotal?.toLocaleString('en-IN') || '0'}</p></div>
                                                                        <div><p className="text-[10px] uppercase font-bold text-purple-400">Link</p>{so.invoicePdfUrl ? <a href={so.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs font-bold">View PDF <ExternalLinkIcon className="h-3 w-3" /></a> : <p className="text-xs text-purple-300 font-bold italic">No URL</p>}</div>
                                                                    </> : (
                                                                        <div className="col-span-2 flex flex-col items-center justify-center py-4 text-center">
                                                                            <InvoiceIcon className="h-8 w-8 text-purple-200 mb-2" />
                                                                            <p className="text-xs font-bold text-purple-400 uppercase">No Invoice Generated</p>
                                                                            {so.status === 'Batch Created' ? (
                                                                                <button 
                                                                                    onClick={() => handleCreateZohoInvoiceAction(so.id)} 
                                                                                    disabled={!!isCreatingInvoice} 
                                                                                    className="mt-4 px-4 py-2 bg-purple-600 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-purple-700 flex items-center gap-2 transition-all active:scale-95"
                                                                                >
                                                                                    {isCreatingInvoice === so.id ? <RefreshIcon className="h-3 w-3 animate-spin" /> : <PlusIcon className="h-3 w-3" />}
                                                                                    {isCreatingInvoice === so.id ? 'Creating...' : 'Create Zoho Invoice'}
                                                                                </button>
                                                                            ) : (
                                                                                <p className="mt-3 text-[10px] text-gray-400 italic bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                                                                                    Pending Picking/Batching in EasyEcom
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><TruckIcon className="h-4 w-4 text-partners-green" /> Logistics Timeline</h4>
                                                                <div className="flex px-4 pt-2"><TimelineStep label="Batch Created" date={so.batchCreatedAt} icon={<CubeIcon className="h-4 w-4" />} /><TimelineStep label="Invoiced" date={so.invoiceDate} icon={<InvoiceIcon className="h-4 w-4" />} /><TimelineStep label="Shipped" date={so.manifestDate} icon={<CheckCircleIcon className="h-4 w-4" />} isLast /></div>
                                                            </div>
                                                        </div>
                                                        <div className="pt-6 border-t border-gray-100">
                                                            <div className="flex justify-between items-center mb-4"><h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><GlobeIcon className="h-4 w-4 text-blue-600" /> Logistics & Shipment Status</h4>{(so.invoiceNumber && !so.awb && so.boxCount > 0) && <button onClick={() => handlePushToNimbusAction(so.id)} disabled={!!isPushingNimbus} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95">{isPushingNimbus === so.id ? <RefreshIcon className="h-3 w-3 animate-spin" /> : <SendIcon className="h-3 w-3" />}{isPushingNimbus === so.id ? 'Shipping...' : 'Ship with Nimbus Post'}</button>}</div>
                                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className={`p-4 rounded-xl border transition-all ${so.boxCount > 0 ? 'bg-partners-light-green border-partners-green/20' : 'bg-red-50 border-red-100'}`}><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Package Detail</p><div className="flex items-center gap-2"><CubeIcon className={`h-5 w-5 ${so.boxCount > 0 ? 'text-partners-green' : 'text-red-400'}`} /><div><p className="text-sm font-bold text-gray-800">Box Count</p><p className={`text-lg font-black ${so.boxCount > 0 ? 'text-partners-green' : 'text-red-600'}`}>{so.boxCount || 0}</p></div></div></div>
                                                            {so.awb ? <>
                                                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 col-span-1 md:col-span-1"><div className="flex flex-col h-full justify-between"><div><p className="text-[10px] font-bold text-blue-400 uppercase">Carrier & AWB</p><p className="text-sm font-bold text-gray-900 truncate">{so.carrier || 'Pending'}</p><p className="text-xs font-mono text-blue-600 font-bold tracking-wider">{so.awb}</p></div><span className={`mt-2 w-fit px-2 py-0.5 rounded text-[10px] font-bold border ${so.trackingStatus?.toLowerCase().includes('deliv') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{so.trackingStatus || 'In-Transit'}</span></div></div>
                                                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Delivery SLA</p><div className="space-y-3"><div><p className="text-[9px] font-bold text-gray-400">Exp Delivery Date</p><p className="text-sm font-bold text-partners-green">{so.edd || 'TBD'}</p></div><div><p className="text-[9px] font-bold text-gray-400">Delivered Date</p><p className="text-sm font-bold text-gray-800">{so.deliveredDate || '-'}</p></div></div></div>
                                                                <div className={`p-4 rounded-xl border ${so.rtoStatus ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Return Status (RTO)</p>{so.rtoStatus ? <div className="space-y-2"><p className="text-xs font-bold text-red-600">{so.rtoStatus}</p><div><p className="text-[9px] font-bold text-gray-400">Return AWB</p><p className="text-xs font-mono font-bold text-red-600">{so.rtoAwb || 'N/A'}</p></div></div> : <div className="flex flex-col items-center justify-center py-2"><CheckCircleIcon className="h-6 w-6 text-gray-200" /><p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">No Returns</p></div>}</div>
                                                            </> : <div className="md:col-span-3 p-12 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-center">{!so.invoiceNumber ? <><LockClosedIcon className="h-8 w-8 text-gray-200 mb-3" /><p className="text-sm font-bold text-gray-400 uppercase">Logistics Pending Invoice Generation</p></> : so.boxCount === 0 ? <><div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-3"><CubeIcon className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm font-bold text-red-600 uppercase">Missing Physical Box Data</p></div><p className="text-xs text-red-400">Update box count in the backend to enable shipping.</p></> : <><TruckIcon className="h-8 w-8 text-blue-200 mb-3" /><p className="text-sm font-bold text-blue-400 uppercase">Invoice Ready for Shipment</p><p className="text-xs text-blue-300 mt-1">Generate AWB by clicking the 'Ship with Nimbus' button above.</p></>}</div>}
                                                            </div>
                                                            {so.awb && so.channel.toLowerCase().includes('blinkit') && !so.status.toLowerCase().includes('shipped') && (
                                                                <div className="mt-4 bg-yellow-50 border border-yellow-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-in fade-in slide-in-from-top-2">
                                                                    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg"><span className="font-black italic text-xl">b</span></div><div><p className="text-xs font-bold text-yellow-800 uppercase">Blinkit Portal Action Required</p><p className="text-[10px] text-yellow-600 font-medium">AWB assigned. Generate appointment pass before dispatching.</p></div></div>
                                                                    <button onClick={(e) => { e.stopPropagation(); setBlinkitModal({ isOpen: true, so }); }} className="px-6 py-2.5 bg-yellow-500 text-white text-[11px] font-bold rounded-xl shadow-md hover:bg-yellow-600 transition-all flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Get Appointment Details</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><DotsVerticalIcon className="h-4 w-4 text-partners-green rotate-90" /> SKU Breakdown</h4>
                                                            <div className="overflow-x-auto border rounded-xl">
                                                                <table className="w-full text-[11px] text-left">
                                                                    <thead className="bg-gray-50 text-gray-500 uppercase"><tr><th className="py-2.5 px-4">Item Name / SKU</th><th className="py-2.5 text-right w-24">EE Item Qty</th><th className="py-2.5 text-right w-24 text-red-600">Cancelled</th><th className="py-2.5 text-right w-24 text-green-600">Shipped</th><th className="py-2.5 text-right w-24 text-orange-600">Returned</th><th className="py-2.5 px-4 text-center w-28">Item status</th></tr></thead>
                                                                    <tbody className="divide-y divide-gray-100">{so.items.map((item, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="py-3 px-4"><p className="font-bold text-gray-800">{item.itemName}</p><p className="text-[10px] text-gray-400 font-mono">{item.masterSku || item.articleCode}</p></td><td className="py-3 text-right font-bold text-gray-900">{item.itemQuantity || 0}</td><td className="py-3 text-right text-red-600 font-bold">{item.cancelledQuantity || 0}</td><td className="py-3 text-right text-green-600 font-bold">{item.shippedQuantity || 0}</td><td className="py-3 text-right text-orange-600 font-bold">{item.returnedQuantity || 0}</td><td className="py-3 px-4 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase inline-block w-full ${item.itemStatus?.toLowerCase().includes('ship') ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.itemStatus || 'Processing'}</span></td></tr>))}</tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default SalesOrderTable;
