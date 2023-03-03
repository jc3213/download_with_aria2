@ECHO OFF
SET Zip=%ProgramFiles%\7-Zip\7z.exe
IF NOT EXIST "%Zip%" GOTO :Exit
:Mode
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
ECHO 3. Chromium Manifest V3
SET /P Option=Build for: 
IF %Option% EQU 1 CALL :Make chromium
IF %Option% EQU 2 CALL :Make firefox
IF %Option% EQU 3 CALL :Make chromium_mv3
CLS && GOTO :Mode
:Make
SET Mode=%~DP0%1
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN (%Mode%\manifest.json) DO (IF %%~I EQU version SET Out=%Mode%-%%~J.zip)
"%Zip%" a "%Out%" "%CD%\chromium\*"
IF %1 EQU chromium GOTO :Exit
"%Zip%" u "%Out%" -ux2 "%Mode%\*"
:Exit
ECHO.
ECHO.
ECHO ^<%Out%^> build completed, script will be terminated in 5 seconds...
TIMEOUT /T 5
EXIT
