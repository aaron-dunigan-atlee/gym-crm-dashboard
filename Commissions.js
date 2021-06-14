/**
 * Store last month's commissions
 * @param {Event} e Because this is run from a one-time trigger
 */
function updateCommissionHistory(e) {
  // Remove the calling trigger
  if (e && e.triggerUid) {
    deleteTriggerById(e.triggerUid)
    console.log("Deleted one-off trigger with id %s", e.triggerUid)
    var param = CacheService.getScriptCache().get(e.triggerUid + '_param') 
  }
  
  // Get month as a string
  var lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth()-1)
  var month = Utilities.formatDate(lastMonth, TIMEZONE, 'MMMM yyyy')
  
  // Get history sheet and create it if it doesn't exist
  var historySheet = SS.getSheetByName(COMMISSION_HISTORY_SHEET_NAME) || createHistorySheet();

  // Get existing history data
  var historyData = getRowsData(historySheet)
  var historyByName = hashObjects(historyData, 'salesperson')

  // Update headers to include last month
  var thisMonthHeader = "Commission " + month
  var headers = historySheet.getRange("1:1").getValues()[0]
  if (!headers.includes(thisMonthHeader)) {
    headers = headers.filter(Boolean).concat(thisMonthHeader)
    historySheet.getRange(1, 1, 1, headers.length).setValues([headers])
    SpreadsheetApp.flush()
  }

  // Get last month's commissions from Commissions sheet
  var commissionsSheet = SS.getSheetByName(COMMISSIONS_SHEET_NAME)
  var commissionsData = getRowsData(
    commissionsSheet, 
    null, 
    {
      headersRowIndex: COMMISSIONS_SHEET_HEADER_ROW
    }
  )

  // Add to current data
  var monthKey = normalizeHeader(thisMonthHeader)
  commissionsData.forEach(function(row){
    if (historyByName[row.salesperson]) {
      historyByName[row.salesperson][monthKey] = row.commission
    } else {
      row[monthKey] = row.commission
      historyData.push(row)
    }
  })

  // Write back to sheet
  setRowsData(
    historySheet,
    historyData
  )
}

function createHistorySheet() {
  var templateSheet = SpreadsheetApp.openById(GYM_OWNER_TEMPLATE_ID)
    .getSheetByName(COMMISSION_HISTORY_SHEET_NAME)
    .copyTo(SS)
    .setName(COMMISSION_HISTORY_SHEET_NAME)
  return templateSheet
}