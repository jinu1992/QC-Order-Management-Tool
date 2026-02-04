const SHEET_PO_DB = "PO_Database";
const SHEET_INVENTORY = "Master_SKU_Mapping";
const SHEET_CHANNEL_CONFIG = "Channel_Config";
const SHEET_USERS = "Users";
const SHEET_UPLOAD_LOGS = "Upload_Logs";
const SHEET_PO_REPOSITORY = "PO_Repository";
const LOG_DEBUG_SHEET = "System_Logs";
const SHEET_PACKING_DATA = "Master_Packing_Data";

const SPREADSHEET_ID = "10pI-pT9-7l3mD9XqR9vLwT3KxY9Mv6A8fN2u-b0vA4I"; 

function getSpreadsheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if (ss) return ss;
  } catch (e) {
    throw new Error("Could not access Spreadsheet. Check SPREADSHEET_ID and sharing permissions.");
  }
}

/**
 * Standard GAS JSON response helper.
 * CRITICAL: This should only be called by doGet and doPost.
 */
function responseJSON(obj) {
  const output = JSON.stringify(obj || { status: 'success', message: 'Action completed' });
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

// Handle GET requests
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getPurchaseOrders') return responseJSON(getPurchaseOrders(e.parameter.poNumber));
    if (action === 'getInventory') return responseJSON(getInventory());
    if (action === 'getChannelConfigs') return responseJSON(getChannelConfigs());
    if (action === 'getSystemConfig') return responseJSON(getSystemConfig());
    if (action === 'getUsers') return responseJSON(getUsers());
    if (action === 'getUploadMetadata') return responseJSON(getUploadMetadata());
    if (action === 'getPackingData') return responseJSON(getPackingData(e.parameter.referenceCode));
    return responseJSON({status: 'error', message: 'Invalid action'});
  } catch (err) {
    return responseJSON({status: 'error', message: err.toString()});
  }
}

// Handle POST requests
function doPost(e) {
  let result;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: 'error', message: 'No post data received' });
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Log request for debugging
    debugLog(action || "UNKNOWN_ACTION", data);

    // CRITICAL: All these functions MUST return a PLAIN OBJECT, NOT a responseJSON output.
    if (action === 'saveUser') result = saveUser(data);
    else if (action === 'deleteUser') result = deleteUser(data.userId);
    else if (action === 'logFileUpload') result = handleLogFileUpload(data);
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
    else if (action === 'cancelLineItem') result = handleCancelLineItem(data.poNumber, data.articleCode);
    else if (action === 'updateFBAShipmentId') result = handleUpdateFBAShipmentId(data.poNumber, data.fbaShipmentId);
    else if (action === 'fetchEasyEcomShipments') result = handleSyncEasyEcomShipments();
    else if (action === 'loginGoogle') result = handleGoogleLogin(data.idToken);
    else if (action === 'syncZohoContactToEasyEcom') {
      const ok = syncZohoContactToEasyEcom(data.contactId);
      result = ok === true ? { status: 'success', message: 'Sync successful' } : { status: 'error', message: 'Sync failed' };
    }
    else {
      result = { status: 'error', message: 'Invalid action: ' + action };
    }

    // Fallback if the handler function returned nothing
    if (!result) {
      result = { status: 'success', message: 'Process finished' };
    }

  } catch (error) {
    const errorMsg = (error && error.message) ? error.message : String(error);
    result = { status: 'error', message: 'Backend Exception: ' + errorMsg };
  }

  // Convert to JSON exactly once
  return responseJSON(result);
}

/**
 * REFACTORED HANDLERS: These now return plain objects.
 */
function handleCreateZohoInvoice(eeReferenceCode) {
  try {
    // Assuming createZohoInvoiceByReferenceCode is defined in your other script files
    const result = createZohoInvoiceByReferenceCode(eeReferenceCode);
    return result; 
  } catch (e) {
    return { status: 'error', message: "Zoho Error: " + e.toString() };
  }
}

function handleLogFileUpload(data) {
  try {
    // Logic to record the upload in SHEET_UPLOAD_LOGS
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_UPLOAD_LOGS);
    if (sheet) {
      sheet.appendRow([
        new Date(), 
        data.functionId, 
        data.userName, 
        data.fileName || 'Unknown', 
        'Success'
      ]);
    }
    return { status: 'success', message: 'File upload logged and processed.' };
  } catch (e) {
    return { status: 'error', message: 'File log failed: ' + e.toString() };
  }
}

function handlePushToNimbus(eeReferenceCode) {
  try {
    // Assuming pushOrderToNimbus exists
    return pushOrderToNimbus(eeReferenceCode);
  } catch (e) {
    return { status: 'error', message: "Nimbus Error: " + e.toString() };
  }
}

function handleSyncEasyEcomShipments() {
  try {
    // Assuming fetchAndStoreEasyEcomShipments exists
    return fetchAndStoreEasyEcomShipments();
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function handleSyncInventory() {
  try {
    // Assuming updateMasterSkuInventory exists
    return updateMasterSkuInventory();
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function handleSyncZohoContacts() {
  try {
    // Assuming syncZohoContactsToSheet exists
    return syncZohoContactsToSheet();
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function handleCancelLineItem(poNumber, articleCode) {
  try {
    // Assuming cancelLineItemInSheet exists
    return cancelLineItemInSheet(poNumber, articleCode);
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function handleUpdateFBAShipmentId(poNumber, fbaShipmentId) {
  try {
    // Assuming updateFBAShipmentIdInSheet exists
    return updateFBAShipmentIdInSheet(poNumber, fbaShipmentId);
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function handleGoogleLogin(idToken) {
  if (!idToken) return { status: 'error', message: 'Missing token' };

  try {
    const verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
    const response = UrlFetchApp.fetch(verifyUrl, { muteHttpExceptions: true });
    const tokenInfo = JSON.parse(response.getContentText());

    if (!tokenInfo.email) return { status: 'error', message: 'Invalid token verification' };

    // Verify Audience
    if (tokenInfo.aud !== "763018750068-sbk6u9ka6k1r665h92tlqm3b796td5kp.apps.googleusercontent.com") {
      return { status: 'error', message: 'Token audience mismatch' };
    }

    const email = tokenInfo.email.toLowerCase().trim();
    const ss = getSpreadsheet();
    const userSheet = ss.getSheetByName(SHEET_USERS);
    if (!userSheet) return { status: 'error', message: 'Security database not configured' };

    const data = userSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    const emailIdx = headers.indexOf("email");
    const nameIdx = headers.indexOf("name");
    const roleIdx = headers.indexOf("role");
    const idIdx = headers.indexOf("id");

    for (let i = 1; i < data.length; i++) {
      const rowEmail = String(data[i][emailIdx]).toLowerCase().trim();
      if (rowEmail === email) {
        return {
          status: 'success',
          user: {
            id: String(data[i][idIdx] || i),
            name: data[i][nameIdx] || tokenInfo.name || "User",
            email,
            role: data[i][roleIdx] || "Limited Access",
            avatarInitials: (data[i][nameIdx] || "U")[0].toUpperCase(),
            isInitialized: true
          }
        };
      }
    }

    return { status: 'error', message: `Account '${email}' is not authorized.` };

  } catch (e) {
    return { status: 'error', message: 'Verification failed: ' + e.message };
  }
}

function getPurchaseOrders(poNumberFilter) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PO_DB);
    if (!sheet) return {status: 'error', message: `Sheet "${SHEET_PO_DB}" not found.`};
    const rawData = sheet.getDataRange().getValues();
    if (rawData.length <= 1) return {status: 'success', data: []};
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
    return {status: 'success', data: data};
  } catch (e) {
    return {status: 'error', message: e.toString()};
  }
}

function getUploadMetadata() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_UPLOAD_LOGS);
  if (!sheet) return {status: 'success', data: []};
  const rows = getDataAsJSON(sheet);
  const map = {};
  rows.forEach(r => {
    map[r['ID']] = { id: r['ID'], functionName: r['FunctionName'], lastUploadedBy: r['LastUploadedBy'], lastUploadedAt: r['LastUploadedAt'], status: r['Status'] };
  });
  return {status: 'success', data: Object.values(map)};
}

function getUsers() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  return {status: 'success', data: getDataAsJSON(sheet)};
}

function getInventory() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  return {status: 'success', data: getDataAsJSON(sheet)};
}

function getChannelConfigs() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CHANNEL_CONFIG);
  return {status: 'success', data: getDataAsJSON(sheet)};
}

function getSystemConfig() {
  const props = PropertiesService.getScriptProperties();
  return { status: 'success', data: { easyecom_email: props.getProperty('EASY_ECOM_EMAIL') || '' } };
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

function debugLog(action, data) {
  try {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName(LOG_DEBUG_SHEET);
    if (sheet) sheet.appendRow([new Date(), action, JSON.stringify(data)]);
  } catch (err) {}
}

function saveUser(user) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_USERS);
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
    return {status: 'success'};
  } catch (e) {
    return {status: 'error', message: e.toString()};
  }
}

function deleteUser(userId) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_USERS);
    const data = sheet.getDataRange().getValues();
    const idIdx = data[0].indexOf("ID");
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(userId)) {
        sheet.deleteRow(i + 1);
        return {status: 'success'};
      }
    }
    return {status: 'error', message: 'User not found'};
  } catch (e) {
    return {status: 'error', message: e.toString()};
  }
}

function updatePOStatus(poNumber, status) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PO_DB);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const poIdx = headers.indexOf("PO Number");
    const statusIdx = headers.indexOf("Status");

    let updatedCount = 0;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][poIdx]) === String(poNumber)) {
        sheet.getRange(i + 1, statusIdx + 1).setValue(status);
        updatedCount++;
      }
    }
    return { status: 'success', message: `Updated ${updatedCount} rows for PO ${poNumber}` };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}