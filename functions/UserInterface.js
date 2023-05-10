const PROPERTY_DEFAULT_PROFILE_NAME = "defaultProfileName";

const KEY_ENDPOINT_READ = "endpointRead";
const KEY_ENDPOINT_WRITE = "endpointWrite";
const KEY_PROFILE_NAME = "profileName";

const URL_GITHUB = "https://github.com/IGVF-DACC/igvf-metadata-submitter/tree/dev";


function setDefaultEndpointRead() {
  var endpoint = Browser.inputBox(
    `* Current default endpoint for READs (GET):\\n${getDefaultEndpointRead()}\\n\\n` +
    "* Supported ENCODE endpoints:\\n" +
    `${ENCODE_ENDPOINTS.join("\\n")}\\n\\n` +
    "* Supported IGVF endpoints:\\n" +
    `${getIgvfEndpointsAvailableForUsers().join("\\n")}\\n\\n` +
    "Enter a new endpoint:"
  );
  if (endpoint) {
    endpoint = trimTrailingSlash(endpoint);
  }
  if (!isValidEndpoint(endpoint)) {
    if (endpoint !== "cancel") {
      alertBox("Wrong endpoint: " + endpoint);
    }
    return;
  }
  setSpreadsheetDevMetadata(KEY_ENDPOINT_READ, endpoint);
}

function setDefaultEndpointWrite() {
  var endpoint = Browser.inputBox(
    `* Current default endpoint for Write actions (PUT/POST):\\n${getDefaultEndpointWrite()}\\n\\n` +
    "* Supported ENCODE endpoints:\\n" +
    `${ENCODE_ENDPOINTS.join("\\n")}\\n\\n` +
    "* Supported IGVF endpoints:\\n" +
    `${getIgvfEndpointsAvailableForUsers().join("\\n")}\\n\\n` +
    'Enter a new endpoint:'
  );
  if (endpoint) {
    endpoint = trimTrailingSlash(endpoint);
  }
  if (!isValidEndpoint(endpoint)) {
    if (endpoint !== "cancel") {
      alertBox("Wrong endpoint: " + endpoint);
    }
    return;
  }

  setSpreadsheetDevMetadata(KEY_ENDPOINT_WRITE, endpoint);
}

function checkProfile() {
  var profileName = getProfileName();

  if (getProfileName()) {
    var profile = getProfile(getProfileName(), getEndpointRead())

    if (!profile) {
      alertBox(
        "Found profile name but couldn't get profile from portal. Wrong credentials?\n" +
        "Go to the menu 'IGVF/ENCODE' -> 'Authorization'."
      );
    } else {
      return true;
    }

  } else {
    alertBox(
      "No profile name found.\n" +
      "Go to the menu 'IGVF/ENCODE' -> 'Settings & auth' to define it."
    );
  }
}

function search() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();

  var currentRow = sheet.getActiveCell().getRow();
  if (currentRow <= HEADER_ROW) {
    alertBox("Select a non-header data cell and run Search.");
    return;
  }
  var currentCol = sheet.getActiveCell().getColumn();
  if (!currentCol) {
    alertBox("Cannot find a column for the selected cell.");
    return;
  }
  var currentProp = getCellValue(sheet, HEADER_ROW, currentCol);
  var profile = getProfile(getProfileName(), getEndpointRead());
  var endpoint = getEndpointRead();

  var url = makeSearchUrlForProp(profile, currentProp, endpoint);

  if (url) {
    var propType = profile["properties"][currentProp]["type"];
    var selectedCellValue = SpreadsheetApp.getActiveSheet().getActiveCell().getValue();
    openSearch(
      url, currentProp, propType, getUIEndpoint(endpoint), selectedCellValue,
    );
  } else {
    alertBox("Couldn't find Search URL for selected column's property.");
  }
}

function uploadSidebar() {
  openUploadSidebar()
}

function openProfilePage() {
  if (!checkProfile()) {
    return;
  }

  openUrl(
    makeProfileUrl(getProfileName(), getEndpointRead(), format="page")
  );
}

function openToolGithubPage() {
  openUrl(URL_GITHUB);
}

function showSheetInfoAndHeaderLegend() {
  alertBox(
    "* Settings (This sheet)\n" +
    `- Endpoint READ (GET, profile): ${getEndpointRead()}\n` +
    `- Endpoint WRITE (POST/PATCH/PUT): ${getEndpointWrite()}\n` +
    `- Profile name: ${getProfileName()}\n\n` +

    "* Settings (Global)\n" +
    `- Endpoint READ (GET, profile): ${getDefaultEndpointRead()}\n` +
    `- Endpoint WRITE (POST/PATCH/PUT): ${getDefaultEndpointWrite()}\n` +
    `- Profile name: ${getDefaultProfileName()}\n\n` +

    "* Color legends for header properties\n" +
    "- red: required property\n" +
    "- blue: identifying property\n" +
    "- black: other editable property\n" +
    "- gray: ADMIN only property (readonly,nonSubmittable,'Do not sumit')\n\n" +

    "* Commented properties (filtered out when being sent to the portal)\n" +
    "- #skip: Set it to 1 to skip any READ/WRITE REST action for a row.\n" +
    "- #response: Debugging info. Action + HTTP error code + JSON response.\n" +
    "- #response_time: Debugging info. Time of recent action.\n\n" +

    "* Style legends for properties\n" +
    "- Underline: Searachable property. Go to menu 'Search'.\n" +
    "- Italic+Bold: Array type property."
  );
}

function applyProfileToSheet() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();
  var profile = getProfile(getProfileName(), getEndpointRead());

  // clear tooltip and dropdown menus
  clearFontColorInSheet(sheet);
  clearNoteInSheet(sheet);
  clearFormatInSheet(sheet);
  clearDataValidationsInSheet(sheet);

  // align all text to TOP to make more readable
  setRangeAlignTop(sheet);

  var missingProps = highlightHeaderAndDataCell(sheet, profile);
  if (missingProps.length > 0) {
    alertBox(
      "Some properties are missing in the given profile.\n" +
      "- Possible mismatch between profile and accession?\n\n" +
      "* Current profile: " + getProfileName() + "\n\n" +
      "* Missing properties:\n" + missingProps.join(", ")
    );
  }
}

function makeTemplate(forAdmin=false) {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();
  var profile = getProfile(getProfileName(), getEndpointRead());

  addMetadataTemplateToSheet(sheet, profile, forAdmin);

  applyProfileToSheet();
}

function makeTemplateForAdmin() {
  makeTemplate(forAdmin=true);
}

function makeTemplateForUser() {
  makeTemplate(forAdmin=false);
}

function getMetadataForAll(forAdmin) {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();
  var profile = getProfile(getProfileName(), getEndpointRead());

  if (profile["identifyingProperties"]
    .filter(prop => findColumnByHeaderValue(sheet, prop))
    .length === 0) {
    alertBox(
      `Couldn't find an identifying property (${profile["identifyingProperties"].join(",")}) in header row ${HEADER_ROW}\n\n` +
      `Add a proper identifying property to the header row and define it for each data row to retrieve from the portal.`
    );
    return;
  }

  var numData = getNumMetadataInSheet(sheet, ignoreHiddenRows=true);
  if (numData && !alertBoxOkCancel(
    `Found ${numData} data row(s).\n\n` + 
    "THIS ACTION CAN OVERWRITE DATA ON UNHIDDEN ROWS.\n\n" +
    "Are you sure to proceed?")) {
    return;
  }

  var numUpdated = updateSheetWithMetadataFromPortal(
    sheet, getProfileName(), getEndpointRead(), getEndpointRead(), forAdmin,
  );
  alertBox(`Updated ${numUpdated} rows.`);

  applyProfileToSheet();
}

function getMetadataForAllForAdmin() {
  return getMetadataForAll(forAdmin=true);
}

function getMetadataForAllForUser() {
  return getMetadataForAll(forAdmin=false);
}

function validateJsonWithSchema() {
  if (!checkProfile()) {
    return;
  }

  var numSubmitted = validateSheet(
    getCurrentSheet(), getProfileName(), getEndpointRead()
  );
  alertBox(`Validated ${numSubmitted} rows.`);
}

function convertSelectedRowToJson() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();
  var currentRow = sheet.getActiveCell().getRow();
  if (currentRow <= HEADER_ROW) {
    alertBox("Select a non-header data cell.");
    return;
  }

  var json = convertRowToJson(
    sheet, currentRow, getProfileName(), getEndpointRead(), keepCommentedProps=false
  );
  var jsonText = JSON.stringify(json, null, EXPORTED_JSON_INDENT);

  var htmlOutput = HtmlService
      .createHtmlOutput(`<pre>${jsonText}</pre>`)
      .setWidth(500)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, `Row: ${currentRow}`);
}

function putAll() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();

  var numData = getNumMetadataInSheet(sheet, ignoreHiddenRows=true);
  if (numData === 0) {
    alertBox(`Found no data to submit to the portal.`);
    return;
  }  
  if (!alertBoxOkCancel(
    `Found ${numData} data row(s).\n\n` + 
    "PUT action will REPLACE metadata on the portal with those on the sheet. " +
    "Therefore, any properties missing on the sheet will also be REMOVED from portal's metadata." +
    "If you are not an admin and just want to patch non-empty values of properties on the sheet, use PATCH instead.\n\n" +
    `Are you sure to PUT to ${getEndpointWrite()}?`)) {
    return;
  }

  var numSubmitted = submitSheetToPortal(
    sheet, getProfileName(), getEndpointWrite(), getEndpointRead(), method="PUT"
  );
  alertBox(`Submitted (PUT) ${numSubmitted} rows to ${getEndpointWrite()}.`);
}

function patchSelected() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();

  var selectedCols = getSelectedColumns(sheet, keepCommentedProps=false);
  if (selectedCols.length === 0) {
    alertBox('Found no selected column(s) with valid header.');
    return;
  }

  var numData = getNumMetadataInSheet(sheet, ignoreHiddenRows=true);
  if (numData === 0) {
    alertBox(`Found no data to submit to the portal.`);
    return;
  }  
  if (!alertBoxOkCancel(
    `Found ${numData} data row(s).\n\n` +
    "PATCH action will REPLACE properties on the portal with data on selected columns only.\n\n" +
    `Selected properties: ${selectedCols.map(x => x.headerProp).join(",")}` + "\n\n" +
    `Are you sure to PATCH to ${getEndpointWrite()}?`)) {
    return;
  }

  var numSubmitted = submitSheetToPortal(
    sheet, getProfileName(), getEndpointWrite(), getEndpointRead(), method="PATCH",
    selectedColsForPatch=selectedCols,
  );
  alertBox(`PATCHed ${numSubmitted} rows to ${getEndpointWrite()}.`);

  applyProfileToSheet();
}

function patchAll() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();

  var numData = getNumMetadataInSheet(sheet, ignoreHiddenRows=true);
  if (numData === 0) {
    alertBox(`Found no data to submit to the portal.`);
    return;
  }
  if (!alertBoxOkCancel(
    `Found ${numData} data row(s).\n\n` + 
    "PATCH action will REPLACE properties on the portal with data on the sheet.\n\n" +
    `Are you sure to PATCH to ${getEndpointWrite()}?`)) {
    return;
  } 

  var numSubmitted = submitSheetToPortal(
    sheet, getProfileName(), getEndpointWrite(), getEndpointRead(), method="PATCH"
  );
  alertBox(`Submitted (PATCH) ${numSubmitted} rows to ${getEndpointWrite()}.`);
}

function postAll() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();

  var numData = getNumMetadataInSheet(sheet, ignoreHiddenRows=true);
  if (numData === 0) {
    alertBox(`Found no data to submit to the portal.`);
    return;
  }  
  if (!alertBoxOkCancel(
    `Found ${numData} data row(s).\n\n` +
    "POST action will submit new objects (rows on the sheet) to the portal.\n\n" +
    "And then it will UPDATE rows with new identifying properties (e.g. accession, uuid) assigned from the portal. " +
    "No other properties/values will be updated on the sheet even though some new properties with " +
    "default values are assigned to them on the portal.\n\n" +
    `You can add ${HEADER_COMMENTED_PROP_SKIP} column and set it to 1 for a row that you want to skip REST actions.\n\n` +
    `Are you sure to POST to ${getEndpointWrite()}?`)) {
    return;
  }

  var numSubmitted = submitSheetToPortal(
    sheet, getProfileName(), getEndpointWrite(), getEndpointRead(), method="POST"
  );
  alertBox(`Submitted (POST) ${numSubmitted} rows to ${getEndpointWrite()}.`);

  applyProfileToSheet();
}

function exportToJson() {
  if (!checkProfile()) {
    return;
  }

  var sheet = getCurrentSheet();
  var jsonFilePath = Browser.inputBox(
    "Enter JSON file path (e.g. metadata-submitter-09-09-1999.json):"
  );

  exportSheetToJsonFile(
    sheet, getProfileName(), getEndpointRead(),
    keepCommentedProps=false,
    jsonFilePath=jsonFilePath,
  );
}

function authorize(server) {
  if (getUsername(server) && getPassword(server)) {
    if (!alertBoxOkCancel(
      `Username and password already exist for ${server}, are you sure to proceed?`)) {
      return;
    }
  }

  var username = Browser.inputBox(`Enter your username for ${server}:`);
  if (!username || username === "cancel") {
    alertBox("Failed to update username.");
    return;
  }
  setUsername(username, server);

  var password = Browser.inputBox(`Enter your password for ${server}:`);
  if (!password || password === "cancel") {
    alertBox("Failed to update password.");
    return;
  }
  setPassword(password, server);
}

function authorizeForEncode() {
  return authorize(ENCODE);
}

function authorizeForIgvf() {
  return authorize(IGVF);
}

function setEndpointRead() {
  var endpoint = Browser.inputBox(
    `* Current endpoint for READs (GET):\\n${getEndpointRead()}\\n\\n` +
    "* Supported ENCODE endpoints:\\n" +
    `${ENCODE_ENDPOINTS.join("\\n")}\\n\\n` +
    "* Supported IGVF endpoints:\\n" +
    `${getIgvfEndpointsAvailableForUsers().join("\\n")}\\n\\n` +
    "Enter a new endpoint:"
  );
  if (endpoint) {
    endpoint = trimTrailingSlash(endpoint);
  }
  if (!isValidEndpoint(endpoint)) {
    if (endpoint !== "cancel") {
      alertBox("Wrong endpoint: " + endpoint);
    }
    return;
  }
  setCurrentSheetDevMetadata(KEY_ENDPOINT_READ, endpoint);
}

function setEndpointWrite() {
  var endpoint = Browser.inputBox(
    `* Current endpoint for Write actions (PUT/POST):\\n${getEndpointWrite()}\\n\\n` +
    "* Supported ENCODE endpoints:\\n" +
    `${ENCODE_ENDPOINTS.join("\\n")}\\n\\n` +
    "* Supported IGVF endpoints:\\n" +
    `${getIgvfEndpointsAvailableForUsers().join("\\n")}\\n\\n` +
    'Enter a new endpoint:'
  );
  if (endpoint) {
    endpoint = trimTrailingSlash(endpoint);
  }
  if (!isValidEndpoint(endpoint)) {
    if (endpoint !== "cancel") {
      alertBox("Wrong endpoint: " + endpoint);
    }
    return;
  }
  setCurrentSheetDevMetadata(KEY_ENDPOINT_WRITE, endpoint);
}

function setProfileName() {    
  var profileName = Browser.inputBox(
    `* Current profile name:\\n${getProfileName()}\\n\\n` +
    "Snakecase (with _) or capitalized CamelCase are allowed for a profile name.\\n" +
    "No plural (s) is allowed in profile name.\\n" +
    "(e.g. Experiment, BiosampleType, biosample_type, lab):\\n\\n" +
    "Enter a new profile name:"
  );
  if (!isValidProfileName(profileName, getEndpointRead())) {
    if (profileName !== "cancel") {
      alertBox("Wrong profile name: " + profileName);
    }
    return;
  }
  setCurrentSheetDevMetadata(KEY_PROFILE_NAME, profileName);
}

function getDefaultProfileName() {
  return getSpreadsheetDevMetadata(KEY_PROFILE_NAME);
}

function setDefaultProfileName() {    
  var profileName = Browser.inputBox(
    `* Current default profile name:\\n${getDefaultProfileName()}\\n\\n` +
    "Snakecase (with _) or capitalized CamelCase are allowed for a profile name.\\n" +
    "No plural (s) is allowed in profile name.\\n" +
    "(e.g. Experiment, BiosampleType, biosample_type, lab):\\n\\n" +
    "Enter a new profile name:"
  );
  if (!isValidProfileName(profileName, getEndpointRead())) {
    if (profileName !== "cancel") {
      alertBox("Wrong profile name: " + profileName);
    }
    return;
  }
  setSpreadsheetDevMetadata(KEY_PROFILE_NAME, profileName);
}

function getDefaultEndpointRead() {
  var defaultEndpointRead = getSpreadsheetDevMetadata(KEY_ENDPOINT_READ);
  return defaultEndpointRead ? defaultEndpointRead : DEFAULT_ENDPOINT_READ
}

function getDefaultEndpointWrite() {
  var defaultEndpointWrite = getSpreadsheetDevMetadata(KEY_ENDPOINT_WRITE);
  return defaultEndpointWrite ? defaultEndpointWrite : DEFAULT_ENDPOINT_WRITE
}

function getEndpointRead() {
  var endpoint = getCurrentSheetDevMetadata(KEY_ENDPOINT_READ);
  return endpoint ? endpoint : getDefaultEndpointRead();
}

function getEndpointWrite() {
  var endpoint = getCurrentSheetDevMetadata(KEY_ENDPOINT_WRITE);
  return endpoint ? endpoint : getDefaultEndpointWrite();
}

function getProfileName() {
  var profileName = getCurrentSheetDevMetadata(KEY_PROFILE_NAME);
  return profileName ? profileName : getDefaultProfileName();
}

// developer only (debugging purpose)

function authorizeForAws() {
  if (getAwsAccessKey() && getAwsSecretAccessKey()) {
    if (!alertBoxOkCancel(
      `(Developer only) AWS access key and secret access key pair already exists, are you sure to proceed?`)) {
      return;
    }
  }

  var awsAccessKey = Browser.inputBox(`Enter your AWS access key:`);
  if (!awsAccessKey || awsAccessKey === "cancel") {
    alertBox("Failed to update AWS access key.");
    return;
  }
  setAwsAccessKey(awsAccessKey);

  var awsSecretAccessKey = Browser.inputBox(`Enter your AWS secret access key:`);
  if (!awsSecretAccessKey || awsSecretAccessKey === "cancel") {
    alertBox("Failed to update AWS secret access key.");
    return;
  }
  setAwsSecretAccessKey(awsSecretAccessKey);
}

function showSheetAllDevMetadata() {
  var sheet = getCurrentSheet();
  var allMetadata = getSheetAllDevMetadata(sheet);
  alertBox(JSON.stringify(allMetadata, null, 4));
}

function showSpreadsheetAllDevMetadata() {
  var allMetadata = getSpreadsheetAllDevMetadata();
  alertBox(JSON.stringify(allMetadata, null, 4));
}
