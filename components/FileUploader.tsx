
import React, { useState, useEffect } from 'react';
import { User, UploadMetadata } from '../types';
import { CloudDownloadIcon, ExternalLinkIcon, InfoIcon, XCircleIcon, CheckCircleIcon, RefreshIcon, PaperclipIcon } from './icons/Icons';
import { logFileUpload, fetchUploadMetadata } from '../services/api';

interface FileUploaderProps {
    currentUser: User;
    addLog: (action: string, details: string) => void;
    addNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ currentUser, addLog, addNotification }) => {
    const [uploadHistory, setUploadHistory] = useState<UploadMetadata[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

    const uploadFunctions = [
        {
            id: 'b2b-packing-list',
            name: 'B2B Packing List Data',
            link: 'https://app.easyecom.io/V2/reports/reports-HomePage',
            instructions: "Go to 'B2B Packing List Report' in Other Reports section and Download last 7 days file.",
            accept: '.csv, .xlsx'
        },
        {
            id: 'flipkart-minutes-po',
            name: 'FlipkartMinutes PO Upload',
            link: 'https://seller.flipkart.com/',
            instructions: "Upload the PO file (Excel or CSV) downloaded from the Flipkart Minutes portal. The system backend will process this data into the PO database.",
            accept: '.csv, .xlsx'
        }
    ];

    const loadMetadata = async () => {
        setIsLoadingMetadata(true);
        try {
            const data = await fetchUploadMetadata();
            setUploadHistory(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingMetadata(false);
        }
    };

    useEffect(() => {
        loadMetadata();
    }, []);

    const handleUploadClick = (funcId: string) => {
        setSelectedFunction(funcId);
        setIsModalOpen(true);
    };

    const processUpload = async (file: File) => {
        if (!selectedFunction) return;

        setIsUploading(true);
        try {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target?.result?.toString().split(',')[1];
                    // Log the upload attempt to the backend and send file data
                    const res = await logFileUpload(selectedFunction, currentUser.name, base64Data, file.name);
                    
                    if (res.status === 'success') {
                        addLog('File Upload', `Successfully uploaded ${file.name} for ${selectedFunction}`);
                        addNotification(`File "${file.name}" processed successfully by backend.`, 'success');
                        setIsModalOpen(false);
                        loadMetadata();
                    } else {
                        addNotification('Upload failed: ' + (res.message || 'Unknown error'), 'error');
                    }
                } catch (err) {
                    addNotification('Failed to communicate with processing server.', 'error');
                } finally {
                    setIsUploading(false);
                }
            };

            reader.onerror = () => {
                addNotification('Error reading local file.', 'error');
                setIsUploading(false);
            };

            reader.readAsDataURL(file);
        } catch (e) {
            addNotification('System error during upload initialization.', 'error');
            setIsUploading(false);
        }
    };

    const getMetadata = (funcId: string) => uploadHistory.find(h => h.id === funcId);

    return (
        <div className="p-4 sm:p-6 lg:p-8 flex-1">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800">System Data File Uploader</h1>
                <p className="text-gray-500 mt-1">Manual synchronization hub for reports and channel data.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {uploadFunctions.map(func => {
                    const meta = getMetadata(func.id);
                    return (
                        <div key={func.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-shadow overflow-hidden">
                            <div className="p-6 flex-1">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                        <CloudDownloadIcon className="h-6 w-6" />
                                    </div>
                                    <h3 className="font-bold text-gray-900">{func.name}</h3>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Sync Status</p>
                                        {meta ? (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                                    <span className="text-xs font-bold text-gray-700">{meta.lastUploadedBy}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-medium italic">{meta.lastUploadedAt}</span>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">No previous uploads found.</p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <a href={func.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">
                                            <span>Open Portal Source</span>
                                            <ExternalLinkIcon className="h-3.5 w-3.5" />
                                        </a>
                                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-2">
                                            <InfoIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-[11px] text-amber-800 leading-relaxed">
                                                <span className="font-bold uppercase text-[9px] block mb-0.5">Instructions</span>
                                                {func.instructions}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                <button 
                                    onClick={() => handleUploadClick(func.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-partners-green text-white font-bold rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-[0.98]"
                                >
                                    <CloudDownloadIcon className="h-4 w-4" />
                                    Upload New Data
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {isModalOpen && selectedFunction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Upload Data File</h3>
                                <p className="text-xs text-gray-500 font-medium">Processing: {uploadFunctions.find(f => f.id === selectedFunction)?.name}</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                        </div>
                        
                        <div className="p-8">
                            <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                                <InfoIcon className="h-5 w-5 text-blue-500 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-1">Required Steps</p>
                                    <p className="text-xs text-blue-800 leading-relaxed">
                                        {uploadFunctions.find(f => f.id === selectedFunction)?.instructions}
                                    </p>
                                </div>
                            </div>

                            <label className="group relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-3xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-partners-green transition-all overflow-hidden">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <PaperclipIcon className={`h-12 w-12 text-gray-400 mb-3 group-hover:text-partners-green group-hover:scale-110 transition-all ${isUploading ? 'animate-bounce' : ''}`} />
                                    <p className="mb-2 text-sm font-bold text-gray-700">Click to select or drag and drop</p>
                                    <p className="text-xs text-gray-500">CSV or XLSX (Max. 10MB)</p>
                                </div>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept=".csv, .xlsx, .xls"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) processUpload(file);
                                    }}
                                    disabled={isUploading}
                                />
                                {isUploading && (
                                    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3">
                                        <RefreshIcon className="h-10 w-10 text-partners-green animate-spin" />
                                        <p className="text-sm font-bold text-partners-green">Processing data...</p>
                                    </div>
                                )}
                            </label>

                            <div className="mt-6 flex items-center justify-center gap-2">
                                <CheckCircleIcon className="h-4 w-4 text-partners-green" />
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Validations strictly applied</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUploader;
