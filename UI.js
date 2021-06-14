/**
 * Create custom menu(s)
 * @param {Event} e 
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('💪 Max Out Your Gym')
    .addItem('🆗 Authorize', 'authorize')
    .addItem('🟢 Run setup', 'runSetup')
    // .addItem('🔄 Update from previous version', 'importPreviousData') 
    .addToUi();
  addDebugMenu(ui, true) 
  // addTutorialMenu(ui)
  if (!PROPS.getProperty('ran_setup')) {
    SS.toast('Run the setup under "💪 Max Out Your Gym", then simply continue to use the sheet as usual. :)', 'Hey! First time?', -1)
  }
}

/**
 * Just here to force (re-)authorization
 */
function authorize() {
  SS.toast('🆗 The script is authorized')
}

/**
 * Show a dialog with a brief message and a link
 * @param {string} title
 * @param {string} message
 * @param {string} linkText 
 * @param {string} url 
 * @requires link-dialog.html
 */
function showLinkDialog(title, message, linkText, url, height) {
  var template = HtmlService.createTemplateFromFile('link-dialog');
  template.url = url;
  template.message = message;
  template.linkText = linkText;
  var dialog = template.evaluate().setHeight(height || 100).setWidth(300);
  SpreadsheetApp.getUi().showModalDialog(dialog, title);
}


/**
 * Shows a video in a popup
 * @param {string} title     Title for the dialog box.
 * @param {string} loomCode  Loom's file id, from the url.
 * @requires tutorial.html
 */
function showTutorial(title, loomCode){
  var ui = SpreadsheetApp.getUi()
  var template = HtmlService.createTemplateFromFile('tutorial')
  template.loomCode = loomCode;
  var html = template.evaluate()
  .setWidth(960)
  .setHeight(690)
  .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  ui.showModalDialog(html, title);
}

/* Video tutorials. function name: tutorial info */
var TUTORIALS = {
  'nameOfTutorial': {
    loomId: '**LOOM CODE HERE**',
    title: 'Tutorial Title'
  },
  'anotherTutorial': {
    loomId: '**LOOM CODE HERE**',
    title: 'Tutorial Title 2'
  }
}


/**
 * Programmatically create the functions to show tutorials.
 */
var buildTutorialFunctions = function() {
  for (var functionName in TUTORIALS) {
    var tutorial = TUTORIALS[functionName]

    this[functionName] = function(thisTitle, thisId) {
      return function() {
        showTutorial(thisTitle, thisId)
      }
    }(tutorial.title, tutorial.loomId)
  }
}()

/**
 * Call this from the onOpen function to create the tutorial menu.
 * @requires tutorial.html
 */
function addTutorialMenu(ui) {
  ui = ui || SpreadsheetApp.getUi()
  var tutorialMenu = ui.createMenu('ℹ️ Tutorials');
  for (var functionName in TUTORIALS) {
    tutorialMenu.addItem('🎞️ ' + TUTORIALS[functionName].title, functionName)
  }
  tutorialMenu.addToUi();
}


/**
 * Show a spinner in a modal dialog while a function runs.
 * @param {string} title        Title of dialog
 * @param {string} message      Message to show user while the function runs.
 * @param {string} functionName Function to run.
 * @param {string} successMessage Message to be displayed in the modal if the function runs successfully.
 * @param {string} failureMessage Message to be displayed on failure.  The error message will be appended.
 * @requires spinner-modal.html
 */
function showSpinnerModal(message, functionName, successMessage, failureMessage, title) {
  title = title || "One moment..."
  var template = HtmlService.createTemplateFromFile('spinner-modal');
  template.message = message;
  template.functionName = functionName;
  template.successMessage = successMessage;
  template.failureMessage = failureMessage;
  SpreadsheetApp.getUi().showModalDialog(
    template.evaluate().setWidth(250).setHeight(200),
    title
  )
}

function onFinishSpinnerModal(message) {
  SS.toast(message)
}

