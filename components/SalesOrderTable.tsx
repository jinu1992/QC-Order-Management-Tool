
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
    FilterIcon,
    ClockIcon,
    PrinterIcon,
    AlertIcon
} from './icons/Icons';
import { createZohoInvoice, pushToNimbusPost, fetchPurchaseOrder, syncSinglePO, fetchPackingData, updateFBAShipmentId } from '../services/api';

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
    appointmentDate?: string;
    appointmentRequestDate?: string;
    ewb?: string;
    fbaShipmentId?: string;
}

// --- Amazon FBA Shipment ID Dialog ---

const FbaShipmentModal: FC<{ so: GroupedSalesOrder, onSave: (id: string) => void, onClose: () => void, isSaving: boolean }> = ({ so, onSave, onClose, isSaving }) => {
    const [fbaId, setFbaId] = useState(so.fbaShipmentId || '');
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 bg-[#232F3E] border-b border-gray-700 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                        <GlobeIcon className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Amazon FBA Requirement</h3>
                    <p className="text-xs text-gray-400 mt-1">Order Ref: <span className="font-bold text-partners-green">{so.id}</span></p>
                </div>
                <div className="p-8">
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-6 flex gap-3">
                         <AlertIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                         <p className="text-xs text-amber-800 leading-relaxed">FBA Shipment ID is required for Amazon fulfillment. This ID will be recorded in the PO Database before invoice generation.</p>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">FBA Shipment ID</label>
                            <input 
                                type="text"
                                autoFocus
                                value={fbaId}
                                onChange={(e) => setFbaId(e.target.value)}
                                placeholder="e.g. FBA15G89Z7J"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900] transition-all outline-none font-mono font-bold"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-8">
                        <button 
                            disabled={!fbaId.trim() || isSaving}
                            onClick={() => onSave(fbaId.trim())}
                            className="w-full py-4 bg-[#FF9900] text-gray-900 font-black rounded-2xl shadow-xl shadow-amber-100 hover:bg-[#FF8C00] transition-all active:scale-[0.98] text-sm uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <RefreshIcon className="h-5 w-5 animate-spin"/> : <CheckCircleIcon className="h-5 w-5" />}
                            {isSaving ? 'Saving & Generating...' : 'Confirm & Create Invoice'}
                        </button>
                        <button 
                            disabled={isSaving}
                            onClick={onClose}
                            className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Combined Instamart Label Printing ---

const InstamartPrintManager: FC<{ so: GroupedSalesOrder, onClose: () => void }> = ({ so, onClose }) => {
    const [packingData, setPackingData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await fetchPackingData(so.id);
            setPackingData(data);
            setIsLoading(false);
        };
        load();
    }, [so.id]);

    // Group items by Box ID, Map SKU to Item Code, and CONSOLIDATE QUANTITIES
    const groupedBoxes: Record<string, any[]> = useMemo(() => {
        const boxes: Record<string, any[]> = {};
        
        packingData.forEach(row => {
            const boxId = String(row['Box ID'] || 'UNKNOWN').trim();
            if (!boxes[boxId]) boxes[boxId] = [];
            
            // Map Master SKU from packing data to Item Code (articleCode) from PO Items
            const masterSku = String(row['SKU']).trim();
            const poItem = so.items.find(i => String(i.masterSku).trim() === masterSku || String(i.articleCode).trim() === masterSku);
            const itemCode = poItem?.articleCode || masterSku;
            const quantity = Number(row['Item Quantity'] || 0);

            // Consolidate logic: Check if this itemCode already exists in this specific box
            const existingItem = (boxes[boxId] as any[]).find(item => item.itemCode === itemCode);
            
            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                boxes[boxId].push({
                    productName: row['Product Name'] || 'N/A',
                    ean: row['EAN'] || 'N/A',
                    itemCode: itemCode,
                    quantity: quantity
                });
            }
        });
        return boxes;
    }, [packingData, so.items]);

    const handlePrintPack = () => {
        const boxEntries = Object.entries(groupedBoxes) as [string, any[]][];
        const totalBoxes = boxEntries.length;
        if (totalBoxes === 0) {
            alert("No packing data found for this order ID.");
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const packingDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        html += `
  <div class="min-h-screen p-6 font-mono page-break">

    <!-- HEADER -->
    <div class=" border-b-2 border-black pb-2 mb-4">
      <p class="text-xl font-black uppercase">
        MASTER PACKING SLIP
      </p>

    </div>

    <!-- PO / INVOICE -->
    <div class="space-y-4 mb-6">
      <div>
        <p class="text-xs font-bold uppercase">PO Number</p>
        <p class="text-3xl font-black uppercase">${so.poReference}</p>
      </div>

      <div>
        <p class="text-xs font-bold uppercase">Invoice No.</p>
        <p class="text-3xl font-black uppercase">${so.invoiceNumber || 'N/A'}</p>
      </div>
    </div>

    <!-- TOTALS -->
    <div class="border-t-2 border-black pt-4 space-y-4">
      <div>
        <p class="text-xs font-bold uppercase">Total Box Count</p>
        <p class="text-3xl font-black">${totalBoxes}</p>
      </div>

      <div>
        <p class="text-xs font-bold uppercase">SKU Count</p>
        <p class="text-3xl font-black">${so.items.length}</p>
      </div>

      <div>
        <p class="text-xs font-bold uppercase">Total Quantity</p>
        <p class="text-3xl font-black">${so.qty}</p>
      </div>
    </div>
  </div>
`;


boxEntries.forEach(([boxId, items], idx) => {
  html += `
  <div class="min-h-screen p-6 font-mono ${idx < totalBoxes - 1 ? 'page-break' : ''}">

    <!-- HEADER -->
    <div class="flex justify-between items-end gap-4 border-b-2 border-black pb-2 mb-4">
      <p class="text-xl font-black uppercase">
        Instamart Box Label
      </p>
      <p class="text-xl font-black text-right">
        BOX ${idx + 1}/${totalBoxes}
      </p>
    </div>

    <!-- PO / INVOICE -->
    <div class="border-b-2 border-black pb-3 mb-4 space-y-3">
      <div>
        <p class="text-xs font-bold uppercase">PO Number</p>
        <p class="text-xl font-black uppercase">${so.poReference}</p>
      </div>

      <div>
        <p class="text-xs font-bold uppercase">Invoice No.</p>
        <p class="text-xl font-black uppercase">${so.invoiceNumber || 'N/A'}</p>
      </div>
    </div>

    <!-- SKU DETAILS -->
    <div class="space-y-4 mb-4">
      ${items.map(item => `
        <div class="space-y-2">
          <div>
            <p class="text-xs font-bold uppercase">SKU Name</p>
            <p class="text-xl font-black uppercase">${item.productName}</p>
          </div>

          <div>
            <p class="text-xs font-bold uppercase">SKU Code</p>
            <p class="text-xl font-black uppercase">${item.itemCode}</p>
          </div>

          <div>
            <p class="text-xs font-bold uppercase">EAN Barcode</p>
            <p class="text-xl font-black uppercase">${item.ean}</p>
          </div>

          <div>
            <p class="text-xs font-bold uppercase">Quantity</p>
            <p class="text-xl font-black">${item.quantity}</p>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- FOOTER -->
    <div class="grid grid-cols-2 gap-4 border-t-2 border-black pt-4">
      <div>
        <p class="text-xs font-bold uppercase">Box ID</p>
        <p class="text-lg font-bold">${boxId}</p>
      </div>

      <div class="text-right">
        <p class="text-xs font-bold uppercase">Packing Date</p>
        <p class="text-lg font-bold">${packingDate}</p>
      </div>
    </div>

  </div>
  `;
});

        html += `
                    <script>
                        window.onload = function() { 
                            setTimeout(function() {
                                window.print(); 
                                window.onafterprint = function() {
                                    window.close();
                                };
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[120] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-partners-green text-white rounded-lg"><PrinterIcon className="h-6 w-6"/></div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Instamart Label Pack (Master + Box)</h3>
                            <p className="text-xs text-gray-500">Order: <span className="font-bold text-partners-green">{so.id}</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><XCircleIcon className="h-6 w-6 text-gray-400"/></button>
                </div>

                <div className="p-8 overflow-y-auto bg-gray-100 flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <RefreshIcon className="h-10 w-10 animate-spin mb-4 text-partners-green" />
                            <p className="font-bold">Analyzing Packing Structure...</p>
                        </div>
                    ) : packingData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <AlertIcon className="h-12 w-12 text-amber-500 mb-4" />
                            <p className="font-bold text-gray-800">No Packing Data Found</p>
                            <p className="text-sm text-gray-500 max-w-sm mt-2">Could not find rows matching SO ID "{so.id}" in the Master_Packing_Data sheet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-partners-light-green p-6 border rounded-2xl shadow-sm relative group overflow-hidden flex flex-col border-partners-green/30 col-span-1 sm:col-span-2">
                                <div className="absolute top-0 right-0 p-2 bg-partners-green/10 text-[10px] font-bold text-partners-green uppercase tracking-widest">Page 1: Master Slip</div>
                                <h4 className="text-sm font-black text-gray-900 mb-2">Master Packing Slip Header</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Total Boxes</p><p className="text-lg font-black text-partners-green">{Object.keys(groupedBoxes).length}</p></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">PO Ref</p><p className="text-xs font-bold truncate text-gray-800">{so.poReference}</p></div>
                                    <div><p className="text-[10px] font-bold text-gray-400 uppercase">Total Qty</p><p className="text-lg font-black text-gray-800">{so.qty}</p></div>
                                </div>
                            </div>

                            {(Object.entries(groupedBoxes) as [string, any[]][]).map(([boxId, items], i) => (
                                <div key={boxId} className="bg-white p-6 border rounded-2xl shadow-sm relative group overflow-hidden flex flex-col border-l-4 border-l-partners-green">
                                    <div className="absolute top-0 right-0 p-2 bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">BOX {i+1} OF {Object.keys(groupedBoxes).length}</div>
                                    <div className="mb-4">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">Unique Box ID</p>
                                        <p className="text-xl font-black text-gray-900 leading-none">{boxId}</p>
                                    </div>
                                    <div className="space-y-3 flex-1">
                                        <div className="flex justify-between items-center border-b pb-1">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase">Box Contents</p>
                                            <span className="text-[10px] font-bold text-gray-400">{(items as any[]).length} SKUs</span>
                                        </div>
                                        {(items as any[]).map((item, j) => (
                                            <div key={j} className="flex justify-between items-start gap-2 border-b border-gray-50 pb-2 last:border-0">
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-gray-900 line-clamp-1">{item.productName}</p>
                                                    <p className="text-[10px] text-black font-black uppercase mt-1">Item Code: {item.itemCode}</p>
                                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight">EAN: {item.ean}</p>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="bg-partners-light-green text-partners-green px-2 py-0.5 rounded font-bold text-xs border border-partners-green/20">x{item.quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-gray-500 bg-white border rounded-xl hover:bg-gray-100">Cancel</button>
                    <button 
                        onClick={handlePrintPack} 
                        disabled={packingData.length === 0}
                        className="px-10 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        <PrinterIcon className="h-5 w-5" /> Print All {Object.keys(groupedBoxes).length + 1} Labels (Master + Box)
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Shipping Confirmation Modal ---

const ShippingConfirmationModal: FC<{ so: GroupedSalesOrder, onConfirm: () => void, onClose: () => void, onPrint: () => void }> = ({ so, onConfirm, onClose, onPrint }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-100 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 bg-amber-50 border-b border-amber-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                        <AlertIcon className="h-10 w-10 text-amber-600" />
                    </div>
                    <h3 className="text-xl font-bold text-amber-900 uppercase tracking-tight">Final Label Check!</h3>
                    <p className="text-xs text-amber-700 mt-1">Order Ref: <span className="font-bold">{so.id}</span></p>
                </div>
                <div className="p-8">
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 mb-6 flex gap-4">
                         <div className="bg-amber-100 p-2.5 rounded-xl h-fit shadow-sm"><PrinterIcon className="h-6 w-6 text-amber-600"/></div>
                         <div>
                            <p className="text-sm font-bold text-amber-900">Are the labels pasted on boxes?</p>
                            <p className="text-xs text-amber-700 mt-1.5 leading-relaxed">For Instamart fulfillment, labels must be physically pasted on all <span className="font-bold text-amber-900 underline">{so.boxCount} boxes</span> before triggering Nimbus shipment.</p>
                         </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={onConfirm}
                            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-[0.98] text-sm"
                        >
                            Yes, Labels Pasted. Ship now.
                        </button>
                        <button 
                            onClick={onPrint}
                            className="w-full py-3 bg-partners-green/10 text-partners-green font-bold rounded-2xl border border-partners-green/20 hover:bg-partners-green/20 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <PrinterIcon className="h-4 w-4" /> No, Print Labels First
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-full py-3 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Back to Table
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Copy Field Helper ---

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

/* Fix: Redeclaration error fixed by maintaining only one definition of PortalHelperModal. */
const PortalHelperModal: FC<{ so: GroupedSalesOrder, onClose: () => void }> = ({ so, onClose }) => {
    const isZepto = so.channel.toLowerCase().includes('zepto');
    const portalName = isZepto ? 'Zepto Brands' : 'Blinkit Partners';
    const portalUrl = isZepto ? 'https://brands.zepto.co.in/' : 'https://partnersbiz.com';
    const brandColor = isZepto ? 'bg-purple-600' : 'bg-yellow-400';
    const logoText = isZepto ? 'z' : 'b';
    const shadowColor = isZepto ? 'shadow-purple-100' : 'shadow-yellow-100';

    const amountWithTax = (so.amount * 1.05).toFixed(0);
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-partners-gray-bg rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white">
                <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${brandColor} rounded-xl flex items-center justify-center text-white shadow-lg ${shadowColor}`}>
                            <span className="font-black italic text-xl">{logoText}</span>
                        </div>
                        <div><h3 className="text-lg font-bold text-gray-800">{portalName} Helper</h3><p className="text-xs text-gray-500">Portal: <span className="font-bold text-partners-green">{portalUrl.replace('https://', '')}</span></p></div>
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
                        <CopyField label="Fulfilled Quantity" value={String(so.qty)} icon={<CubeIcon className="h-3 w-3"/>} />
                        <CopyField label="Courier Name" value={so.carrier || 'Standard'} icon={<TruckIcon className="h-3 w-3"/>} />
                        <CopyField label="AWB Number" value={so.awb || 'N/A'} icon={<GlobeIcon className="h-3 w-3"/>} />
                        <CopyField label="Invoice Number" value={so.invoiceNumber || 'N/A'} icon={<InvoiceIcon className="h-3 w-3"/>} />
                        <CopyField label="Total Amount (Inc. Tax)" value={`₹${amountWithTax}`} icon={<CurrencyIcon className="h-3 w-3"/>} />
                        <div className="md:col-span-2"><CopyField label="Invoice PDF URL" value={so.invoicePdfUrl || 'N/A'} icon={<ExternalLinkIcon className="h-3 w-3"/>} /></div>
                    </div>
                    <div className="flex flex-col items-center pt-2">
                        <button onClick={() => window.open(portalUrl, '_blank')} className={`w-full py-4 ${brandColor} text-white font-bold rounded-2xl shadow-xl ${shadowColor} hover:brightness-95 transition-all flex items-center justify-center gap-3 active:scale-95`}><ExternalLinkIcon className="h-5 w-5" /> Open {portalName} Portal</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const parseDateString = (dateStr: string | undefined): number => {
    try {
        if (!dateStr || dateStr.trim() === "") return 0;
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

const SalesOrderTable: FC<SalesOrderTableProps> = ({ activeFilter, setActiveFilter, purchaseOrders, setPurchaseOrders, tabCounts, addLog, addNotification, onSync, isSyncing, inventoryItems }) => {
    const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
    const [isCreatingInvoice, setIsCreatingInvoice] = useState<string | null>(null);
    const [isPushingNimbus, setIsPushingNimbus] = useState<string | null>(null);
    const [isRefreshingSo, setIsRefreshingSo] = useState<string | null>(null);
    const [portalHelper, setPortalHelper] = useState<{ isOpen: boolean, so: GroupedSalesOrder | null }>({ isOpen: false, so: null });
    const [instamartPrintPackModal, setInstamartPrintPackModal] = useState<{ isOpen: boolean, so: GroupedSalesOrder | null }>({ isOpen: false, so: null });
    const [shippingConfirm, setShippingConfirm] = useState<{ isOpen: boolean, so: GroupedSalesOrder | null }>({ isOpen: false, so: null });
    const [fbaShipmentModal, setFbaShipmentModal] = useState<{ isOpen: boolean, so: GroupedSalesOrder | null }>({ isOpen: false, so: null });
    
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
        { id: 'Returned', name: 'Returned' },
        { id: 'Closed', name: 'Closed' },
    ];

    const { salesOrders, salesTabCounts } = useMemo(() => {
        const groups: Record<string, GroupedSalesOrder> = {};
        const counts: Record<string, number> = { 'All POs': 0, 'Confirmed': 0, 'Batch Created': 0, 'Invoiced': 0, 'Label Generated': 0, 'Box Data Upload Pending': 0, 'Shipped': 0, 'Returned': 0, 'Closed': 0 };

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
                const eeStatusLower = eeStatus.toLowerCase();
                
                const effectiveOrderDate = item.eeOrderDate || po.eeOrderDate || 'N/A';
                
                let displayStatus = 'Processing';

                if (eeStatusLower === 'returned' || eeStatusLower === 'rto' || item.rtoStatus || po.rtoStatus) displayStatus = 'Returned';
                else if (eeStatusLower === 'closed') displayStatus = 'Closed';
                else if (eeStatusLower === 'shipped' || maniDate) displayStatus = 'Shipped';
                else if (awb) displayStatus = 'Label Generated';
                else if (invNum) {
                    if (eeBoxCount === 0) displayStatus = 'Box Data Upload Pending';
                    else displayStatus = 'Invoiced';
                } 
                else if (batchDate || eeStatusLower === 'picking' || eeStatusLower === 'batched') displayStatus = 'Batch Created';
                else if (eeStatusLower === 'confirmed' || eeStatusLower === 'open') displayStatus = 'Confirmed';

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
                        boxCount: eeBoxCount,
                        appointmentDate: po.appointmentDate,
                        appointmentRequestDate: po.appointmentRequestDate,
                        ewb: item.ewb || po.ewb,
                        fbaShipmentId: item.fbaShipmentId || po.fbaShipmentId
                    };
                } else {
                    const curPo = String(po.id || '');
                    if (!groups[refCode].poReference.includes(curPo)) groups[refCode].poReference += `, ${curPo}`;
                    const statusRank = (s: string) => { 
                        if (s === 'Returned') return 10;
                        if (s === 'Closed') return 8;
                        if (s === 'Shipped') return 7; 
                        if (s === 'Label Generated') return 6;
                        if (s === 'Box Data Upload Pending') return 5;
                        if (s === 'Invoiced') return 4; 
                        if (s === 'Batch Created') return 3; 
                        if (s === 'Confirmed') return 2; 
                        return 1; 
                    };
                    if (statusRank(displayStatus) > statusRank(groups[refCode].status)) groups[refCode].status = displayStatus;
                    if (groups[refCode].orderDate === 'N/A' && effectiveOrderDate !== 'N/A') groups[refCode].orderDate = effectiveOrderDate;
                    if (!groups[refCode].batchCreatedAt) groups[refCode].batchCreatedAt = batchDate;
                    if (!groups[refCode].invoiceDate) groups[refCode].invoiceDate = item.invoiceDate;
                    if (!groups[refCode].manifestDate) groups[refCode].manifestDate = maniDate;
                    if (!groups[refCode].invoiceNumber) groups[refCode].invoiceNumber = invNum;
                    
                    groups[refCode].boxCount = eeBoxCount;

                    if (!groups[refCode].awb && awb) groups[refCode].awb = awb;
                    if (!groups[refCode].trackingStatus && trackingStatus) groups[refCode].trackingStatus = trackingStatus;
                    if (!groups[refCode].ewb) groups[refCode].ewb = item.ewb || po.ewb;
                    if (!groups[refCode].fbaShipmentId) groups[refCode].fbaShipmentId = item.fbaShipmentId || po.fbaShipmentId;
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
        });

        let filteredResults = results;
        if (activeFilter !== 'All POs') filteredResults = results.filter(so => so.status === activeFilter);
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

    const refreshSingleSOState = async (poReference: string) => {
        setIsRefreshingSo(poReference);
        const poIds = poReference.split(',').map(s => s.trim());
        for (const id of poIds) {
            try {
                await syncSinglePO(id);
                const updated = await fetchPurchaseOrder(id);
                if (updated) {
                    setPurchaseOrders(prev => prev.map(p => p.poNumber === id ? updated : p));
                }
            } catch (e) {
                console.error("Failed refresh for SO sub-po", id);
            }
        }
        setIsRefreshingSo(null);
    };

    const handleCreateZohoInvoiceAction = async (eeRef: string, poRef: string, soObj?: GroupedSalesOrder) => {
        // Amazon FBA Interception
        if (soObj && (soObj.channel.toLowerCase().includes('amazon_fba') || soObj.channel.toLowerCase().includes('amazon fba'))) {
            setFbaShipmentModal({ isOpen: true, so: soObj });
            return;
        }

        setIsCreatingInvoice(eeRef);
        try {
            const res = await createZohoInvoice(eeRef);
            if (res.status === 'success') {
                addNotification(res.message || 'Invoice triggered.', 'success');
                addLog('Invoice Creation', `EE Ref: ${eeRef}`);
                
                // Immediate local state update to "Processing" to show feedback
                const parentPoNumbers = poRef.split(',').map(s => s.trim());
                setPurchaseOrders(prev => prev.map(po => {
                    if (parentPoNumbers.includes(po.poNumber)) {
                        return {
                            ...po,
                            items: po.items?.map(item => 
                                item.eeReferenceCode === eeRef ? { ...item, invoiceNumber: 'GENERATING...' } : item
                            )
                        };
                    }
                    return po;
                }));

                // Follow up with targeted refresh
                await refreshSingleSOState(poRef);
            } else {
                addNotification('Error: ' + res.message, 'error');
            }
        } catch (e) {
            addNotification('Network error.', 'error');
        } finally {
            setIsCreatingInvoice(null);
        }
    };

    const handleFbaSaveAndInvoice = async (fbaId: string) => {
        const so = fbaShipmentModal.so;
        if (!so) return;

        setIsCreatingInvoice(so.id);
        try {
            // Step 1: Update FBA ID in Sheet
            const updateRes = await updateFBAShipmentId(so.poReference, fbaId);
            if (updateRes.status !== 'success') {
                throw new Error("Failed to save FBA ID: " + updateRes.message);
            }

            // Step 2: Proceed with Zoho Invoice
            const res = await createZohoInvoice(so.id);
            if (res.status === 'success') {
                addNotification('FBA ID Saved & Invoice triggered.', 'success');
                addLog('Amazon FBA Invoice', `FBA ID: ${fbaId}, Ref: ${so.id}`);
                
                // Refresh data
                await refreshSingleSOState(so.poReference);
                setFbaShipmentModal({ isOpen: false, so: null });
            } else {
                addNotification('Zoho Error: ' + res.message, 'error');
            }
        } catch (e: any) {
            addNotification(e.message || 'Workflow failed.', 'error');
        } finally {
            setIsCreatingInvoice(null);
        }
    };

    const handlePushToNimbusAction = async (eeRef: string, poRef: string) => {
        setIsPushingNimbus(eeRef);
        try {
            const res = await pushToNimbusPost(eeRef);
            if (res.status === 'success') {
                const parentPoNumbers = poRef.split(',').map(s => s.trim());
                // Update local state immediately with AWB from response
                if (res.awb) {
                    setPurchaseOrders(prev => prev.map(po => {
                        if (parentPoNumbers.includes(po.poNumber)) {
                            return {
                                ...po,
                                awb: res.awb,
                                items: po.items?.map(item => 
                                    item.eeReferenceCode === eeRef ? { ...item, awb: res.awb, carrier: 'Assigned' } : item
                                )
                            };
                        }
                        return po;
                    }));
                }
                addNotification(res.message || 'Pushed to Nimbus.', 'success');
                addLog('Nimbus Shipping', `EE Ref: ${eeRef}`);
                
                // Follow up with targeted refresh to get full tracking details
                await refreshSingleSOState(poRef);
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
        const eeStatusLower = so.originalEeStatus.toLowerCase().trim();
        const canInvoice = !so.invoiceNumber && eeStatusLower !== 'open' && (eeStatusLower === 'confirmed' || so.status === 'Batch Created');

        if (canInvoice) return { label: isCreatingInvoice === so.id ? 'Creating...' : 'Create Invoice', color: 'bg-purple-600 text-white hover:bg-purple-700', onClick: () => handleCreateZohoInvoiceAction(so.id, so.poReference, so), disabled: isExecuting };
        if (so.status === 'Invoiced' && !so.awb && so.boxCount > 0) {
            const isInstamart = so.channel.toLowerCase().includes('instamart');
            const ewbMissing = (so.invoiceTotal || 0) >= 50000 && !so.ewb;

            if (ewbMissing) {
                return { 
                    label: 'EWB Missing', 
                    color: 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed', 
                    onClick: () => addNotification('E-Way Bill required for orders >= ₹50,000.', 'warning'), 
                    disabled: true 
                };
            }

            return { 
                label: isPushingNimbus === so.id ? 'Shipping...' : 'Ship Nimbus', 
                color: 'bg-blue-600 text-white hover:bg-blue-700', 
                onClick: () => {
                    if (isInstamart) {
                        setShippingConfirm({ isOpen: true, so });
                    } else {
                        handlePushToNimbusAction(so.id, so.poReference);
                    }
                }, 
                disabled: isExecuting 
            };
        }
        if (so.status === 'Label Generated' || so.awb) return { label: 'Track Order', color: 'bg-partners-green text-white hover:bg-green-700', onClick: () => setExpandedRowId(so.id), disabled: isExecuting };
        return { label: 'Details', color: 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100', onClick: () => setExpandedRowId(so.id), disabled: isExecuting };
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            {portalHelper.isOpen && portalHelper.so && <PortalHelperModal so={portalHelper.so} onClose={() => setPortalHelper({ isOpen: false, so: null })} />}
            {instamartPrintPackModal.isOpen && instamartPrintPackModal.so && <InstamartPrintManager so={instamartPrintPackModal.so} onClose={() => setInstamartPrintPackModal({ isOpen: false, so: null })} />}
            {fbaShipmentModal.isOpen && fbaShipmentModal.so && (
                <FbaShipmentModal 
                    so={fbaShipmentModal.so} 
                    isSaving={isCreatingInvoice === fbaShipmentModal.so.id}
                    onClose={() => setFbaShipmentModal({ isOpen: false, so: null })}
                    onSave={handleFbaSaveAndInvoice}
                />
            )}
            {shippingConfirm.isOpen && shippingConfirm.so && (
                <ShippingConfirmationModal 
                    so={shippingConfirm.so} 
                    onClose={() => setShippingConfirm({ isOpen: false, so: null })} 
                    onConfirm={() => {
                        const so = shippingConfirm.so!;
                        setShippingConfirm({ isOpen: false, so: null });
                        handlePushToNimbusAction(so.id, so.poReference);
                    }}
                    onPrint={() => {
                        const so = shippingConfirm.so!;
                        setShippingConfirm({ isOpen: false, so: null });
                        setInstamartPrintPackModal({ isOpen: true, so });
                    }}
                />
            )}
            
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveFilter(tab.id)} className={`px-3 py-1.5 text-sm font-semibold rounded-full border transition-all ${activeFilter === tab.id ? 'bg-partners-green text-white border-partners-green shadow-sm' : 'bg-white text-gray-600 border-partners-border hover:bg-gray-50'}`}>{tab.name} <span className="ml-1 text-[10px] opacity-70">({salesTabCounts[tab.id] || 0})</span></button>
                    ))}
                </div>
                <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-all"><CloudDownloadIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync All Data</button>
            </div>

            <div className="mt-6 overflow-x-auto border border-gray-100 rounded-xl shadow-inner max-h-[70vh]">
                <table className="w-full text-sm text-left text-gray-600 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-20">
                        <tr>
                            <th className="p-4 w-4 sticky left-0 bg-gray-50 z-30 border-r border-gray-100"></th>
                            <th className="px-6 py-3 text-blue-600 sticky left-12 bg-gray-50 z-30 border-r border-gray-100 min-w-[150px]">
                                <div className="flex items-center gap-2">SO ID (EE Ref)<button onClick={() => setActiveFilterColumn(activeFilterColumn === 'id' ? null : 'id')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.id ? 'text-partners-green' : 'text-gray-400'}`}><SearchIcon className="h-3 w-3"/></button></div>
                                {activeFilterColumn === 'id' && (<div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case"><input type="text" autoFocus placeholder="Search ID..." className="w-full px-3 py-1.5 text-xs border rounded-md focus:ring-1 focus:ring-partners-green" value={columnFilters.id || ''} onChange={(e) => setColumnFilters({...columnFilters, id: e.target.value})} /></div>)}
                            </th>
                            <th className="px-6 py-3">EE Status</th>
                            <th className="px-6 py-3 min-w-[140px]">
                                <div className="flex items-center gap-2">Channel<button onClick={() => setActiveFilterColumn(activeFilterColumn === 'channel' ? null : 'channel')} className={`p-1 rounded hover:bg-gray-200 ${columnFilters.channel ? 'text-partners-green' : 'text-gray-400'}`}><FilterIcon className="h-3 w-3"/></button></div>
                                {activeFilterColumn === 'channel' && (<div ref={filterMenuRef} className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 p-2 z-40 normal-case"><select className="w-full px-2 py-1.5 text-xs border rounded-md" value={columnFilters.channel || ''} onChange={(e) => setColumnFilters({...columnFilters, channel: e.target.value})}><option value="">All Channels</option>{uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}</select></div>)}
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
                                const isRefreshing = isRefreshingSo === so.poReference;
                                
                                // Error proofing: Check if it's an Instamart order with box data
                                const isInstamart = so.channel.toLowerCase().includes('instamart');
                                const showPrintActionInRow = isInstamart && so.boxCount > 0 && (so.status === 'Invoiced' || so.status === 'Label Generated' || !!so.awb);

                                return (
                                    <Fragment key={so.id}>
                                        <tr className={`border-b hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : 'bg-white'}`} onClick={() => setExpandedRowId(isExpanded ? null : so.id)}>
                                            <td className="p-4 text-center sticky left-0 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]"><div className="text-gray-400 hover:text-partners-green">{isExpanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}</div></td>
                                            <td className="px-6 py-4 font-bold text-blue-600 whitespace-nowrap sticky left-12 z-10 bg-inherit border-r border-gray-100 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">{so.id}</td>
                                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${so.status === 'Returned' ? 'bg-red-100 text-red-700' : so.status === 'Shipped' ? 'bg-emerald-100 text-emerald-700' : so.status === 'Label Generated' ? 'bg-amber-100 text-amber-700' : so.status === 'Box Data Upload Pending' ? 'bg-red-50 text-red-700 border border-red-100' : so.status === 'Invoiced' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>{so.status}</span></td>
                                            <td className="px-6 py-4 font-medium text-gray-800">{so.channel}</td>
                                            <td className="px-6 py-4">{so.storeCode}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{so.qty} / ₹{totalAmountIncTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-400">{so.orderDate}</td>
                                            <td className="px-6 py-4 text-center sticky right-0 z-10 bg-inherit border-l border-gray-100 shadow-[-2px_0_4px_rgba(0,0,0,0.02)]" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2">
                                                    {showPrintActionInRow && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setInstamartPrintPackModal({ isOpen: true, so }); }}
                                                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap bg-partners-green text-white hover:bg-green-700 flex items-center gap-1.5"
                                                            title="Print Instamart Box Labels"
                                                        >
                                                            <PrinterIcon className="h-3.5 w-3.5" /> Print Labels
                                                        </button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); action.onClick?.(); }} disabled={action.disabled} className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all shadow-sm active:scale-95 whitespace-nowrap ${action.color} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>{action.label}</button>
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
                                                                <div className="flex justify-between items-center mb-4">
                                                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><CalendarIcon className="h-4 w-4 text-blue-500" /> Fulfillment Ref</h4>
                                                                    <button 
                                                                        onClick={() => refreshSingleSOState(so.poReference)}
                                                                        disabled={isRefreshing}
                                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                                                                    >
                                                                        <RefreshIcon className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                                                                        {isRefreshing ? 'Refreshing...' : 'Refresh Targeted'}
                                                                    </button>
                                                                </div>
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
                                                                            {(!so.invoiceNumber && so.originalEeStatus.toLowerCase().trim() !== 'open' && (so.originalEeStatus.toLowerCase().trim() === 'confirmed' || so.status === 'Batch Created')) ? (
                                                                                <button onClick={() => handleCreateZohoInvoiceAction(so.id, so.poReference, so)} disabled={!!isCreatingInvoice} className="mt-4 px-4 py-2 bg-purple-600 text-white text-[11px] font-bold rounded-lg shadow-sm hover:bg-purple-700 flex items-center gap-2 transition-all active:scale-95">{isCreatingInvoice === so.id ? <RefreshIcon className="h-3 w-3 animate-spin" /> : <PlusIcon className="h-3 w-3" />}{isCreatingInvoice === so.id ? 'Creating...' : 'Create Zoho Invoice'}</button>
                                                                            ) : (<p className="mt-3 text-[10px] text-gray-400 italic bg-gray-100 px-3 py-1 rounded-full border border-gray-200">{so.originalEeStatus.toLowerCase().trim() === 'open' ? 'Awaiting Confirmation (Status: Open)' : 'Pending Picking/Batching in EasyEcom'}</p>)}
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
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><GlobeIcon className="h-4 w-4 text-blue-600" /> Logistics & Shipment Status</h4>
                                                                <div className="flex items-center gap-3">
                                                                    {(so.channel.toLowerCase().includes('instamart') && so.boxCount > 0) && (
                                                                        <div className="flex gap-2">
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); setInstamartPrintPackModal({ isOpen: true, so }); }}
                                                                                className="flex items-center gap-2 px-6 py-2 bg-partners-green text-white text-[11px] font-bold rounded-lg shadow-md hover:bg-green-700 transition-all active:scale-95 animate-in fade-in zoom-in-95"
                                                                            >
                                                                                <PrinterIcon className="h-4 w-4" /> Print Full Packset (PDF)
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {(so.invoiceNumber && !so.awb && so.boxCount > 0) && (
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (so.channel.toLowerCase().includes('instamart')) {
                                                                                        setShippingConfirm({ isOpen: true, so });
                                                                                    } else {
                                                                                        handlePushToNimbusAction(so.id, so.poReference);
                                                                                    }
                                                                                }} 
                                                                                disabled={!!isPushingNimbus || ((so.invoiceTotal || 0) >= 50000 && !so.ewb)} 
                                                                                className={`flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-[11px] font-bold rounded-lg shadow-md transition-all active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed`}
                                                                            >
                                                                                {isPushingNimbus === so.id ? <RefreshIcon className="h-3 w-3 animate-spin" /> : <SendIcon className="h-3 w-3" />}
                                                                                {isPushingNimbus === so.id ? 'Shipping...' : 'Ship with Nimbus Post'}
                                                                            </button>
                                                                            {((so.invoiceTotal || 0) >= 50000 && !so.ewb) && (
                                                                                <p className="text-[10px] text-red-600 font-black animate-pulse uppercase tracking-tighter">EWB Missing</p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                                                <div className={`p-4 rounded-xl border transition-all ${so.boxCount > 0 ? 'bg-partners-light-green border-partners-green/20' : 'bg-red-50 border-red-100'}`}><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Package Detail</p><div className="flex items-center gap-2"><CubeIcon className={`h-5 w-5 ${so.boxCount > 0 ? 'text-partners-green' : 'text-red-400'}`} /><div><p className="text-sm font-bold text-gray-800">Box Count</p><p className={`text-lg font-black ${so.boxCount > 0 ? 'text-partners-green' : 'text-red-600'}`}>{so.boxCount || 0}</p></div></div></div>
                                                                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100"><p className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Appointment Date</p><div className="flex flex-col h-full"><div className="flex items-center gap-2"><CalendarIcon className={`h-4 w-4 ${so.appointmentDate ? 'text-indigo-600' : 'text-gray-300'}`} /><p className={`text-sm font-bold ${so.appointmentDate ? 'text-indigo-700' : 'text-gray-400'}`}>{so.appointmentDate || so.appointmentRequestDate || 'Pending'}</p></div><p className="text-[9px] text-indigo-400 font-medium mt-1 uppercase tracking-tighter">{so.appointmentDate ? 'Confirmed' : so.appointmentRequestDate ? 'Requested' : 'To be Scheduled'}</p></div></div>
                                                                {so.awb ? <>
                                                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 col-span-1 md:col-span-1"><div className="flex flex-col h-full justify-between"><div><p className="text-[10px] font-bold text-blue-400 uppercase">Carrier & AWB</p><p className="text-sm font-bold text-gray-900 truncate">{so.carrier || 'Pending'}</p><p className="text-xs font-mono text-blue-600 font-bold tracking-wider">{so.awb}</p></div><span className={`mt-2 w-fit px-2 py-0.5 rounded text-[10px] font-bold border ${so.trackingStatus?.toLowerCase().includes('deliv') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{so.trackingStatus || 'In-Transit'}</span></div></div>
                                                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Delivery SLA</p><div className="space-y-3"><div><p className="text-[9px] font-bold text-gray-400">Exp Delivery Date</p><p className="text-sm font-bold text-partners-green">{so.edd || 'TBD'}</p></div><div><p className="text-[9px] font-bold text-gray-400">Delivered Date</p><p className="text-sm font-bold text-gray-800">{so.deliveredDate || '-'}</p></div></div></div>
                                                                <div className={`p-4 rounded-xl border ${so.status === 'Returned' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}><p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Return Status (RTO)</p>{so.status === 'Returned' ? <div className="space-y-2"><p className="text-xs font-bold text-red-600">{so.rtoStatus || 'Returned'}</p><div><p className="text-[9px] font-bold text-gray-400">Return AWB</p><p className="text-xs font-mono font-bold text-red-600">{so.rtoAwb || 'N/A'}</p></div></div> : <div className="flex flex-col items-center justify-center py-2"><CheckCircleIcon className="h-6 w-6 text-gray-200" /><p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">No Returns</p></div>}</div>
                                                            </> : <div className="md:col-span-3 p-12 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center justify-center text-center">{!so.invoiceNumber ? <><LockClosedIcon className="h-8 w-8 text-gray-200 mb-3" /><p className="text-sm font-bold text-gray-400 uppercase">Logistics Pending Invoice Generation</p></> : so.boxCount === 0 ? <><div className="p-4 bg-red-50 rounded-xl border border-red-100 mb-3"><CubeIcon className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm font-bold text-red-600 uppercase">Missing Physical Box Data</p></div><p className="text-xs text-red-400">Update box count in the backend to enable shipping.</p></> : <><TruckIcon className="h-8 w-8 text-blue-200 mb-3" /><p className="text-sm font-bold text-blue-400 uppercase">Invoice Ready for Shipment</p><p className="text-xs text-blue-300 mt-1">Generate AWB by clicking the 'Ship with Nimbus' button above.</p></>}</div>}
                                                            </div>
                                                            {so.awb && (so.channel.toLowerCase().includes('blinkit') || so.channel.toLowerCase().includes('zepto')) && so.status !== 'Shipped' && so.status !== 'Returned' && (
                                                                <div className={`mt-4 border p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 animate-in fade-in slide-in-from-top-2 ${so.channel.toLowerCase().includes('zepto') ? 'bg-purple-50 border-purple-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${so.channel.toLowerCase().includes('zepto') ? 'bg-purple-600' : 'bg-yellow-400'}`}>
                                                                            <span className="font-black italic text-xl">{so.channel.toLowerCase().includes('zepto') ? 'z' : 'b'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <p className={`text-xs font-bold uppercase ${so.channel.toLowerCase().includes('zepto') ? 'text-purple-800' : 'text-yellow-800'}`}>{so.channel.toLowerCase().includes('zepto') ? 'Zepto Brands' : 'Blinkit'} Portal Action Required</p>
                                                                            <p className={`text-[10px] font-medium ${so.channel.toLowerCase().includes('zepto') ? 'text-purple-600' : 'text-yellow-600'}`}>AWB assigned. Generate appointment pass before dispatching.</p>
                                                                        </div>
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setPortalHelper({ isOpen: true, so }); }} 
                                                                        className={`px-6 py-2.5 text-white text-[11px] font-bold rounded-xl shadow-md transition-all flex items-center gap-2 ${so.channel.toLowerCase().includes('zepto') ? 'bg-purple-600 hover:bg-purple-700' : 'bg-yellow-500 hover:bg-yellow-600'}`}
                                                                    >
                                                                        <CalendarIcon className="h-4 w-4" />Get Appointment Details
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between items-center mb-4">
                                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><DotsVerticalIcon className="h-4 w-4 text-partners-green rotate-90" /> SKU Breakdown</h4>
                                                            </div>
                                                            <div className="overflow-x-auto border rounded-xl"><table className="w-full text-[11px] text-left"><thead className="bg-gray-50 text-gray-500 uppercase"><tr><th className="py-2.5 px-4">Item Name / SKU</th><th className="py-2.5 text-right w-24">EE Item Qty</th><th className="py-2.5 text-right w-24 text-red-600">Cancelled</th><th className="py-2.5 text-right w-24 text-green-600">Shipped</th><th className="py-2.5 text-right w-24 text-orange-600">Returned</th><th className="py-2.5 px-4 text-center w-28">Item status</th></tr></thead><tbody className="divide-y divide-gray-100">{so.items.map((item, idx) => (<tr key={idx} className="hover:bg-gray-50"><td className="py-3 px-4"><p className="font-bold text-gray-800">{item.itemName}</p><p className="text-[10px] text-gray-400 font-mono">{item.masterSku || item.articleCode}</p></td><td className="py-3 text-right font-bold text-gray-900">{item.itemQuantity || 0}</td><td className="py-3 text-right text-red-600 font-bold">{item.cancelledQuantity || 0}</td><td className="py-3 text-right text-green-600 font-bold">{item.shippedQuantity || 0}</td><td className="py-3 text-right text-orange-600 font-bold">{item.returnedQuantity || 0}</td><td className="py-3 px-4 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase inline-block w-full ${item.itemStatus?.toLowerCase().includes('ship') ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{item.itemStatus || 'Processing'}</span></td></tr>))}</tbody></table></div>
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
