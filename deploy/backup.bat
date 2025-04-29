@echo off
echo ===================================
echo    Backup Sistema de Tutoria
echo ===================================
echo.

:: Configurações
set BACKUP_DIR=backups
set MONGODB_URI=sua_string_de_conexao
set DATE=%date:~-4,4%-%date:~-7,2%-%date:~-10,2%
set TIME=%time:~0,2%-%time:~3,2%
set BACKUP_NAME=tutoria_backup_%DATE%_%TIME%

:: Criar diretório de backup se não existir
if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

echo Iniciando backup...
echo Data: %DATE%
echo Hora: %TIME%
echo.

:: Backup do MongoDB
echo Realizando backup do banco de dados...
mongodump --uri="%MONGODB_URI%" --out="%BACKUP_DIR%\%BACKUP_NAME%"

:: Backup dos arquivos
echo Copiando arquivos de configuração...
xcopy /s /i "config" "%BACKUP_DIR%\%BACKUP_NAME%\config"
xcopy /s /i "public" "%BACKUP_DIR%\%BACKUP_NAME%\public"

echo.
echo Backup concluído em: %BACKUP_DIR%\%BACKUP_NAME%
echo.

:: Limpar backups antigos (manter últimos 5)
echo Limpando backups antigos...
dir /b /ad "%BACKUP_DIR%\tutoria_backup_*" | sort /r > temp.txt
for /f "skip=5" %%a in (temp.txt) do rd /s /q "%BACKUP_DIR%\%%a"
del temp.txt

echo.
echo Processo finalizado!
pause