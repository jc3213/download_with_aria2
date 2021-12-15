@ECHO OFF
:Code
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
SET /P Option=Build for: 
IF %Option% EQU 1 SET Code=Chromium
IF %Option% EQU 2 SET Code=Firefox
IF NOT DEFINED Code CLS && GOTO :Code
FOR /F "USEBACKQ SKIP=3 TOKENS=1,2 DELIMS=,: " %%I IN ("%~DP0%Code%\manifest.json") DO (IF %%~I EQU version SET Version=%%~J)
%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -Command "Compress-Archive -Path '%~DP0Chromium\*' -DestinationPath '%~DP0%Code%-%Version%.zip'"
IF %Option% EQU 2 %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe -Command "Compress-Archive -Path '%~DP0Firefox\*' -Update -DestinationPath '%~DP0%Code%-%Version%.zip'"
ECHO Download with Aria2 for %Code% version %Version% build completed...
:Exit
TIMEOUT /T 5
EXIT
