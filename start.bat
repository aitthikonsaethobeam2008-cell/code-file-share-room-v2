@echo off
cd /d "%~dp0"
echo === Installing packages (first time takes about 1 minute) ===
call npm.cmd install
echo.
echo === Starting at http://localhost:3000 - do not close this window ===
start "" http://localhost:3000
call npm.cmd start
pause
