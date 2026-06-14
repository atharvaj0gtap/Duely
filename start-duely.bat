@echo off
REM Run from this script's own folder, wherever the project is cloned.
cd /d "%~dp0"
start "Duely" cmd /k "npm run dev:full"
timeout /t 3 /nobreak >nul
start http://localhost:5173
