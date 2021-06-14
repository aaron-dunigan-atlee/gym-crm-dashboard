/**
 * We're doubling up on this deployment: the doPost responds to the GHL webhook,
 * but this doGet returns a link to a PDF challenge report for the gym owner
 * @param {Event} e 
 * @returns HtmlOutput
 */
 function doGet(e){
  // Identify the client via their row on Accountability Tracking
  var clientRow = e.parameter.r;
  if (!clientRow) {
    return ContentService
      .createTextOutput("Something went wrong.")
  }
  // Context object to be passed to page template.
  var context = {
    'clientRow': clientRow
  };

  try {
    return renderPage(context);
  } catch(err) {
    console.error(err.message + '\n' + err.stack)
    return ContentService
      .createTextOutput("Something went wrong.")
  }
}

/**
 * Return html content to be included in another html template
 * @param {string} filename 
 * @param {Object} context Fields to pass to the template
 */
 function include(filename, context){
  var template = HtmlService.createTemplateFromFile(filename);
  if (context) template.context = context;
  return template.evaluate().getContent();
}

function renderPage(context) {
  var template = HtmlService.createTemplateFromFile('html/index');
  template.context = context;
  return template.evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('Challenge Reports')
    // .setFaviconUrl('');
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}