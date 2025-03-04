from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import anthropic
import google.generativeai as genai
import os
from dotenv import load_dotenv
import json
import uuid
import logging
from datetime import datetime
import traceback

# 配置日志
def setup_logger():
    # 创建logs目录（如果不存在）
    if not os.path.exists('logs'):
        os.makedirs('logs')
    
    # 生成日志文件名（使用当前日期）
    log_filename = f'logs/api_{datetime.now().strftime("%Y%m%d")}.log'
    
    # 配置日志格式
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_filename, encoding='utf-8'),
            logging.StreamHandler()  # 同时输出到控制台
        ]
    )
    return logging.getLogger(__name__)

logger = setup_logger()

app = Flask(__name__)
CORS(app, supports_credentials=True)

# 加载环境变量
load_dotenv()

# 配置文件路径
CONFIG_FILE = 'api_configs.json'

# 存储API配置
api_configs = {}

def load_configs():
    """从文件加载配置"""
    global api_configs
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                api_configs = json.load(f)
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        api_configs = {}

def save_configs():
    """保存配置到文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(api_configs, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"保存配置文件失败: {e}")

# 启动时加载配置
load_configs()

@app.route('/api/config', methods=['POST'])
def save_config():
    try:
        config = request.json
        config['id'] = str(uuid.uuid4())
        api_configs[config['id']] = config
        save_configs()
        logger.info(f"保存新配置成功 - ID: {config['id']}, 名称: {config['name']}")
        return jsonify({"status": "success", "id": config['id']})
    except Exception as e:
        error_msg = f"保存配置失败: {str(e)}"
        logger.error(error_msg)
        logger.error(f"错误详情: {traceback.format_exc()}")
        return jsonify({"status": "error", "message": error_msg}), 500

@app.route('/api/config/<config_id>', methods=['PUT'])
def update_config(config_id):
    try:
        if config_id not in api_configs:
            return jsonify({"status": "error", "message": "配置不存在"}), 404
        config = request.json
        config['id'] = config_id
        api_configs[config_id] = config
        save_configs()
        logger.info(f"更新配置成功 - ID: {config_id}, 名称: {config['name']}")
        return jsonify({"status": "success"})
    except Exception as e:
        error_msg = f"更新配置失败: {str(e)}"
        logger.error(error_msg)
        logger.error(f"错误详情: {traceback.format_exc()}")
        return jsonify({"status": "error", "message": error_msg}), 500

@app.route('/api/config/<config_id>', methods=['DELETE'])
def delete_config(config_id):
    try:
        if config_id not in api_configs:
            return jsonify({"status": "error", "message": "配置不存在"}), 404
        config_name = api_configs[config_id]['name']
        del api_configs[config_id]
        save_configs()
        logger.info(f"删除配置成功 - ID: {config_id}, 名称: {config_name}")
        return jsonify({"status": "success"})
    except Exception as e:
        error_msg = f"删除配置失败: {str(e)}"
        logger.error(error_msg)
        logger.error(f"错误详情: {traceback.format_exc()}")
        return jsonify({"status": "error", "message": error_msg}), 500

@app.route('/api/config', methods=['GET'])
def get_configs():
    try:
        return jsonify(api_configs)
    except Exception as e:
        error_msg = f"获取配置失败: {str(e)}"
        logger.error(error_msg)
        logger.error(f"错误详情: {traceback.format_exc()}")
        return jsonify({"status": "error", "message": error_msg}), 500

def call_openai(prompt, system_prompt, config):
    """调用OpenAI API"""
    client = openai.OpenAI(
        api_key=config['api_key'],
        base_url=config.get('api_base')
    )
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    response = client.chat.completions.create(
        model=config['model'],
        messages=messages,
        temperature=config.get('temperature', 0.7),
        max_tokens=config.get('max_tokens', 1000)
    )
    return response.choices[0].message.content

def call_anthropic(prompt, system_prompt, config):
    """调用Anthropic API"""
    client = anthropic.Anthropic(api_key=config['api_key'])
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    
    response = client.messages.create(
        model=config['model'],
        max_tokens=1000,
        messages=messages
    )
    return response.content[0].text

def call_google(prompt, system_prompt, config):
    """调用Google API"""
    genai.configure(api_key=config['api_key'])
    model = genai.GenerativeModel(config['model'])
    
    full_prompt = f"{system_prompt}\n\n用户: {prompt}" if system_prompt else prompt
    response = model.generate_content(full_prompt)
    return response.text

def call_api(config, prompt, system_prompt):
    """调用不同提供商的API"""
    provider = config.get('provider', 'openai')
    
    if provider == 'openai' or provider == 'openai_compatible':
        return call_openai(prompt, system_prompt, config)
    elif provider == 'anthropic':
        return call_anthropic(prompt, system_prompt, config)
    elif provider == 'google':
        return call_google(prompt, system_prompt, config)
    else:
        raise ValueError(f"不支持的API提供商: {provider}")

@app.route('/api/query', methods=['POST'])
def query_apis():
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        system_prompt = data.get('system_prompt', '')
        
        if not prompt:
            return jsonify({'error': '提示词不能为空'}), 400
            
        if not api_configs:
            return jsonify({'error': '没有可用的API配置'}), 400

        results = {}
        for config_id, config in api_configs.items():
            try:
                logger.info(f"准备调用API - 配置ID: {config_id}, 名称: {config['name']}")
                result = call_api(config, prompt, system_prompt)
                logger.info(f"API调用成功 - 配置ID: {config_id}, 名称: {config['name']}")
                results[config_id] = result
            except Exception as e:
                logger.error(f"API调用失败 - 配置ID: {config_id}, 名称: {config['name']}, 错误: {str(e)}")
                logger.error(traceback.format_exc())
                results[config_id] = f"Error: {str(e)}"

        return jsonify(results)

    except Exception as e:
        logger.error(f"查询请求处理失败: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 
