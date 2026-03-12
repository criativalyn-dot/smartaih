#!/bin/bash
# Export PATH so macOS background services can find Node/NPM
export PATH=/usr/local/bin:/opt/homebrew/bin:$PATH

cd /Users/evelynmollmann/.gemini/antigravity/scratch/aih-consultation
# Kill any existing processes on the port just in case
/usr/sbin/lsof -ti:5174 | xargs kill -9 2>/dev/null
# Clean cache and start
rm -rf node_modules/.vite
/usr/local/bin/npm run dev -- --port 5174 --host 127.0.0.1
