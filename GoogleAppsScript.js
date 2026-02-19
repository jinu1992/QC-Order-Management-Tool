/**
 * ============================================================================
 * QUICKCOMMERCE DASHBOARD BACKEND (Google Apps Script)
 * ============================================================================
 */

// IDs & Sheet Names
const SPREADSHEET_ID = '1YM0dKPWySifYFDyNqCenJ4L85xIBSTrBGNPDcoo6Kfg'; 
const DRIVE_FOLDER_ID = '1y8ANlFfmrymTub4H_GTajRRbiL0Z_Ie4'; 

// Sheet Names
const SHEET_PO_DB = "PO_Database";
const SHEET_PO_REPO = "PO_Repository";
const SHEET_INVENTORY = "Master_SKU_Mapping";
const SHEET_ZOHO_CUSTOMERS = "Zoho_Customers";
const SHEET_CHANNEL_CONFIG = "Channel_Config";
const SHEET_SHIPMENT_LOG = "EE Shipment Log";
const SHEET_EE_SHIPMENTS = "EE_Shipments";
const SHEET_EE_CUSTOMERS = "EE_Customers";
const LOG_DEBUG_SHEET = "System_Logs";
const SHEET_USERS = "Users";
const SHEET_UPLOAD_LOGS ="Upload_Logs";
const SHEET_MASTER_DATA ="Master_Packing_Data";

// API Endpoints
const EASYECOM_BASE_URL = "https://api.easyecom.io";
const EASYECOM_ORDERS_URL = `${EASYECOM_BASE_URL}/webhook/v2/createOrder`;

/**
 * Standard GAS JSON response helper.
 */
function responseJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'ping') return responseJSON({status: 'success', message: 'pong'});
    if (action === 'getPurchaseOrders') return getPurchaseOrders(e.parameter.poNumber);
    if (action === 'getInventory') return getInventory();
    if (action === 'getChannelConfigs') return getChannelConfigs();
    if (action === 'getSystemConfig') return getSystemConfig();
    if (action === 'getUsers') return getUsers();
    if (action === 'getUploadMetadata') return getUploadMetadata();
    if (action === 'getPackingData') return getPackingData(e.parameter.referenceCode);
    return responseJSON({status: 'error', message: 'Invalid action'});
  } catch (err) {
    return responseJSON({status: 'error', message: err.toString()});
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({status: 'error', message: 'No post data received'});
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    debugLog(action || "UNKNOWN_ACTION", data);

    let result;

    if (action === 'ping') result = { status: 'success', message: 'pong' };
    else if (action === 'saveUser') result = saveUser(data); 
    else if (action === 'deleteUser') result = deleteUser(data.userId); 
    else if (action === 'logFileUpload') result = logFileUpload(data);
    else if (action === 'createItem') result = createInventoryItem(data);
    else if (action === 'updatePrice') result = updateInventoryPrice(data);
    else if (action === 'saveChannelConfig') result = saveChannelConfig(data);
    else if (action === 'saveSystemConfig') result = saveSystemConfig(data);
    else if (action === 'pushToEasyEcom') result = pushToEasyEcom(data);
    else if (action === 'createZohoInvoice') result = handleCreateZohoInvoice(data.eeReferenceCode);
    else if (action === 'pushToNimbus') result = handlePushToNimbus(data.eeReferenceCode);
    else if (action === 'updatePOStatus') result = updatePOStatus(data.poNumber, data.status);
    else if (action === 'syncZohoContacts') result = handleSyncZohoContacts();
    else if (action === 'syncInventory') result = handleSyncInventory();
    else if (action === 'manual_sync_inventory_allocation') result = manual_sync_inventory_allocation();
    else if (action === 'cancelLineItem') result = handleCancelLineItem(data.poNumber, data.articleCode);
    else if (action === 'updateFBAShipmentId') result = handleUpdateFBAShipmentId(data.poNumber, data.fbaShipmentId);
    else if (action === 'fetchEasyEcomShipments') result = handleSyncEasyEcomShipments();
    else if (action === 'syncZohoContactToEasyEcom') {
      const ok = syncZohoContactToEasyEcom(data.contactId);
      result = ok === true ? {status: 'success'} : {status: 'error', message: 'Sync failed'};
    }
    else {
      return responseJSON({status: 'error', message: 'Invalid action: ' + action});
    }

    // Ensure we always wrap the result in responseJSON if the function didn't already
    if (result && result.getContentText) return result; // It's already a TextOutput
    return responseJSON(result || {status: 'success', message: 'Action processed'});

  } catch (error) {
    return responseJSON({status: 'error', message: "doPost Error: " + error.toString()});
  }
}

// ... [Existing helper functions like getPackingData, handleCancelLineItem, etc. remain unchanged] ...

function manual_sync_inventory_allocation() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const mapSheet = ss.getSheetByName(SHEET_INVENTORY);
  const dbSheet = ss.getSheetByName(SHEET_PO_DB);

  Logger.log("Starting Manual FIFO Inventory Allocation...");

  const mapData = mapSheet.getDataRange().getValues();
  const inventoryMap = new Map(); 

  mapData.slice(1).forEach(row => {
    const sku = String(row[2]).trim();
    const qty = Number(row[4]) || 0;
    if (sku) inventoryMap.set(sku, qty);
  });

  const dbLastRow = dbSheet.getLastRow();
  if (dbLastRow < 2) return { status: 'success', message: 'Database empty' };

  const dbRange = dbSheet.getRange(2, 1, dbLastRow - 1, 20);
  const dbData = dbRange.getValues();

  dbData.forEach((row, index) => {
    const status = String(row[0]).toLowerCase().trim();
    const eeRefId = String(row[19]).trim();
    if (status === 'waiting for confirmation' && eeRefId === '') {
      dbData[index][15] = 0; 
    }
  });

  const fifoOrders = dbData
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const status = String(row[0]).toLowerCase().trim();
      const eeRefId = String(row[19]).trim();
      return (status === 'new' || status === 'confirmed') && eeRefId === '';
    })
    .sort((a, b) => new Date(a.row[1]) - new Date(b.row[1]));

  fifoOrders.forEach(({ row, index }) => {
    const sku = String(row[8]).trim();
    const reqQty = Number(row[10]) || 0;
    let available = inventoryMap.get(sku) || 0;
    const fulfillable = Math.min(reqQty, available);
    inventoryMap.set(sku, available - fulfillable);
    dbData[index][15] = fulfillable; 
  });

  const allocationOutput = dbData.map(row => [row[15]]);
  dbSheet.getRange(2, 16, allocationOutput.length, 1).setValues(allocationOutput);

  Logger.log("Manual FIFO Inventory Allocation Completed.");
  SpreadsheetApp.flush();
  
  return { status: 'success', message: 'Manual inventory allocation successful.' };
}

// ... [Rest of the file remains as provided in your last update] ...
