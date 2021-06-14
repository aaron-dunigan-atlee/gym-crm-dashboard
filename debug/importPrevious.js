
/**
 * Import a user's existing data into this version of the spreadsheet.
 * As of 2.13.21 this is turned off because we've made breaking changes.  
 * Possibly this can be re-written to still work.
 * We would need to handle the two files.
 */
function importPreviousData() {
  var ui = SpreadsheetApp.getUi();
  // Warn user what we're going to do.
  var result = ui.alert(
    'Update From Previous Version',
    'This will delete ALL lead data in the current spreadsheet,\nand replace it with the leads from your previous version.\nAre you sure you want to continue?',
     ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;
  showPicker('Select your previous version of the CRM.', MimeType.GOOGLE_SHEETS)
}


/**
 * Show a file picker.  File picker results will be returned to the callback function 'setPickerResult'
 * @param {string} message Title of picker dialog
 * @param {MimeType} fileType Type of file to be picked.
 */
function showPicker(message, fileType) {
  message = message || 'Choose a file.'
  var template = HtmlService.createTemplateFromFile('picker')
  template.fileType = fileType
  var html = template.evaluate()
    .setWidth(600)
    .setHeight(425)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  SpreadsheetApp.getUi().showModalDialog(html, message);
}

/**
 * Handle results of a file picker: Transfer lead tracking sheet.
 * @param {string} fileUrl Url of the chosen file
 */
function importCrmTracking(fileUrl) {
  console.log("User picked file %s", fileUrl)
  var previousCrm = SpreadsheetApp.openByUrl(fileUrl);
  
  // Transfer lead tracking sheet
  var previousLeadTrackingSheet = previousCrm.getSheetByName(CRM_SHEET_NAME)
  if (previousLeadTrackingSheet) {
    var previousLeads = getRowsData(
      previousLeadTrackingSheet,
      null,
      {
        headersRowIndex: CRM_HEADERS_ROW
      }
    )
    var currentCrmSheet = SS.getSheetByName(CRM_SHEET_NAME)
    if (currentCrmSheet) {
      setRowsData(
        currentCrmSheet,
        previousLeads,
        {
          headersRowIndex: CRM_HEADERS_ROW,
          writeMethod: 'clear',
          preserveArrayFormulas: true
        }
      )
    } else { 
      ui.alert("Sorry, we couldn't find a sheet called 'CRM Tracking Sheet' on this spreadsheet, so we couldn't import your leads.")
    }
  } else { 
    ui.alert("Sorry, we couldn't find a sheet called 'CRM Tracking Sheet' on that spreadsheet, so we couldn't import your leads.")
  }

  return fileUrl;
}

/**
 * Step 2 of the file picker callbacks: import accountability sheet
 * @param {string} fileUrl 
 */
function importAccountability(fileUrl) {
  var previousCrm = SpreadsheetApp.openByUrl(fileUrl);
  // Transfer Accountability Tracking
  var previousAccountabilitySheet = previousCrm.getSheetByName(ACCOUNTABILITY_SHEET_NAME)
  if (previousAccountabilitySheet) {
    // We won't use getRowsData here, because of the multiple header rows.  Easier to just copy and write whole columns.
    var startRow = ACCOUNTABILITY_DATA_START_ROW;
    var endRow = previousAccountabilitySheet.getLastRow();
    var dataHeight = endRow - startRow + 1;
    var previousSheetWidth = previousAccountabilitySheet.getLastColumn();
    var previousHeaders = previousAccountabilitySheet.getRange(ACCOUNTABILITY_HEADERS_ROW, 1, 1, previousSheetWidth).getValues()[0]
    var previousWeighOutColumn = previousHeaders.findIndex(function(x){
      return /weigh-out/i.test(x)
    }) + 1;
    var previousCoachColumn = previousHeaders.findIndex(function(x){
      return /coach/i.test(x)
    }) + 1;
    var previousConversionColumn = previousHeaders.findIndex(function(x){
      return /converted/i.test(x)
    }) + 1;

    // Get current sheet and its columns
    var currentAccountabilitySheet = SS.getSheetByName(ACCOUNTABILITY_SHEET_NAME)
    if (currentAccountabilitySheet) {
      // Clear existing data
      var currentSheetWidth = currentAccountabilitySheet.getLastColumn();
      currentAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, 1, currentAccountabilitySheet.getMaxRows() - ACCOUNTABILITY_DATA_START_ROW + 1,currentSheetWidth).clearContent();

      // Transfer columns through week 5 (column 16/P)
      currentAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, 1, dataHeight, 16)
        .setValues(previousAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, 1, dataHeight, 16).getValues())

      // Transfer weigh-out
      var currentHeaders = currentAccountabilitySheet.getRange(ACCOUNTABILITY_HEADERS_ROW, 1, 1, currentSheetWidth).getValues()[0]
      var currentWeighOutColumn = currentHeaders.findIndex(function(x){
        return /weigh-out/i.test(x)
      }) + 1;
      if (currentWeighOutColumn && previousWeighOutColumn) {
        currentAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, currentWeighOutColumn, dataHeight, 2)
          .setValues(previousAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, previousWeighOutColumn, dataHeight, 2).getValues())
      }

      // Transfer converted into a member
      var currentConversionColumn = currentHeaders.findIndex(function(x){
        return /converted/i.test(x)
      }) + 1;
      if (currentConversionColumn && previousConversionColumn) {
        currentAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, currentConversionColumn, dataHeight, 1)
          .setValues(previousAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, previousConversionColumn, dataHeight, 1).getValues())
      }

      // Transfer coach
      var currentCoachColumn = currentHeaders.findIndex(function(x){
        return /coach/i.test(x)
      }) + 1;
      if (currentCoachColumn && previousCoachColumn) {
        currentAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, currentCoachColumn, dataHeight, 1)
          .setValues(previousAccountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, previousCoachColumn, dataHeight, 1).getValues())
      }

    } else { 
      ui.alert("Sorry, we couldn't find a sheet called 'Accountability Tracking' on this spreadsheet, so we couldn't import your accountability data.")
    }
  } else { 
    ui.alert("Sorry, we couldn't find a sheet called 'Accountability Tracking' on that spreadsheet, so we couldn't import your accountability data.")
  }

  return fileUrl;
}


/**
 * Step 3 of the file picker callbacks: import gym name
 * @param {string} fileUrl 
 */
function importGymName(fileUrl) {
  var previousCrm = SpreadsheetApp.openByUrl(fileUrl);

  try {
    var previousDashboard = previousCrm.getSheetByName('Metrics Dashboard') 
    if (previousDashboard) {
      SS.getRangeByName('GymName').setValue(previousDashboard.getRange('A2').getValue())
    }
  } catch(err) {
    console.error(err)
  }

}

/**
 * Get the access token so we can use the file picker.
 */
function getAccessToken() {
  var token = ScriptApp.getOAuthToken();
  return token
}