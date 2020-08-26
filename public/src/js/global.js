// *** getElementById shorthand. *** //
export function $(id) {
    return document.getElementById(id);
}


// *** Convert total seconds into a 00:00 time format. *** //
export function getTimeFormat(totalSeconds) {

    const minutes = Math.trunc(totalSeconds / 60); // divide by 60 and remove all decimals
    let seconds = totalSeconds % 60; // use remainder as seconds

    if (seconds < 10) seconds = "0" + seconds; // if seconds is lower than 10, add 0 e.g. 05; otherwise leave as normal

    const formattedTime = minutes + ":" + seconds;

    return formattedTime;
}


// *** Check if the URL matches a forbidden one, and disable the relevant checkbox. *** //
export function urlCheck(tabURL, elementID) {

    const urlArray = ["chrome://", "chrome-extension://", "https://chrome.google.com/webstore", "edge://", "extension://"];
    const check = urlArray.some(el => tabURL.includes(el));

    (check ? $(elementID).disabled = true: $(elementID).disabled = false);
}