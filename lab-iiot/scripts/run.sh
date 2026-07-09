#!/bin/sh
# Simple helper to run the backend on Unix/macOS
cd "$(dirname "$0")/.." || exit 1
cd backend || exit 1
npm install --silent
node server.js