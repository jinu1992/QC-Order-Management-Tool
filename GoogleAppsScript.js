const SHEET_PO_DB = "PO_Database";
const SHEET_INVENTORY = "Master_SKU_Mapping";
const SHEET_CHANNEL_CONFIG = "Channel_Config";
const SHEET_USERS = "Users";
const SHEET_UPLOAD_LOGS = "Upload_Logs";
const LOG_DEBUG_SHEET = "System_Logs";

// Ensure this matches your actual Spreadsheet ID
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// Handle GET requests
function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getPurchaseOrders') return getPurchaseOrders();
  if (action === 'getInventory') return getInventory();
  if (action === 'getChannelConfigs') return getChannelConfigs();
  if (action === 'getSystemConfig') return getSystemConfig();
  if (action === 'getUsers') return getUsers();
  if (action === 'getUploadMetadata') return getUploadMetadata();
  return responseJSON({status: 'error', message: 'Invalid action'});
}

function getPurchaseOrders() {
  try {
    if (typeof fetchEasyEcomShipments === 'function') {
      fetchEasyEcomShipments();
    }
  } catch (e) {
    Logger.log("fetchEasyEcomShipments error: " + e.toString());
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_PO_DB);
  if (!sheet) return responseJSON({status: 'error', message: `Sheet "${SHEET_PO_DB}" not found.`});
  
  const data = getDataAsJSON(sheet);
  return responseJSON({status: 'success', data: data});
}

function getUploadMetadata() {
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
    if (action === 'syncZohoContactToEasyEcom') return responseJSON({status: 'success', message: 'Sync triggered'});
    
    return responseJSON({status: 'error', message: 'Invalid action: ' + action});
  } catch (error) {
    return responseJSON({status: 'error', message: "doPost Error: " + error.toString()});
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function debugLog(action, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getOrCreateSheet(LOG_DEBUG_SHEET, ["Timestamp", "Action", "Raw Payload"]);
    sheet.appendRow([new Date(), action, JSON.stringify(data)]);
  } catch (err) {}
}