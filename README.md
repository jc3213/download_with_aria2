## About
- This is a browser extension for [aria2 - ultra fast download utility](https://github.com/aria2/aria2) via JSON-RPC
    - It supports [Google Chrome](https://www.google.com/chrome/), [Microsoft Edge](https://www.microsoft.com/edge), [Mozilla Firefox](https://www.mozilla.org/firefox/), and so like browsers
- Built-in Task Manager
    - [Github Repository](https://github.com/jc3213/aria2.app) | [Github Pages](https://jc3213.github.io/aria2.app/)
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
    - Only Forward `Cookies` when capture browser downloads
    - Exclude rules via [hostname match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Support proxy server
    - Auto-Proxy rules via [hostname match patterns](https://github.com/jc3213/download_with_aria2/wiki/MatchPattern#hostname)
- Change options for JSON-RPC and Tasks
- Backup/Restore options for this extension and JSON-RPC
- Prompt new download window when enabled before download starts
- Notification when downloads start, or complete

## Install the extension
- Google Web Store
    - None
- Microsoft Edge Addons
    - [https://microsoftedge.microsoft.com/addons/detail/cgoonbdaiddmlpnneceehfamhjmkbmec](https://microsoftedge.microsoft.com/addons/detail/cgoonbdaiddmlpnneceehfamhjmkbmec)
- Firefox Browser Add-ons
    - ~~[https://addons.mozilla.org/firefox/addon/downwitharia2/](https://addons.mozilla.org/firefox/addon/downwitharia2/)~~ **Obseleted**
    - [https://addons.mozilla.org/firefox/addon/download-with-aria2/](https://addons.mozilla.org/firefox/addon/download-with-aria2/) Provider: [@ivysrono](https://github.com/ivysrono)

## User Manual
- [How to use](//github.com/jc3213/download_with_aria2/wiki)
- [How to build](//github.com/jc3213/download_with_aria2/wiki/HowToBuild)
- [Feed back](//github.com/jc3213/download_with_aria2/issues/new/)

## Screenshot
- Options Manifest V3
![Options](https://github.com/jc3213/download_with_aria2/assets/8744936/0da3a3ef-3b43-4fbd-ad06-4daa57e3753f)
- Options JSON-RPC
![Options (JSON-RPC)](https://github.com/jc3213/download_with_aria2/assets/8744936/3152302d-ef1f-410a-8ea1-534380c13e1b)
- Task Manager
![Task Manager](https://github.com/jc3213/download_with_aria2/assets/8744936/2e007b6b-bce2-4da0-ba6d-6efa6df57746)
- New Download
![New Download](https://github.com/jc3213/download_with_aria2/assets/8744936/965f1be8-99e6-4485-985a-96f47a13267b)
- Detected Images
![Detected Images](https://github.com/jc3213/download_with_aria2/assets/8744936/5626cb60-0dd8-42ff-88c4-0b9e16e80a1c)
