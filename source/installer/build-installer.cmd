@echo off
setlocal
rem Builds CafeAttendance-Setup.exe. Run from the source folder on a dev machine
rem with Node 20+ and Inno Setup 6 installed. Output: installer\dist\CafeAttendance-Setup.exe
cd /d "%~dp0.."
set "OUT=installer\stage"
set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"

echo [1/5] prisma client + next build (standalone)
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\app"
call npx prisma generate || exit /b 1
call npx next build || exit /b 1

echo [2/5] stage files
xcopy /e /i /q .next\standalone "%OUT%\app" >nul || exit /b 1
xcopy /e /i /q .next\static "%OUT%\app\.next\static" >nul || exit /b 1
if exist public xcopy /e /i /q public "%OUT%\app\public" >nul
xcopy /e /i /q prisma\migrations "%OUT%\app\migrations" >nul || exit /b 1
copy /y scripts\migrate.js "%OUT%\app\migrate.js" >nul || exit /b 1
for /f "delims=" %%n in ('node -p process.execPath') do copy /y "%%n" "%OUT%\node.exe" >nul
for %%f in (start.cmd stop.cmd launch.vbs icon.ico) do copy /y "installer\%%f" "%OUT%\%%f" >nul

echo [3/5] check: query engine present?
dir /s /b "%OUT%\app\node_modules\.prisma\client\*.node" >nul || (echo Prisma query engine missing from standalone output & exit /b 1)

echo [4/5] check: migrations apply on a fresh DB using the staged files
set "HERE=%CD:\=/%"
set "DATABASE_URL=file:%HERE%/installer/stage/check.db"
"%OUT%\node.exe" "%OUT%\app\migrate.js" || exit /b 1
del /q "%OUT%\check.db" 2>nul

echo [5/5] inno setup
"%ISCC%" installer\setup.iss || exit /b 1
echo Done: installer\dist\CafeAttendance-Setup.exe
endlocal
