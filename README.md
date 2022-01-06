# About

- This extension is completely rewritten from [chrome-aria2-integration](https://github.com/robbielj/chrome-aria2-integration)
- Enhanced browser download monitoring, and built-in Aria2 Manager

# Usage
- Indicate running status over toolbar icon
    - Idle: Yellow `0`
    - Active: Blue `Number`
    - Error: Red `E`
- Built-in `Aria2 Web Manager`
    - Filtering tasks with queues `Active`, `Stopped`, and `Removed`
    - `New Task` page with extra options
        - Drop `.metalink`, or `.meta4`, or `.torrent` on `Download Urls` to download [**Chrome Only**]
    - `Task Manager` that can change options for downloads
        - Change selected files for bittorrent downloads
        - Add or remove download uris for http/ftp downloads
    - `Options` page for the extension
    - `Global Options` page for Aria2
- Capturing browser downloads
    - Save captured downloads to other directories [**Firefox Only**]
- Support proxy and auto-proxy

# Feedback

- [File an issue](https://github.com/jc3213/download_with_aria2-archived/issues/new/choose)

# Build

- Download latest stable [source code](https://github.com/jc3213/download_with_aria2/releases/latest)
- Extract source code

#### Windows
- Download 7-zip standalone console `v21.06` [Windows](https://www.7-zip.org/a/7z2106-extra.7z)
- Put `7za.exe` and `7za.dll` into the same folder with `Windows Auto Build.cmd`
- Run `Windows Auto Build.cmd` and follow the instructions

#### Linux (Not Completed)
- Download 7-zip standalone console `v21.06` [Linux 64bit](https://www.7-zip.org/a/7z2106-linux-x64.tar.xz) | [Linux 32bit](https://www.7-zip.org/a/7z2106-linux-x86.tar.xz) | [Linux ARM](https://www.7-zip.org/a/7z2106-linux-arm64.tar.xz)
- Put `7zz` into the same folder with `Linux Auto Build.sh`
- Need help to complete shell script

# Others

- The extension is not published on `Google Web Store`, or `Microsoft Store`.
    - `Firefox Add-on` hosted by [@ivysrono](https://addons.mozilla.org/firefox/addon/download-with-aria2/)
- Built-in `Aria2 Web Manager` is not powerfule enough
    - [`Aria2 WebUI`](https://ziahamza.github.io/webui-aria2/)
    - [`Yet Another Aria2 Web Frontend`](http://binux.github.io/yaaw/demo/)
