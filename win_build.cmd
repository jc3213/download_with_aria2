@ECHO OFF
PUSHD %~DP0
IF NOT EXIST 7za.exe GOTO :Exit
IF NOT EXIST 7za.dll GOTO :Exit
:Mode
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
ECHO 3. Chromium Manifest V3
SET /P Option=Build for: 
IF %Option% EQU 1 GOTO :Chromium
IF %Option% EQU 2 GOTO :Firefox
IF %Option% EQU 3 GOTO :Chromium_MV3
CLS && GOTO :Mode
:Chromium
SET Mode=chromium
CALL :Main
GOTO :Exit
:Firefox
SET Mode=firefox
CALL :Main
GOTO :Extra
:Chromium_MV3
SET Mode=chromium_mv3
CALL :Main
GOTO :Extra
:Main
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN (%Mode%\manifest.json) DO (IF %%~I EQU version SET Zip=%Mode%-%%~J.zip)
7za.exe a %Zip% "%CD%\chromium\*"
EXIT /B
:Extra
7za.exe u %Zip% -ux2 "%CD%\%Mode%\*"
:Exit
ECHO.
ECHO.
ECHO ^<%Zip%^> build completed, script will be terminated in 5 seconds...
TIMEOUT /T 5
EXIT
