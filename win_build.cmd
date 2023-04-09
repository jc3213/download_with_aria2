@ECHO OFF
FOR /F "tokens=1,2*" %%I IN ('REG QUERY HKLM\Software\7-Zip /V Path') DO (IF "%%I"=="Path" SET Zip=%%K7z.exe)
IF NOT EXIST "%Zip%" GOTO :Exit
:Type
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Chromium Manifest V3
ECHO 3. Firefox
SET /P Option=Build for: 
IF %Option% EQU 1 CALL :Make chromium
IF %Option% EQU 2 CALL :Make chromium_mv3
IF %Option% EQU 3 CALL :Make firefox
CLS && GOTO :Type
:Make
SET Type=%~DP0%1
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN (%Type%\manifest.json) DO (IF %%~I EQU version SET Out=%Type%-%%~J.zip)
"%Zip%" a "%Out%" "%CD%\chromium\*"
IF %1 EQU chromium GOTO :Exit
"%Zip%" u "%Out%" -ux2 "%Type%\*"
:Exit
ECHO.
ECHO.
ECHO ^<%Out%^> build completed, script will be terminated in 5 seconds...
TIMEOUT /T 5
EXIT
