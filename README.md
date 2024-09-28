# Download with Aria2

## Install
| <a href="https://microsoftedge.microsoft.com/addons/detail/cgoonbdaiddmlpnneceehfamhjmkbmec"><img src="https://github.com/user-attachments/assets/755ede26-33d5-41eb-9000-9ba903886041" title="Microsoft Edge" width="64" height="64"></a> | <a href="https://addons.mozilla.org/firefox/addon/download-with-aria2/"><img src="https://github.com/user-attachments/assets/e2bb973f-5106-4eae-8d1d-4a3dd25b01e5" title="Mozilla Firefox" width="64" height="64"></a> | TBA |
| - | - | - |

## About
- The browser extension for [aria2 - ultra fast download utility](https://github.com/aria2/aria2) via JSON-RPC
    - The development is based on [aria2.js](https://github.com/jc3213/aria2.js) 
    - Read [Wiki](//github.com/jc3213/download_with_aria2/wiki) for usage
    - Send feedback at [issues page](//github.com/jc3213/download_with_aria2/issues/new/)
- Built-in Task Manager
    - Parted to [Github Repository](https://github.com/jc3213/aria2.js/tree/main/manager)
    - Try [Github Pages](https://jc3213.github.io/aria2.js/manager)
- Context menus
    - Download this link
    - Download this image
    - Download all images on this page
- Capture browser downloads
    - Capture downloads via [downloads](https://developer.chrome.com/docs/extensions/reference/downloads) API
    - Capture downloads via [webRequest](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest) API
        - *Firefox only*
    - Capture downloads via file size
    - Capture downloads via [hostname match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
    - Capture downloads via [file extension match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#file-extension)
- Simulating browser `Request Headers` to bypass CORS checks
    - Forwards `Cookies` only when capturing browser downloads
    - Exclude rules via [hostname match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Proxy server
    - Auto-proxy rules via [hostname match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Change options for JSON-RPC and Tasks
- Backup/Restore options for this extension and JSON-RPC
- Notification system
    - When download started, or completed
    - When extension installed, or updated

## Screenshot

### Options: Extension
![Options: Extension](https://github.com/jc3213/download_with_aria2/assets/8744936/0da3a3ef-3b43-4fbd-ad06-4daa57e3753f "Options: Extension")

### Options: JSON-RPC
![Options: JSON-RPC](https://github.com/jc3213/download_with_aria2/assets/8744936/3152302d-ef1f-410a-8ea1-534380c13e1b "Options: JSON-RPC")

### Task Manager
![Task Manager](https://github.com/jc3213/download_with_aria2/assets/8744936/2e007b6b-bce2-4da0-ba6d-6efa6df57746 "Task Manager")

### New Download
![New Download](https://github.com/jc3213/download_with_aria2/assets/8744936/965f1be8-99e6-4485-985a-96f47a13267b "New Download")

### Detected Images
![Detected Images](https://github.com/jc3213/download_with_aria2/assets/8744936/5626cb60-0dd8-42ff-88c4-0b9e16e80a1c "Detected Images")
