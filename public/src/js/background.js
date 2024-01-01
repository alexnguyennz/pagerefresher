// *************** // 
// *** IMPORTS *** //
// *************** //
import {getTimeFormat} from "./global.js";


// ********************** // 
// *** INITIALIZATION *** //
// ********************** //

// *** Set default storage options if none are saved already. *** //
chrome.storage.sync.get({
  enableContext: false,
  intervalOne: 5,
  intervalTwo: 15,
  intervalThree: 30,
  intervalFour: 60,
  intervalFive: 120
}, items => {

  chrome.storage.sync.set(items);
  if (items.enableContext === true) addContextMenu(); // set context menu to open initially on extension reload
});


let tabIDList = {}; // *** Store all running reloads in an object using each tab's ID along with their properties. *** //

getInitialTabState();


// ************************* // 
// *** CHROME TAB EVENTS *** //
// ************************* //

// *** For newly created tabs, create a new tab object for it in the tabIDList. *** //
chrome.tabs.onCreated.addListener(tab => createTabObject(tab));


// *** When the active tab is changed, change the context enable checkbox to true or false depending on whether a reload exists for that tab. *** //
chrome.tabs.onActivated.addListener(tab => {
  updateContextState(tab.tabId);
});


// *** Listen for any tabs that are reloaded and set badge text and colour after a tab reload/change since badge changes reset after a tab change. *** //
chrome.tabs.onUpdated.addListener((tabID, changeInfo) => {

  setBadge(tabID);

  if (tabIDList[tabID]["blockReload"] === true) blockReload(tabID, true); // continue to inject the window.stop code upon a reload if the state remains true

  if (changeInfo.title) tabIDList[tabID]["tabTitle"] = changeInfo.title; // if title and/or URL has changed, update the tabIDList entry
  if (changeInfo.url) tabIDList[tabID]["tabURL"] = changeInfo.url;
});


// *** Listen for any tabs that are closed and if a reload exists for it, delete it. *** //
chrome.tabs.onRemoved.addListener(tabID => {

  if (tabIDList[tabID].hasOwnProperty("reloadInfo")) {
    clearInterval(tabIDList[tabID]["reloadInfo"]["intervalID"]);
    clearInterval(tabIDList[tabID]["reloadInfo"]["timeLeftID"]);
  }

  delete tabIDList[tabID];
});


// *** Set up context menu's onClicked event listeners. *** //
chrome.runtime.onInstalled.addListener(() => {

  chrome.storage.sync.get(["intervalOne", "intervalTwo", "intervalThree", "intervalFour", "intervalFive"], items => {

    contextInterval = items.intervalOne; // initially set interval to intervalOne by default - one radio must be checked

    chrome.contextMenus.onClicked.addListener((info, tab) => {

      // set default state whenever any context item is clicked; delete the current tab's reload and set enableReload checkbox to false
      chrome.contextMenus.update("enableReload", {checked: false});
      deleteReload(tab.id);

      switch (info.menuItemId) {
        case "intervalOne":
          contextInterval = items.intervalOne;
          break;
        case "intervalTwo":
          contextInterval = items.intervalTwo;
          break;
        case "intervalThree":
          contextInterval = items.intervalThree;
          break;
        case "intervalFour":
          contextInterval = items.intervalFour;
          break;
        case "intervalFive":
          contextInterval = items.intervalFive;
          break;
        case "enableReload":
          (info.checked ? createReload(contextInterval) : deleteReload(tab.id));
          break;

      }
    });
  });
});


// *********************** // 
// *** CHROME MESSAGES *** //
// *********************** //

// *** Listen for any messages from other pages. *** //
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {

  switch (request.greeting) {
    case "createReload":
      createReload(request.interval);
      sendResponse({message: "reload created"});
      break;
    case "deleteReload":
      deleteReload(request.tabID);
      sendResponse({message: "reload deleted"});
      break;
    case "getTabIDList":
      chrome.tabs.query({
        active: true,
        currentWindow: true,
        windowType: "normal"
      }, tab => sendResponse({tabIDList: tabIDList, tabID: tab[0].id, tabURL: tab[0].url}));
      break;
    case "blockReload":
      chrome.tabs.query({
        active: true,
        currentWindow: true,
        windowType: "normal"
      }, tab => {
        blockReload(tab[0].id, request.state);
        sendResponse({message: "block reload"});
      });
      break;
    case "bypassCache":
      bypassCache(request.state);
      sendResponse({message: "cache bypassed"});
      break;
    case "enableContext":
      addContextMenu();
      sendResponse({message: "context enabled"});
      break;
    case "disableContext":
      chrome.contextMenus.removeAll();
      contextMenuLoaded = false;
      sendResponse({message: "context disabled"});
      break;
  }

  return true;
});


// ***************** // 
// *** FUNCTIONS *** //
// ***************** //

let contextMenuLoaded = false; // track context menu state (on or off); set to false by default
let contextInterval; // track state of context interval value

// *** Remove any existing context menu and create context menu. *** //
function addContextMenu() {

  chrome.contextMenus.removeAll(() => {
    chrome.storage.sync.get(["intervalOne", "intervalTwo", "intervalThree", "intervalFour", "intervalFive"], items => {

      contextInterval = items.intervalOne;

      const definedIntervals = {
        intervalOne: items.intervalOne,
        intervalTwo: items.intervalTwo,
        intervalThree: items.intervalThree,
        intervalFour: items.intervalFour,
        intervalFive: items.intervalFive
      };

      chrome.contextMenus.create({"contexts": ["page"], "id": "contextParent", "title": "Page Refresher"});
      chrome.contextMenus.create({
        "type": "checkbox",
        "parentId": "contextParent",
        "id": "enableReload",
        "title": "Enable"
      });

      contextMenuLoaded = true;

      for (const [key, value] of Object.entries(definedIntervals)) {
        chrome.contextMenus.create({
          "type": "radio",
          "parentId": "contextParent",
          "id": key,
          "title": getTimeFormat(value)
        });
      }

      chrome.tabs.query({
        active: true,
        currentWindow: true,
        windowType: "normal"
      }, tab => updateContextState(tab[0].id));
    });
  });
}


// *** Updates the checked status of the enableReload context menu based on the reload state for that tab. *** //
function updateContextState(tabID) {

  if (contextMenuLoaded === true) {
    (tabIDList[tabID].hasOwnProperty("reloadInfo") ? chrome.contextMenus.update("enableReload", {"checked": true}) : chrome.contextMenus.update("enableReload", {"checked": false}));
  }
}


// *** Create Reload. *** //
function createReload(interval) {

  chrome.tabs.query({active: true, currentWindow: true, windowType: "normal"}, tab => {
    const tabID = tab[0].id; // store tabID

    if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) { // reset any reloads; only allow one reload on a tab at one time in case a bug/error runs multiple reloads
      clearInterval(tabIDList[tabID]["reloadInfo"]["intervalID"]);
      clearInterval(tabIDList[tabID]["reloadInfo"]["timeLeftID"]);
      delete tabIDList[tabID]["reloadInfo"];
    }

    tabIDList[tabID]["reloadInfo"] = {};

    tabIDList[tabID]["reloadInfo"]["interval"] = interval;
    tabIDList[tabID]["reloadInfo"]["timeLeft"] = interval;

    setBadge(tabID); // set badge to display time left

    const intervalID = setInterval(() => reloadTab(tabID), interval * 1000); // run a reload using the current active tab ID, store intervalID

    const timeLeftID = setInterval(() => {
      tabIDList[tabID]["reloadInfo"]["timeLeft"]--;

      if (tabIDList[tabID]["reloadInfo"]["timeLeft"] === 0) tabIDList[tabID]["reloadInfo"]["timeLeft"] = interval;

      setBadge(tabID); // update badge text with currenttime left
    }, 1000);

    tabIDList[tabID]["reloadInfo"]["intervalID"] = intervalID;
    tabIDList[tabID]["reloadInfo"]["timeLeftID"] = timeLeftID;

    updateContextState(tabID);
  });
}


// *** Reload tab functionality. *** //
function reloadTab(tabID) {

  (tabIDList[tabID]["bypassCache"] ? chrome.tabs.reload(tabID, {bypassCache: true}) : chrome.tabs.reload(tabID));
}


// *** Delete both reloads using clearInterval. *** //
function deleteReload(tabID) {

  if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) {
    clearInterval(tabIDList[tabID]["reloadInfo"]["intervalID"]);
    clearInterval(tabIDList[tabID]["reloadInfo"]["timeLeftID"]);

    chrome.action.setBadgeText({tabId: tabID, text: ""}); // reset badge text if reload is turned off

    delete tabIDList[tabID]["reloadInfo"];

    updateContextState(tabID);
  }
}


// *** Set time left in reload to badge text, badge colour, and extension title. *** //
function setBadge(tabID) {

  if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) {
    const formattedTimeLeft = getTimeFormat(tabIDList[tabID]["reloadInfo"]["timeLeft"]); // store formatted times (1:00) from tabIDList object

    chrome.action.setBadgeBackgroundColor({tabId: tabID, color: "#ff6c52"});
    chrome.action.setBadgeText({tabId: tabID, text: formattedTimeLeft});
  }

}


// *** Get initial tab state of all current tabs. *** //
function getInitialTabState() {

  chrome.tabs.query({}, tabs => tabs.forEach(tab => createTabObject(tab)));
}


// *** Create a new tab object inside the tabIDList. *** //
function createTabObject(tab) {

  const tabID = tab.id;

  tabIDList[tabID] = {};
  tabIDList[tabID]["tabTitle"] = tab.title;
  tabIDList[tabID]["tabURL"] = tab.url;
  tabIDList[tabID]["blockReload"] = false;
  tabIDList[tabID]["bypassCache"] = false;
}


// *** Block meta refreshes and automatic reloads. *** //
function blockReload(tabID, state) {

  function windowStop() {
    window.stop();
  }

  tabIDList[tabID]["blockReload"] = state;

  (tabIDList[tabID]["blockReload"] === true ? chrome.scripting.executeScript({
    target: {tabId: tabID},
    function: windowStop
  }) : chrome.tabs.reload(tabID));
}


// *** Bypass local cache. *** //
function bypassCache(state) {
  chrome.tabs.query({active: true, currentWindow: true, windowType: "normal"}, tab => {
    const tabID = tab[0].id;

    tabIDList[tabID]["bypassCache"] = state;
  });
}

