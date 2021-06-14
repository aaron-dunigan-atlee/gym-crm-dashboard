/**
 * Sync values from Accountability Tracking (on gym-owner copy) back to CRM sheet (on dashboard copy).
 * (Call with no params to sync full sheet.)
 * @param {Event} e          Trigger Event (because this runs on a nightly trigger)
 * @param {integer} startRow Sheet row to start sync
 * @param {integer} endRow   Sheet row to end sync
 * @param {Sheet} accountabilitySheet 
 */
function syncAccountabilityToCrm(e, startRow, endRow, accountabilitySheet) {
  // 5.19.21 We needed to add a monthly trigger to update commissions history, and I didn't want to try to push out a new trigger to all scripts,
  // so I'm piggybacking off this old trigger which most scripts are still running daily.
  // If second of month, store last month's commissions (not on first of month to avoid timezone offsets)
  var today = new Date()
  if (today.getDate() === 2) {
    setContinuationTrigger('updateCommissionHistory')
  }
  
  console.log("Sync accountability is deprecated")
  return;
  // As of 3.3.21 we're no longer needing this.  We use vlookups to move accountability data back to the CRM page. 
  // But existing copies have this as a timed trigger so I'm leaving it here for now.
  
  
  // Set defaults
  var gymOwnerSpreadsheet = getGymOwnerSpreadsheet();
  var dashboardSpreadsheet = getDashboardSpreadsheet();

  accountabilitySheet = accountabilitySheet || gymOwnerSpreadsheet.getSheetByName(ACCOUNTABILITY_SHEET_NAME)
  startRow = startRow || ACCOUNTABILITY_DATA_START_ROW;
  endRow = endRow || getFirstEmptyRow(accountabilitySheet, startRow) - 1;
  console.log("Syncing accountability from row %s to %s", startRow, endRow)
  if (endRow < startRow) {
    console.error("Start row is after end row")
    return;
  }

  // Get accountability sheet data
  var accountabilityData = getRowsData(
    accountabilitySheet,
    accountabilitySheet.getRange(startRow, 1, endRow-startRow+1, accountabilitySheet.getLastColumn()),
    {
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW
    }
  // Filter out empty rows
  ).filter(function(x){return x.firstName})
  if (accountabilityData.length === 0) {
    console.error("No accountability data in that range.")
    return;
  }

  // Get CRM data
  var crmSheet = dashboardSpreadsheet.getSheetByName(CRM_SHEET_NAME)
  var crmData = getRowsData(
    crmSheet,
    null,
    {
      headersRowIndex: CRM_HEADERS_ROW,
      getMetadata: true
    }
  )
  var crmByName = multihashObjects(crmData, ['firstName','lastName'])
  
  // Match up rows and write it back
  accountabilityData.forEach(function(accountabilityRow){
    var crmRow = crmByName[accountabilityRow.firstName+'.'+accountabilityRow.lastName]
    if (!crmRow) {
      console.error("Couldn't find %s %s on CRM", accountabilityRow.firstName, accountabilityRow.lastName)
      return;
    }
    console.log("Found %s %s on row %s of CRM", accountabilityRow.firstName, accountabilityRow.lastName, crmRow.sheetRow)
    Object.assign(crmRow, accountabilityRow)
    setRowsData(
      crmSheet,
      [crmRow],
      {
        firstRowIndex: crmRow.sheetRow,
        headersRowIndex: CRM_HEADERS_ROW,
        startHeader: 'Challenge Start Date',
        endHeader: 'Challenge End Date',
        preserveFormulas: true,
        preserveArrayFormulas: true
      }
    )
    // We moved the converted column away from the others.
    setRowsData(
      crmSheet,
      [crmRow],
      {
        firstRowIndex: crmRow.sheetRow,
        headersRowIndex: CRM_HEADERS_ROW,
        startHeader: 'Converted into a member?',
        endHeader: 'Converted into a member?',
        preserveFormulas: true,
        preserveArrayFormulas: true
      }
    )
  }) // for each accountability row
}

/**
 * Adjust the accoutability tracking sheet to reflect current number of weeks.
 * @param {integer} weeks Dropdown restricts it to 6, 8, or 12.
 */
function setChallengeLength(weeks) {
  // Make this adjustment on the dashboard copy AND the gym-owner copy.
  // The triggering file is the gym-owner copy, so that's SS. 
  // Get a reference to the dashboard copy from the protected settings
  var thisAccountabilitySheet = SS.getSheetByName(ACCOUNTABILITY_SHEET_NAME)
  var dashboardAccountabilitySheet = SpreadsheetApp.openById(
      SS.getRangeByName('CrmSpreadsheetId').getValue()
    ).getSheetByName(ACCOUNTABILITY_SHEET_NAME)
  var sheets = [thisAccountabilitySheet, dashboardAccountabilitySheet]
  sheets.forEach(function(accountabilitySheet){
    // Calculate columns to hide.
    // Week 6 is at col. Q (17).  Final week weigh-out starts at AC (29)
    if (weeks === 6) {
      // Hide weeks 6-11
      accountabilitySheet.hideColumns(17, 12)
    } else if (weeks === 8) {
      // Hide Weeks 8 through 11 (U/21 - AB/28)
      accountabilitySheet.hideColumns(21, 8)
      // Show weeks 6,7
      accountabilitySheet.showColumns(17, 4)
    } else {  // i.e. if weeks === 12, but default to showing everything if an invalid value is passed.
      // Show all columns.
      accountabilitySheet.showColumns(17, 12)
    }
  }) // for each sheet
}