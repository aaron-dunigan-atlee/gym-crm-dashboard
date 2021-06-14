
/**
 * Update rows data for existing rows, with a lock to avoid collisions or changes to the sheet while we are processing.
 * @param {SpreadsheetApp.Sheet} sheet 
 * @param {Object[]} rows Rows data
 * @param {Object} setOptions Options to be passed to setRowsData
 * @param {string} primaryKey  Unique key to use to identify the row to update.  If not present, we will use the .sheetRow property in the rows data.
 */
function updateRows(sheet, rows, setOptions, primaryKey) {
  // Default options
  setOptions = setOptions || {}
  setOptions.preserveArrayFormulas = true;

  // Set a lock
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  // Update rows via primaryKey
  if (primaryKey) {
    // Transfer set options to get options, but don't include start/end headers b/c we don't know if they include the primary key column
    var getOptions = {getMetadata: true}
    Object.assign(getOptions, setOptions)
    getOptions.startHeader = null;
    getOptions.endHeader = null;
    var dataByKey = hashObjects(
      getRowsData(sheet, null, getOptions), 
      primaryKey
    )
    rows.forEach(function(row){
      if (!row[primaryKey]) {
        notifyError("Unable to update row: primary key " + primaryKey + "  in this row: " + JSON.stringify(row))
        return
      }
      var rowToUpdate = dataByKey[row[primaryKey]]
      if (!rowToUpdate) {
        notifyError("Unable to update row: no row found with " + primaryKey + " = " + row[primaryKey] + " on sheet " + sheet.getName() + " of " + sheet.getParent().getName())
        return
      }
      setOptions.firstRowIndex = rowToUpdate.sheetRow
      setRowsData(
        sheet,
        [row],
        setOptions
      )
      if (setOptions.log) console.log("Updated data for %s=%s on row %s", primaryKey, row[primaryKey], rowToUpdate.sheetRow)
    })
  } else {
  // Update via sheetRow
    rows.forEach(function(row){
      if (!row.sheetRow) throw new Error("Unable to update row: no metadata attached")
      setOptions.firstRowIndex = row.sheetRow
      setRowsData(
        sheet,
        [row],
        setOptions
      )
    })
    if (setOptions.log) console.log("Updated rows at these indices:\n%s", rows.map(function(x){return x.sheetRow}))
  }

  // Flush before releasing lock
  SpreadsheetApp.flush()
  lock.releaseLock()
}

/**
 * Delete rows data for existing rows, with a lock to avoid collisions or changes to the sheet while we are processing.
 * @param {SpreadsheetApp.Sheet} sheet 
 * @param {Object[]} rows Rows data objects
 * @param {Object} options Options to be passed to getRowsData
 * @param {string} primaryKey  Unique key to use to identify the row to update.  If not present, we will use the .sheetRow property in the rows data.
 */
 function removeRows(sheet, rows, options, primaryKey) {
  // Default options
  options = options || {}

  // Set a lock
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  // Update rows via primaryKey
  if (primaryKey) {
    var dataByKey = hashObjects(
      getRowsData(sheet, null, Object.assign(options, {getMetadata: true})), 
      primaryKey
    )
    var rowsToDelete = rows.map(function(row){
      if (!row[primaryKey]) throw new Error("Unable to remove row: primary key '%s' is missing", primaryKey)
      var rowToUpdate = dataByKey[row[primaryKey]]
      if (!rowToUpdate) throw new Error("Unable to remove row: no row found with %s=%s", primaryKey, row[primaryKey])
      if (options.log) console.log("Removing row %s where %s=%s", rowToUpdate.sheetRow, primaryKey, row[primaryKey])
      return rowToUpdate.sheetRow
    })
    deleteSheetRows(sheet, rowsToDelete)
  } else {
  // Remove via sheetRow
    deleteSheetRows(sheet, rows.map(function(x){return x.sheetRow}))
    if (options.log) console.log("Removed rows at these indices:\n%s", rows.map(function(x){return x.sheetRow}))
  }

  // Flush before releasing lock
  SpreadsheetApp.flush()
  lock.releaseLock()
}

/**
 * Use the batchUpdate method to delete multiple rows from a sheet.
 * @param {integer[]} rowsToDelete Array of 1-based row indices to delete
 * @requires Service Advanced Sheets service
 */
function deleteSheetRows(sheet, rowsToDelete) {
  // Each time we remove a row, the indices change, so pre-calculate the adjusted indices.
  var adjustedRowsToDelete = rowsToDelete.sort(function(a,b){return a-b}).map(function(x, i){return x-i})
  var sheetId = sheet.getSheetId()
  var requests = adjustedRowsToDelete.map(function(x){
        console.log("Deleting row %s", x)
    return {
      'deleteDimension': {
        'range': {
          "sheetId": sheetId,
          "dimension": 'ROWS',
          // Half-open range: start at x-1 b/c API uses 0-based indices
          "startIndex": x-1,
          "endIndex": x
        }
      }
    }
  })
  try {
    Sheets.Spreadsheets.batchUpdate({'requests': requests}, sheet.getParent().getId())
  } catch(err) {
    // If it's the last row we'll get this error:
    if (err.message.includes('Sorry, it is not possible to delete all non-frozen rows.')) {
      sheet.insertRowAfter(sheet.getLastRow())
      Sheets.Spreadsheets.batchUpdate({'requests': requests}, sheet.getParent().getId())
    } else {
      throw err
    }
  }
}
