function doPost(e){
  return handleResponse(e);
}

var GHL_TO_SHEET_MAP = {
  'first_name': 'firstName',
  'last_name': 'lastName',
  'email': 'emailAddress',
  'phone': 'phoneNumber',
  'contact_source': 'leadSource',
  'contact_id': 'ghlContactId'
}
  
/**
 * Respond to incoming webhook from GHL
 * Adapted from https://ghlexperts.com/scripts-and-hacks/integrations/ghl-to-google-spreadsheet-no-zapier
 * @param {Event} e 
 */
function handleResponse(e) {
  sheetLog(e.postData.contents, 'webhook')

  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty('apiKey');
    var queryString = parseQuery(e.queryString);
    if(queryString != null && queryString.apiKey) {
      if(queryString.apiKey[0] != apiKey) {
        return ContentService
          .createTextOutput(JSON.stringify({"error":"Please provide API Key"}))
          .setMimeType(ContentService.MimeType.JSON);
        }
    } else {
      return ContentService
      .createTextOutput(JSON.stringify({"error":"Please provide API Key"}))
      .setMimeType(ContentService.MimeType.JSON);
    }

    /* Parse the incoming data, and format and map to our headers */
    var lead = JSON.parse(e.postData.contents)
    // Sometimes the name is not passed, so look it up with API.
    if ((!lead.first_name || !lead.last_name) && lead.contact_id) {
      try {
        var contact = HighLevel.setApiKey(getHighLevelApiKey()).getContact(lead.contact_id).contact
        lead.first_name = contact.firstName
        lead.last_name = contact.lastName
        lead.full_name = contact.firstName + ' ' + contact.lastName
      } catch(err) {
        console.warn("Couldn't fetch HL contact %s: %s", lead.contact_id, err.message)
      }
    }
    mapHeaders(lead, GHL_TO_SHEET_MAP)
    // Process the lead to determine status and other fields
    assignLeadStatus(lead)

    // Handle cancelled membership
    if (lead.status === 'Cancelled Membership') {
      console.log("Cancelled membership: adding membership end date")
      lead.membershipEndDate = getDatestamp();
    }

    /* Check whether we've already got this client.  If so, update.  If not, append. */

    // Get CRM data
    var crmSheet = SS.getSheetByName(CRM_SHEET_NAME)
    var crmData = getRowsData(
      crmSheet,
      null,
      {
        headersRowIndex: CRM_HEADERS_ROW,
        getMetadata: true
      }
    )
    var crmByName = multihashObjects(crmData, ['firstName','lastName'], {'separator': ' '})
    // Note that older versions won't have the GHL Contact ID field, so we may need to check by name.
    var crmById = hashObjects(crmData, 'ghlContactId')
    var existingLead = crmById[lead.contact_id] || crmByName[lead.full_name]

    /* Update the lead */
    var editRange
    if (existingLead) {
      if (lead.pipleline_stage === 'Archive') {
        archiveClients([existingLead])
      } else {
        editRange = updateLead(existingLead, lead)
        // sheetLog("Updated lead on " + editRange.getA1Notation())
      }
    } else {
      // At this point, if lead is archived but not present on sheet, we'll just disregard it
      if (lead.pipleline_stage !== 'Archive') editRange = appendLead(lead)
    }
    // We need to run the onEdit to handle status change AND change in membership 
    if (editRange) {
      onEditStatus({
        // Pass the first cell as the edited cell.
        range: editRange.offset(0,0,1,1)
      })
    }

    // We have to leave one line of test data when setting up; delete this line if it's still there.
    if (crmData[0].firstName === 'Jim' && crmData[0].lastName === 'Jonas') crmSheet.deleteRow(2)

    // Update the filter
    updateCustomerPricingFilter()

    // Other business: set the syncHighLevel trigger if it's not present.  
    // TODO: Once all existing gyms (as of 3.29.21) are phased in, this can be removed.
    patch_setSyncHighLevelTrigger();

    // return json success results
    return ContentService
      .createTextOutput(JSON.stringify({"result":"success"}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err){
    // if error return this
    err = (typeof err === 'string') ? new Error(err) : err;
    sheetLog(err.message + '\n' + err.stack, 'error', 'error');
    return ContentService
      .createTextOutput(JSON.stringify({"result":"error", "error": err}))
      .setMimeType(ContentService.MimeType.JSON);
  } 

  //-----------------
  // Private functions

  function updateLead(existingLead, newLead) {
    console.log("Updating lead details for lead " + newLead.full_name)

    // Update object
    for (var prop in newLead) {
      if (newLead[prop]) existingLead[prop] = newLead[prop]
    }
    var editRange = setRowsData(
      crmSheet,
      [existingLead],
      {
        'firstRowIndex': existingLead.sheetRow,
        'log': true,
        'preserveArrayFormulas': true
      }
    )
    SpreadsheetApp.flush()

    // // Run the onEdit trigger for a change in membership status on the CRM page.
    // if (membershipStatusChanged) onEditCrmConvertedToMember({range: editRange})

    return editRange
  }

  function appendLead(lead) {
    // If status is member, add "Yes" to conversion column
    // if (lead.status === 'Member Sign-Up') {
    //   lead.convertedIntoAMember = 'Yes'
    // }
    // Add timestamp
    lead.leadGenerationDateformatShouldBe2019099 = Utilities.formatDate(new Date(), TIMEZONE, 'M/d/yy')
    return setRowsData(
      crmSheet,
      [lead],
      {
        'firstRowIndex': getFirstEmptyRow(crmSheet, CRM_HEADERS_ROW + 1),
        'log': true,
        'preserveArrayFormulas': true
      }
    )
  }
}

/**
 * Determine the lead status based on data in the incoming json, and re-assign the .status field based on our own naming system
 * @param {Object} lead Whose .status comes from HighLevel
 */
function assignLeadStatus(lead) {
  // If there's a calendar object, it's an appointment
  if (lead.calendar && lead.calendar.status === 'booked' && lead.calendar.appoinmentStatus === 'confirmed') {
    lead.consultationDateformatShouldBe2019099 = 
      Utilities.formatDate(new Date(lead.calendar.startTime), TIMEZONE, 'yyyy-MM-dd')
    lead.status = "Scheduled Appointments"
    return;
  }

  // If status is "abandoned", it's not a good fit
  if (lead.status && lead.status === 'abandoned') {
    lead.status = "Not a Good Fit"
    return;
  }

  // Lead status is "lost", could be "no-show", or "show, no close".  We'll default to the latter.
  if (lead.status && lead.status === 'lost') {
    lead.status = "Show, No-Close"
    return;
  }

  // Otherwise, it's based on the pipeline stage
  // Yes, that's pipleline.
  switch (lead.pipleline_stage) {
    case "Scheduled Appointment":
      lead.status = "Scheduled Appointments";
      break;
    case "New Client - Challenger":
      lead.status = "Challenge Sign-Up";
      break;
    case "New Client - Member":
      lead.status = "Member Sign-Up";
      break;
    case "No show":
      lead.status = "No-Show"
      break;
    // case "Archive": preserve the last known status
    case "Archive":
      lead.status = null
      break;
    case "Cancelled Membership":
      lead.status = "Cancelled Membership"
      break;  
    // Default is new lead
    default:
      lead.status = "New Lead";
      break; 
  }

}

function parseQuery(query) {
  if (query) {
  return query.split("&")
    .reduce(function(o, e) {
      var temp = e.split("=");
      var key = temp[0].trim();
      var value = temp[1].trim();
      value = isNaN(value) ? value : Number(value);
      if (o[key]) {
        o[key].push(value);
      } else {
        o[key] = [value];
      }
        return o;
    }, {});
  }
  return null;
}