@ECHO OFF
TITLE Download with Aria2
FOR /F "tokens=1,2*" %%I IN ('REG QUERY HKLM\Software\7-Zip /V Path') DO (IF "%%I"=="Path" SET Zip=%%K7z.exe)
:Select
ECHO ================================================================
ECHO 1. Chromium
ECHO 2. Chromium Manifest V3
ECHO 3. Firefox
ECHO ================================================================
SET /P Act=^> 
IF [%Act%] EQU [1] CALL :Make chromium
IF [%Act%] EQU [2] CALL :Make chromium_mv3
IF [%Act%] EQU [3] CALL :Make firefox
CLS && GOTO :Select
:Make
SET Type=%~DP0%1
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN (%Type%\manifest.json) DO (IF %%~I EQU version SET Out=%Type%-%%~J.zip)
"%Zip%" a "%Out%" "%CD%\chromium\*"
IF %1 EQU chromium GOTO :Exit
"%Zip%" u "%Out%" -ux2 "%Type%\*"
:Exit
ECHO.
ECHO.
ECHO File "%Out%"
ECHO Return to main menu in 5 seconds...
TIMEOUT /T 5
