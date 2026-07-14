@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" "%~dp0node_modules\next\dist\bin\next" start -H 0.0.0.0 -p 3000 >> "%~dp0.next-local-server-3000.log" 2>&1
