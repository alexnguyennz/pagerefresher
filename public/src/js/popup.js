// *************** // 
// *** IMPORTS *** //
// *************** //
import {$, getTimeFormat, urlCheck} from "./global.js";


// ********************** // 
// *** INITIALIZATION *** //
// ********************** //
document.addEventListener('DOMContentLoaded', () => {

  // ELEMENT REFERENCES
  const option = $("option");
  const blockReload = $("blockReload");
  const bypassCache = $("bypassCache");
  const customInterval = document.getElementsByName("customInterval");
  const definedIntervals = document.getElementsByName("definedInterval");
  const definedIntervalsObj = document.getElementsByClassName("definedInterval");

  // LOAD IN TAB ID RELOAD INFO AND CUSTOM INTERVALS
  chrome.runtime.sendMessage({greeting: "getTabIDList"}, response => {

    const tabID = response.tabID;
    const tabIDList = response.tabIDList;
    const tabURL = response.tabURL;

    if (tabIDList[tabID].hasOwnProperty("reloadInfo") === true) {
      formatIntervalInputs(tabIDList[tabID]["reloadInfo"]["interval"]);
      option.checked = true;
    } else {
      option.checked = false;
    }

    urlCheck(tabURL, "blockReload"); // check tab's URL, pass in blockReload checkbox and disable it if it is a chrome:// URL

    blockReload.checked = tabIDList[tabID]["blockReload"];
    bypassCache.checked = tabIDList[tabID]["bypassCache"];
  });

  chrome.storage.sync.get(["intervalOne", "intervalTwo", "intervalThree", "intervalFour", "intervalFive"], items => {
    formatIntervalInputs(items.intervalOne); // by default, set the custom interval to intervalOne

    // set each definedInterval value and label text to value
    for (const item in items) {
      definedIntervalsObj[item].value = items[item];
      document.querySelector("label[for=" + item + "]").innerHTML = getTimeFormat(items[item]);
    }
  });

  // EVENT LISTENERS
  option.addEventListener("click", toggleReload);
  blockReload.addEventListener("click", () => chrome.runtime.sendMessage({
    greeting: "blockReload",
    state: blockReload.checked
  }));
  bypassCache.addEventListener("click", () => chrome.runtime.sendMessage({
    greeting: "bypassCache",
    state: bypassCache.checked
  }));

  // for each custom interval's input, set the defined interval checked state to false if the value changes
  customInterval.forEach(item => {
    item.addEventListener("input", () => {
      definedIntervals.forEach(item => item.checked = false);
      resetReload();
    });

    item.addEventListener("click", event => event.target.select());
  });

  definedIntervals.forEach(item => {
    item.addEventListener("click", event => {
      formatIntervalInputs(event.target.value);
      resetReload();
    });
  });

  cssTransitionFix();

});


// *** Toggle reload based on check state of option. *** //
function toggleReload() {

  const minuteInterval = $("minuteInterval").value;
  const secondInterval = $("secondInterval").value;

  const interval = (+minuteInterval * 60) + (+secondInterval); // convert strings to numbers and convert to total seconds

  // send message from toggle as long as interval is above 0 (can't have 0 interval)
  if (interval > 0 && option.checked === true) {
    chrome.runtime.sendMessage({greeting: "createReload", interval: interval});
    formatIntervalInputs(interval);
  } else if (option.checked === false) {
    chrome.tabs.query({
      active: true,
      currentWindow: true,
      windowType: "normal"
    }, tab => chrome.runtime.sendMessage({greeting: "deleteReload", tabID: tab[0].id}));
  } else if (interval === 0) {
    option.checked = false;
  }
}


// *** Remove reload and set toggle to false/off when a defined interval radio is clicked. *** //
function resetReload() {

  chrome.tabs.query({active: true, currentWindow: true, windowType: "normal"}, tab => {
    chrome.runtime.sendMessage({greeting: "deleteReload", tabID: tab[0].id});
    option.checked = false;
  });
}


// *** Convert intervals into minutes and seconds and store the values into the input fields. *** //
function formatIntervalInputs(interval) {

  const minuteInterval = $("minuteInterval");
  const secondInterval = $("secondInterval");

  if (interval > 60) {
    minuteInterval.value = parseInt(interval / 60);
    secondInterval.value = interval % 60;
  } else {
    minuteInterval.value = 0;
    secondInterval.value = interval;
  }
}


// *** Add CSS transition to the toggle after the popup has loaded; otherwise the toggle will show the switch transitioning to on if there's a reload for it. *** //
function cssTransitionFix() {

  const style = document.createElement("style");
  style.innerHTML = '.knobs, .layer, #reload-toggle, #reload-toggle .knobs:before, #reload-toggle .knobs:after, #reload-toggle .knobs span {' + 'transition: 0.3s ease all' + "}";

  const ref = document.querySelector('script');
  setTimeout(() => {
    ref.parentNode.insertBefore(style, ref)
  }, 50);
}