@echo off
setlocal
rem Starts the attendance server (hidden) and opens the kiosk in an app window.
rem Normally run via launch.vbs so no console appears.
rem Data (DB + secret + logs) lives in %LOCALAPPDATA%\CafeAttendance so upgrades keep it.

set "APP=%~dp0"
set "DATA=%LOCALAPPDATA%\CafeAttendance"
if not exist "%DATA%" mkdir "%DATA%"

rem Secret: generate once; regenerate if the file is missing or empty.
for %%A in ("%DATA%\jwt.secret") do if not exist "%%~A" set REGEN=1
for %%A in ("%DATA%\jwt.secret") do if exist "%%~A" if %%~zA==0 set REGEN=1
if defined REGEN (
  powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')" > "%DATA%\jwt.secret"
)
set /p JWT_SECRET=<"%DATA%\jwt.secret"
if not defined JWT_SECRET ( echo Could not create jwt.secret & exit /b 1 )

set "DB=%DATA:\=/%"
set "DATABASE_URL=file:%DB%/attendance.db"
rem Not 3000: dev servers (React, Next, etc.) usually hold it.
set "PORT=3789"
set "WEBAUTHN_ORIGIN=http://localhost:%PORT%"
set "HOSTNAME=127.0.0.1"
set "NODE_ENV=production"

rem Already running? Just open the window. Match our health body, not just any
rem HTTP answer, so another app on the port is not mistaken for ours.
curl -s http://127.0.0.1:%PORT%/api/health | findstr /c:"\"database\":\"connected\"" >nul && goto open

rem Create / upgrade the database schema.
"%APP%node.exe" "%APP%app\migrate.js" >> "%DATA%\server.log" 2>&1 || exit /b 1

rem Hidden window; env vars above are inherited. Output goes to the logs.
powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath '%APP%node.exe' -ArgumentList '\"%APP%app\server.js\"' -WorkingDirectory '%APP%app' -RedirectStandardOutput '%DATA%\server.out.log' -RedirectStandardError '%DATA%\server.err.log'"

for /l %%i in (1,1,30) do (
  curl -s http://127.0.0.1:%PORT%/api/health | findstr /c:"\"database\":\"connected\"" >nul && goto open
  timeout /t 1 /nobreak >nul
)
echo Server did not start (port %PORT% in use?). See %DATA%\server.err.log
exit /b 1

:open
rem WebAuthn rpID is "localhost", so the browser must open localhost, not 127.0.0.1.
start "" msedge --app=http://localhost:%PORT%/kiosk 2>nul || start "" http://localhost:%PORT%/kiosk
endlocal
