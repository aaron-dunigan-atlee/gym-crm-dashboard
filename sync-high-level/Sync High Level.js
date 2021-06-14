/**
 * Sync this spreadsheet with its highlevel location
 */
function syncHighLevel() {
  // Get API Key
  HighLevel.setApiKey(getHighLevelApiKey())

  // Find the gym pipeline 
  var pipeline = getGymPipeline()
  var stagesById = hashObjects(pipeline.stages, 'id')

  // Share the gym owner spreadsheet with any added employee
  updateUsers()

  // Get Opportunities
  var opportunities = HighLevel.getOpportunities(pipeline.id)
  console.log("Found %s opportunities in the HighLevel pipeline", opportunities.length)
  var opportunitiesByContactId = hashByContactId(opportunities)

  // Get CRM data
  var crmSheet = SS.getSheetByName(CRM_SHEET_NAME)
  var crmData = getRowsData(
    crmSheet,
    null,
    {
      headersRowIndex: CRM_HEADERS_ROW,
      getMetadata: true,
      log: true
    }
  )
  var crmDataByContactId = hashObjects(crmData, 'ghlContactId')

  // Find clients on CRM that are not in HighLevel (i.e. they were deleted) and move them to Archived
  var clientsToKeep = [];
  var clientsToArchive = crmData.filter(function(client){
    // Not on HighLevel
    if (!opportunitiesByContactId[client.ghlContactId]) return true;
    
    // OR on HighLevel, but stage is Archive
    var opportunity = opportunitiesByContactId[client.ghlContactId];
    var stage = stagesById[opportunity.pipelineStageId];
    if (stage && stage.name === 'Archive') return true;

    // Still here?  It's a keeper
    // First assign pipleline_stage and HL status so we can update the status
    client.hlPipelineStage = stage.name
    client.hlStatus = opportunity.status
    clientsToKeep.push(client)
    return false;
  })
  console.log("%s clients will be kept; %s will be archived", clientsToKeep.length, clientsToArchive.length); 
  if (clientsToArchive.length > 0) archiveClients(clientsToArchive, crmSheet)

  // Update status of all remaining clients
  console.log("Updating client statuses")
  clientsToKeep.forEach(function(client){updateLeadOnSync(client, opportunitiesByContactId[client.ghlContactId])})

  // Add any opportunities not listed on spreadsheet 
  var opportunitiesToAdd = opportunities.filter(function(opportunity){
    if (!opportunity.contact || !opportunity.contact.id) {
      console.error("Opportunity doesn't have associated contact: %s", JSON.stringify(opportunity))
      return false
    }
    return (!crmDataByContactId[opportunity.contact.id]) 
  })
  console.log("Found %s opportunities not on the CRM sheet", opportunitiesToAdd.length)

  // Convert opportunities to clients
  opportunitiesToAdd.forEach(function(opportunity){
    if (opportunity.contact) {
      // The opportunity doesn't include all contact fields, so we query them separately
      console.log("Adding opportunity %s to the CRM sheet", opportunity.contact.name)
      var client = HighLevel.getContact(opportunity.contact.id).contact
      mapHeaders([client], HL_CONTACT_TO_CRM_MAP)
      var dateStarted = client.dateAdded ? new Date(client.dateAdded) : new Date();
      client.leadGenerationDateformatShouldBe2019099 = Utilities.formatDate(dateStarted, TIMEZONE, 'M/d/yy')
      // Get status
      client.hlStatus = opportunity.status;
      client.hlPipelineStage = stagesById[opportunity.pipelineStageId].name;
      client.ghlContactId = client.id
      updateLeadOnSync(client)
      clientsToKeep.push(client)
    } else {
      console.warn("Opportunity found but doesn't contain contact info: %s", JSON.stringify(opportunity))
    }
  })

  // Update the CRM sheet
  console.log("Updating CRM sheet")
  setRowsData(
    crmSheet,
    clientsToKeep,
    {
      'log': true,
      'writeMethod': 'clear',
      'preserveArrayFormulas': true
    }
  )

  // Other business: update pricing filter
  updateCustomerPricingFilter()

}

var HL_CONTACT_TO_CRM_MAP = {
  'firstName': 'firstName',
  'lastName': 'lastName',
  'phone': 'phoneNumber',
  'user.email': 'user.emailAddress'
}

/**
 * Handle change in status, specifically to challenger or member
 * @param {Object} lead Client object from spreadsheet, with added hlStatus and hlPipelineStage fields
 */
function updateLeadOnSync(lead, hlOpportunity) {
  // Get the new lead status
  // console.log("Getting status for lead %s", JSON.stringify(lead,null,2))
  var newStatus = getClientStatusOnSync(lead)
  if (newStatus === lead.status) {
    // No change.  Just return
    console.log("No change in status (%s) for %s %s", lead.status, lead.firstName, lead.lastName)
    return
  }
  // Assign the new status
  console.log("Updating status for %s %s, from %s to %s", lead.firstName, lead.lastName, lead.status, newStatus)
  lead.status = newStatus

  // Handle membership sign up: add start date
  if (MEMBER_SIGN_UP_PATTERN.test(newStatus)) {
    console.log("Member sign-up: adding membership start date")
    lead.membershipStartDate = lead.membershipStartDate || getDatestamp();
  }

  // Handle challenge sign up, but only if they didn't previously sign up as challenger
  if (CHALLENGE_SIGN_UP_PATTERN.test(newStatus) && !lead.challengeStartDate) {
    console.log("New challenger: adding dates and adding to accountability")
    var dateStamp = getDatestamp();

    // Add date and challenge status
    lead.challengeStartDate = dateStamp
    var challengeLengthWeeks = getChallengeLength();
    var challengeEndDate = new Date()
    challengeEndDate.setDate(challengeEndDate.getDate() + challengeLengthWeeks*7)
    lead.challengeEndDate = getDatestamp(challengeEndDate);

    // Get a lock to avoid collisions
    var lock = LockService.getScriptLock()
    var success = lock.tryLock(30000);
    if (!success) {
      sheetLog('Could not obtain lock', 'lockError')
      return;
    }

    updateOnAccountability(lead)

    // Release the lock
    lock.releaseLock()
  } // if challenge sign up

  // Handle cancelled membership
  if (newStatus === 'Cancelled Membership') {
    console.log("Cancelled membership: adding membership end date")
    lead.membershipEndDate = lead.membershipEndDate || getDatestamp();
  }

}

/**
 * Add a lead to the accountability (challengers) sheet, if not already there.
 * @param {Object} lead Lead object from CRM sheet
 * @returns 
 */
function updateOnAccountability(lead) {


  // Check if it's on the accountability already, in which case, don't duplicate
  var accountabilitySheet = getGymOwnerSpreadsheet().getSheetByName("Accountability Tracking");
  var challengers = getRowsData(
    accountabilitySheet,
    // First 3 columns (first, last, start date) to save read time
    accountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, 1, accountabilitySheet.getLastRow() - ACCOUNTABILITY_DATA_START_ROW + 1, 3),
    {
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW,
    }
  )
  var dateStamp = getDatestamp();
  if (challengers.find(function(c){ return c.firstName === lead.firstName && c.lastName === lead.lastName && getDatestamp(c.challengeStartDate) === dateStamp})) {
    sheetLog("Duplicate challenge sign-up, not added to accountability", 'duplicate')
    return
  }

  // Create the challenger's google drive folder and challenger spreadsheet
  createChallengerFolder(lead)

  // Write back to accountability sheet
  var firstEmptyRow = getFirstEmptyRow(accountabilitySheet, ACCOUNTABILITY_DATA_START_ROW)
  setRowsData(
    accountabilitySheet,
    [lead],
    {
      firstRowIndex: firstEmptyRow,
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW,
      startHeader: 'First Name',
      endHeader: 'Challenge End Date',
      log: true
    }
  )
  setRowsData(
    accountabilitySheet,
    [lead],
    {
      firstRowIndex: firstEmptyRow,
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW,
      startHeader: 'Challenger File',
      endHeader: 'Challenger File',
      log: true
    }
  )

  console.log("Added %s %s to accountability", lead.firstName, lead.lastName)

}

/**
 * Create a google drive folder, and challenge tracking spreadsheet, for a challenger
 * @param {Object} lead 
 */
function createChallengerFolder(lead) {
  // Get the location folder
  var locationFolder = getLocationFolder()

  var folderName = lead.firstName + ' ' + lead.lastName + ' ' + lead.challengeStartDate
  var challengerFolder = getOrCreateFolderByName(locationFolder, folderName)
  var challengerSpreadsheet = getChallengerSpreadsheet(challengerFolder, 'Challenge Tracker ' + folderName)
  lead.challengerFile = '=HYPERLINK("' + challengerFolder.getUrl() + '", "Open File")'
}

/**
 * Determine the lead status based on data in the HL opportunity
 * @param {Object} lead Client object from CRM spreadsheet
 */
function getClientStatusOnSync(lead) {

  // If status is "abandoned", it's not a good fit
  if (lead.hlStatus && lead.hlStatus === 'abandoned') {
    return "Not a Good Fit"
  }

  // Lead status is "lost", could be "no-show", or "show, no close".  We'll default to the latter.
  if (lead.hlStatus && lead.hlStatus === 'lost') {
    return "Show, No-Close"
  }

  // Otherwise, it's based on the pipeline stage
  switch (lead.hlPipelineStage) {
    case "Scheduled Appointment":
      return "Scheduled Appointments";
      break;
    case "New Client - Challenger":
      return "Challenge Sign-Up";
      break;
    case "New Client - Member":
      return "Member Sign-Up";
      break;
    case "No show":
      return "No-Show"
      break;
    case "Archive":
      return "Archived"
      break;
    case "New Lead":
      return "New Lead"
      break;
    case "Cancelled Membership":
      return "Cancelled Membership"
      break;
    // Default is no change
    default:
      return lead.status;
      break; 
  }

}


/**
 * Get the HighLevel API key for this location, found on the spreadsheet
 * @returns {string}
 */
function getHighLevelApiKey() {
  var range = getRangeByName(SS.getSheetByName("DO NOT MODIFY"), "HighLevelApiKey")
  if (!range) throw new Error("Can't find API key")
  var key = range.getValue() 
  if (!key) throw new Error("Can't find API key")
  return key
}

/**
 * Find the gym pipeline (a little tricky as it doesn't have a constant identifier across locations, but it should have the same stages)
 * @returns {Object}
 */
function getGymPipeline() {
  var pipelines = HighLevel.getPipelines().pipelines;
  var gymPipeline = pipelines.find(function(pipeline){
    return pipeline.stages.some(function(x){ return x.name === 'New Client - Challenger'})
  })
  if (!gymPipeline) throw new Error("Can't find a gym pipeline for this location")
  console.log("Found gym pipeline with id %s", gymPipeline.id)
  return gymPipeline
}



/**
 * Hash an array of opportunities by their contact id (different from the opportunity id)
 * @param {Object[]} array Opportunities
 * @return {Object} Object of form {key: Object from array}
 */
 function hashByContactId(array) {
  var hash = {};
  array.forEach(function(opportunity){
    if (opportunity.contact && opportunity.contact.id) {
      hash[opportunity.contact.id] = opportunity;
    } else {
      console.warn("Can't hash opportunity because it doesn't have a contact id: " + JSON.stringify(opportunity))
    }
  })
  return hash
}

/**
 * Move these clients to the Archived sheet
 * @param {Object[]} clients CRM Client objects
 */
function archiveClients(clients, crmSheet) {
  console.log("Archiving %s clients", clients.length)
  // Copoy to archive sheet
  crmSheet = crmSheet || SS.getSheetByName(CRM_SHEET_NAME)
  var archiveSheet = getArchiveSheet()
  setRowsData(
    archiveSheet,
    clients,
    {
      'writeMethod': 'append',
      'log': true
    }
  )
  //  Remove from the crm sheet. Note: this requires advanced Sheets.
  removeRows(
    crmSheet,
    clients,
    {'log': true},
    'ghlContactId'
  )

  // Remove from gym owner copy by mapping the sheetrow indices from crm copy.
  removeRows(
    getGymOwnerSpreadsheet().getSheetByName('Pricing'),
    clients,
    {'log': true}
    // No primaryKey given, forces use of sheetRows
  )
}

/**
 * Get the archive sheet.  Create it if it doesn't exist.
 */
function getArchiveSheet() {
  var sheet = SS.getSheetByName(ARCHIVE_SHEET_NAME)
  if (sheet) return sheet;
  sheet = SS.insertSheet(ARCHIVE_SHEET_NAME);
  var headers = SS.getSheetByName(CRM_SHEET_NAME).getRange("1:1").getValues()
  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers)
  sheet.setFrozenRows(1)
  SpreadsheetApp.flush()
  console.log("Created Archive sheet")
  return sheet
}

function updateUsers() {
  // Get the users for this location
  var users = HighLevel.getUsers().users
  console.log("Found these users for this location: %s", JSON.stringify(
    users.map(function(u) { return u.firstName + " " + u.lastName + " (" + u.email + ")"}),
    null, 2
  ));

  // Get the spreadsheet id for the gym owner spreadsheet
  var spreadsheetId = getGymOwnerSpreadsheet().getId()

  // Give all users access
  users.forEach(function(user) {
    shareSilentlyFailSilently(spreadsheetId, user.email, "writer")
  })
  
}
