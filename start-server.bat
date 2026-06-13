@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "PORT=8000"
set "PAGE=index.html"
set "SERVER="

REM -- Find a runtime: prefer Python, fall back to Node --
where py >nul 2>nul && set "SERVER=py -m http.server !PORT!"
if not defined SERVER (
  where python >nul 2>nul && set "SERVER=python -m http.server !PORT!"
)
if not defined SERVER (
  where node >nul 2>nul && set "SERVER=npx --yes http-server -p !PORT! -c-1"
)

if not defined SERVER (
  echo.
  echo [ERROR] Python or Node.js is required but was not found.
  echo   Python : https://www.python.org/downloads/
  echo   Node   : https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "!PAGE!" (
  echo [ERROR] "!PAGE!" not found in this folder.
  echo  Put this .bat file in the same folder as the HTML file.
  pause
  exit /b 1
)

echo ============================================
echo   Local server
echo   URL : http://localhost:!PORT!/!PAGE!
echo   cmd : !SERVER!
echo ============================================
echo.

REM -- Run the server in a separate window (close it to stop) --
start "Local Server - maps" cmd /k "!SERVER!"

REM -- Wait a moment, then open the browser --
timeout /t 2 /nobreak >nul
start "" "http://localhost:!PORT!/!PAGE!"

echo Browser opened.
echo Server runs in the 'Local Server - maps' window.
echo (Close that window or press Ctrl+C there to stop it.)
echo.
pause
