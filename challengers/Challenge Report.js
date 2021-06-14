/**
 * Generate a report using the data on this row.
 * @param {integer} accountabilityRow 
 * @returns {Blob} PDF blob
 */
function generateChallengeReport(accountabilityRow) {
  // We have to copy the template, because multiple gym locations might be accessing the template simultaneously.
  var templateCopy = SpreadsheetApp.openById(CHALLENGE_REPORT_TEMPLATE_ID).copy('Temporary Report Copy')

  try {
    var targetSheet = templateCopy.getSheetByName('Accountability Data')

    // Copy the client data
    var accountabiltySheet = SS.getSheetByName(ACCOUNTABILITY_SHEET_NAME)
    var sourceRange = accountabiltySheet.getRange(accountabilityRow, 1, 1, 34) // Up through column AH
    var targetRange = getRangeByName(targetSheet, 'DataRowStart').offset(0,0,sourceRange.getHeight(), sourceRange.getWidth())
    var data = sourceRange.getDisplayValues()
    targetRange.setValues(data)
    console.log("Set client data to range %s on %s", targetRange.getA1Notation(), 'Accountability Data')

    // Copy the gym name
    var gymName = getRangeByName(SS.getSheetByName(SETTINGS_SHEET_NAME), 'GymName').getValue()
    getRangeByName(targetSheet, 'GymName').setValue(gymName)
    console.log("Set gym name to %s", gymName)

    // Get the pdf
    SpreadsheetApp.flush()
    var blob = getRangeAsBlob(templateCopy.getSheetByName('Report'))
    // Set client name in file name: first two values are first and last name
    var filename = "Challenge report for " + data[0][0] + " " + data[0][1] + ".pdf";
    blob.setName(filename)
    console.log("Created report '%s'", filename)
    
    return {
      'data': Utilities.base64Encode(blob.getBytes()),
      'mimeType': MimeType.PDF,
      'filename': filename
    }
    
  } finally {
    // Remove the report copy
    DriveApp.getFileById(templateCopy.getId()).setTrashed(true)
    console.log("Removed temporary spreadsheet copy")
  }
}


