#!/bin/bash

echo "Starting LLM WARS..."

# 创建临时文件存储进程ID
PID_FILE="/tmp/llm_wars_pids"

# 清理函数
cleanup() {
    echo "Stopping services..."
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                kill "$pid"
                wait "$pid" 2>/dev/null
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    echo "Services stopped."
    exit 0
}

# 设置清理钩子
trap cleanup SIGINT SIGTERM

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js 14 or higher."
    exit 1
fi

# 检查虚拟环境是否存在
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# 检查前端依赖是否安装
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# 检测终端类型并启动服务
launch_terminal() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && $1\""
    elif command -v gnome-terminal &> /dev/null; then
        # GNOME Terminal
        gnome-terminal -- bash -c "$1; exec bash"
    elif command -v konsole &> /dev/null; then
        # KDE Konsole
        konsole -e bash -c "$1; exec bash"
    elif command -v xterm &> /dev/null; then
        # xterm
        xterm -e bash -c "$1; exec bash"
    else
        # 后备方案：在后台运行
        bash -c "$1" &
        echo $! >> "$PID_FILE"
    fi
}

# 启动后端服务
echo "Starting backend service..."
launch_terminal "source venv/bin/activate && python app.py"

# 启动前端服务
echo "Starting frontend service..."
launch_terminal "cd frontend && npm start"

echo "Services are starting..."
echo "Backend will be available at http://localhost:5000"
echo "Frontend will be available at http://localhost:3000"
echo
echo "Press Ctrl+C to stop all services."
echo "Or press Enter to exit..."

# 等待用户输入
read -p "Press Enter to exit..."
cleanup 