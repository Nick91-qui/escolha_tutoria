@echo off
echo ===================================
echo    Iniciando Sistema de Tutoria
echo ===================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js e tente novamente.
    pause
    exit /b 1
)



:: Iniciar monitor em nova janela
start "Monitor de Sistema" cmd /c "node monitor-local.js"

:: Iniciar servidor
echo Iniciando servidor...
start "Servidor de Tutoria" cmd /c "node server.js"

:: Abrir navegador após 5 segundos
timeout /t 5 >nul
start http://localhost:3000

echo.
echo Sistema iniciado! Pressione qualquer tecla para encerrar todos os processos...
pause >nul

:: Encerrar todos os processos node
taskkill /f /im node.exe