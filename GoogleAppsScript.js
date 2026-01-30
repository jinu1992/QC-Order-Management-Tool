
const SHEET_PO_DB = "PO_Database";
const SHEET_INVENTORY = "Master_SKU_Mapping";
const SHEET_CHANNEL_CONFIG = "Channel_Config";
const SHEET_USERS = "Users";
const SHEET_UPLOAD_LOGS = "Upload_Logs";
const SHEET_PO_REPOSITORY = "PO_Repository";
const LOG_DEBUG_SHEET = "System_Logs";
const SHEET_PACKING_DATA = "Master_Packing_Data";

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getActiveSpreadsheet().getId() : "10pI-pT9-7l3mD9XqR9vLwT3KxY9Mv6A8fN2u-b0vA4I"; 

// Handle GET requests
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getPurchaseOrders') {
    const poNumber = e.parameter.poNumber;
    return getPurchaseOrders(poNumber);
  }
  if (action === 'getInventory') return getInventory();
  if (action === 'getChannelConfigs') return getChannelConfigs();
  if (action === 'getSystemConfig') return getSystemConfig();
  if (action === 'getUsers') return getUsers();
  if (action === 'getUploadMetadata') return getUploadMetadata();
  if (action === 'getPackingData') {
    const refCode = e.parameter.referenceCode;
    return getPackingData(refCode);
  }
  return responseJSON({status: 'error', message: 'Invalid action'});
}

function getPackingData(referenceCode) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PACKING_DATA);
  if (!sheet) return responseJSON({status: 'error', message: `Sheet "${SHEET_PACKING_DATA}" not found.`});
  
  const rawData = sheet.getDataRange().getValues();
  if (rawData.length <= 1) return responseJSON({status: 'success', data: []});
  
  const headers = rawData[0];
  const refCodeIdx = headers.indexOf("Reference Code");

  const data = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.every(cell => cell === "")) continue;
    
    if (referenceCode && refCodeIdx !== -1 && String(row[refCodeIdx]).trim() !== String(referenceCode).trim()) {
        continue;
    }

    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = row[j]; }
    data.push(obj);
  }
  
  return responseJSON({status: 'success', data: data});
}

/**
 * Returns PO data from sheet. Optimized for single PO lookup.
 */
function getPurchaseOrders(poNumberFilter) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PO_DB);
  if (!sheet) return responseJSON({status: 'error', message: `Sheet "${SHEET_PO_DB}" not found.`});
  
  const rawData = sheet.getDataRange().getValues();
  if (rawData.length <= 1) return responseJSON({status: 'success', data: []});
  
  const headers = rawData[0];
  let poNumIdx = headers.indexOf("PO Number");
  if (poNumIdx === -1) poNumIdx = headers.indexOf("PO_Number");

  const data = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.every(cell => cell === "")) continue;
    
    // If filter is provided, skip non-matching rows
    if (poNumberFilter && poNumIdx !== -1 && String(row[poNumIdx]).trim() !== String(poNumberFilter).trim()) {
        continue;
    }

    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = row[j]; }
    data.push(obj);
  }
  
  return responseJSON({status: 'success', data: data});
}

function getUploadMetadata() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(SHEET_UPLOAD_LOGS, ["ID", "FunctionName", "LastUploadedBy", "LastUploadedAt", "Status", "FileName"]);
  const rows = getDataAsJSON(sheet);
  const map = {};
  rows.forEach(r => {
    map[r['ID']] = {
      id: r['ID'],
      functionName: r['FunctionName'],
      lastUploadedBy: r['LastUploadedBy'],
      lastUploadedAt: r['LastUploadedAt'],
      status: r['Status']
    };
  });
  return responseJSON({status: 'success', data: Object.values(map)});
}

function getUsers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(SHEET_USERS, ["ID", "Name", "Email", "Contact", "Role", "Avatar", "Password", "IsInitialized"]);
  return responseJSON({status: 'success', data: getDataAsJSON(sheet)});
}

// Handle POST requests
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return responseJSON({status: 'error', message: 'No data'});
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    debugLog(action || "UNKNOWN_ACTION", data);

    if (action === 'login') return loginUser(data.email, data.password);
    if (action === 'resetPassword') return resetPassword(data.userId);
    if (action === 'saveUser') return saveUser(data);
    if (action === 'deleteUser') return deleteUser(data.userId);
    if (action === 'logFileUpload') return logFileUpload(data);
    if (action === 'createItem') return createInventoryItem(data);
    if (action === 'updatePrice') return updateInventoryPrice(data);
    if (action === 'saveChannelConfig') return saveChannelConfig(data);
    if (action === 'saveSystemConfig') return saveSystemConfig(data);
    if (action === 'pushToEasyEcom') return pushToEasyEcom(data);
    if (action === 'sendAppointmentEmail') return sendAppointmentEmail(data);
    if (action === 'createZohoInvoice') return handleCreateZohoInvoice(data.eeReferenceCode);
    if (action === 'pushToNimbus') return handlePushToNimbus(data.eeReferenceCode);
    if (action === 'syncZohoContacts') return handleSyncZohoContacts();
    if (action === 'syncZohoContactToEasyEcom') return handleSyncZohoContactToEasyEcom(data.contactId);
    if (action === 'syncSinglePO') return handleSyncSinglePO(data.poNumber);
    if (action === 'updatePOStatus') return updatePOStatus(data.poNumber, data.status);
    if (action === 'syncInventory') return handleSyncInventory();
    if (action === 'cancelLineItem') return handleCancelLineItem(data.poNumber, data.articleCode);
    
    return responseJSON({status: 'error', message: 'Invalid action: ' + action});
  } catch (error) {
    return responseJSON({status: 'error', message: "doPost Error: " + error.toString()});
  }
}

/**
 * Enhanced line-item cancellation.
 * Targets both 'EE_item_item_status' and global 'Status' to ensure consistency for unpushed POs.
 */
function handleCancelLineItem(poNumber, articleCode) {
    console.log(`[GAS-CANCEL] Executing Cancel for PO: ${poNumber}, Article: ${articleCode}`);
    try {
        const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
        const sheet = ss.getSheetByName(SHEET_PO_DB);
        if (!sheet) throw new Error("PO_Database sheet not found");

        const fullRange = sheet.getDataRange();
        const data = fullRange.getValues();
        const headers = data[0].map(h => String(h).trim().toLowerCase());
        
        const poNumIdx = headers.indexOf("po number") !== -1 ? headers.indexOf("po number") : headers.indexOf("po_number");
        const artCodeIdx = headers.indexOf("item code") !== -1 ? headers.indexOf("item code") : headers.indexOf("article code");
        const lineStatusIdx = headers.indexOf("ee_item_item_status");
        const globalStatusIdx = headers.indexOf("status");

        if (poNumIdx === -1 || artCodeIdx === -1) {
            throw new Error(`Critical columns missing. Found: ${headers.join(', ')}`);
        }

        let updateCount = 0;
        const targetPo = String(poNumber).trim();
        const targetSku = String(articleCode).trim();

        for (let i = 1; i < data.length; i++) {
            const rowPo = String(data[i][poNumIdx]).trim();
            const rowSku = String(data[i][artCodeIdx]).trim();

            if (rowPo === targetPo && rowSku === targetSku) {
                console.log(`[GAS-CANCEL] Updating match on row ${i + 1}`);
                
                // Update line-level status if column exists
                if (lineStatusIdx !== -1) {
                    sheet.getRange(i + 1, lineStatusIdx + 1).setValue("Cancelled");
                }
                
                // Also update global status if it's currently New or Below Threshold
                if (globalStatusIdx !== -1) {
                    const currentVal = String(data[i][globalStatusIdx]).trim().toLowerCase();
                    if (currentVal === "" || currentVal === "new" || currentVal === "below threshold") {
                        sheet.getRange(i + 1, globalStatusIdx + 1).setValue("Cancelled");
                    }
                }
                
                updateCount++;
            }
        }

        if (updateCount === 0) {
            return responseJSON({ status: 'error', message: `SKU ${targetSku} not found in PO ${targetPo}.` });
        }

        SpreadsheetApp.flush();
        return responseJSON({ status: 'success', message: `Cancelled ${updateCount} matching line(s).` });
    } catch (e) {
        console.error(`[GAS-CANCEL] Fatal Error:`, e);
        return responseJSON({ status: 'error', message: "GAS Failure: " + e.toString() });
    }
}

function handleSyncInventory() {
    try {
        if (typeof updateMasterSkuInventory === 'function') {
            updateMasterSkuInventory();
            return responseJSON({ status: 'success', message: 'Master SKU Inventory sync completed.' });
        } else {
            return responseJSON({ status: 'error', message: 'updateMasterSkuInventory function not found in GAS.' });
        }
    } catch (e) {
        return responseJSON({ status: 'error', message: e.toString() });
    }
}

function handleSyncZohoContacts() {
  try {
    if (typeof syncZohoContacts === 'function') {
      syncZohoContacts();
      return responseJSON({status: 'success', message: 'Zoho contacts sync initiated.'});
    } else {
      return responseJSON({status: 'error', message: 'syncZohoContacts function not implemented in GAS.'});
    }
  } catch (e) {
    return responseJSON({status: 'error', message: e.toString()});
  }
}

function handleSyncZohoContactToEasyEcom(contactId) {
  try {
    if (typeof syncZohoContactToEasyEcom === 'function') {
      syncZohoContactToEasyEcom(contactId);
      return responseJSON({status: 'success', message: 'Zoho contact sync to EasyEcom triggered.'});
    } else {
      return responseJSON({status: 'error', message: 'syncZohoContactToEasyEcom function not found.'});
    }
  } catch (e) {
    return responseJSON({status: 'error', message: e.toString()});
  }
}

function handleSyncSinglePO(poNumber) {
    try {
        if (typeof fetchSingleEasyEcomShipment === 'function') {
            fetchSingleEasyEcomShipment(poNumber);
            return responseJSON({ status: 'success', message: `Sync for PO ${poNumber} triggered.` });
        } else {
            return responseJSON({ status: 'error', message: 'Targeted PO sync function not found in GAS.' });
        }
    } catch (e) {
        return responseJSON({ status: 'error', message: e.toString() });
    }
}

/**
 * Handle File Uploads and process content based on FunctionID
 */
function logFileUpload(data) {
  const { functionId, userName, fileData, fileName } = data;
  const timestamp = new Date().toLocaleString();
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateSheet(SHEET_UPLOAD_LOGS, ["ID", "FunctionName", "LastUploadedBy", "LastUploadedAt", "Status", "FileName"]);
  
  try {
    if (functionId === 'amazon-b2b-shipment') {
      const processResult = processAmazonB2BShipment(fileData, fileName, userName);
      if (processResult.status === 'success') {
        logSheet.appendRow([functionId, "Amazon B2B Shipment", userName, timestamp, "Success", fileName]);
        return responseJSON({ status: 'success', message: processResult.message });
      } else {
        throw new Error(processResult.message);
      }
    }
    
    // Default metadata log for other uploads
    logSheet.appendRow([functionId, functionId, userName, timestamp, "Success", fileName]);
    return responseJSON({ status: 'success', message: 'File upload logged.' });
    
  } catch (err) {
    logSheet.appendRow([functionId, functionId, userName, timestamp, "Error", fileName]);
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function processAmazonB2BShipment(base64Data, fileName, userEmail) {
  if (!base64Data) return { status: 'error', message: 'No file data received.' };
  
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(base64Data), "text/csv").getDataAsString();
    const rows = Utilities.parseCsv(decoded);
    
    if (rows.length < 2) return { status: 'error', message: 'File is empty or invalid.' };
    
    const headers = rows[0].map(h => h.trim());
    const fcIdIdx = headers.indexOf("FC ID");
    const shipmentIdIdx = headers.indexOf("Shipment ID");
    
    if (fcIdIdx === -1 || shipmentIdIdx === -1) {
      return { status: 'error', message: 'Missing required columns: "FC ID" or "Shipment ID".' };
    }
    
    const repoSheet = getOrCreateSheet(SHEET_PO_REPOSITORY, [
      "Date Received", "Channel Name", "Sender Email", "Subject", "File Name", "Drive Link", "Category", "PO Number", "Store Code", "Status"
    ]);
    
    const uniqueShipments = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const shipmentId = String(row[shipmentIdIdx]).trim();
      const fcId = String(row[fcIdIdx]).trim();
      if (shipmentId && fcId) uniqueShipments.set(shipmentId, fcId);
    }
    
    const dateStr = new Date().toLocaleDateString('en-GB');
    let count = 0;
    uniqueShipments.forEach((fcId, shipmentId) => {
      repoSheet.appendRow([dateStr, "Amazon", userEmail, "Amazon B2B Shipment Upload", fileName, "-", "B2B Shipment", shipmentId, "Amazon_" + fcId, "New"]);
      count++;
    });
    
    return { status: 'success', message: `Successfully processed ${count} unique shipments.` };
    
  } catch (e) {
    return { status: 'error', message: 'Parsing Error: ' + e.toString() };
  }
}

function updatePOStatus(poNumber, status) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_PO_DB);
    if (!sheet) throw new Error("PO_Database sheet not found");

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    
    let poNumIndex = headers.indexOf("po number");
    if (poNumIndex === -1) poNumIndex = headers.indexOf("po_number");
    
    let statusIndex = headers.indexOf("status");
    if (statusIndex === -1) statusIndex = headers.indexOf("po status");

    if (poNumIndex === -1 || statusIndex === -1) throw new Error("Required columns not found.");

    let updateCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][poNumIndex]).trim() === String(poNumber).trim()) {
        sheet.getRange(i + 1, statusIndex + 1).setValue(status);
        updateCount++;
      }
    }

    if (updateCount === 0) return responseJSON({ status: 'error', message: `PO ${poNumber} not found.` });

    SpreadsheetApp.flush();
    return responseJSON({ status: 'success', message: `Successfully marked PO ${poNumber} as ${status}.` });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function getInventory() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  return responseJSON({status: 'success', data: getDataAsJSON(sheet)});
}

function getChannelConfigs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CHANNEL_CONFIG);
  return responseJSON({status: 'success', data: getDataAsJSON(sheet)});
}

function getSystemConfig() {
  const props = PropertiesService.getScriptProperties();
  return responseJSON({ status: 'success', data: { easyecom_email: props.getProperty('EASY_ECOM_EMAIL') || '' } });
}

function getDataAsJSON(sheet) {
  if (!sheet) return [];
  const rawData = sheet.getDataRange().getValues();
  if (rawData.length <= 1) return [];
  const headers = rawData[0];
  const data = [];
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.every(cell => cell === "")) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = row[j]; }
    data.push(obj);
  }
  return data;
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function debugLog(action, data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = getOrCreateSheet(LOG_DEBUG_SHEET, ["Timestamp", "Action", "Raw Payload"]);
    sheet.appendRow([new Date(), action, JSON.stringify(data)]);
  } catch (err) {}
}
