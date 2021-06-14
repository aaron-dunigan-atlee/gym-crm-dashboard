/**
 * One-time patch to create challenger files for existing challengers.  4.20.21
 */
function patch_createChallengerFiles() {
  // We update the gym owner copy
  var spreadsheet = getGymOwnerSpreadsheet()
  var sheet = spreadsheet.getSheetByName('Accountability Tracking')
  var startRow = ACCOUNTABILITY_DATA_START_ROW; 
  var challengers = getRowsData(
    sheet,
    sheet.getRange(startRow, 1, sheet.getLastRow()-startRow+1, sheet.getLastColumn()),
    {
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW
    }
  )
  var locationFolder = getLocationFolder()
  challengers.forEach(function(lead){
    if (!lead.firstName || !(lead.challengeStartDate instanceof Date)) return;
    if (!lead.challengerFile) {
      var folderName = lead.firstName + ' ' + lead.lastName + ' ' + getDatestamp(lead.challengeStartDate)
      var challengerFolder = getOrCreateFolderByName(locationFolder, folderName)
      getChallengerSpreadsheet(challengerFolder, 'Challenge Tracker ' + folderName, new Date(lead.challengeStartDate))
      lead.challengerFile = '=HYPERLINK("' + challengerFolder.getUrl() + '", "Open File")'
    }
  })

  setRowsData(
    sheet,
    challengers,
    {
      firstRowIndex: startRow,
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW,
      startHeader: 'Challenger File',
      endHeader: 'Challenger File',
      log: true,
      preserveFormulas: true
    }
  )
}

/**
 * Called from the webhook.  Syncing with HL was added 3.29.21, but we need a timed trigger to be set.
 * If the trigger doesn't exist, set it.
 */
function patch_setSyncHighLevelTrigger() {
  var functionName = 'syncHighLevel';
  // Check for existing trigger
  var existingTrigger = ScriptApp.getProjectTriggers()
    .find(function(x){return x.getHandlerFunction() === functionName})
  if (existingTrigger) {
    console.log("This location already has the syncHighLevel trigger; no need to update")
    return;
  }

  var trigger = ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();
  console.log("Created trigger for '%s' with id %s to run once per hour", functionName, trigger.getUniqueId())
}