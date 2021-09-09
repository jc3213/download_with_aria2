@ECHO OFF
SETLOCAL EnableDelayedExpansion
PUSHD %~DP0
:Code
ECHO Auto build script for extension ^<Download with Aria2^>
ECHO 1. Chromium
ECHO 2. Firefox
SET /P Version=Build for: 
IF %Version% EQU 1 SET Code=Chromium
IF %Version% EQU 2 SET Code=Firefox
IF NOT DEFINED Code CLS && GOTO :Code
IF NOT EXIST 7z.exe GOTO :Exit
:File
%~DP07z.exe a %~DP0%Code%.zip %~DP0Common\*
%~DP07z.exe u %~DP0%Code%.zip %~DP0%Code%\*
PAUSE
:Exit
EXIT
