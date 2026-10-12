@echo off
setlocal

cd /d "%~dp0"

echo Budowanie wersji produkcyjnej...
docker compose run --build --rm build

if errorlevel 1 (
    echo.
    echo Build nie powiodl sie.
    exit /b 1
)

echo.
echo Build gotowy w katalogu: %~dp0build
exit /b 0
