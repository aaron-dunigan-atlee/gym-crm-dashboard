var DEV_EMAIL = 'chatbot@maxoutyourgym.com'
var LOG_SHEET_NAME = 'Log'

function getDebug(){
  var debugStatus = (CacheService.getUserCache().get('debug') == 'true')
  if (debugStatus) console.log('Debug mode is on.')
  return debugStatus
 }
 
 var DEBUG = getDebug();

function activateDebug(){
  var myDate = new Date();
  myDate.setHours( myDate.getHours() + 1 );
  var cache = CacheService.getUserCache()
  console.warn('Entering debug mode until %s EST',Utilities.formatDate(myDate, 'EST', 'hh:mm a'))
  cache.put('debug','true',3600) // one hour
}

function deactivateDebug(){
  var myDate = new Date();
  var cache = CacheService.getUserCache()
  console.warn('Left debug mode at %s EST',Utilities.formatDate(myDate, 'EST', 'hh:mm a'))
  cache.remove('debug')
}

function checkDebug(){
  var cache = CacheService.getUserCache()
  var debug = cache.get('debug') ? 'on' : 'off'
  var ui = SpreadsheetApp.getUi()
  if (ui) ui.alert('Debug mode is: '+debug);
  console.log('Debug mode is: '+debug);
}

/**
 * Add a menu with debug/testing tools
 * @param {SpreadsheetApp.Ui} ui
 * @param {boolean} forDevOnly If true, first check if user is dev, or if we are already in debug only.
 */
function addDebugMenu(ui, forDevOnly) {
  var showMenu = true;
  if (forDevOnly) {
    try {
      var user = Session.getActiveUser().getEmail();
      console.log("addDebugMenu: current user is %s", user)
    } catch(err) {
      console.log("Error in onOpen: " + err.message)
    }
    showMenu = (DEBUG || user === DEV_EMAIL) 
  }

  if (showMenu) {
    ui = ui || SpreadsheetApp.getUi();
    ui.createMenu('🕷️ Debug')
      .addItem('Enter Debug Mode', 'activateDebug')
      .addItem('Exit Debug Mode', 'deactivateDebug')
      .addItem('Check Debug Mode Status', 'checkDebug')
      .addItem('Expand log JSON', 'showJsonInActiveCell')
      .addToUi()
  }
}

/**
 * Log a debug message to a sheet.
 * @param {string} message Log message
 * @param {string} tag     Optional short tag to label the message
 * @param {string} level   Optional log level.  If level is 'debug' and DEBUG is false, the message won't be logged.
 */
function sheetLog(message, tag, level) {
  level = level || (DEBUG ? 'debug' : 'info')
  tag = tag || ''
  console.log("%s (%s): %s", tag || 'sheetLog', level, message)
  if (!DEBUG && level === 'debug') return;
  var sheet = SS.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) return
  level = level || (DEBUG ? 'debug' : 'info')
  tag = tag || ''
  sheet.appendRow([new Date(), level, tag, message])
}


/**
 * "Make JSON Pretty"
 * Show a dialog with any json in the active cell stringified.
 */
function showJsonInActiveCell(useDialog, sortKeys) {
  var text = SpreadsheetApp.getActive().getActiveCell().getValue();
  try {
    var json = JSON.parse(text);
  } catch(err) {
    SpreadsheetApp.getActive().toast('No JSON in that cell');
    return;
  }

  // From JR: sort keys.  
  if (sortKeys) {
    var newObj = {};
    var keys = Object.keys(json);
    keys.sort()
    keys.forEach(function(key){
      newObj[key] = json[key]
    })
    var htmlHeight = keys.length*20
  }
  
  var html = HtmlService.createHtmlOutput('<pre>' + JSON.stringify(json, null, useDialog ? 2: 1) + '</pre>').setTitle('JSON Viewer');
  
  if (useDialog) {
    html.setHeight()
    SpreadsheetApp.getUi().showModelessDialog(html, "JSON Viewer");
  } else {
    SpreadsheetApp.getUi().showSidebar(html);
  }

}

/**
 * From JR: convert url params to JSON
 * @param {string} url 
 */
function urlParamsToJson(url) {
  var parametersString = url.split(/\?/)[1]
  var parameterPairs = parametersString.split(/&/g)
  json = {}
  parameterPairs.forEach(function(x){
    var splitted = x.split(/=/)
    var key = splitted[0];
    var value = splitted[1];
    json[key] = value;
  })  

  return json
}
