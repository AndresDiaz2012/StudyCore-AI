@echo off
title StudyCore AI — Setup
cd /d "%~dp0"

echo ============================================
echo   StudyCore AI — Instalacion inicial
echo ============================================
echo.

echo [1/3] Instalando dependencias Python...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de Python. Asegurate de tener pip disponible.
    pause
    exit /b 1
)

echo.
echo [2/3] Instalando dependencias Node.js (frontend)...
cd frontend
npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo npm install.
    pause
    exit /b 1
)
cd ..

echo.
echo [3/3] Verificando archivo .env...
if not exist ".env" (
    echo ADVERTENCIA: No se encontro .env — copia el archivo .env y agrega tu ANTHROPIC_API_KEY
) else (
    echo .env encontrado OK
)

echo.
echo ============================================
echo   Instalacion completada exitosamente!
echo ============================================
echo.
echo Para iniciar la aplicacion:
echo   1. Abre start_backend.bat  (en una ventana)
echo   2. Abre start_frontend.bat (en otra ventana)
echo   3. Ve a http://localhost:5173 en tu navegador
echo.
pause
