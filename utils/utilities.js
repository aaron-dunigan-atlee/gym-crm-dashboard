/**
 * Get the sheet index of the first empty row on a leadsheet.  
 * @param {SpreadsheetApp.Sheet} sheet 
 * @param {integer} startRow            Optional row to start looking on.  Defaults to 2 (i.e. assuming there is 1 header row)
 * Sometimes we can't use .getLastRow() because checkboxes and other stuff count as data.
 */
function getFirstEmptyRow(sheet, startRow) {
  startRow = startRow || 2;
  var emptyRowIndex = sheet
    .getRange('A:A')
    .getValues()
    .findIndex(function(row, index){return index >= startRow-1 && !row[0]})
  if (emptyRowIndex > -1) {
    // console.log("First empty row on " + leadsheet.getName() + " is row " + (emptyRowIndex + 1))
    return emptyRowIndex + 1;
  } else {
    // Sheet is full, so insert a row at the bottom.
    // console.log("No empty rows on " + leadsheet.getName() + ", so we'll insert one at the bottom.")
    var lastRow = sheet.getMaxRows();
    sheet.insertRowAfter(lastRow);
    return lastRow + 1;
  }
}

/**
 * Format a date for the sheet.
 * @param {Date} date 
 */
function getDatestamp(date) {
  date = date || new Date()
  if (!(date instanceof Date)) return "";
  return Utilities.formatDate(date, TIMEZONE, "MM/dd/yyyy")
}

/**
 * Get the challenge length setting (number of weeks)
 * Default to 6 weeks.
 */
function getChallengeLength() {
  var challengeLengthRange = SS.getRangeByName('ChallengeLength')
  if (!challengeLengthRange) return 6;
  return challengeLengthRange.getValue() || 6
  
}



/**
 * Hash an array of objects by a key
 * @param {Object[]} array 
 * @param {string} key 
 * @param {Object} options
 *    strict {boolean} If true, throw error if key is absent;
 *    keyCase {string} Convert case of key before hashing.  'lower' or 'upper';
 *    verbose {boolean} Log a warning if key is absent;
 *    toString {boolean} Explicitly convert keys to strings.  Default false.
 * @return {Object} Object of form {key: Object from array}
 */
function hashObjects(array, key, options) {
  options = options || {}
  var hash = {};
  array.forEach(function(object){
    if (object[key]) {
      var thisKey = object[key];
      if (options.toString) thisKey = thisKey.toString();
      if (options.keyCase == 'upper') thisKey = thisKey.toLocaleUpperCase();
      if (options.keyCase == 'lower') thisKey = thisKey.toLocaleLowerCase();
      hash[thisKey] = object;
    } else {
      if (options.strict) throw new Error("Can't hash object because it doesn't have key " + key)
      if (options.verbose) console.warn("Can't hash object because it doesn't have key " + key + ": " + JSON.stringify(object))
    }
  })
  return hash
}


/**
 * Hash an array of objects by several keys, which will be joined
 * @param {Object[]} array 
 * @param {string[]} keys
 * @param {Object} options
 *    strict {boolean} If true, throw error if key is absent;
 *    keyCase {string} Convert case of key before hashing.  'lower' or 'upper';
 *    verbose {boolean} Log a warning if key is absent;
 *    separator {string} Used to separate keys.  Default is '.'
 * @return {Object} Object of form {key: Object from array}
 */
function multihashObjects(array, keys, options) {
  options = options || {}
  var separator = options.separator || '.'
  var hash = {};
  array.forEach(function(object){

    var thisKey = keys.map(function(key){return object[key]}).join(separator);
    hash[thisKey] = object;

  })
  return hash
}

/**
 * Test whether a named range and a Range object have the same upper left cell.
 * @param {string} rangeName 
 * @param {Range} cellRange 
 */
function namedRangeStartsAtCell(rangeName, cellRange) {
  var range = SS.getRangeByName(rangeName);
  // This line handles the case where the named range has a sheetname prepended, e.g. 'Settings'!NamedRange rather than just NamedRange:
  if (!range) range = getRangeByName(cellRange.getSheet(), rangeName)
  if (!range) return false;
  return (
    range.getRow() === cellRange.getRow()
    && range.getColumn() === cellRange.getColumn()
  )
}


/**
 * Add some additional properties using a mapping, 
 * because headers/fields are different from one object source to the next
 * @param {Object} objects rowsData object, or array of them.
 * @param {Object} map     Of the form {existingHeaderName: newHeaderName}. 
 */
function mapHeaders(objects, map) {
  if (!(objects instanceof Array)) objects = [objects];
  objects.forEach(function(object){
    for (var prop in map) {
      // We don't want to overwrite if the mapped property already exists but the original property doesn't.
      if (object[prop] !== undefined) object[map[prop]] = object[prop];
    }
  })
}

/**
 * Get a link directly to this sheet.
 * @param {Sheet} sheet 
 * @param {Object} options  .noTools: boolean, if true, link to a minimal interface with no Sheets header or toolbar
 */
function getSheetUrl(sheet, options) {
  var baseUrl = sheet.getParent().getUrl()
  options = options || {}
  // If the url has parameters, remove them, and append #gid=...
  var url = baseUrl.replace(/\?.*$/, '');
  if (options.noTools) url += '?rm=minimal'
  url += '#gid=' + sheet.getSheetId();
  return url
}


/**
 * Get a named range from a sheet.  Return null if this sheet doesn't have that named range.
 * Not equivalent to sheet.getRange(name) because this throws an exception if the range doesn't exist 
 * (and worse, can return a range from another sheet if the range does exist on another sheet but not on this one)
 * @param {Sheet} sheet 
 * @param {string} rangeName 
 */
function getRangeByName(sheet, rangeName) {
  var namedRanges = sheet.getNamedRanges();
  var match = namedRanges.find(function(namedRange){
    // console.log("Named range: " + namedRange.getName())
    // Range names may have sheet names, e.g. 'Sheet1'!RangeName, so we want to strip the sheet name:
    return namedRange.getName().replace(/^.*!/, '') === rangeName
  }) // find

  if (match) {
    return match.getRange();
  } else {
    return null;
  }

}

function getGymOwnerSpreadsheet() {
  // If this range exists, it contains the gym owner ss id.
  var gymOwnerIdRange = SS.getRangeByName('LinkedSpreadsheetId')
  if (gymOwnerIdRange) {
    return SpreadsheetApp.openById(
      gymOwnerIdRange.getValue()
    )
  } else {
    // Otherwise we're running from the gym owner ss.
    return SS;
  }
}

function getDashboardSpreadsheet() {
  // If this range exists, it contains the dashboard ss id.
  var dashboardIdRange = SS.getRangeByName('CrmSpreadsheetId')
  if (dashboardIdRange) {
    return SpreadsheetApp.openById(
      dashboardIdRange.getValue()
    )
  } else {
    // Otherwise we're running from the dashboard
    return SS;
  }
}


/**
 * Convert range to blob
 * https://xfanatical.com/blog/print-google-sheet-as-pdf-using-apps-script/
 * @param {*} sheet 
 * @param {*} range 
 */
 function getRangeAsBlob(sheet, range) {
  var spreadsheetUrl = sheet.getParent().getUrl();
  var rangeParam = ''
  var sheetParam = ''
  if (range) {
    rangeParam =
      '&r1=' + (range.getRow() - 1)
      + '&r2=' + range.getLastRow()
      + '&c1=' + (range.getColumn() - 1)
      + '&c2=' + range.getLastColumn()
  }
  if (sheet) {
    sheetParam = '&gid=' + sheet.getSheetId()
  }
  var exportUrl = spreadsheetUrl.replace(/\/edit.*$/, '')
      + '/export?exportFormat=pdf&format=pdf'
      + '&size=LETTER'
      + '&portrait=true'
      + '&scale=2'   // 1= Normal 100% / 2= Fit to width / 3= Fit to height / 4= Fit to Page
      + '&top_margin=0.75'              
      + '&bottom_margin=0.75'          
      + '&left_margin=0.7'             
      + '&right_margin=0.7'           
      + '&sheetnames=false&printtitle=false'
      + '&pagenum=false'
      + '&gridlines=false'
      + '&fzr=false' 
      +'&horizontal_alignment=CENTER'  //LEFT/CENTER/RIGHT
      +'&vertical_alignment=MIDDLE'       //TOP/MIDDLE/BOTTOM     
      + sheetParam
      + rangeParam
      
  // console.log('exportUrl=' + exportUrl)
  var response = UrlFetchApp.fetch(exportUrl, {
    headers: { 
      Authorization: 'Bearer ' +  ScriptApp.getOAuthToken(),
    },
  })
  
  return response.getBlob()
}

/**
 * Get the gym name for this spreadsheet
 */
function getGymName() {
  var gymNameRange = SS.getRangeByName('GymName')
  var gymName;
  if (gymNameRange) gymName = gymNameRange.getValue()

  return gymName || (SS.getName().split('-')[1] || "<Unknown gym name>").trim()
}

/**
 * Set a trigger to execute a function after a specified time.
 * The callback function should delete the trigger to avoid leaving old triggers against the quota
 * @param {string} functionName 
 * @param {integer} delay       Delay in ms
 */
 function setContinuationTrigger(functionName, delay) {
  delay = delay || 1000
  var trigger = ScriptApp.newTrigger(functionName)
      .timeBased()
      .after(delay)
      .create();
  var triggerId = trigger.getUniqueId();
  console.log('Function %s will run in %s ms with trigger ID %s.', functionName, delay, triggerId)
  return trigger.getUniqueId()
}
