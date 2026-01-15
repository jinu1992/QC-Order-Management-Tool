
import { InventoryItem, PurchaseOrder, POStatus, POItem, ChannelConfig, StorePocMapping, User, UploadMetadata } from '../types';

const API_URL = 'https://script.google.com/macros/s/AKfycbwBDSNnN_xKlZc4cTwwKthd7-Nq8IE83csNdNHODP55EnVEz-gfWzcvzYdxGeNbJSPzZQ/exec'; 

/**
 * Shared helper for POST requests to Google Apps Script.
 */
const postToScript = async (payload: any) => {
    if (!API_URL || API_URL.includes('YOUR_SCRIPT_ID')) throw new Error("API URL is not configured.");
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        return response;
    } catch (error: any) {
        console.error("Fetch implementation failed:", error);
        throw error;
    }
};

export const logFileUpload = async (functionId: string, userName: string, fileData?: string, fileName?: string): Promise<{status: string, message?: string}> => {
    const response = await postToScript({ 
        action: 'logFileUpload', 
        functionId, 
        userName, 
        fileData, 
        fileName 
    });
    return await response.json();
};

export const createZohoInvoice = async (eeReferenceCode: string): Promise<{status: string, message?: string}> => {
    const response = await postToScript({ 
        action: 'createZohoInvoice', 
        eeReferenceCode 
    });
    return await response.json();
};

export const pushToNimbusPost = async (eeReferenceCode: string): Promise<{status: string, message?: string}> => {
    const response = await postToScript({ 
        action: 'pushToNimbus', 
        eeReferenceCode 
    });
    return await response.json();
};

export const fetchUploadMetadata = async (): Promise<UploadMetadata[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getUploadMetadata`, { method: 'GET', redirect: 'follow', mode: 'cors' });
        const json = await response.json();
        return json.status === 'success' ? json.data : [];
    } catch (error) {
        return [];
    }
};

export const loginUser = async (email: string, password: string): Promise<{status: string, message?: string, user?: User}> => {
    const response = await postToScript({ action: 'login', email, password });
    return await response.json();
};

export const resetUserPassword = async (userId: string) => {
    const response = await postToScript({ action: 'resetPassword', userId });
    return await response.json();
};

export const fetchUsers = async (): Promise<User[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getUsers`, { method: 'GET', redirect: 'follow', mode: 'cors' });
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
    const response = await postToScript({ action: 'saveUser', ...user });
    return await response.json();
};

export const deleteUserFromSheet = async (userId: string) => {
    const response = await postToScript({ action: 'deleteUser', userId });
    return await response.json();
};

export const fetchInventoryFromSheet = async (): Promise<InventoryItem[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getInventory`, { method: 'GET', redirect: 'follow', mode: 'cors' });
        const json = await response.json();
        if (json.status === 'success') return transformSheetDataToInventory(json.data);
        return [];
    } catch (error) { return []; }
};

export const fetchPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getPurchaseOrders`, { method: 'GET', redirect: 'follow', mode: 'cors' });
        const json = await response.json();
        if (json.status === 'success' && Array.isArray(json.data)) return transformSheetDataToPOs(json.data);
        return [];
    } catch (error) { return []; }
};

export const fetchStorePocMappings = async (): Promise<StorePocMapping[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getStorePocMappings`, { method: 'GET', redirect: 'follow', mode: 'cors' });
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
    const response = await postToScript({
        action: 'sendAppointmentEmail',
        ...params
    });
    return await response.json();
};

export const fetchChannelConfigs = async (): Promise<ChannelConfig[]> => {
    try {
        const response = await fetch(`${API_URL}?action=getChannelConfigs`, { method: 'GET', redirect: 'follow', mode: 'cors' });
        const json = await response.json();
        if (json.status === 'success' && Array.isArray(json.data)) return transformSheetDataToChannelConfigs(json.data);
        return [];
    } catch (error) { return []; }
};

export const fetchSystemConfig = async (): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}?action=getSystemConfig`, { method: 'GET', redirect: 'follow', mode: 'cors' });
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
            itemStatus: row['EE_item_item_status'],
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
            carrier: row['Carrier'],
            awb: row['AWB'],
            trackingStatus: row['Tracking Status'],
            edd: formatSheetDate(row['EDD']),
            latestStatus: row['Latest Status'],
            latestStatusDate: formatSheetDate(row['Latest Status Date']),
            currentLocation: row['Current Location'],
            deliveredDate: formatSheetDate(row['Delivered Date']),
            rtoStatus: row['RTO Status'],
            rtoAwb: row['RTO AWB']
        };

        if (poMap.has(poNumber)) {
            const po = poMap.get(poNumber)!;
            po.items?.push(item);
            po.qty += qty;
            po.amount += itemAmount;
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
                carrier: row['Carrier'],
                awb: row['AWB'],
                trackingStatus: row['Tracking Status'],
                edd: formatSheetDate(row['EDD']),
                latestStatus: row['Latest Status'],
                latestStatusDate: formatSheetDate(row['Latest Status Date']),
                currentLocation: row['Current Location'],
                deliveredDate: formatSheetDate(row['Delivered Date']),
                rtoStatus: row['RTO Status'],
                rtoAwb: row['RTO AWB']
            });
        }
    });
    return Array.from(poMap.values());
};

export const createInventoryItem = async (item: Partial<InventoryItem>) => {
     const response = await postToScript({ action: 'createItem', ...item });
     return await response.json();
};

export const updateInventoryPrice = async (channel: string, articleCode: string, newPrice: number) => {
    const response = await postToScript({ action: 'updatePrice', channel, articleCode, newPrice });
    return await response.json();
};

export const saveChannelConfig = async (config: ChannelConfig) => {
    const response = await postToScript({ action: 'saveChannelConfig', ...config });
    return await response.json();
};

export const saveSystemConfig = async (config: any) => {
    const response = await postToScript({ action: 'saveSystemConfig', ...config });
    return await response.json();
};

export const createEasyEcomCustomer = async (details: any) => {
    const response = await postToScript({ action: 'createEasyEcomCustomer', ...details });
    return await response.json();
};

export const requestZohoSync = async (contactId: string) => {
    const response = await postToScript({ 
        action: 'syncZohoContactToEasyEcom', 
        contactId: String(contactId).trim() 
    });
    return await response.json();
};

export const updatePOStatus = async (poNumber: string, status: string) => {
    const response = await postToScript({ 
        action: 'updatePOStatus', 
        poNumber,
        status
    });
    return await response.json();
};

export const cancelPurchaseOrder = async (poNumber: string) => {
    return updatePOStatus(poNumber, 'Cancelled');
};

export const pushToEasyEcom = async (po: PurchaseOrder, selectedArticleCodes: string[]) => {
    const itemsToSend = (po.items || []).filter(item => selectedArticleCodes.includes(item.articleCode))
        .map(item => ({
            ...item,
            unitCost: Number(((item.unitCost || 0) * 1.05).toFixed(2))
        }));
    const isPartial = (po.items || []).length > itemsToSend.length;
    const response = await postToScript({
        action: 'pushToEasyEcom',
        poNumber: po.poNumber,
        channel: po.channel,
        storeCode: po.storeCode,
        eeCustomerId: po.eeCustomerId,
        orderDate: po.orderDate,
        items: itemsToSend,
        isPartial
    });
    return await response.json();
};
