@echo off
rem Stops only the node.exe that lives in this app folder, never other Node processes.
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '%~dp0node.exe' } | Stop-Process -Force"
