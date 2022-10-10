# About

- This extension is completely rewritten from [chrome-aria2-integration](https://github.com/robbielj/chrome-aria2-integration)

# How to Use

- [Wiki](//github.com/jc3213/download_with_aria2/wiki)

# Feedback

- [File an issue](//github.com/jc3213/download_with_aria2/issues/new/)

# Build

- Download latest stable [source code](https://github.com/jc3213/download_with_aria2/releases/latest)
- Extract source code

#### Windows
- Download [7-zip standalone console v22.01](https://www.7-zip.org/a/7z2201-extra.7z)
- Put `7za.exe` and `7za.dll` into the same folder with `win_build.cmd`
- Run `win_build.cmd` and follow the instructions

#### Linux
- Install `zip` from software sources or elsewhere.
- Run `linux_build.sh` and follow the instructions
- If the browser parameter `firefox` or `chromium` is specified, the extension can be compiled without interaction.
- When the browser parameter is specified, and then specify the `-i` parameter, the browser can directly install the compiled extension in an interactive manner.
    - Due to Chrome's security policy, this function is currently only implemented in Firefox, and only supports Firefox Browser Developer Edition
- The extension will be generated in the `build` folder under the working directory of the compiled script.
- Examples:
    - `./linux_build.sh firefox -i`
- After preliminary modification and testing, it is basically usable, but further testing is still required.

# Others

- **Google Web Store**
    - None
- **Microsoft Store**
    - Link: https://microsoftedge.microsoft.com/addons/detail/cgoonbdaiddmlpnneceehfamhjmkbmec [**Reviewing**]
- **Firefox Add-on**
    - Link: https://addons.mozilla.org/firefox/addon/download-with-aria2/
    - Provider: [@ivysrono](https://github.com/ivysrono)
- **Aria2 WebUI**
    - Link: https://ziahamza.github.io/webui-aria2/
- **Yet Another Aria2 Web Frontend**
    - Link: http://binux.github.io/yaaw/demo/
