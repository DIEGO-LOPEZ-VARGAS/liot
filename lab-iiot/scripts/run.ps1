# PowerShell helper to run backend on Windows
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
Set-Location -Path "$PSScriptRoot\..\backend"
npm install
node server.js