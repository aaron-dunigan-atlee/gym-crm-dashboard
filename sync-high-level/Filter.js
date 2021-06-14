/**
 * Update the filter on the Pricing sheet of Gym owner spreadsheet,
 * so that it covers the whole sheet AND includes Challenge and Member Sign-Ups
 */
function updateCustomerPricingFilter() {
  var gymOwnerSs = getGymOwnerSpreadsheet()
  var pricingSheet = gymOwnerSs.getSheetByName("Pricing")
  
  // Remove the existing filter. We just need any range on the sheet to get the sheet's filter.
  var existingFilter = pricingSheet.getRange("A1").getFilter()
  if (existingFilter) existingFilter.remove();

  // Create a new filter that covers the whole data
  var filter = pricingSheet.getRange(1, 1, pricingSheet.getMaxRows(), pricingSheet.getMaxColumns()).createFilter()
  var criteria = SpreadsheetApp.newFilterCriteria()
    // There's a .setVisibleValues() which would be more convenient, except it's not supported.  Oh, google. 
    .setHiddenValues([
      '',
      null,
      'New Lead',
      'Not a Good Fit',
      'Show, No-Close',
      'No-Show',
      'Scheduled Appointments',
      'Archived',
      'Cancelled Membership'
    ])
    .build()
  // Column 1 is client status
  filter.setColumnFilterCriteria(1, criteria)

  console.log("Updated pricing filter to cover range %s", filter.getRange().getA1Notation())
}