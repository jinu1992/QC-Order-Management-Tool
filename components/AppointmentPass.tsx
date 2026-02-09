
import React from 'react';
import { XIcon, PrinterIcon } from './icons/Icons';

interface AppointmentPassProps {
    appointmentId: string;
    appointmentDate: string;
    appointmentTime: string;
    facilityName: string;
    qrCodeUrl?: string;
    purchaseManagerName: string;
    purchaseManagerPhone: string;
    unloadingSlot: string;
    onClose: () => void;
}

const AppointmentPass: React.FC<AppointmentPassProps> = ({
    appointmentId,
    appointmentDate,
    appointmentTime,
    facilityName,
    qrCodeUrl,
    purchaseManagerName,
    purchaseManagerPhone,
    unloadingSlot,
    onClose
}) => {
    const handlePrint = () => {
        window.print();
    };

    // Ensure image is treated as high quality for print
    const processedQrUrl = qrCodeUrl?.includes('export=view') 
        ? qrCodeUrl.replace('export=view', 'export=download') 
        : qrCodeUrl;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: auto; margin: 0; }
                    body { margin: 0; background: white; -webkit-print-color-adjust: exact; }
                    .no-print { display: none !important; }
                    .print-full { width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
                }
            `}} />
            
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden relative flex flex-col print-full animate-in fade-in zoom-in-95 duration-300">
                
                {/* Header Decoration */}
                <div className="bg-[#f0f9f4] px-8 pt-8 pb-4 relative overflow-hidden flex justify-between items-start print:bg-white print:border-b-2 print:border-gray-200">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Appointment Pass</h1>
                        <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">{appointmentDate}</p>
                    </div>
                    {/* Illustration (Simulated) */}
                    <div className="flex -space-x-4 pr-12 pt-2 opacity-80 no-print">
                         <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-3xl shadow-xl transform -rotate-12 border-4 border-white">📦</div>
                         <div className="w-16 h-16 bg-blue-400 rounded-full flex items-center justify-center text-3xl shadow-xl transform rotate-12 border-4 border-white">🚚</div>
                         <div className="w-16 h-16 bg-partners-green rounded-full flex items-center justify-center text-3xl shadow-xl transform -rotate-3 border-4 border-white">✔️</div>
                    </div>
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/50 rounded-full transition-colors no-print">
                        <XIcon className="h-6 w-6 text-gray-400" />
                    </button>
                </div>

                <div className="px-8 py-10 space-y-10">
                    {/* Appointment ID */}
                    <div>
                        <p className="text-2xl font-black text-gray-900">
                            Appointment ID <span className="text-blue-600">#{appointmentId}</span>
                        </p>
                    </div>

                    {/* Summary Box */}
                    <div className="grid grid-cols-3 gap-6 bg-[#f8fafc] p-8 rounded-[2rem] border border-gray-100 shadow-sm print:bg-white print:border-2 print:border-gray-100">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Reporting time</p>
                            <p className="text-lg font-black text-gray-900">{appointmentTime}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Facility Name</p>
                            <p className="text-lg font-black text-gray-900 leading-tight">{facilityName}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Unloading Slot</p>
                            <p className="text-lg font-black text-gray-900">{unloadingSlot}</p>
                        </div>
                    </div>

                    {/* QR Code Area */}
                    <div className="flex flex-col items-center py-6">
                        <div className="w-64 h-64 p-4 bg-white border-[10px] border-gray-50 rounded-3xl shadow-inner flex items-center justify-center print:border-gray-100">
                            {processedQrUrl ? (
                                <img 
                                    src={processedQrUrl} 
                                    alt="Appointment QR" 
                                    className="w-full h-full object-contain"
                                    crossOrigin="anonymous" 
                                />
                            ) : (
                                <div className="text-center p-8 text-gray-300 font-black uppercase text-xs">
                                    <div className="text-4xl mb-2">QR</div>
                                    Awaiting QR Data...
                                </div>
                            )}
                        </div>
                        <p className="mt-6 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Scan at gate entrance</p>
                    </div>

                    {/* Purchase Manager Box */}
                    <div className="bg-[#f8fafc] p-8 rounded-[2rem] border border-gray-100 shadow-sm print:bg-white print:border-2 print:border-gray-100">
                         <h3 className="text-xl font-black text-gray-900 mb-6">Purchase Manager Details</h3>
                         <div className="grid grid-cols-2 gap-8">
                             <div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Name</p>
                                 <p className="text-lg font-black text-gray-900">{purchaseManagerName}</p>
                             </div>
                             <div>
                                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Phone Number</p>
                                 <p className="text-lg font-black text-gray-900">{purchaseManagerPhone}</p>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-[#f0f9f4] p-8 flex flex-col items-center relative overflow-hidden print:bg-white print:border-t-2 print:border-gray-200">
                    <p className="text-xl font-black text-gray-900 tracking-tight">partnersbiz.com</p>
                    
                    {/* Print Button */}
                    <button 
                        onClick={handlePrint}
                        className="mt-8 px-10 py-4 bg-gray-900 text-white font-black rounded-full shadow-2xl hover:scale-105 transition-all active:scale-95 flex items-center gap-2 uppercase text-xs tracking-widest no-print"
                    >
                        <PrinterIcon className="h-4 w-4" /> Print Official Pass
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentPass;
