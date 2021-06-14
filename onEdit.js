
/**
 * Create a map of {sheetName: {column header: function name}} for onEdit triggers
 */
function getOnEditFunctions() {
  return {
    // CRM Tracking Sheet
    'CRM Tracking Sheet': {
      'Status': 'onEditStatus',
      'Converted into a member?': 'onEditCrmConvertedToMember'
    },
    // Accountability Tracking
    'Accountability Tracking': {
      'Converted into a member?': 'onEditAccountabilityConvertedToMember'
    },
  }
}

/**
 * Installable edit trigger that routes to a function based on the sheet and column edited.
 * @param {Event} e 
 */
function onEditRouter(e) {
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();

  // Check for functions associated with a named range (on settings sheet)
  if (sheetName == 'Settings' && namedRangeStartsAtCell('ChallengeLength', e.range)) {
    onEditChallengeLength(e);
    return;
  }

  if (sheetName == 'Settings' && (namedRangeStartsAtCell('TwilioSID', e.range) || namedRangeStartsAtCell('TwilioToken', e.range))) {
    onEditTwilio(e);
    return;
  }

  return;
  
  // As of 3.3.21 we're no longer needing this.  We use vlookups to move accountability data back to the CRM page. 
  // But existing copies have this as a trigger so I'm leaving it here for now.
  // Check if there are onEdit functions for this sheet.
  var onEditFunctions = getOnEditFunctions();
  var sheetFunctions = onEditFunctions[sheetName]
  if (!sheetFunctions) return;

  // Check if there is an onEdit function for the column(s) encompassed by e.range.
  var headerRow = HEADER_ROWS_BY_SHEET_NAME[sheetName];
  var firstEditColumn = e.range.getColumn();
  var editWidth = e.range.getWidth();
  var firstEditRow = e.range.getRow();
  var editHeight = e.range.getHeight();
  // Get the headers on this sheet.
  var headers = sheet.getRange(headerRow, firstEditColumn, 1, editWidth).getValues()[0];
  headers.forEach(function(header, index){
    // Check if there's a function for this column
    var editFunction = sheetFunctions[header]
    if (!editFunction) return; // Check next header
    var column = index + firstEditColumn;
    // Send only 1-column ranges to the edit functions.
    console.log("Applying function %s to column %s ", editFunction, column)
    e.range = sheet.getRange(firstEditRow, column, editHeight, 1);
    // Run the function
    this[editFunction](e)
  }) // for each header


}
/**
 * Transfer Twilio SID and Token to High Level
 * @param {Event} e Edit event
 */
function onEditTwilio(e) {
  var sidRange = getRangeByName(e.range.getSheet(), 'TwilioSID')
  if (!sidRange) throw new Error("No range 'TwilioSID' found")
  var sid = sidRange.getValue()

  var tokenRange = getRangeByName(e.range.getSheet(), 'TwilioToken')
  if (!tokenRange) throw new Error("No range 'TwilioToken' found")
  var token = tokenRange.getValue()

  
  if (sid && token) {
    console.log("Updating Twilio auth details")
    // Set them in HL
    handleServerResult(
      postServerRequest({
        'action': 'setTwilioAuth',
        'arguments': {
          'sid': sid,
          'token': token
        }
      })
    )
  } else if (!sid && !token) {
    console.log("Removing Twilio auth details")
    // Both removed: remove from HL
    handleServerResult(
      postServerRequest({
        'action': 'removeTwilioAuth'
      })
    )
  } else {
    // One but not the other?  We'll asssume the user is still entering, and do nothing.
    console.log("We only have one of Twilio SID and token; doing nothing")
  }


}


/**
 * When status is changed, make appropriate changes.
 * @param {Event} e 
 * If changed to Member Sign-Up, set Membership date and Converted To Member
 * If Challenge Sign-Up, add to Challenge sheet and mark challenge started date
 * If 
 */
function onEditStatus(e) {
  // In case the edit range is more than 1 cell:
  // var values = (e.value === undefined) ? e.range.getValues() : [[e.value]]
  if (e.range.getHeight() > 1) {
    console.error("Can't run onEditStatus on multiple rows... giving up.")
    return;
  }

  // e doesn't always contain value, for example when we undo.  So read cell value for status.
  var status = e.range.getValue();
  console.log("Got this status value: " + status)
  if (!status) return;

  if (MEMBER_SIGN_UP_PATTERN.test(status)) onMemberSignUp(e)
  if (CHALLENGE_SIGN_UP_PATTERN.test(status)) onChallengeSignUp(e)
}

/**
 * Respond to member sign-up.  Set date and set converted to member.
 * @param {onEdit Event} e 
 */
function onMemberSignUp(e) {
  console.log("Membership Sign-Up")
  var crmSheet = e.range.getSheet();
  var leadRow = e.range.getRow();

  // Add date 
  var headers = crmSheet.getRange("1:1").getValues()[0]
  var startDateColumn = headers.indexOf('Membership Start Date') + 1
  if (startDateColumn > 0) crmSheet.getRange(leadRow, startDateColumn).setValue(getDatestamp())

  // Add conversion status
  // var convertedColumn = headers.indexOf('Converted into a member?') + 1
  // if (convertedColumn > 0) crmSheet.getRange(leadRow, convertedColumn).setValue('Yes')

}

/**
 * Respond to challenge sign-up.
 * Set challenge start and end date.  
 * Add to accountability tracker.
 * @param {onEdit Event} e 
 */
function onChallengeSignUp(e) {
  // Use a lock to help avoid duplicates
  var lock = LockService.getScriptLock();
  var success = lock.tryLock(30000);
  if (!success) {
    sheetLog('Could not obtain lock', 'lockError')
    return;
  }

  console.log("Challenge Sign-Up")
  var crmSheet = e.range.getSheet();
  var leadRow = e.range.getRow();

  // Get full row data for this lead.
  var leadRowRange = crmSheet.getRange(leadRow, 1, 1, crmSheet.getLastColumn())
  var lead = getRowsData(crmSheet, leadRowRange, {headersRowIndex: 1})[0]
  console.log("Challenge sign-up: %s", JSON.stringify(lead))


  var dateStamp = getDatestamp();

  // Add date and challenge status
  lead.challengeStartDate = dateStamp
  var challengeLengthWeeks = getChallengeLength();
  var challengeEndDate = new Date()
  challengeEndDate.setDate(challengeEndDate.getDate() + challengeLengthWeeks*7)
  lead.challengeEndDate = getDatestamp(challengeEndDate);

  // Write them back to CRM sheet
  var headers = crmSheet.getRange("1:1").getValues()[0]
  var startDateColumn = headers.indexOf('Challenge Start Date') + 1
  if (startDateColumn > 0) crmSheet.getRange(leadRow, startDateColumn).setValue(lead.challengeStartDate)
  var endDateColumn = headers.indexOf('Challenge End Date') + 1
  if (endDateColumn > 0) crmSheet.getRange(leadRow, endDateColumn).setValue(lead.challengeEndDate)

  // Check if it's on the accountability already, and add it if not.
  updateOnAccountability(lead)

  lock.releaseLock()
}

/**
 * Respond to a challenger converting to membership
 * @param {edit Event} e 
 */
function onEditAccountabilityConvertedToMember(e) {
  var accountabilitySheet = e.range.getSheet()
  var editRow = e.range.getRow()
  syncAccountabilityToCrm(null, editRow, editRow, accountabilitySheet)
}

/**
 * When user marks membership on CRM sheet, check if that member is on accountability and update there too.
 * No longer needed 3.3.21
 * @param {edit Event} e 
 */
function onEditCrmConvertedToMember(e) {
  return;
  var crmSheet = e.range.getSheet()
  var editRow = e.range.getRow()
  console.log("Membership changed on row %s of crm", editRow)

  // Get row data for this row
  var crmRowData = getRowsData(
    crmSheet,
    crmSheet.getRange(editRow, 1, 1, crmSheet.getLastColumn()),
    {
      headersRowIndex: CRM_HEADERS_ROW,
      startHeader: 'First Name',
      endHeader: 'Last Name'
    }
  )[0]
  console.log("Got this data: %s", JSON.stringify(crmRowData))

  // Get the accountability data (on gym-owner copy) and find the row corresponding to this person
  var accountabilitySheet = getGymOwnerSpreadsheet().getSheetByName(ACCOUNTABILITY_SHEET_NAME)
  var accountabilityRow = getRowsData(
    accountabilitySheet,
    accountabilitySheet.getRange(ACCOUNTABILITY_DATA_START_ROW, 1, accountabilitySheet.getLastColumn(), accountabilitySheet.getLastColumn()),
    {
      headersRowIndex: ACCOUNTABILITY_HEADERS_ROW,
      getMetadata: true
    }
  // Find our member
  ).find(function(x){return x.firstName === crmRowData.firstName && x.lastName === crmRowData.lastName})

  if (accountabilityRow) {
    var membershipColumn = getHeaderColumn(
      accountabilitySheet, 
      'Converted into a member?',
      {headersRowIndex: ACCOUNTABILITY_HEADERS_ROW}
    )
    if (membershipColumn > 0) {
      accountabilitySheet.getRange(accountabilityRow.sheetRow, membershipColumn).setValue("Yes")
      console.log("Updated member on accountability")
    }
  } else {
    console.log("Member not found on accountability")
  }
}

/**
 * When challenge length is updated, update the accountability sheet
 * @param {edit Event} e 
 */
function onEditChallengeLength(e) {
  setChallengeLength(
    SS.getRangeByName('ChallengeLength').getValue()
  );
}