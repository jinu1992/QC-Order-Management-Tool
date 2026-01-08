
import React, { useState, useMemo, useEffect, FC } from 'react';
import { PurchaseOrder, POStatus, StorePocMapping } from '../types';
import { CalendarIcon, MailIcon, ReplyIcon, CheckCircleIcon, XCircleIcon, ExternalLinkIcon, BuildingIcon, RefreshIcon, InfoIcon, TruckIcon, ClipboardListIcon, InvoiceIcon, GlobeIcon, CurrencyIcon } from './icons/Icons';
import { fetchStorePocMappings, sendAppointmentEmail } from '../services/api';

const inputClassName = "mt-1 block w-full rounded-lg border border-gray-300 bg-white text-gray-900 shadow-sm focus:border-partners-green focus:ring-partners-green sm:text-sm py-3 px-3";

interface AppointmentModalProps {
    po: PurchaseOrder;
    poc?: StorePocMapping;
    onClose: () => void;
    onSuccess: () => void;
    addLog: (action: string, details: string) => void;
    addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
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
        <div 
            onClick={handleCopy}
            className="flex flex-col gap-1.5 p-3 bg-white border border-gray-200 rounded-xl hover:border-partners-green transition-colors group cursor-pointer active:bg-gray-50 select-none"
        >
            <div className="flex justify-between items-center pointer-events-none">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    {icon} {label}
                </span>
                <div 
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500 group-hover:bg-partners-green group-hover:text-white'}`}
                >
                    {copied ? 'COPIED!' : 'COPY'}
                </div>
            </div>
            <p className="text-sm font-bold text-gray-800 break-all pointer-events-none">{value || 'N/A'}</p>
        </div>
    );
};

const BlinkitAppointmentModal: FC<{ po: PurchaseOrder, onClose: () => void }> = ({ po, onClose }) => {
    // Extract invoice details from items - prioritizing invoicePdfUrl for helper modal
    const firstPushedItem = (po.items || []).find(i => !!i.invoiceNumber);
    const invoiceNumber = firstPushedItem?.invoiceNumber || 'N/A';
    const invoicePdfUrl = firstPushedItem?.invoicePdfUrl || 'N/A';
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
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <XCircleIcon className="h-6 w-6 text-gray-400"/>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Instructions Card */}
                    <div className="bg-partners-light-green border-2 border-dashed border-partners-green/30 p-4 rounded-2xl flex gap-4 items-start">
                        <div className="bg-partners-green p-2 rounded-lg text-white">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-partners-green uppercase tracking-tight">Scheduling Instructions</p>
                            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                                Take the <span className="font-bold underline">earliest available slot</span> on the suggested date in the portal. 
                                <br/>
                                <span className="text-red-600 font-extrabold uppercase">Important: Do not select Sundays.</span>
                            </p>
                        </div>
                    </div>

                    {/* Copy Grid */}
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
                            onClick={() => window.open('https://partnersbiz.com/login', '_blank')}
                            className="w-full py-4 bg-partners-green text-white font-bold rounded-2xl shadow-xl shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            <ExternalLinkIcon className="h-5 w-5" />
                            Open Blinkit Partners Portal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmailAppointmentModal: FC<AppointmentModalProps> = ({ po, poc, onClose, onSuccess, addLog, addNotification }) => {
    const [boxes, setBoxes] = useState(po.boxes || 1);
    const [isLoading, setIsLoading] = useState(false);

    const handleSend = async () => {
        if (!poc?.pocEmail) {
            alert("No POC Email found for this store. Please check Store_POC_Mapping.");
            return;
        }
        setIsLoading(true);
        try {
            const res = await sendAppointmentEmail(po, boxes, poc.pocEmail);
            if (res.status === 'success') {
                addLog('Email Sent', `Appointment request sent to ${poc.pocEmail} for PO ${po.poNumber}`);
                addNotification(`Email sent to ${poc.pocName} (${poc.pocEmail})`, 'success');
                onSuccess();
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">Email Appointment Request</h3>
                        <p className="text-sm text-gray-500">To: <span className="font-bold text-partners-green">{poc?.pocName || 'Unknown'} ({poc?.pocEmail || 'Missing Email'})</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">PO Number</p>
                            <p className="font-bold text-gray-800">{po.poNumber}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Store Code</p>
                            <p className="font-bold text-gray-800">{po.storeCode}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Total Qty</p>
                            <p className="font-bold text-gray-800">{po.qty} Units</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Dispatch Date</p>
                            <p className="font-bold text-gray-800">{po.dispatchDate || po.eeManifestDate || 'N/A'}</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Number of Boxes / Cartons</label>
                        <input 
                            type="number" 
                            className={inputClassName} 
                            value={boxes} 
                            onChange={e => setBoxes(Number(e.target.value))} 
                            placeholder="Enter physical box count"
                        />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors">Cancel</button>
                    <button 
                        onClick={handleSend}
                        disabled={isLoading}
                        className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                        {isLoading ? <RefreshIcon className="h-4 w-4 animate-spin"/> : <MailIcon className="h-4 w-4"/>}
                        {isLoading ? 'Sending...' : 'Send Email Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AppointmentManager: React.FC<{ purchaseOrders: PurchaseOrder[], setPurchaseOrders: any, addLog: any, addNotification: any }> = ({ purchaseOrders, setPurchaseOrders, addLog, addNotification }) => {
    const [pocMappings, setPocMappings] = useState<StorePocMapping[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [emailModal, setEmailModal] = useState<{ isOpen: boolean, po?: PurchaseOrder, poc?: StorePocMapping }>({ isOpen: false });
    const [blinkitModal, setBlinkitModal] = useState<{ isOpen: boolean, po?: PurchaseOrder }>({ isOpen: false });

    useEffect(() => {
        const loadPocs = async () => {
            setIsLoading(true);
            const data = await fetchStorePocMappings();
            setPocMappings(data);
            setIsLoading(false);
        };
        loadPocs();
    }, []);

    const relevantOrders = useMemo(() => {
        return purchaseOrders.filter(po => {
            const hasEeRef = (po.items || []).some(i => !!i.eeReferenceCode);
            const channel = po.channel.toLowerCase();
            
            // Logic for Blinkit: After courier assignment (AWB) and before appointment is set
            if (channel.includes('blinkit')) {
                return !!po.awb && !po.appointmentDate;
            }

            // General logic for others: In-Transit or Pushed
            return (po.status === POStatus.InTransit || hasEeRef) && !po.appointmentDate;
        });
    }, [purchaseOrders]);

    const getPoc = (channel: string, storeCode: string) => {
        return pocMappings.find(m => m.channel === channel && m.storeCode === storeCode);
    };

    const handleConfirmAppointment = (po: PurchaseOrder) => {
        const date = prompt("Enter Appointment Date (e.g. 15 Oct 24):");
        const id = prompt("Enter Appointment ID / ASN:");
        if (date && id) {
            setPurchaseOrders((prev: PurchaseOrder[]) => prev.map(p => 
                p.id === po.id ? { ...p, appointmentDate: date, appointmentId: id, actionToBeTaken: 'Awaiting Delivery' } : p
            ));
            addLog('Appointment Confirmed', `Recorded appointment ${id} for PO ${po.poNumber}`);
            addNotification(`Appointment recorded for ${po.poNumber}`, 'success');
        }
    };

    const renderBrandWorkflow = (po: PurchaseOrder) => {
        const channel = po.channel.toLowerCase();
        const poc = getPoc(po.channel, po.storeCode);

        if (channel.includes('blinkit')) {
            return (
                <div className="flex flex-col gap-2 w-full">
                    <button 
                        onClick={() => setBlinkitModal({ isOpen: true, po })}
                        className="flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold text-white bg-partners-green rounded-lg hover:bg-green-700 transition-all shadow-sm active:scale-95"
                    >
                        <ExternalLinkIcon className="h-3.5 w-3.5" /> Get Appointment Details
                    </button>
                    <button 
                        onClick={() => handleConfirmAppointment(po)}
                        className="text-[10px] font-bold text-partners-green hover:underline flex items-center justify-center gap-1"
                    >
                        <CheckCircleIcon className="h-3 w-3" /> Mark Appointment Taken
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-2 w-full">
                <button 
                    onClick={() => setEmailModal({ isOpen: true, po, poc })}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-[10px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm"
                >
                    <MailIcon className="h-3.5 w-3.5" /> Send Appointment Email
                </button>
                <button 
                    onClick={() => handleConfirmAppointment(po)}
                    className="text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:underline flex items-center justify-center gap-1"
                >
                    <CheckCircleIcon className="h-3 w-3" /> Log Manual Appointment
                </button>
            </div>
        );
    };

    return (
        <>
            {emailModal.isOpen && emailModal.po && (
                <EmailAppointmentModal 
                    po={emailModal.po} 
                    poc={emailModal.poc}
                    onClose={() => setEmailModal({ isOpen: false })}
                    onSuccess={() => {
                        setPurchaseOrders((prev: PurchaseOrder[]) => prev.map(p => 
                            p.id === emailModal.po!.id ? { ...p, appointmentRequestDate: new Date().toLocaleDateString('en-GB') } : p
                        ));
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

            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-gray-800">Dispatch-to-Appointment Queue</h2>
                        <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 flex items-center gap-2">
                            <InfoIcon className="h-4 w-4 text-blue-500" />
                            <span>Blinkit orders appear here once Courier is assigned.</span>
                        </div>
                    </div>

                    {relevantOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <TruckIcon className="mx-auto h-16 w-16 text-gray-200"/>
                            <h3 className="mt-4 text-lg font-bold text-gray-800">Queue is Empty</h3>
                            <p className="mt-1 text-gray-400">POs will appear here once they are ready for appointment scheduling.</p>
                        </div>
                    ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-[11px] text-gray-500 uppercase bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-4">PO & Logistics</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Tracking & Courier</th>
                                    <th className="px-6 py-4 text-center">Workflow Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {relevantOrders.map(po => {
                                    return (
                                        <tr key={po.id} className="bg-white hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 font-bold text-partners-green whitespace-nowrap">
                                                {po.poNumber} 
                                                <div className="text-gray-900 text-xs mt-1">{po.channel} - {po.storeCode}</div>
                                                <div className="text-gray-400 font-normal text-[10px] mt-0.5">{po.qty} Units</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded border w-fit ${po.status === POStatus.InTransit ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                        {po.status === POStatus.InTransit ? 'In-Transit' : 'Processing'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs">
                                                    <p className="font-bold text-gray-700">{po.carrier || 'Pending Assign'}</p>
                                                    <p className="text-gray-400 font-mono text-[10px]">{po.awb || 'No AWB'}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center">
                                                    {renderBrandWorkflow(po)}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default AppointmentManager;
