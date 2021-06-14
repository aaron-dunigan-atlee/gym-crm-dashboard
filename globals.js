/**
 * Scripts by Aaron Dunigan AtLee
 * aaron.dunigan.atlee -at- gmail
 * Feb 2021
 */
var VERSION = 2.5 // Allow gym employees access

/* This Spreadsheet */

var SS = SpreadsheetApp.getActive();
var TIMEZONE = SS.getSpreadsheetTimeZone();

var ACCOUNTABILITY_SHEET_NAME = "Accountability Tracking"
var CRM_SHEET_NAME = "CRM Tracking Sheet"
var SETTINGS_SHEET_NAME = "Settings"
var ARCHIVE_SHEET_NAME = "Archived"
var COMMISSION_HISTORY_SHEET_NAME = 'Commission History'
var COMMISSIONS_SHEET_NAME = 'Commissions'
var COMMISSIONS_SHEET_HEADER_ROW = 2

// Header row for each sheet
var ACCOUNTABILITY_HEADERS_ROW = 5;
var CRM_HEADERS_ROW = 1;
var HEADER_ROWS_BY_SHEET_NAME = {
  // CRM Tracking Sheet
  'CRM Tracking Sheet': CRM_HEADERS_ROW,
  // Accountability Tracking
  'Accountability Tracking': ACCOUNTABILITY_HEADERS_ROW
}

var ACCOUNTABILITY_DATA_START_ROW = 9;

// Use regex for status matching, in case user doesn't use the drop down.
var MEMBER_SIGN_UP_PATTERN = /Member Sign[ -]+Up/i
var CHALLENGE_SIGN_UP_PATTERN = /Challenge Sign[ -]+Up/i

/* Properties and keys */
var PROPS = PropertiesService.getScriptProperties();
var LOCATION_FOLDER_KEY = 'location_folder_id'

/* The challenge report template */
var CHALLENGE_REPORT_TEMPLATE_ID = '1HgOIqaFPrEU-lR5QsrLseQNP7m8sZcupuuZKH48QueQ'
var CHALLENGER_FILES_ROOT_FOLDER_ID = '1QTAWBUtTDFmOhYsOndVVpyJtJV96H5l2'
var CHALLENGE_TRACKER_TEMPLATE_ID = '1IYrWHL_WPSzN6X6Xm8kl2dzrkA4uYYKwFTKh29FLBCM'

/* The crm template */
var GYM_OWNER_TEMPLATE_ID = '1p28mKYUy5E9h3MY9fe6yomvpqYtfYgOhT5K8gF1xfjo'