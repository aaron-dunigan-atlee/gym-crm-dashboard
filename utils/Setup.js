/**
 * Authorize script and install onEdit trigger.
 * Register this copy with our admin panel
 * 
 */
function runSetup() {
  // Alert user what we are going to do (also, absence of this alert means the menu didn't run, e.g. after first-time authorization.)
  var message = "Running this setup allows the CRM to respond automatically\nto lead status changes.  You only need to run this once."
  message += "\nDo you want to continue?"

  // Determine which copy we're running from
  var role = SS.getRangeByName('GymOwnerEditable') ? 'editor' : 'dashboard' 

  var ui = SpreadsheetApp.getUi();
  var button = ui.alert(
    "Setup",
    message,
    ui.ButtonSet.OK_CANCEL);
  if (button !== ui.Button.OK) return;
  
  var apiKey = Utilities.getUuid();
  PROPS.setProperty('apiKey', apiKey)

  // Assemble the arguments and register with admin panel
  var args = {
    'apiKey': apiKey,
    // If this is the gym owner's editable copy, role is 'editor'.  Otherwise this is the 'dashboard'.
    // Affects how the server processes the registration.
    'role': role
  }

  if (args.role === 'editor') {
    // Add links to sheets for gym owner copy
    args.settingsLink = getSheetUrl(SS.getSheetByName('Settings'), {'noTools': true});
    args.accountabilityLink = getSheetUrl(SS.getSheetByName('Accountability Tracking'), {'noTools': true});
    args.pricingLink = getSheetUrl(SS.getSheetByName('Pricing'), {'noTools': true});
    args.commissionsLink = getSheetUrl(SS.getSheetByName('Commissions'), {'noTools': true});
    
    // Edit trigger for gym owner copy only, to respond to changes in settings sheet
    setEditTrigger()
    // This used to be a sync trigger; it's actually now for commissions history.  See notes on syncAccountabilityToCrm()
    setSyncTrigger(); 
  }

  postServerRequest({
    'action': 'registerCopy',
    'arguments': args
  })

  if (args.role === 'dashboard') {
    // Set trigger to sync with high level
    setSyncHighLevelTrigger()
  }

  // Toast to clear the one that says you need to run the setup
  SS.toast("Setup complete")
  PROPS.setProperty('ran_setup', getDatestamp())
  ui.alert('Setup', "The setup is complete.", ui.ButtonSet.OK)

}

/**
 * Set the installed onEdit trigger.
 */
function setEditTrigger() {
  var functionName = 'onEditRouter';
  // Avoid duplicate triggers.
  deleteTriggerByName(functionName);

  var trigger = ScriptApp.newTrigger(functionName)
    .forSpreadsheet(SS)
    .onEdit()
    .create();
  console.log("Created trigger for '%s' with id %s", functionName, trigger.getUniqueId())
}

/**
 * Set the timed trigger to sync the accountability tracker to crm.
 */
function setSyncTrigger() {
  var functionName = 'syncAccountabilityToCrm';
  // Avoid duplicate triggers.
  deleteTriggerByName(functionName);

  var trigger = ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();
  console.log("Created trigger for '%s' with id %s to run daily", functionName, trigger.getUniqueId())
  
}


/**
 * Set the timed trigger to sync the spreadsheet with HighLevel.
 */
 function setSyncHighLevelTrigger() {
  var functionName = 'syncHighLevel';
  // Avoid duplicate triggers.
  deleteTriggerByName(functionName);

  var trigger = ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyHours(1)
    .create();
  console.log("Created trigger for '%s' with id %s to run once per hour", functionName, trigger.getUniqueId())
  
}

/**
 * Delete the trigger assigned to a particular function.
 * @param {string} functionName 
 */
function deleteTriggerByName(functionName) {
  // Find all existing triggers for the function, if they exist, and delete them
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() == functionName) {
      console.log("Removing trigger for '%s' with id %s", functionName, trigger.getUniqueId())
      ScriptApp.deleteTrigger(trigger);
    }
  })
}