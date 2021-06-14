/**
 * Get the challenger spreadsheet in the given folder with the given name, or if it doesn't exist, create it
 * @param {Folder} folder 
 * @param {string} filename 
 * @param {Date} startDate
 */
function getChallengerSpreadsheet(folder, filename, startDate) {
  startDate = startDate || new Date()
  folder = folder || getLocationFolder()

  var file = getFileByName(folder, filename)
  if (file) return SpreadsheetApp.open(file)

  // Doesn't exist; create it from a template
  file = DriveApp.getFileById(CHALLENGE_TRACKER_TEMPLATE_ID).makeCopy(filename, folder)
  console.log("Created challenge tracker %s with id %s", filename, file.getId())
  spreadsheet = SpreadsheetApp.open(file)
  // Create check-in rows for the challenge trackers
  var checkins = []
  var challengeLength = getChallengeLength()
  for (var i=1; i<=challengeLength; i++) {
    checkins.push({
      'checkin': 'Check-in #' + i,
      'date': getDatestamp(startDate)
    })
    startDate.setDate(startDate.getDate()+7)
  }
  setRowsData(
    spreadsheet.getSheetByName('Check-ins'),
    checkins,
    {
      log: true,
      startHeader: 'Check-in',
      endHeader: 'Date'
    }
  )
  return spreadsheet

}