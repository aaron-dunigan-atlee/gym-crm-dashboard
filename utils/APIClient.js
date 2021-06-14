// The "Admin Panel" web app
var SERVER_URL = 'https://script.google.com/macros/s/AKfycbzMER1TeisyrG34GQOM330kjn9bSnwMIMS4hojrKfRP6kPYyplt3ygR/exec'

/**
 * Post a request to the server script to perform an action
 * @param {Object} request 
 *    config.action {string}     Required.  Name of a public method on the server.
 *    config.arguments {Object}  Optional.  Named arguments for the action. 
 */
function postServerRequest(request) {
  if (!request.action) {
    throw new Error("Server request with no action: " + JSON.stringify(request))
  }
  
  // Get user email if allowed
  var user;
  try{
    user = Session.getActiveUser().getEmail()
  } catch(err) {
    user = 'unknown user'
  }

  // Add user and fileId and scriptId to payload
  request.user = user;
  request.fileId = SS.getId();
  request.scriptId = ScriptApp.getScriptId();
  
  var options = {
    "method"  : "POST",
    "payload" : JSON.stringify(request),
    "followRedirects" : true,
    "muteHttpExceptions": true,
  };

  console.log('Posting this request to the server: \n' + JSON.stringify(request, null, 2))

  var result = FetchTools.backoffOne(SERVER_URL, options);

  if (result.getResponseCode() == 200) {
    var content = result.getContentText();
    console.log('Response from server is %s', content)
    try {
      var response = JSON.parse(content)
      return response
    } catch(err) {
      console.error(err.message)
      return {
        status: 'error',
        message: "We got this response from the server but we didn't understand it:\n" + content
      }
    }

  } else {
    // Return an error object for the calling function to handle.
    return {
      status: 'error',
      message: result.getContentText()
    }
  }
}

/**
 * Display the result of the server request with a message to the user.
 * @param {Object} result With a .status and .message
 */
function handleServerResult(result) {
  // Log result
  if (result.status === 'error') { 
    console.error(result.message)
  } else if (result.status === 'warning') {
    console.warn(result.message)
  } else {
    console.log(result.message)
  }
}

