@echo off
echo ===================================
echo    Configuracao Inicial do Sistema
echo ===================================
echo.

:: Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js antes de continuar.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Verificar MongoDB
echo Verificando MongoDB...
mongosh --eval "db.version()" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] MongoDB nao esta instalado ou nao esta rodando!
    echo Por favor, instale o MongoDB e inicie o servico.
    echo Download: https://www.mongodb.com/try/download/community
    pause
    exit /b 1
)

:: Criar diretorios necessarios
if not exist "logs" mkdir logs
if not exist "logs\pm2" mkdir logs\pm2

:: Instalar dependencias
echo Instalando dependencias...
call npm install

echo.
echo Configuracao concluida com sucesso!
echo Execute start.bat para iniciar o sistema.
echo.
pause