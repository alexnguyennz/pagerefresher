// *************** // 
// *** IMPORTS *** //
// *************** //
import {$, getTimeFormat} from "./global.js";


// ********************** // 
// *** INITIALIZATION *** //
// ********************** //
document.addEventListener('DOMContentLoaded', () => {

  loadRows();
  updateOptionStates();

  $("display-all-tabs").addEventListener("click", () => loadRows());

  // EVENT LISTENERS
  $("save-options").addEventListener("click", saveOptions);
  $("reset-options").addEventListener("click", resetOptions);

  document.getElementsByName("interval").forEach(item => item.addEventListener("click", event => event.target.select())); // auto select values in interval fields
});

// *** Load tab information into individual rows with options (as buttons). *** //
function loadRows() {

  const table = $("reload-table").getElementsByTagName("tbody")[0];
  const displayAllTabs = $("display-all-tabs");

  chrome.runtime.sendMessage({greeting: "getTabIDList"}, response => {
    table.innerHTML = ""; // reset all table information that has been loaded in previously

    const tabIDList = response.tabIDList;

    if (displayAllTabs.checked === false) {

      if (reloadsExist(tabIDList) === true) {

        for (const tabID in tabIDList) {
          if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) { // only display tab info if it has a reload
            const row = table.insertRow();

            let formattedTitle = tabIDList[tabID]["tabTitle"];
            let formattedURL = tabIDList[tabID]["tabURL"];

            if (tabIDList[tabID]["tabTitle"].length >= 75) formattedTitle = tabIDList[tabID]["tabTitle"].substr(0, 75) + "...";  // add ... to the end of a long URL
            if (tabIDList[tabID]["tabURL"].length >= 75) formattedURL = tabIDList[tabID]["tabURL"].substr(0, 75) + "...";  // add ... to the end of a long URL

            // insert each desired property into an individual cell; use createTextNode to escape HTML characters e.g. for elements so that they don't display
            row.insertCell(-1).appendChild(document.createTextNode(formattedTitle));
            row.insertCell(-1).appendChild(document.createTextNode(formattedURL));
            row.insertCell(-1).appendChild(document.createTextNode(getTimeFormat(tabIDList[tabID]["reloadInfo"]["interval"])));

            (tabIDList[tabID]["blockReload"] ? row.insertCell(-1).innerHTML = '&#10004;' : row.insertCell(-1).innerHTML = '&#x2718;');
            (tabIDList[tabID]["bypassCache"] ? row.insertCell(-1).innerHTML = '&#10004;' : row.insertCell(-1).innerHTML = '&#x2718;');

            row.insertCell(-1).innerHTML = '<button value="' + tabID + '" name="go-button" class="go-button" title="Go to tab"></button>' +
              '<button value="' + tabID + '" name="quit-button" class="quit-button" title="Close reload">&#10060;</button>';

            createTabOptions();
          }
        }
      } else {
        table.innerHTML = `<tr><td colspan="6">No reloads. Start one!</td></tr>`;
      }
    } else if (displayAllTabs.checked === true) {
      for (const tabID in tabIDList) {
        const row = table.insertRow();

        let formattedTitle = tabIDList[tabID]["tabTitle"];
        let formattedURL = tabIDList[tabID]["tabURL"];

        if (tabIDList[tabID]["tabTitle"].length >= 75) formattedTitle = tabIDList[tabID]["tabTitle"].substr(0, 75) + "...";  // add ... to the end of a long URL
        if (tabIDList[tabID]["tabURL"].length >= 75) formattedURL = tabIDList[tabID]["tabURL"].substr(0, 75) + "...";  // add ... to the end of a long URL

        // insert each desired property into an individual cell; use createTextNode to escape HTML characters e.g. for elements so that they don't display
        row.insertCell(-1).appendChild(document.createTextNode(formattedTitle));
        row.insertCell(-1).appendChild(document.createTextNode(formattedURL));

        if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) {
          row.insertCell(-1).appendChild(document.createTextNode(getTimeFormat(tabIDList[tabID]["reloadInfo"]["interval"])));
        } else {
          row.insertCell(-1).appendChild(document.createTextNode("-"));
        }

        (tabIDList[tabID]["blockReload"] ? row.insertCell(-1).innerHTML = '&#10004;' : row.insertCell(-1).innerHTML = '&#x2718;');
        (tabIDList[tabID]["bypassCache"] ? row.insertCell(-1).innerHTML = '&#10004;' : row.insertCell(-1).innerHTML = '&#x2718;');

        if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) {
          row.insertCell(-1).innerHTML = '<button value="' + tabID + '" name="go-button" class="go-button" title="Go to tab"></button>' +
            '<button value="' + tabID + '" name="quit-button" class="quit-button" title="Close reload">&#10060;</button>';
        } else {
          row.insertCell(-1).innerHTML = '<button value="' + tabID + '" name="go-button" class="go-button" title="Go to tab"></button>';
        }

        createTabOptions();
      }
    }
  });
}


// *** Return true or false based on whether at least a single reload exists in the tabIDList. *** //
function reloadsExist(tabIDList) {

  for (const tabID in tabIDList) if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) return true;

  return false; // return false after the loop ends if return true hasn't occurred
}


// *** Create event listeners for the tab row buttons, and blockReload/bypassCache checkboxes. *** //
function createTabOptions() {

  // ELEMENT REFERENCES
  const goButton = document.getElementsByName("go-button");
  const quitButton = document.getElementsByName("quit-button");

  // for each 'Go' button on click, make the corresponding tab the active tab
  goButton.forEach(item => {
    item.addEventListener("click", event => {
      const tabID = parseInt(event.target.value);
      chrome.tabs.update(tabID, {active: true});
    });
  });

  // for each 'Quit' button on click, remove the table row and delete the corresponding reload
  quitButton.forEach(item => {
    item.addEventListener("click", event => {
      event.target.closest("tr").remove(); // delete the parent table row to get rid of the reload entry

      const tabID = parseInt(event.target.value);
      chrome.runtime.sendMessage({greeting: "deleteReload", tabID: tabID});
    });
  });
}


// *** Update the inputs based on storage settings. *** //
function updateOptionStates() {

  const inputs = document.getElementsByTagName("input");

  chrome.storage.sync.get(["enableContext"], items => (items.enableContext ? inputs["context-enabled"].checked = true : inputs["context-disabled"].checked = true));

  chrome.storage.sync.get(["intervalOne", "intervalTwo", "intervalThree", "intervalFour", "intervalFive"], items => {

    // loop through each interval in items, modify values based on interval value (e.g. 30 seconds)
    for (const interval in items) {
      if (items[interval] > 60) {
        inputs[interval + "-minutes"].value = parseInt(items[interval] / 60);
        inputs[interval + "-seconds"].value = items[interval] % 60;
      } else {
        inputs[interval + "-minutes"].value = 0;
        inputs[interval + "-seconds"].value = items[interval];
      }
    }
  });
}


// *** Save options. *** //
function saveOptions() {

  const inputs = document.getElementsByTagName("input");

  if (inputs["context-enabled"].checked === true) {
    chrome.runtime.sendMessage({greeting: "enableContext"});
    chrome.storage.sync.set({enableContext: true});
  } else if (inputs["context-disabled"].checked === true) {
    chrome.runtime.sendMessage({greeting: "disableContext"});
    chrome.storage.sync.set({enableContext: false});
  }

  const intervals = ["intervalOne", "intervalTwo", "intervalThree", "intervalFour", "intervalFive"];

  // get interval field values and sync them
  intervals.forEach(interval => {
    const number = (+inputs[interval + "-minutes"].value * 60) + (+inputs[interval + "-seconds"].value);
    chrome.storage.sync.set({[interval]: number});
  });

  updateOptionStates(); // update inputs to reflect newly saved settings

  setSuccessMessage("Settings saved.");
}


// *** Print success message after options have been saved or reset. *** //
function setSuccessMessage(messageText) {
  const message = $("message");
  message.innerHTML = messageText;

  const saveOptions = $("save-options");
  const resetOptions = $("reset-options");

  // disable save and reset buttons temporarily while the success message shows
  saveOptions.disabled = true;
  resetOptions.disabled = true;

  setTimeout(() => {
    message.innerHTML = "";
    saveOptions.disabled = false;
    resetOptions.disabled = false;
  }, 2000);
}


// *** Reset options back to default. *** //
function resetOptions() {

  chrome.storage.sync.set({
    enableContext: false,
    intervalOne: 5,
    intervalTwo: 15,
    intervalThree: 30,
    intervalFour: 60,
    intervalFive: 120
  }, () => {
    chrome.runtime.sendMessage({greeting: "disableContext"}); // turn context menu back OFF by default
    updateOptionStates(); // update inputs to ensure changed settings are shown only after the settings have been saved
    setSuccessMessage("Settings reset.");
  });
}
