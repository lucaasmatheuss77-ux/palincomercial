@echo off
cd /d "C:\Users\Administrador TI\Comercial Palin\palin-commercial-hub"
node_modules\.bin\next.cmd build 1>"%~dp0build_out.txt" 2>&1
echo EXIT:%ERRORLEVEL%
