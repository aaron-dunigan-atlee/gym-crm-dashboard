/**
 * Utilities for interfacing with HighLevel API (for individual location)
 * http://developers.gohighlevel.com/
 */
var HighLevel = (function(ns) {
  var HIGHLEVEL_API_KEY

  // Initialize the HL API by getting the API key for this location from the spreadsheet
  ns.setApiKey = function(key) {
    HIGHLEVEL_API_KEY = key;
    return ns
  }

  ns.getUsers = function() {
    return callHighLevel('get','users/location')
  }

  ns.getOpportunities = function(pipelineId) {
    // Requires pagination
    var endpointRoot = 'pipelines/' + pipelineId + '/opportunities?limit=20'
    var endpoint = endpointRoot
    var opportunities = []
    do {
      var result = callHighLevel('get', endpoint)
      opportunities = opportunities.concat(result.opportunities)
      endpoint = endpointRoot +
        '&startAfterId=' + result.meta.startAfterId + 
        '&startAfter=' + result.meta.startAfter
    } while (result.meta.nextPageUrl)
    return opportunities
  }

  ns.getOpportunity = function(pipelineId, opportunityId) {
    return callHighLevel('get', 'pipelines/' + pipelineId + '/opportunities/' + opportunityId)
  }

  ns.getPipelines = function() {
    return callHighLevel('get', 'pipelines/')
  }

  ns.getContact = function(id) {
    return callHighLevel('get', 'contacts/'+id)
  } 

  return ns;

  // -----------------
  // Private functions

  /**
   * Make a call to the Dialpad API
   * @param {string} method GET, PUT, POST, DELETE
   * @param {string} endpoint 
   * @param {Object} payload 
   * @returns {Object} The API response.
   */
  function callHighLevel(method, endpoint, payload){
    if (!HIGHLEVEL_API_KEY) throw new Error("No API key specified")

    var root = 'https://rest.gohighlevel.com/v1/';
    
    var params = {
      'method': method,
      'headers': {
        'Authorization': 'Bearer ' + HIGHLEVEL_API_KEY,
        'Accept': 'application/json'
      }
    };
    if (DEBUG) params.muteHttpExceptions = true;
    if (payload) params.payload = payload
    
    var response = DEBUG ? 
      UrlFetchApp.fetch(root + endpoint, params) :
      FetchTools.backoffOne(root + endpoint, params);
    var content = response.getContentText();
    // Some endpoints return empty response.
    if (!content) return null;
    if (DEBUG) console.log(content)
    var json = JSON.parse(content);
    return json;
  }

})({})
