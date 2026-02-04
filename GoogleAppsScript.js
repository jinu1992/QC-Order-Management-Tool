
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
  if (action === 'getPurchaseOrders') return getPurchaseOrders(e.parameter.poNumber);
  if (action === 'getInventory') return getInventory();
  if (action === 'getChannelConfigs') return getChannelConfigs();
  if (action === 'getSystemConfig') return getSystemConfig();
  if (action === 'getUsers') return getUsers();
  if (action === 'getUploadMetadata') return getUploadMetadata();
  if (action === 'getPackingData') return getPackingData(e.parameter.referenceCode);
  return responseJSON({status: 'error', message: 'Invalid action'});
}

// Handle POST requests
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return responseJSON({status: 'error', message: 'No data'});
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    debugLog(action || "UNKNOWN_ACTION", data);

    if (action === 'loginGoogle') return handleGoogleLogin(data.idToken);
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
    if (action === 'fetchEasyEcomShipments') return handleSyncEasyEcomShipments();
    if (action === 'updatePOStatus') return updatePOStatus(data.poNumber, data.status);
    if (action === 'syncInventory') return handleSyncInventory();
    if (action === 'cancelLineItem') return handleCancelLineItem(data.poNumber, data.articleCode);
    if (action === 'updateFBAShipmentId') return handleUpdateFBAShipmentId(data.poNumber, data.fbaShipmentId);
    
    return responseJSON({status: 'error', message: 'Invalid action: ' + action});
  } catch (error) {
    return responseJSON({status: 'error', message: "doPost Error: " + error.toString()});
  }
}

/**
 * Verifies Google ID Token and checks authorized users sheet.
 */
function handleGoogleLogin(idToken) {
  if (!idToken) return responseJSON({ status: 'error', message: 'Missing token' });

  try {
    // 1. Verify token with Google's API
    const verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
    const response = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
    const tokenInfo = JSON.parse(response.getContentText());

    if (!tokenInfo.email) {
      return responseJSON({ status: 'error', message: 'Invalid token verification' });
    }

    const email = tokenInfo.email.toLowerCase().trim();

    // 2. Check if email exists in Users sheet
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const userSheet = ss.getSheetByName(SHEET_USERS);
    if (!userSheet) return responseJSON({ status: 'error', message: 'Security database not configured' });

    const data = userSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const emailIdx = headers.indexOf("email");
    const nameIdx = headers.indexOf("name");
    const roleIdx = headers.indexOf("role");
    const idIdx = headers.indexOf("id");

    for (let i = 1; i < data.length; i++) {
      const rowEmail = String(data[i][emailIdx]).toLowerCase().trim();
      if (rowEmail === email) {
        // Authorized!
        const user = {
          id: String(data[i][idIdx] || i),
          name: data[i][nameIdx] || tokenInfo.name || "User",
          email: email,
          role: data[i][roleIdx] || "Limited Access",
          avatarInitials: (data[i][nameIdx] || "U").charAt(0).toUpperCase(),
          isInitialized: true
        };
        return responseJSON({ status: 'success', user: user });
      }
    }

    return responseJSON({ 
      status: 'error', 
      message: `Account '${email}' is not authorized. Please contact the administrator.` 
    });

  } catch (e) {
    return responseJSON({ status: 'error', message: 'Verification failed: ' + e.toString() });
  }
}

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
    if (poNumberFilter && poNumIdx !== -1 && String(row[poNumIdx]).trim() !== String(poNumberFilter).trim()) continue;
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
    map[r['ID']] = { id: r['ID'], functionName: r['FunctionName'], lastUploadedBy: r['LastUploadedBy'], lastUploadedAt: r['LastUploadedAt'], status: r['Status'] };
  });
  return responseJSON({status: 'success', data: Object.values(map)});
}

function getUsers() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(SHEET_USERS, ["ID", "Name", "Email", "Contact", "Role", "Avatar", "Password", "IsInitialized"]);
  return responseJSON({status: 'success', data: getDataAsJSON(sheet)});
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
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(headers); }
  return sheet;
}

function debugLog(action, data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = getOrCreateSheet(LOG_DEBUG_SHEET, ["Timestamp", "Action", "Raw Payload"]);
    sheet.appendRow([new Date(), action, JSON.stringify(data)]);
  } catch (err) {}
}

function saveUser(user) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(SHEET_USERS, ["ID", "Name", "Email", "Contact", "Role", "Avatar", "Password", "IsInitialized"]);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("ID");
  
  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(user.id)) {
      rowIdx = i + 1;
      break;
    }
  }

  const rowValues = headers.map(h => {
    if (h === "ID") return user.id;
    if (h === "Name") return user.name;
    if (h === "Email") return user.email;
    if (h === "Contact") return user.contactNumber;
    if (h === "Role") return user.role;
    if (h === "Avatar") return user.avatarInitials;
    if (h === "IsInitialized") return true;
    return "";
  });

  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  return responseJSON({status: 'success'});
}

function deleteUser(userId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_USERS);
  if (!sheet) return responseJSON({status: 'error'});
  const data = sheet.getDataRange().getValues();
  const idIdx = data[0].indexOf("ID");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(userId)) {
      sheet.deleteRow(i + 1);
      return responseJSON({status: 'success'});
    }
  }
  return responseJSON({status: 'error'});
}
