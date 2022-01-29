@ECHO OFF
IF NOT EXIST "%~DP07za.exe" GOTO :Exit
IF NOT EXIST "%~DP07za.dll" GOTO :Exit
:Code
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
SET /P Option=Build for: 
IF %Option% EQU 1 SET Code=Chromium
IF %Option% EQU 2 SET Code=Firefox
IF NOT DEFINED Code CLS && GOTO :Code
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN ("%~DP0%Code%\manifest.json") DO (IF %%~I EQU version SET Version=%%~J)
"%~DP07za.exe" a "%~DP0%Code%-%Version%.zip" "%~DP0Chromium\*"
IF %Option% EQU 2 "%~DP07za.exe" u "%~DP0%Code%-%Version%.zip" "%~DP0Firefox\*"
ECHO.
ECHO.
ECHO %Code% %Version% build completed, script will be terminated in 5 seconds...
:Exit
TIMEOUT /T 5
EXIT
