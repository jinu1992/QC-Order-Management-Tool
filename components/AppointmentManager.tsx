
import React, { useState, useMemo, useEffect, FC } from 'react';
import { PurchaseOrder, POStatus, StorePocMapping, ChannelConfig } from '../types';
import { 
    CalendarIcon, 
    MailIcon, 
    CheckCircleIcon, 
    XCircleIcon, 
    ExternalLinkIcon, 
    RefreshIcon, 
    InfoIcon, 
    TruckIcon, 
    ClipboardListIcon, 
    InvoiceIcon, 
    GlobeIcon, 
    CurrencyIcon,
    SearchIcon,
    FilterIcon,
    ClockIcon,
    PaperclipIcon
} from './icons/Icons';
import { fetchStorePocMappings, sendAppointmentEmail, fetchChannelConfigs } from '../services/api';

const inputClassName = "mt-1 block w-full rounded-lg border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-partners-green focus:ring-partners-green sm:text-sm py-3 px-3";

interface BulkAppointmentModalProps {
    channel: string;
    pos: PurchaseOrder[];
    channelConfig?: ChannelConfig;
    onClose: () => void;
    onSuccess: (sentIds: string[]) => void;
    addLog: (action: string, details: string) => void;
    addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const BulkEmailModal: FC<BulkAppointmentModalProps> = ({ channel, pos, channelConfig, onClose, onSuccess, addLog, addNotification }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [poData, setPoData] = useState(pos.map(p => ({
        ...p,
        boxes: p.boxes || 1,
        requestedDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] // Default to tomorrow
    })));

    const handleSend = async () => {
        if (!channelConfig?.appointmentTo) {
            alert(`No recipient email configured for ${channel}. Please set it in Admin > Channel Config.`);
            return;
        }

        setIsLoading(true);
        try {
            const subject = `📦 Appointment Request for ${channel} | PO IDs: ${pos.map(p => p.poNumber).join(', ')}`;
            const params = {
                channel,
                pos: poData.map(p => ({
                    poNumber: p.poNumber,
                    storeCode: p.storeCode,
                    qty: p.qty,
                    boxes: p.boxes,
                    dispatchDate: p.dispatchDate || p.eeManifestDate || 'N/A',
                    trackingUrl: p.trackingUrl || `https://nimbuspost.com/track?awb=${p.awb}`,
                    trackingStatus: p.latestTrackingStatus || p.trackingStatus || 'In-Transit',
                    requestedDate: p.requestedDate
                })),
                toEmails: channelConfig.appointmentTo,
                ccEmails: channelConfig.appointmentCc || ''
            };

            const res = await sendAppointmentEmail(params);
            if (res.status === 'success') {
                addLog('Bulk Email Sent', `Sent appointment request for ${pos.length} POs from ${channel}`);
                addNotification(`Email sent for ${pos.length} POs to ${channelConfig.appointmentTo}`, 'success');
                onSuccess(pos.map(p => p.id));
                onClose();
            } else {
                alert("Failed to send email: " + res.message);
            }
        } catch (e) {
            alert("Network error sending email");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Bulk Appointment Request: {channel}</h3>
                        <p className="text-xs text-gray-500 mt-1">To: <span className="font-bold text-partners-green">{channelConfig?.appointmentTo || 'MISSING RECIPIENT'}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>
                
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-gray-50 text-gray-500 uppercase font-bold border-b">
                                <tr>
                                    <th className="px-4 py-3">PO Number</th>
                                    <th className="px-4 py-3">Store</th>
                                    <th className="px-4 py-3 text-right">Qty</th>
                                    <th className="px-4 py-3 w-24">Boxes</th>
                                    <th className="px-4 py-3">Dispatch Date</th>
                                    <th className="px-4 py-3 w-40">Request Delivery Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {poData.map((po, idx) => (
                                    <tr key={po.id}>
                                        <td className="px-4 py-3 font-bold text-partners-green">{po.poNumber}</td>
                                        <td className="px-4 py-3">{po.storeCode}</td>
                                        <td className="px-4 py-3 text-right font-bold">{po.qty}</td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="number" 
                                                className="w-full p-1.5 border rounded text-right"
                                                value={po.boxes}
                                                onChange={e => {
                                                    const newData = [...poData];
                                                    newData[idx].boxes = parseInt(e.target.value) || 1;
                                                    setPoData(newData);
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">{po.dispatchDate || po.eeManifestDate || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="date" 
                                                className="w-full p-1.5 border rounded"
                                                value={po.requestedDate}
                                                onChange={e => {
                                                    const newData = [...poData];
                                                    newData[idx].requestedDate = e.target.value;
                                                    setPoData(newData);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-2">Email Preview Subject</p>
                        <p className="text-sm text-gray-700 bg-white p-2 rounded border font-medium">
                            📦 Appointment Request for {channel} | PO IDs: {pos.map(p => p.poNumber).join(', ')}
                        </p>
                    </div>
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 z-10">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                    <button onClick={handleSend} disabled={isLoading} className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50">
                        {isLoading ? <RefreshIcon className="h-4 w-4 animate-spin"/> : <MailIcon className="h-4 w-4"/>}
                        {isLoading ? 'Sending Request...' : `Send Request for ${pos.length} POs`}
                    </button>
                </div>
            </div>
        </div>
    );
};

const BlinkitAppointmentModal: FC<{ po: PurchaseOrder, onClose: () => void }> = ({ po, onClose }) => {
    // Search for invoice info in items or use defaults
    const firstPushedItem = (po.items || []).find(i => !!i.invoiceNumber);
    const invoiceNumber = firstPushedItem?.invoiceNumber || po.invoiceId || 'N/A';
    const invoicePdfUrl = firstPushedItem?.invoicePdfUrl || po.poPdfUrl || 'N/A';
    const amountWithTax = (po.amount * 1.05).toFixed(0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
            <div className="bg-partners-gray-bg rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white">
                <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg shadow-yellow-100">
                            <span className="font-black italic text-xl">b</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Blinkit Appointment Helper</h3>
                            <p className="text-xs text-gray-500">Portal: <span className="font-bold text-partners-green">partnersbiz.com</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="bg-partners-light-green border-2 border-dashed border-partners-green/30 p-4 rounded-2xl flex gap-4 items-start">
                        <div className="bg-partners-green p-2 rounded-lg text-white"><CalendarIcon className="h-5 w-5" /></div>
                        <div>
                            <p className="text-sm font-bold text-partners-green uppercase tracking-tight">Scheduling Instructions</p>
                            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                                Take the <span className="font-bold underline">earliest available slot</span> on the suggested date in the portal.
                                <br/>
                                <span className="text-red-600 font-extrabold uppercase">Important: Do not select Sundays.</span>
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <CopyField label="PO Number" value={po.poNumber} icon={<ClipboardListIcon className="h-3 w-3"/>} />
                        <CopyField label="Courier Name" value={po.carrier || 'Standard'} icon={<TruckIcon className="h-3 w-3"/>} />
                        <CopyField label="AWB Number" value={po.awb || 'N/A'} icon={<GlobeIcon className="h-3 w-3"/>} />
                        <CopyField label="Invoice Number" value={invoiceNumber} icon={<InvoiceIcon className="h-3 w-3"/>} />
                        <CopyField label="Total Amount (Inc. Tax)" value={`₹${amountWithTax}`} icon={<CurrencyIcon className="h-3 w-3"/>} />
                        <div className="md:col-span-2">
                            <CopyField label="Invoice PDF URL" value={invoicePdfUrl} icon={<ExternalLinkIcon className="h-3 w-3"/>} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center pt-2">
                        <button 
                            onClick={() => window.open('https://partnersbiz.com', '_blank')} 
                            className="w-full py-4 bg-partners-green text-white font-bold rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <ExternalLinkIcon className="h-5 w-5" /> Open Blinkit Partners Portal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

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

const AppointmentManager: React.FC<{ purchaseOrders: PurchaseOrder[], setPurchaseOrders: any, addLog: any, addNotification: any }> = ({ purchaseOrders, setPurchaseOrders, addLog, addNotification }) => {
    const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [bulkModal, setBulkModal] = useState<{ isOpen: boolean, channel: string, pos: PurchaseOrder[], channelConfig?: ChannelConfig }>({ isOpen: false, channel: '', pos: [] });
    const [blinkitModal, setBlinkitModal] = useState<{ isOpen: boolean, po?: PurchaseOrder }>({ isOpen: false });
    const [activeTab, setActiveTab] = useState<'toBeScheduled' | 'open' | 'invoicePending' | 'serviced' | 'cancelled'>('toBeScheduled');
    const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);

    useEffect(() => {
        const loadConfigs = async () => {
            setIsLoading(true);
            const data = await fetchChannelConfigs();
            setChannelConfigs(data);
            setIsLoading(false);
        };
        loadConfigs();
    }, []);

    const getIsAppointmentTaken = (po: PurchaseOrder) => {
        // An appointment is "taken" if it has a confirmed date OR an existing request date.
        return !!po.appointmentDate || !!po.appointmentRequestDate;
    };

    const relevantOrders = useMemo(() => {
        // Rule: Only show orders for which an Appointment has NOT been booked yet.
        return purchaseOrders.filter(po => 
            !getIsAppointmentTaken(po) && 
            (
                po.status === POStatus.AppointmentPending || 
                po.status === POStatus.Pushed || 
                po.status === POStatus.PartiallyProcessed || 
                po.status === POStatus.InTransit ||
                po.status === POStatus.NewPO
            )
        ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [purchaseOrders]);

    const statistics = useMemo(() => {
        const toBeScheduled = relevantOrders.length;
        const openAppointments = purchaseOrders.filter(po => getIsAppointmentTaken(po) && po.status !== POStatus.Delivered && po.status !== POStatus.Closed && po.status !== POStatus.Cancelled).length;
        const invoicePending = purchaseOrders.filter(po => !po.poPdfUrl && po.status !== POStatus.Cancelled).length;
        const fulfilled = purchaseOrders.filter(po => po.status === POStatus.Delivered || po.status === POStatus.Closed).length;
        const cancelled = purchaseOrders.filter(po => po.status === POStatus.Cancelled).length;
        return { toBeScheduled, openAppointments, invoicePending, fulfilled, cancelled, totalServiced: fulfilled };
    }, [relevantOrders, purchaseOrders]);

    const tableOrders = useMemo(() => {
        if (activeTab === 'toBeScheduled') return relevantOrders;
        
        let filtered = purchaseOrders;
        switch (activeTab) {
            case 'open':
                filtered = purchaseOrders.filter(po => getIsAppointmentTaken(po) && po.status !== POStatus.Delivered && po.status !== POStatus.Closed && po.status !== POStatus.Cancelled);
                break;
            case 'invoicePending':
                filtered = purchaseOrders.filter(po => !po.poPdfUrl && po.status !== POStatus.Cancelled);
                break;
            case 'serviced':
                filtered = purchaseOrders.filter(po => po.status === POStatus.Delivered || po.status === POStatus.Closed);
                break;
            case 'cancelled':
                filtered = purchaseOrders.filter(po => po.status === POStatus.Cancelled);
                break;
        }
        return filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    }, [purchaseOrders, relevantOrders, activeTab]);

    const handleSchedule = (po: PurchaseOrder) => {
        const isBlinkit = po.channel.toLowerCase().includes('blinkit');
        if (isBlinkit) {
            setBlinkitModal({ isOpen: true, po });
        } else {
            const config = channelConfigs.find(c => c.channelName === po.channel);
            setBulkModal({ isOpen: true, channel: po.channel, pos: [po], channelConfig: config });
        }
    };

    const handleBulkSchedule = () => {
        const selectedPos = relevantOrders.filter(po => selectedPoIds.includes(po.id));
        if (selectedPos.length === 0) return;
        
        const firstChannel = selectedPos[0].channel;
        const differentChannel = selectedPos.some(p => p.channel !== firstChannel);
        
        if (differentChannel) {
            alert("Bulk scheduling can only be done for one channel at a time. Please select POs from the same channel.");
            return;
        }

        if (firstChannel.toLowerCase().includes('blinkit')) {
            alert("Blinkit appointments must be taken individually through the partners portal helper.");
            return;
        }

        const config = channelConfigs.find(c => c.channelName === firstChannel);
        setBulkModal({ isOpen: true, channel: firstChannel, pos: selectedPos, channelConfig: config });
    };

    const handleToggleSelect = (id: string) => {
        setSelectedPoIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleToggleAll = () => {
        if (selectedPoIds.length === relevantOrders.length) setSelectedPoIds([]);
        else setSelectedPoIds(relevantOrders.map(p => p.id));
    };

    return (
        <>
            {bulkModal.isOpen && (
                <BulkEmailModal 
                    channel={bulkModal.channel}
                    pos={bulkModal.pos}
                    channelConfig={bulkModal.channelConfig}
                    onClose={() => setBulkModal({ isOpen: false, channel: '', pos: [] })}
                    onSuccess={(sentIds) => {
                        setPurchaseOrders((prev: PurchaseOrder[]) => prev.map(p => 
                            sentIds.includes(p.id) ? { ...p, appointmentRequestDate: new Date().toLocaleDateString('en-GB') } : p
                        ));
                        setSelectedPoIds([]);
                    }}
                    addLog={addLog}
                    addNotification={addNotification}
                />
            )}

            {blinkitModal.isOpen && blinkitModal.po && (
                <BlinkitAppointmentModal 
                    po={blinkitModal.po}
                    onClose={() => setBlinkitModal({ isOpen: false })}
                />
            )}

            <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6 bg-[#F8F9FA]">
                <div className="flex justify-between items-end">
                    <h1 className="text-2xl font-bold text-gray-800">PO Appointments</h1>
                    {selectedPoIds.length > 0 && activeTab === 'toBeScheduled' && (
                        <button 
                            onClick={handleBulkSchedule}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
                        >
                            <MailIcon className="h-4 w-4"/> Schedule Selected ({selectedPoIds.length})
                        </button>
                    )}
                </div>

                {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-0 rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white">
                    <div onClick={() => setActiveTab('toBeScheduled')} className={`p-4 border-r border-gray-100 cursor-pointer transition-colors ${activeTab === 'toBeScheduled' ? 'bg-[#E9F7EF]' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-900">{statistics.toBeScheduled}</span><span className="text-xs font-medium text-gray-600">POs to be Scheduled</span></div>
                        <div className="mt-6 flex justify-between"><div><p className="text-[10px] text-gray-500">Expiring tomorrow</p><p className="text-lg font-bold text-gray-800">0</p></div><div><p className="text-[10px] text-gray-500">This week</p><p className="text-lg font-bold text-gray-800">0</p></div></div>
                    </div>
                    <div onClick={() => setActiveTab('open')} className={`p-4 border-r border-gray-100 cursor-pointer transition-colors ${activeTab === 'open' ? 'bg-[#EBF5FB]' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-900">{statistics.openAppointments}</span><span className="text-xs font-medium text-gray-600">Open Appointments</span></div>
                        <div className="mt-6 flex justify-between"><div><p className="text-[10px] text-gray-500">Due Tomorrow</p><p className="text-lg font-bold text-gray-800">0</p></div><div><p className="text-[10px] text-gray-500">Due this week</p><p className="text-lg font-bold text-gray-800">0</p></div></div>
                    </div>
                    <div onClick={() => setActiveTab('invoicePending')} className={`p-4 border-r border-gray-100 cursor-pointer transition-colors ${activeTab === 'invoicePending' ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}><p className="text-[10px] text-gray-500 leading-tight">PO's with invoice upload pending</p><p className="text-4xl font-bold text-yellow-500 mt-4">{statistics.invoicePending}</p></div>
                    <div onClick={() => setActiveTab('serviced')} className={`p-4 border-r border-gray-100 cursor-pointer transition-colors ${activeTab === 'serviced' ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-900">{statistics.totalServiced}</span><span className="text-xs font-medium text-gray-600">Appointments Serviced</span></div>
                        <p className="text-[9px] text-gray-400 uppercase mt-1">Total Fulfilled</p>
                        <div className="mt-4 flex justify-between"><div><p className="text-[10px] text-gray-500">Fulfilled</p><p className="text-lg font-bold text-gray-800">{statistics.fulfilled}</p></div><div><p className="text-[10px] text-gray-500">No Show</p><p className="text-lg font-bold text-gray-800">0</p></div></div>
                    </div>
                    <div onClick={() => setActiveTab('cancelled')} className={`p-4 cursor-pointer transition-colors ${activeTab === 'cancelled' ? 'bg-red-50' : 'hover:bg-gray-50'}`}><p className="text-[10px] text-gray-500 leading-tight">Cancelled Appointments</p><p className="text-[9px] text-gray-400 uppercase mb-2">Total</p><p className="text-4xl font-bold text-red-500">{statistics.cancelled}</p></div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600 border-collapse">
                            <thead className="bg-[#FAFAFA] text-[11px] text-gray-500 uppercase font-bold border-b border-gray-100">
                                <tr>
                                    {activeTab === 'toBeScheduled' && (
                                        <th className="px-4 py-4 w-10 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 text-partners-green focus:ring-partners-green"
                                                checked={relevantOrders.length > 0 && selectedPoIds.length === relevantOrders.length}
                                                onChange={handleToggleAll}
                                            />
                                        </th>
                                    )}
                                    <th className="px-6 py-4">PO No.</th>
                                    <th className="px-6 py-4">Facility Name</th>
                                    <th className="px-6 py-4">Appointment Status</th>
                                    <th className="px-6 py-4">Delivery Type</th>
                                    <th className="px-6 py-4">Issue Date</th>
                                    <th className="px-6 py-4 text-right">Total Quantity</th>
                                    <th className="px-6 py-4 text-right">Total SKUs</th>
                                    <th className="px-6 py-4">PO Expiry Date</th>
                                    <th className="px-6 py-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tableOrders.length === 0 ? (
                                    <tr><td colSpan={10} className="px-6 py-20 text-center text-gray-400 italic">No POs found for the selected view.</td></tr>
                                ) : (
                                    tableOrders.map(po => {
                                        const isTaken = getIsAppointmentTaken(po);
                                        const isSelected = selectedPoIds.includes(po.id);
                                        const isBlinkit = po.channel.toLowerCase().includes('blinkit');
                                        
                                        return (
                                            <tr key={po.id} className={`hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-partners-light-green/20' : ''}`}>
                                                {activeTab === 'toBeScheduled' && (
                                                    <td className="px-4 py-4 text-center">
                                                        <input 
                                                            type="checkbox" 
                                                            className={`rounded border-gray-300 text-partners-green focus:ring-partners-green ${isBlinkit ? 'opacity-30' : ''}`}
                                                            checked={isSelected}
                                                            onChange={() => !isBlinkit && handleToggleSelect(po.id)}
                                                            disabled={isBlinkit}
                                                            title={isBlinkit ? "Blinkit orders must be scheduled individually" : ""}
                                                        />
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 font-bold text-partners-green hover:underline cursor-pointer">{po.poNumber}</td>
                                                <td className="px-6 py-4 font-medium text-gray-700">{po.channel} - {po.storeCode}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                                                        isTaken ? 'bg-green-100 text-green-700' : 'bg-[#EBF5FB] text-[#2E86C1]'
                                                    }`}>
                                                        {isTaken ? 'Scheduled' : 'Unscheduled'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-[10px] border ${
                                                        isTaken ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-[#F1F9F6] text-partners-green border-[#D5EFE3]'
                                                    }`}>
                                                        <TruckIcon className="h-3 w-3" /> {isTaken ? (po.carrier || 'Logistics Assigned') : 'Courier Vendor'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-medium">{po.orderDate}</td>
                                                <td className="px-6 py-4 font-bold text-gray-900 text-right">{po.qty}</td>
                                                <td className="px-6 py-4 font-medium text-gray-700 text-right">{po.items?.length || 0}</td>
                                                <td className="px-6 py-4 text-gray-500 font-medium">{po.poExpiryDate || po.orderDate}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {!isTaken ? (
                                                        <button 
                                                            onClick={() => handleSchedule(po)}
                                                            className={`px-6 py-1.5 border border-partners-green text-partners-green font-bold text-[11px] rounded hover:bg-partners-green hover:text-white transition-all active:scale-95 ${isBlinkit ? 'bg-yellow-50 border-yellow-400 text-yellow-700 hover:bg-yellow-400 hover:text-white' : ''}`}
                                                        >
                                                            {isBlinkit ? 'Open Helper' : 'Schedule'}
                                                        </button>
                                                    ) : (
                                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                                            <CheckCircleIcon className="h-3 w-3 text-green-500" /> Done
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AppointmentManager;
