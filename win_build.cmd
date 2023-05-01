@echo off
title Download with Aria2
for /f "tokens=2*" %%a in ('reg query "HKLM\Software\7-Zip" /v "Path"') do (set zip=%%b7z.exe)
:main
echo ================================================================
echo 1. Chromium
echo 2. Chromium Manifest V3
echo 3. Firefox
echo ================================================================
set /p act=^> 
if [%act%] equ [1] set bow=chromium
if [%act%] equ [2] set bow=chromium_mv3
if [%act%] equ [3] set bow=firefox
if not defined bow cls && goto :main
for /f "usebackq skip=3 tokens=1,2 delims=,: " %%a in (%bow%\manifest.json) do (if %%~a equ version set output=%bow%-%%~b.zip)
"%zip%" a "%output%" "%~dp0chromium\*"
if %bow% equ chromium goto :exit
"%zip%" u "%output%" -ux2 "%~dp0%bow%\*"
:exit
echo.
echo.
echo File "%output%"
echo Return to main menu in 5 seconds...
timeout /t 5
set act=
set bow=
cls
goto :main
