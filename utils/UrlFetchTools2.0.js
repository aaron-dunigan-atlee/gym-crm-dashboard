
/**
 * FetchTools 
 * v. 2.0
 *  -- add .formQueryUrl
 */
var FetchTools = (function (ns) {
  var BATCH_SIZE = 500;
  var DEFAULT_RETRIES = 3;
  
  ns.backoffOne = function(url, options ,retries){
    retries = retries || DEFAULT_RETRIES;
    options = options || {};
    for (var attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) Utilities.sleep(5000 * Math.pow(2, attempt)); //don't wait the first time
      try{
        var response = UrlFetchApp.fetch(url, options); 
        return response
      } catch (err) {
        if(attempt == retries){
          throw err
        }
        console.error('Fetch error, '+(retries-attempt)+' retries remain.\n'+err.message)
      }
    }  
    
  } // fetchTools.backoffOne()
  
  ns.backoffBatches = function(requests, retries, batchSize){
    batchSize = batchSize || BATCH_SIZE;
    retries = retries || DEFAULT_RETRIES;
    console.log("Fetching %s http requests asychronously in batchs of %s", requests.length, batchSize)
    var responses = [];
    var batchStart = 0;
    do {
      console.log("This batch starts at %s", batchStart)
      var batchResponses = ns.backoffAll(requests.slice(batchStart, batchStart + batchSize), retries);
      responses = responses.concat(batchResponses);
      batchStart += batchSize;  
    } while (batchStart < requests.length)
    return responses;
  } // fetchTools.backoffBatches()

  ns.backoffAll = function(requests,retries){
    retries = retries || DEFAULT_RETRIES;
    var success = false;
    for (var attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) Utilities.sleep(5000 * Math.pow(2, attempt)); //don't wait the first time
      try{
        var responses = UrlFetchApp.fetchAll(requests); 
        success = true;
      } catch (err) {
        if(/Invalid argument/.test(err.message)){
          throw err
          break;
        }
        console.error('FetchAll error, '+(retries-attempt)+' retries remain.\n'+err)
      }
      if (success) break;
    }  
    return responses
  } // fetchTools.backoffAll()

  
  
  /**
   * Convert a url and object of key: value pairs to a url with query parameters (.../?key=value&key2=value2&...)
   * @param {string} url Base url
   * @param {Object} params The query parameters
   * @returns {string} the query url
   */
   ns.formQueryUrl = function(url, params) {
    return url + '?' + Object.keys(params).map(function(key){return key + '=' + params[key]}).join('&')
  }
  
  return ns

})(FetchTools || {})
