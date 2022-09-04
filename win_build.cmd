@ECHO OFF
PUSHD %~DP0
IF NOT EXIST 7za.exe GOTO :Exit
IF NOT EXIST 7za.dll GOTO :Exit
:Code
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
ECHO 3. Chromium Manifest V3
SET /P Option=Build for: 
IF %Option% EQU 1 GOTO :Chromium
IF %Option% EQU 2 GOTO :Firefox
IF %Option% EQU 3 GOTO :Chromium_MV3
CLS && GOTO :Code
:Chromium
SET Code=chromium
CALL :Process
GOTO :Exit
:Firefox
SET Code=firefox
CALL :Process
7za.exe u %Zip% "%CD%\firefox\*"
GOTO :Exit
:Chromium_MV3
SET Code=chromium_mv3
CALL :Process
7za.exe u %Zip% "%CD%\chromium_mv3\*"
GOTO :Exit
:Process
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN (%Code%\manifest.json) DO (IF %%~I EQU version SET Zip=%Code%-%%~J.zip)
7za.exe a %Zip% "%CD%\chromium\*"
EXIT /B
:Exit
ECHO.
ECHO.
ECHO ^<%Zip%^> build completed, script will be terminated in 5 seconds...
TIMEOUT /T 5
EXIT
