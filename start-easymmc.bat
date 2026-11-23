@echo off
setlocal
cd /d "%~dp0"

set "APP_PORT=4800"
title EasyMMC Local Server (Port %APP_PORT%)

echo ==================================================
echo   EasyMMC - Man-Machine Chart (Local Server)
echo   Port tetap : %APP_PORT%
echo   URL akses  : http://localhost:%APP_PORT%
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js belum terpasang atau tidak ditemukan di PATH.
  echo Silakan unduh dan instal Node.js dari https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Menginstal dependensi pertama kali...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] Gagal menjalankan npm install.
    pause
    exit /b 1
  )
  echo.
)

echo Menjalankan server di http://localhost:%APP_PORT% ...
echo Tekan Ctrl+C atau tutup jendela ini untuk menghentikan server.
echo.

start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%APP_PORT%"
node server.js --port=%APP_PORT%

if errorlevel 1 (
  echo.
  echo [ERROR] Server berhenti. Pastikan port %APP_PORT% belum digunakan aplikasi lain.
  pause
  exit /b 1
)

pause
