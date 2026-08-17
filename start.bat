@echo off
echo Starting Unified DroneMind Server...
echo Port: 8000
echo Open: http://localhost:8000
start cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo Unified server is booting up. Open http://localhost:8000 in your browser!
exit
