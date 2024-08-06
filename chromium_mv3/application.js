importScripts('libs/aria2.js', 'background.js');

chrome.runtime.onStartup.addListener(chrome.runtime.getPlatformInfo);

var aria2Persistent = setInterval(chrome.runtime.getPlatformInfo, 26000);
