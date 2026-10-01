@echo off
cd /d "%~dp0"
echo Jieluo Wish: http://127.0.0.1:4173/
echo Keep this window open, then open the address in your browser.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
