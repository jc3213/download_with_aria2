# About

- This extension is completely rewritten from [chrome-aria2-integration](https://github.com/robbielj/chrome-aria2-integration)

# Usage
- Indicate running status over toolbar icon [**Not supported in Manifest V3**]
    - Idle: `Empty`
    - Active: Light Blue `Number`
    - Error: Red `E`
- Built-in `Aria2 Web Manager`
    - Filtering tasks with queues `Active`, `Stopped`, and `Removed`
    - `New Task` page with extra options
        - Support upload `.metalink`, `.meta4`, and `.torrent` files [**Chromium Only**]
    - `Task Manager` that can change options for downloads
        - Change selected files for bittorrent downloads
        - Add or remove download uris for http/ftp downloads
    - `Options` page for the extension
    - `Global Options` page for aria2 jsonrpc
- Capture browser downloads
    - Switchable APIs  [**Firefox Only**]
        - `downloads API` [**Default**]
        - `webRequest API`
    - Capture filter based on file size
    - Capture filter based on file extension [**Firefox only capture MIME type application via webRequest API**]
    - Capture filter based on domain names of referer
        - site `www.google.com`, filter `com`, `google.com`, `www.google.com`
        - site `www.university.org.eu`, filter `eu`, `org.eu`, `university.org.eu`, `www.university.org.eu`
- Support proxy setting and provide auto matching rule

# Feedback

- [File an issue](https://github.com/jc3213/download_with_aria2/issues/new/)

# Build

- Download latest stable [source code](https://github.com/jc3213/download_with_aria2/releases/latest)
- Extract source code

#### Windows
- Download 7-zip standalone console `v21.07` [Windows](https://www.7-zip.org/a/7z2107-extra.7z)
- Put `7za.exe` and `7za.dll` into the same folder with `win_build.cmd`
- Run `win_build.cmd` and follow the instructions

#### Linux
- Install `zip` from software sources or elsewhere.
- Run `linux_build.sh` and follow the instructions
- If the browser parameter `firefox` or `chromium` is specified, the extension can be compiled without interaction.
- When the browser parameter is specified, and then specify the `-i` parameter, the browser can directly install the compiled extension in an interactive manner.(Due to Chrome's security policy, this function is currently only implemented in Firefox, and only supports Firefox Browser Developer Edition)
- The extension will be generated in the `build` folder under the working directory of the compiled script.
- Examples:
    - `./linux_build.sh firefox -i`
- After preliminary modification and testing, it is basically usable, but further testing is still required.

# Others

- The extension is not published on `Google Web Store`, or `Microsoft Store`.
    - `Firefox Add-on` by [@ivysrono](https://addons.mozilla.org/firefox/addon/download-with-aria2/)
- Alternative of built-in `Aria2 Web Manager`
    - [`Aria2 WebUI`](https://ziahamza.github.io/webui-aria2/)
    - [`Yet Another Aria2 Web Frontend`](http://binux.github.io/yaaw/demo/)
