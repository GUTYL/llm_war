@echo off
echo Starting LLM WARS...

:: 创建临时文件存储进程ID
set "PID_FILE=%TEMP%\llm_wars_pids.txt"

:: 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

:: 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed. Please install Node.js 14 or higher.
    pause
    exit /b 1
)

:: 检查虚拟环境是否存在
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

:: 检查前端依赖是否安装
if not exist frontend\node_modules (
    echo Installing frontend dependencies...
    cd frontend
    npm install
    cd ..
)

:: 启动后端服务
start /B cmd /c "venv\Scripts\activate && python app.py" >nul 2>&1
set "BACKEND_PID=%ERRORLEVEL%"
echo %BACKEND_PID% > "%PID_FILE%"

:: 启动前端服务
start /B cmd /c "cd frontend && npm start" >nul 2>&1
set "FRONTEND_PID=%ERRORLEVEL%"
echo %FRONTEND_PID% >> "%PID_FILE%"

echo Services are starting...
echo Backend will be available at http://localhost:5000
echo Frontend will be available at http://localhost:3000
echo.
echo Press Ctrl+C to stop all services.
echo Or press Enter to exit...

:: 等待用户输入
pause >nul

:: 停止服务
echo Stopping services...
for /f "tokens=*" %%a in (%PID_FILE%) do (
    taskkill /F /PID %%a >nul 2>&1
)
del "%PID_FILE%" >nul 2>&1
echo Services stopped. 