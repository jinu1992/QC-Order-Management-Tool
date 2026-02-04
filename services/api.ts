import { InventoryItem, PurchaseOrder, POStatus, POItem, ChannelConfig, StorePocMapping, User, UploadMetadata } from '../types';

/**
 * !!! IMPORTANT !!!
 * YOUR CURRENT API URL:
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbwBDSNnN_xKlZc4cTwwKthd7-Nq8IE83csNdNHODP55EnVEz-gfWzcvzYdxGeNbJSPzZQ/exec'; 

/**
 * Shared helper for POST requests to Google Apps Script.
 * We avoid setting 'Content-Type' to 'application/json' to prevent CORS preflight.
 * Google Apps Script can still parse the body as long as it is valid JSON.
 */
const postToScript = async (payload: any) => {
    if (!API_URL || API_URL.includes('template-id')) {
        throw new Error("Backend API URL is not configured.");
    }
    
    console.log(`[API-OUT] ${payload.action}:`, payload);
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            // Important: Do NOT set headers like Content-Type: application/json here.
            // Leaving it out makes it a "simple request" and avoids CORS preflight failures.
        });
        
        if (!response.ok) {
            throw new Error(`Network Error: Server returned ${response.status}`);
        }

        const text = await response.text();
        let result: any;
        
        try {
            result = JSON.parse(text);
        } catch (e) {
            console.error("[API-ERROR] Failed to parse JSON response:", text);
            // If the backend returned a string instead of JSON, but the request was successful
            if (text.toLowerCase().includes('success') || text.toLowerCase().includes('ok')) {
                return { status: 'success', message: 'Action completed successfully.' };
            }
            throw new Error("Invalid server response format. Check backend logs.");
        }

        // Normalize response to ensure status and message exist
        const normalizedResult = {
            status: result.status || 'success', // Default to success if result exists but no status
            message: result.message || result.error || 'Operation completed.',
            ...result
        };

        console.log(`[API-IN] ${payload.action} Result:`, normalizedResult);
        return normalizedResult;
    } catch (error: any) {
        console.error("[API-CRITICAL] Network/Script Failure:", error);
        throw new Error(error.message || "Cannot reach backend. Ensure GAS is deployed as 'Anyone'.");
    }
};

export const loginWithGoogle = async (credentialToken: string): Promise<{status: string, message?: string, user?: User}> => {
    return await postToScript({ 
        action: 'loginGoogle', 
        idToken: credentialToken 
    });
};

export const fetchPackingData = async (referenceCode: string): Promise<any[]> => {
    try {
        const url = `${API_URL}?action=getPackingData&referenceCode=${encodeURIComponent(referenceCode)}`;
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        return json.status === 'success' ? json.data : [];
    } catch (error) {
        return [];
    }
};

export const logFileUpload = async (functionId: string, userName: string, fileData?: string, fileName?: string): Promise<{status: string, message?: string}> => {
    return await postToScript({ 
        action: 'logFileUpload', 
        functionId, 
        userName, 
        fileData, 
        fileName 
    });
};

export const createZohoInvoice = async (eeReferenceCode: string): Promise<{status: string, message?: string}> => {
    return await postToScript({ 
        action: 'createZohoInvoice', 
        eeReferenceCode 
    });
};

export const pushToNimbusPost = async (eeReferenceCode: string): Promise<{status: string, message?: string, awb?: string}> => {
    return await postToScript({ 
        action: 'pushToNimbus', 
        eeReferenceCode 
    });
};

export const updateFBAShipmentId = async (poNumber: string, fbaShipmentId: string): Promise<{status: string, message?: string}> => {
    return await postToScript({ 
        action: 'updateFBAShipmentId', 
        poNumber,
        fbaShipmentId
    });
};

export const fetchUploadMetadata = async (): Promise<UploadMetadata[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getUploadMetadata`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        return json.status === 'success' ? json.data : [];
    } catch (error) {
        return [];
    }
};

export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getUsers`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        if (json.status === 'success' && Array.isArray(json.data)) {
            return json.data.map((row: any, index: number) => ({
                id: String(row['ID'] || index),
                name: row['Name'] || '',
                email: row['Email'] || '',
                contactNumber: String(row['Contact'] || ''),
                role: row['Role'] || 'Limited Access',
                avatarInitials: row['Avatar'] || (row['Name'] ? row['Name'].charAt(0) : 'U'),
                isInitialized: !!row['IsInitialized']
            }));
        }
        return [];
    } catch (error) {
        return [];
    }
};

export const saveUserToSheet = async (user: User) => {
    return await postToScript({ action: 'saveUser', ...user });
};

export const deleteUserFromSheet = async (userId: string) => {
    return await postToScript({ action: 'deleteUser', userId });
};

export const fetchInventoryFromSheet = async (): Promise<InventoryItem[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getInventory`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        if (json.status === 'success') return transformSheetDataToInventory(json.data);
        return [];
    } catch (error) { return []; }
};

export const syncInventoryFromEasyEcom = async (): Promise<{status: string, message?: string}> => {
    return await postToScript({ action: 'syncInventory' });
};

export const fetchPurchaseOrders = async (poNumber?: string): Promise<PurchaseOrder[]> => {
    try {
        const url = poNumber 
            ? `${API_URL}?action=getPurchaseOrders&poNumber=${encodeURIComponent(poNumber)}`
            : `${API_URL}?action=getPurchaseOrders`;
            
        const response = await fetch(url, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        if (json.status === 'success' && Array.isArray(json.data)) return transformSheetDataToPOs(json.data);
        return [];
    } catch (error) { return []; }
};

export const fetchPurchaseOrder = async (poNumber: string): Promise<PurchaseOrder | null> => {
    const orders = await fetchPurchaseOrders(poNumber);
    return orders.length > 0 ? orders[0] : null;
};

export const fetchStorePocMappings = async (): Promise<StorePocMapping[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getStorePocMappings`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        return json.status === 'success' ? json.data : [];
    } catch (error) { return []; }
};

export const sendAppointmentEmail = async (params: { 
  channel: string, 
  pos: { poNumber: string, storeCode: string, qty: number, boxes: number, dispatchDate: string, trackingUrl: string, trackingStatus: string, requestedDate: string }[],
  toEmails: string,
  ccEmails: string
}) => {
    return await postToScript({
        action: 'sendAppointmentEmail',
        ...params
    });
};

export const fetchChannelConfigs = async (): Promise<ChannelConfig[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getChannelConfigs`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        if (json.status === 'success' && Array.isArray(json.data)) return transformSheetDataToChannelConfigs(json.data);
        return [];
    } catch (error) { return []; }
};

export const fetchSystemConfig = async (): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}?action=getSystemConfig`, { method: 'GET', redirect: 'follow' });
        const json = await response.json();
        return json.status === 'success' ? json.data : {};
    } catch (error) { return {}; }
};

const transformSheetDataToInventory = (rows: any[]): InventoryItem[] => {
    return rows.map((row, index) => ({
        id: `inv-${index}-${Date.now()}`,
        channel: row['Channel'] || 'Unknown',
        articleCode: String(row['Channel Item Code'] || ''),
        sku: String(row['Master SKU'] || ''),
        ean: String(row['EAN'] || ''),
        itemName: row['Itemname'] || '', 
        mrp: Number(row['MRP'] || 0),
        basicPrice: 0, 
        spIncTax: Number(row['Selling Price'] || 0),
        stock: Number(row['Inventory'] || 0)
    }));
};

const transformSheetDataToChannelConfigs = (rows: any[]): ChannelConfig[] => {
    return rows.map((row) => ({
        id: row['Channel Name'] || '',
        channelName: row['Channel Name'] || '',
        status: (row['Status'] as 'Active' | 'Inactive') || 'Active',
        sourceEmail: row['Source Email'] || '',
        searchKeyword: row['Search Keyword'] || '',
        minOrderThreshold: Number(row['Min Order Threshold'] || 0),
        pocName: row['POC Name'] || '',
        pocEmail: row['POC Email'] || '',
        pocPhone: row['POC Phone'] || '',
        appointmentTo: row['Appointment To'] || '',
        appointmentCc: row['Appointment Cc'] || ''
    }));
};

const formatSheetDate = (dateVal: any): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && dateVal.length < 15 && !dateVal.includes('T')) return dateVal;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const transformSheetDataToPOs = (rows: any[]): PurchaseOrder[] => {
    const poMap = new Map<string, PurchaseOrder>();
    
    const getColumnValueCaseInsensitive = (rowObj: any, target: string) => {
        const normalizedTarget = target.toLowerCase().trim();
        for (const key in rowObj) {
            if (key.toLowerCase().trim() === normalizedTarget) return rowObj[key];
        }
        return undefined;
    };

    rows.forEach((row) => {
        const poNumber = row['PO Number'] || row['PO_Number'];
        if (!poNumber) return;
        const rawStatus = row['Status'] || 'New';
        let status = POStatus.NewPO;
        if (rawStatus === 'Below Threshold') status = POStatus.BelowThreshold;
        else if (Object.values(POStatus).includes(rawStatus as POStatus)) status = rawStatus as POStatus;
        
        const qty = Number(row['Qty'] || 0);
        const fulfillableQty = Number(row['Fulfillable qty'] || 0);
        const unitCost = Number(row['Unit Cost (Tax Exclusive)'] || 0);
        const itemAmount = qty * unitCost;
        const articleCode = String(row['Item Code'] || row['Article Code'] || '').trim();
        
        const eeRefBoxCount = Number(getColumnValueCaseInsensitive(row, 'Box Data') || 0);
        const ewb = row['EWB'] || row['E-Way Bill'] || row['Eway Bill'];

        const item: POItem = {
            articleCode,
            masterSku: String(row['Master SKU'] || ''),
            itemName: row['Item Name'] || '',
            qty,
            fulfillableQty,
            unitCost,
            mrp: Number(row['MRP'] || 0),
            priceCheckStatus: String(row['Price Check'] || '').trim(),
            eeOrderRefId: row['EE Order Ref ID'] || row['EE_Order_Ref_ID'],
            eeReferenceCode: row['EE_reference_code'], 
            eeOrderDate: formatSheetDate(row['EE_order_date']),
            itemStatus: row['EE_item_item_status'] || (rawStatus === 'Cancelled' ? 'Cancelled' : undefined),
            itemQuantity: Number(row['EE_item_item_quantity'] || 0),
            cancelledQuantity: Number(row['EE_item_cancelled_quantity'] || 0),
            shippedQuantity: Number(row['EE_item_shipped_quantity'] || 0),
            returnedQuantity: Number(row['EE_item_returned_quantity'] || 0),
            eeOrderStatus: row['EE_order_status'],
            eeBatchCreatedAt: formatSheetDate(row['EE_batch_created_at']),
            eeInvoiceDate: formatSheetDate(row['EE_invoice_date']),
            eeManifestDate: formatSheetDate(row['EE_manifest_date']),
            invoiceId: row['Invoice Id'],
            invoiceStatus: row['Invoice Status'],
            invoiceNumber: row['Invoice Number'],
            invoiceDate: formatSheetDate(row['Invoice Date']),
            invoiceTotal: Number(row['Invoice Total'] || 0),
            invoiceUrl: row['Invoice Url'],
            invoicePdfUrl: row['Invoice PDF Url'],
            eeBoxCount: eeRefBoxCount,
            ewb,
            fbaShipmentId: row['FBA Shipment IDs'],
            inboundPlanId: row['Inbound Plan ID'],
            gst: String(row['GST'] || ''),
            carrier: row['Carrier'],
            awb: row['AWB'],
            bookedDate: formatSheetDate(row['Booked Date']),
            trackingUrl: row['Tracking URL'],
            trackingStatus: row['Tracking Status'],
            edd: formatSheetDate(row['EDD']),
            latestStatus: row['Latest Status'],
            latestStatusDate: formatSheetDate(row['Latest Status Date']),
            currentLocation: row['Current Location'],
            deliveredDate: formatSheetDate(row['Delivered Date']),
            rtoStatus: row['RTO Status'],
            rtoAwb: row['RTO AWB'],
            freightCharged: Number(row['Freight Charged'] || 0),
            zohoItemId: row['Zoho Item ID']
        };

        if (poMap.has(poNumber)) {
            const po = poMap.get(poNumber)!;
            po.items?.push(item);
            po.qty += qty;
            po.amount += itemAmount;
            if (po.status === POStatus.Cancelled && status !== POStatus.Cancelled) {
                po.status = status;
            }
        } else {
            poMap.set(poNumber, {
                id: poNumber,
                poNumber,
                status,
                channel: row['Channel Name'] || 'Unknown',
                storeCode: row['Store Code'] || '',
                qty,
                amount: itemAmount,
                orderDate: formatSheetDate(row['PO Date']),
                poEdd: formatSheetDate(row['PO EDD']),
                poExpiryDate: formatSheetDate(row['PO Expiry Date']),
                eeCustomerId: row['EE Customer ID'] || row['EE_Customer_ID'],
                zohoContactId: row['Zoho Contact ID'] ? String(row['Zoho Contact ID']).trim() : undefined,
                source: 'API',
                items: [item],
                poPdfUrl: row['PO PDF'] || undefined,
                contactVerified: false,
                actionToBeTaken: status === POStatus.NewPO ? 'Upload PO PDF' : 'Review',
                amountReceived: 0,
                eeReferenceCode: row['EE_reference_code'],
                eeOrderDate: formatSheetDate(row['EE_order_date']),
                eeOrderId: row['EE_order_id'],
                eeOrderStatus: row['EE_order_status'],
                eeBatchCreatedAt: formatSheetDate(row['EE_batch_created_at']),
                eeInvoiceDate: formatSheetDate(row['EE_invoice_date']),
                eeManifestDate: formatSheetDate(row['EE_manifest_date']),
                ewb,
                fbaShipmentId: row['FBA Shipment IDs'],
                inboundPlanId: row['Inbound Plan ID'],
                gst: String(row['GST'] || ''),
                carrier: row['Carrier'],
                awb: row['AWB'],
                bookedDate: formatSheetDate(row['Booked Date']),
                trackingUrl: row['Tracking URL'],
                trackingStatus: row['Tracking Status'],
                edd: formatSheetDate(row['EDD']),
                latestStatus: row['Latest Status'],
                latestStatusDate: formatSheetDate(row['Latest Status Date']),
                currentLocation: row['Current Location'],
                deliveredDate: formatSheetDate(row['Delivered Date']),
                rtoStatus: row['RTO Status'],
                rtoAwb: row['RTO AWB'],
                freightCharged: Number(row['Freight Charged'] || 0),
                totalPoValue: Number(row['Total PO Value'] || 0),
                totalCostPrice: Number(row['Total cost price'] || 0)
            });
        }
    });
    return Array.from(poMap.values());
};

export const createInventoryItem = async (item: Partial<InventoryItem>) => {
     return await postToScript({ action: 'createItem', ...item });
};

export const updateInventoryPrice = async (channel: string, articleCode: string, newPrice: number) => {
    return await postToScript({ action: 'updatePrice', channel, articleCode, newPrice });
};

export const saveChannelConfig = async (config: ChannelConfig) => {
    return await postToScript({ action: 'saveChannelConfig', ...config });
};

export const saveSystemConfig = async (config: any) => {
    return await postToScript({ action: 'saveSystemConfig', ...config });
};

export const syncZohoContacts = async () => {
    return await postToScript({ action: 'syncZohoContacts' });
};

export const syncSinglePO = async (poNumber: string) => {
    return await postToScript({ action: 'syncSinglePO', poNumber });
};

export const syncEasyEcomShipments = async () => {
    return await postToScript({ action: 'fetchEasyEcomShipments' });
};

export const requestZohoSync = async (contactId: string) => {
    return await postToScript({ 
        action: 'syncZohoContactToEasyEcom', 
        contactId: String(contactId).trim() 
    });
};

export const updatePOStatus = async (poNumber: string, status: string) => {
    return await postToScript({ 
        action: 'updatePOStatus', 
        poNumber,
        status
    });
};

export const cancelPOLineItem = async (poNumber: string, articleCode: string) => {
    return await postToScript({ 
        action: 'cancelLineItem', 
        poNumber: String(poNumber).trim(),
        articleCode: String(articleCode).trim()
    });
};

export const pushToEasyEcom = async (po: PurchaseOrder, selectedArticleCodes: string[]) => {
    const itemsToSend = (po.items || [])
        .filter(item => selectedArticleCodes.includes(item.articleCode))
        .map(item => ({
            ...item,
            unitCost: Number(((item.unitCost || 0) * 1.05).toFixed(2))
        }));
    
    const isPartial = (po.items || []).length > itemsToSend.length;
    const { items: _, id: __, ...poMetadata } = po;

    return await postToScript({
        action: 'pushToEasyEcom',
        ...poMetadata,
        items: itemsToSend,
        isPartial
    });
};