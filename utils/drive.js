
/**
 * Get (or create) the google drive folder that contains files for this location
 * This folder will be shared with all editors/viewers of the gym owner spreadsheet
 */
function getLocationFolder() {
  // Retrieve the folder id, or create the folder if the id doesn't exist.
  var folderId = PROPS.getProperty(LOCATION_FOLDER_KEY)
  if (folderId) return DriveApp.getFolderById(folderId)

  // Folder doesn't exist; create it and store its id.
  var folder = DriveApp.getFolderById(CHALLENGER_FILES_ROOT_FOLDER_ID).createFolder(getGymName())
  PROPS.setProperty(LOCATION_FOLDER_KEY, folder.getId())
  // Share it with all viewers/editors of the gym owner spreadsheet
  var gymOwnerSs = getGymOwnerSpreadsheet()
  var viewers = gymOwnerSs.getViewers()
  viewers.forEach(function(user){
    folder.addViewer(user)
  })
  var editors = gymOwnerSs.getEditors()
  editors.forEach(function(user){
    folder.addEditor(user)
  })
  console.log("Created location folder '%s' and added %s viewers and %s editors", folder.getName(), viewers.length, editors.length)
  return folder
}


/**
 * Retrieve the first folder named folderName, from the parentFolder
 * If it doesn't exist, create it
 */
 function getOrCreateFolderByName(parentFolder, folderName) {
  var iterator = parentFolder.getFoldersByName(folderName);
  if (iterator.hasNext()) {
    return iterator.next()
  } else {
    var newFolder = parentFolder.createFolder(folderName)
    return newFolder
  }
}


/**
 * Retrieve the first file named fileName, from the parentFolder
 * If it doesn't exist, return null.
 *
 * @param {Folder} parentFolder 
 * @param {string} fileName 
 * @return {File} The File, or null
 */
 function getFileByName(parentFolder, fileName) {
  var iterator = parentFolder.getFilesByName(fileName);
  if (iterator.hasNext()) {
    return iterator.next()
  } else {
    return null;
  }
}



/**
 * Share a file without sending the usual notification email.
 * If the share fails, log the fact and move on.
 * @param {string} fileId 
 * @param {string} userEmail 
 * @param {string} role owner, organizer, fileOrganizer, writer, commenter, reader,
 * @param {boolean} notifyIfNonGoogle If true, if the email is not a google account(e.g. yahoo), we want to send the notification email
 * We detect this by attempting to suppress notification first.  In this case, sharing will fail with an error message like this:
 * API call to drive.permissions.insert failed with error: Bad Request. User message: "You are trying to invite xxx@yahoo.com. Since there is no Google account associated with this email address, you must check the "Notify people" box to invite this recipient."
 */
function shareSilentlyFailSilently(fileId, userEmail, role, notifyIfNonGoogle){
  role = role || 'reader'
  // Convert email aliases (the ones with +) to their originals.
  var realEmail = userEmail.replace(/\+.+@/,'@')
  try {
    Drive.Permissions.insert(
    {
      'role': role,
      'type': 'user',
      'value': realEmail
    },
    fileId,
    {
      'sendNotificationEmails': 'false'
    });  
    console.log("File %s shared with %s", fileId, realEmail)
  } catch(err) {
    if (notifyIfNonGoogle && err.message.includes('there is no Google account associated with this email address')) {
      try {
        Drive.Permissions.insert(
        {
          'role': role,
          'type': 'user',
          'value': realEmail
        },
        fileId,
        {
          'sendNotificationEmails': 'true'
        });  
      } catch(err) {
        console.error("Couldn't share file " + fileId + " with " + realEmail + ": " + err.message, 'Share error')
      }
    } else {
      console.error("Couldn't share file " + fileId + " with " + realEmail + ": " + err.message, 'Share error')
    }
    
  }
}
