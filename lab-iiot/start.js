#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

let backendDir = __dirname;

if (fs.existsSync(path.join(__dirname, 'lab-iiot', 'backend', 'server.js'))) {
  backendDir = path.join(__dirname, 'lab-iiot', 'backend');
} else if (fs.existsSync(path.join(__dirname, 'backend', 'server.js'))) {
  backendDir = path.join(__dirname, 'backend');
} else if (fs.existsSync(path.join(__dirname, '..', 'backend', 'server.js'))) {
  backendDir = path.join(__dirname, '..', 'backend');
}

const serverEntry = path.join(backendDir, 'server.js');
console.log(`Starting server from: ${backendDir}`);

if (!fs.existsSync(serverEntry)) {
  throw new Error(`No se encontró el servidor en ${serverEntry}`);
}

process.chdir(backendDir);
require(serverEntry);
