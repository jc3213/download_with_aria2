# Download with Aria2

## Install
| <a href="https://microsoftedge.microsoft.com/addons/detail/cgoonbdaiddmlpnneceehfamhjmkbmec"><img src="https://github.com/user-attachments/assets/755ede26-33d5-41eb-9000-9ba903886041" title="Microsoft Edge" width="64" height="64"></a> | <a href="https://addons.mozilla.org/firefox/addon/download-with-aria2/"><img src="https://github.com/user-attachments/assets/e2bb973f-5106-4eae-8d1d-4a3dd25b01e5" title="Mozilla Firefox" width="64" height="64"></a> | TBA |
| - | - | - |

## About
- The browser extension for [aria2 - ultra fast download utility](//github.com/aria2/aria2) over JSON-RPC
    - The development is based on [aria2.js](//github.com/jc3213/aria2.js)
    - Read [Wiki: Installation](//github.com/jc3213/download_with_aria2/wiki#first-of-all) for usage
    - Send feedback at [issues page](//github.com/jc3213/download_with_aria2/issues/new/)
- Built-in Task Manager
    - Try the manager [HERE](//jc3213.github.io/aria2.js/app)
    - Get the [Source code](//github.com/jc3213/aria2.js/tree/main/app)
- Context menus
    - Download this link
    - Download this image
    - Download all images on this page
- Capture browser downloads
    - Using [downloads](//developer.chrome.com/docs/extensions/reference/downloads) API
        - *Chromium Limited*
    - Using [webRequest](//developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest) API
        - *Firefox only*
    - Exclude rules for *file size*
    - Exclude rules for hostname and filename based on [Wiki:Match Patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern)
- Forward browser `Request Headers` to bypass CORS checks
    - Better compatibility with `Capturing Browser Downloads`
    - Can override `User-Agent` as you like
    - Exclude rules for hostname based on [Wiki:Match Patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern)
- Proxy server
    - Include rules for hostname based on [Wiki:Match Patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern)
- Communicate seamlessly with this extension using messaging.
    - Try the demo [HERE](//jc3213.github.io/webware/html/test.html)
    - Read [Wiki: Message](//github.com/jc3213/download_with_aria2/wiki/Message) for detailed documentation
- Change the options of JSON-RPC and Tasks
- Backup/Restore options of this extension and JSON-RPC
- Notifications
    - When download started, or completed
    - When extension installed, and updated

## Screenshot

### Options: Extension
![Options - Extension](https://github.com/user-attachments/assets/73253db0-6685-4ace-8a48-5fa37faf3084)

### Options: JSON-RPC
![Options - JSON-RPC](https://github.com/user-attachments/assets/b0253dd0-3b62-443d-8002-0d3f158505cb)

### Task Manager
![Task Manager - Popup](https://github.com/user-attachments/assets/fb096db0-d421-4b84-a8ee-9719e703e45c)
![Task Manager - Open In Tab](https://github.com/user-attachments/assets/ba29a63c-15fe-4ded-951d-8bb19bb13614)

### New Download
![New Download](https://github.com/user-attachments/assets/4557eef8-4ab1-4486-8df4-f648116bceb5)

### Detected Images
![Detected Images](https://github.com/user-attachments/assets/dd23c26b-da04-4ba5-9739-f6652def0731)
