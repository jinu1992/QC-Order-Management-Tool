
const SHEET_PO = "PO_Database";
const SHEET_INVENTORY = "Master_SKU_Mapping";
const SHEET_CHANNEL_CONFIG = "Channel_Config";
const SHEET_USERS = "Users";
const SHEET_UPLOAD_LOGS = "Upload_Logs";
const SHEET_PACKING_DATA = "Master_Packing_Data"; // New sheet for box details
const LOG_DEBUG_SHEET = "System_Logs";

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
    
    if (action === 'syncZohoContactToEasyEcom') {
      const result = syncZohoContactToEasyEcom(data.contactId);
      if (result === true) {
        return responseJSON({status: 'success', message: 'Zoho Contact synced successfully'});
      } else {
        return responseJSON({status: 'error', message: 'Sync process failed. Check Apps Script logs for details.'});
      }
    }
    
    return responseJSON({status: 'error', message: 'Invalid action: ' + action});
  } catch (error) {
    return responseJSON({status: 'error', message: "doPost Error: " + error.toString()});
  }
}

function syncZohoContactToEasyEcom(contactId) {
  if (!contactId) {
    Logger.log('ERROR: No Zoho Contact ID provided.');
    return false;
  }
  Logger.log(`--- Starting sync for Zoho Contact ID: ${contactId} ---`);
  try {
    const zohoContact = typeof _fetchZohoContactDetails === 'function' ? _fetchZohoContactDetails(contactId) : null;
    if (!zohoContact) return false; 
    const success = typeof _createEasyEcomCustomer === 'function' ? _createEasyEcomCustomer(zohoContact) : false;
    return success;
  } catch (e) {
    Logger.log(`An unexpected error occurred during the sync process: ${e.message}`);
    return false;
  }
}

function handlePushToNimbus(eeReferenceCode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const poSheet = ss.getSheetByName(SHEET_PO);
    const packingSheet = ss.getSheetByName(SHEET_PACKING_DATA);
    
    if (!packingSheet) return responseJSON({ status: 'error', message: 'Master_Packing_Data sheet not found.' });

    const poRows = getDataAsJSON(poSheet);
    const packingRows = getDataAsJSON(packingSheet);

    const orderData = poRows.find(r => r['EE_reference_code'] === eeReferenceCode);
    if (!orderData) return responseJSON({ status: 'error', message: 'Order data not found for reference: ' + eeReferenceCode });

    const boxes = packingRows.filter(r => r['EE_reference_code'] === eeReferenceCode).map(b => ({
      length: b['Length'] || 0,
      width: b['Width'] || 0,
      height: b['Height'] || 0,
      weight: b['Weight'] || 0,
      description: b['Content_Description'] || 'General Items'
    }));

    if (boxes.length === 0) return responseJSON({ status: 'error', message: 'No box details found in Master_Packing_Data for ' + eeReferenceCode });

    const payload = {
      order_number: eeReferenceCode,
      order_date: orderData['EE_order_date'],
      invoice_number: orderData['Invoice Number'],
      invoice_date: orderData['Invoice Date'],
      invoice_value: orderData['Invoice Total'],
      consignee: {
        name: orderData['Store Code'] || 'Store',
        address: orderData['Shipping_Address'] || 'Address Pending',
        city: orderData['Shipping_City'] || '',
        state: orderData['Shipping_State'] || '',
        pincode: orderData['Shipping_Zip'] || '',
        phone: orderData['POC Phone'] || ''
      },
      package_details: boxes
    };

    debugLog("NIMBUS_PUSH_PREPARED", payload);

    if (typeof pushToNimbusAPI === 'function') {
      const result = pushToNimbusAPI(payload);
      return responseJSON({ status: 'success', message: result || 'Pushed to Nimbus successfully.' });
    } else {
      return responseJSON({ status: 'success', message: 'Payload prepared but pushToNimbusAPI function is not linked.' });
    }
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}

function handleCreateZohoInvoice(eeReferenceCode) {
  try {
    if (typeof createZohoInvoiceByReferenceCode === 'function') {
      const result = createZohoInvoiceByReferenceCode(eeReferenceCode);
      return responseJSON({ status: 'success', message: result || 'Invoice creation triggered successfully.' });
    } else {
      return responseJSON({ status: 'error', message: 'Backend function createZohoInvoiceByReferenceCode is not defined.' });
    }
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}

function logFileUpload(data) {
  const sheet = getOrCreateSheet(SHEET_UPLOAD_LOGS, ["ID", "FunctionName", "LastUploadedBy", "LastUploadedAt", "Status", "FileName"]);
  const now = new Date().toLocaleString();
  const functionNameMap = { 
    'b2b-packing-list': 'B2B Packing List Data',
    'flipkart-minutes-po': 'FlipkartMinutes PO Upload'
  };
  
  let processingResult = "Logged successfully.";
  let status = 'Success';

  if (data.functionId === 'b2b-packing-list') {
    try {
      if (typeof UpdatePackingListData === "function") {
        UpdatePackingListData(data.fileData, data.fileName);
        processingResult = "Function 'UpdatePackingListData' executed successfully.";
      } else {
        processingResult = "Warning: 'UpdatePackingListData' is not defined. Logged only.";
        status = 'Pending';
      }
    } catch (e) {
      processingResult = "Error: " + e.toString();
      status = 'Error';
      sheet.appendRow([data.functionId, functionNameMap[data.functionId] || data.functionId, data.userName, now, status, data.fileName || 'N/A']);
      return responseJSON({status: 'error', message: processingResult});
    }
  } else if (data.functionId === 'flipkart-minutes-po') {
    try {
      if (typeof ProcessFlipkartMinutesPO === "function") {
        ProcessFlipkartMinutesPO(data.fileData, data.fileName);
        processingResult = "Function 'ProcessFlipkartMinutesPO' executed successfully.";
        status = 'Success';
      } else {
        processingResult = "Warning: 'ProcessFlipkartMinutesPO' is not defined in backend. Data logged only.";
        status = 'Pending';
      }
    } catch (e) {
      processingResult = "Backend Error: " + e.toString();
      status = 'Error';
      sheet.appendRow([data.functionId, functionNameMap[data.functionId] || data.functionId, data.userName, now, status, data.fileName || 'N/A']);
      return responseJSON({status: 'error', message: processingResult});
    }
  }

  sheet.appendRow([data.functionId, functionNameMap[data.functionId] || data.functionId, data.userName, now, status, data.fileName || 'N/A']);
  return responseJSON({status: 'success', message: processingResult});
}

function loginUser(email, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const rows = getDataAsJSON(sheet);
  const user = rows.find(r => String(r['Email']).toLowerCase() === String(email).toLowerCase());
  
  if (!user) return responseJSON({status: 'error', message: 'User not found'});
  if (String(user['Password']) === String(password)) {
    const userOutput = {...user};
    delete userOutput['Password'];
    return responseJSON({status: 'success', user: userOutput});
  }
  return responseJSON({status: 'error', message: 'Incorrect password'});
}

function resetPassword(userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf('ID');
  const passIdx = headers.indexOf('Password');
  const initIdx = headers.indexOf('IsInitialized');
  
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(userId)) {
      const tempPass = Math.random().toString(36).slice(-8);
      sheet.getRange(i + 1, passIdx + 1).setValue(tempPass);
      sheet.getRange(i + 1, initIdx + 1).setValue(false);
      const userEmail = rows[i][headers.indexOf('Email')];
      sendSetupEmail(userEmail, tempPass);
      return responseJSON({status: 'success', message: 'Reset email sent'});
    }
  }
  return responseJSON({status: 'error', message: 'User not found'});
}

function saveUser(data) {
  const sheet = getOrCreateSheet(SHEET_USERS, ["ID", "Name", "Email", "Contact", "Role", "Avatar", "Password", "IsInitialized"]);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf('ID');
  let isNew = true;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(data.id)) {
      isNew = false;
      const range = sheet.getRange(i + 1, 1, 1, headers.length);
      const updatedRow = headers.map(h => {
        if (h === 'ID') return data.id;
        if (h === 'Name') return data.name;
        if (h === 'Email') return data.email;
        if (h === 'Contact') return data.contactNumber;
        if (h === 'Role') return data.role;
        if (h === 'Avatar') return data.avatarInitials;
        return rows[i][headers.indexOf(h)];
      });
      range.setValues([updatedRow]);
      break;
    }
  }
  if (isNew) {
    const tempPass = Math.random().toString(36).slice(-8);
    sheet.appendRow([data.id, data.name, data.email, data.contactNumber, data.role, data.avatarInitials, tempPass, false]);
    sendSetupEmail(data.email, tempPass);
  }
  return responseJSON({status: 'success', message: isNew ? 'Invite sent' : 'User updated'});
}

function sendSetupEmail(email, tempPass) {
  try {
    const subject = "Welcome to Cubelelo PO Portal - Setup your account";
    const body = `Your account has been created.\n\nLogin: ${email}\nTemp Pass: ${tempPass}\n\nPlease change it immediately.`;
    MailApp.sendEmail(email, subject, body);
  } catch (e) {}
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

function deleteUser(userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_USERS);
  const rows = sheet.getDataRange().getValues();
  const idIdx = rows[0].indexOf('ID');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idIdx]) === String(userId)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return responseJSON({status: 'success'});
}

function getPurchaseOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const poSheet = ss.getSheetByName(SHEET_PO);
  const packingSheet = ss.getSheetByName(SHEET_PACKING_DATA);
  
  const poData = getDataAsJSON(poSheet);
  const packingData = getDataAsJSON(packingSheet);
  
  // Calculate Box Counts from Packing Sheet grouped by EE Reference Code
  const boxCounts = {};
  if (packingData) {
    packingData.forEach(row => {
      const ref = row['EE_reference_code'];
      if (ref) {
        boxCounts[ref] = (boxCounts[ref] || 0) + 1;
      }
    });
  }
  
  // Attach joined data to each PO row
  const mergedData = poData.map(row => {
    const ref = row['EE_reference_code'];
    return {
      ...row,
      'EE_reference_box_count': ref ? (boxCounts[ref] || 0) : 0
    };
  });
  
  return responseJSON({status: 'success', data: mergedData});
}

function getInventory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_INVENTORY);
  return responseJSON({status: 'success', data: getDataAsJSON(sheet)});
}

function getChannelConfigs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

function debugLog(action, data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = getOrCreateSheet(LOG_DEBUG_SHEET, ["Timestamp", "Action", "Raw Payload"]);
    sheet.appendRow([new Date(), action, JSON.stringify(data)]);
  } catch (err) {}
}
