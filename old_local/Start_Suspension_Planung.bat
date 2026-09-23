@echo off
title Suspension Planung Server
echo ===================================================
echo   STARTE SUSPENSION PLANUNGS-DATENBANK...
echo ===================================================
echo.
echo Bitte dieses Fenster geoeffnet lassen, solange du
echo in der Web-App arbeitest.
echo Wenn du fertig bist, kannst du das Fenster schliessen.
echo.
echo Oeffne Browser...
start http://localhost:8080/index.html?v=%RANDOM%
python app.py
pause
