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
    - Try the manager [HERE](//jc3213.github.io/aria2.js/manager)
    - Get the [Source code](//github.com/jc3213/aria2.js/tree/main/manager)
- Context menus
    - Download this link
    - Download this image
    - Download all images on this page
- Capture browser downloads
    - Using [downloads](//developer.chrome.com/docs/extensions/reference/downloads) API
        - *Chromium Limited*
    - Using [webRequest](//developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/webRequest) API
        - *Firefox only*
    - Exclude rules based on on *file size*
    - Exclude rules based on [hostname match patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
    - Exclude rules based on [file extension match patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern#file-extension)
- Forward browser `Request Headers` to bypass CORS checks
    - Better compatibility with `Capturing Browser Downloads`
    - Can override `User-Agent` as you like
    - Exclude rules based on [hostname match patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Proxy server
    - Include rules based on [hostname match patterns](//github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Communicate seamlessly with this extension using messaging.
    - Try the demo [HERE](//jc3213.github.io/download_with_aria2/test.html)
    - Read [Wiki: Message](//github.com/jc3213/download_with_aria2/wiki/Message) for detailed documentation
- Change the options of JSON-RPC and Tasks
- Backup/Restore options of this extension and JSON-RPC
- Notifications
    - When download started, or completed
    - When extension installed, and updated

## Screenshot

### Options: Extension
![Options - Extension](https://github.com/user-attachments/assets/bd5e3f33-9771-4b7c-86e2-fb73609b9e47)

### Options: JSON-RPC
![Options - JSON-RPC](https://github.com/user-attachments/assets/6fff2d40-c296-423d-beda-1592cd6a4572)

### Task Manager
![Task Manager - Popup](https://github.com/user-attachments/assets/991c3b4c-1fd1-492d-8f55-7196ab5c1f0a)
![Task Manager - Open In Tab](https://github.com/user-attachments/assets/0b21aa61-fe61-4638-9143-600bc0d1d67f)

### New Download
![New Download - URLs](https://github.com/user-attachments/assets/f6487cd0-a9bc-4536-a5f3-cadd4d6a017f)
![New Download - Files](https://github.com/user-attachments/assets/4a2eac68-67f9-4942-a44b-705a7e9bea78)

### Detected Images
![Detected Images](https://github.com/user-attachments/assets/6ee6ffcc-dcd8-465c-9ab1-e3ad3db63bca)
