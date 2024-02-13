@echo off
title Download with Aria2
for /f "tokens=2*" %%a in ('reg query "HKLM\Software\7-Zip" /v "Path"') do (set zip=%%b7z.exe)
:main
cls
echo ================================================================
echo 1. Chromium
echo 2. Chromium Manifest V3
echo 3. Firefox
echo ================================================================
set /p act=^> 
if [%act%] equ [1] call :archive "chromium" "Chromium"
if [%act%] equ [2] call :archive "chromium_mv3" "Chromium Manifest V3"
if [%act%] equ [3] call :archive "firefox" "Firefox"
goto :main
:archive
for /f "usebackq skip=3 tokens=1,2 delims=,: " %%a in (%~1\manifest.json) do (if %%~a equ version set output=%~1-%%~b.zip)
"%zip%" a "%output%" "%~dp0chromium\*" >nul
if %~1 equ chromium goto :exit
"%zip%" u "%output%" -ux2 "%~dp0%~1\*" >nul
:exit
echo.
echo The program has built the extension for "%~2"
echo.
echo The output file: "%output%"
timeout /t 5
set act=
goto :main
