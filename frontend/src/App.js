import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  TextField,
  Button,
  Grid,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormHelperText,
  Snackbar,
  Alert,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',  // 使用相对路径，将通过代理访问
  timeout: 60000,  // 增加到60秒
  headers: {
    'Content-Type': 'application/json',
  }
});

// 添加请求重试机制
api.interceptors.response.use(undefined, async (err) => {
  const { config } = err;
  
  // 如果是超时错误且没有重试过
  if (err.code === 'ECONNABORTED' && !config._retry) {
    config._retry = true;
    
    // 增加超时时间
    config.timeout = 120000;  // 重试时增加到120秒
    
    // 重试请求
    return api(config);
  }
  
  return Promise.reject(err);
});

function App() {
  const [prompt, setPrompt] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [results, setResults] = useState({});
  const [configs, setConfigs] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);
  const [newConfig, setNewConfig] = useState({
    id: '',
    name: '',
    provider: '',
    api_key: '',
    model: '',
    api_base: '',
    temperature: 0.7,
    max_tokens: 1000,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState(null);
  const [configListExpanded, setConfigListExpanded] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandedResults, setExpandedResults] = useState({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [promptAccordionExpanded, setPromptAccordionExpanded] = useState(true);
  const [fullscreenResult, setFullscreenResult] = useState(null);

  // 添加自动折叠定时器
  useEffect(() => {
    let timer;
    if (configListExpanded) {
      timer = setTimeout(() => {
        setConfigListExpanded(false);
      }, 5000); // 5秒后自动折叠
    }
    return () => clearTimeout(timer);
  }, [configListExpanded]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await api.get('/config');
      setConfigs(response.data);
    } catch (error) {
      console.error('Error fetching configs:', error);
      setError('获取配置失败，请检查后端服务是否正常运行');
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitSuccess(true);
      setPromptAccordionExpanded(false);
      
      const response = await api.post('/query', {
        prompt,
        system_prompt: systemPrompt
      });

      setResults(response.data);
      setSubmitSuccess(false);

      // 自动展开所有结果
      const newExpanded = {};
      Object.keys(response.data).forEach(id => {
        newExpanded[id] = true;
      });
      setExpandedResults(newExpanded);

    } catch (error) {
      console.error('Error querying APIs:', error);
      setError('查询失败，请检查网络连接和API配置');
      setSubmitSuccess(false);
    }
  };

  const handleEditConfig = (config) => {
    setEditingConfig(config);
    setNewConfig({
      ...config,
      id: config.id  // 确保ID字段被正确设置
    });
    setOpenDialog(true);
  };

  const handleSaveConfig = async () => {
    try {
      if (editingConfig) {
        // 更新现有配置
        await api.put(`/config/${editingConfig.id}`, newConfig);
        setEditingConfig(null);
      } else {
        // 添加新配置
        const response = await api.post('/config', newConfig);
        // 保存返回的ID
        setNewConfig(prev => ({ ...prev, id: response.data.id }));
      }
      fetchConfigs();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving config:', error);
      setError('保存配置失败，请检查网络连接');
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingConfig(null);
    setNewConfig({
      id: '',
      name: '',
      provider: '',
      api_key: '',
      model: '',
      api_base: '',
      temperature: 0.7,
      max_tokens: 1000,
    });
  };

  const handleProviderChange = (e) => {
    const provider = e.target.value;
    setNewConfig(prev => ({
      ...prev,
      provider,
      // 重置相关字段
      api_base: provider === 'openai_compatible' ? '' : undefined,
      temperature: 0.7,
      max_tokens: 1000,
    }));
  };

  const showAdvancedOptions = (provider) => {
    return provider === 'openai' || provider === 'openai_compatible';
  };

  const handleCloseError = () => {
    setError(null);
  };

  const handleDeleteClick = (config) => {
    setConfigToDelete(config);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/config/${configToDelete.id}`);
      fetchConfigs();
      setDeleteDialogOpen(false);
      setConfigToDelete(null);
    } catch (error) {
      console.error('Error deleting config:', error);
      setError('删除配置失败，请检查网络连接');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setConfigToDelete(null);
  };

  const handleCopyConfig = (config) => {
    // 创建新的配置对象，移除 id 字段
    const newConfigCopy = {
      ...config,
      id: '',
      name: `${config.name} (副本)`,
    };
    setNewConfig(newConfigCopy);
    setEditingConfig(null);
    setOpenDialog(true);
  };

  const toggleResult = (id) => {
    setExpandedResults(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleFullscreen = (id, result) => {
    setFullscreenResult(fullscreenResult === id ? null : { id, result });
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Grid container spacing={3}>
        {/* 左侧主要内容区域 */}
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
              LLM WARS
            </Typography>
            
            <Accordion 
              expanded={promptAccordionExpanded}
              onChange={(e, expanded) => setPromptAccordionExpanded(expanded)}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>提示词设置</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      variant="outlined"
                      label="System Prompt（可选）"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      placeholder="输入系统提示词，用于设置AI的行为和角色"
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={4}
                      variant="outlined"
                      label="用户提示词"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="输入您想要询问的问题"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      onClick={handleSubmit}
                      disabled={!prompt || Object.keys(configs).length === 0}
                    >
                      发送查询
                    </Button>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>

          <Grid container spacing={2}>
            {Object.entries(results).map(([id, result]) => (
              <Grid item xs={12} md={6} key={id}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleResult(id)}
                  >
                    <Typography variant="h6">
                      {configs[id]?.name || id}
                    </Typography>
                    <Box>
                      <Tooltip title={fullscreenResult?.id === id ? "退出全屏" : "全屏显示"}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen(id, result);
                          }}
                          sx={{ mr: 1 }}
                        >
                          {fullscreenResult?.id === id ? <FullscreenExitIcon /> : <FullscreenIcon />}
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small">
                        {expandedResults[id] ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </Box>
                  </Box>
                  <Collapse in={expandedResults[id]}>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 2 }}>
                      {result}
                    </Typography>
                  </Collapse>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* 全屏显示对话框 */}
          <Dialog
            open={!!fullscreenResult}
            onClose={() => setFullscreenResult(null)}
            maxWidth="md"
            fullWidth
            fullScreen
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {configs[fullscreenResult?.id]?.name || fullscreenResult?.id}
                </Typography>
                <IconButton onClick={() => setFullscreenResult(null)}>
                  <FullscreenExitIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mt: 2 }}>
                {fullscreenResult?.result}
              </Typography>
            </DialogContent>
          </Dialog>
        </Grid>

        {/* 右侧模型配置 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: 2,
                cursor: 'pointer'
              }}
              onClick={() => setConfigListExpanded(!configListExpanded)}
            >
              <Typography variant="h6">模型配置</Typography>
              <Box>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDialog(true);
                  }}
                  sx={{ mr: 1 }}
                >
                  添加模型
                </Button>
                <IconButton size="small">
                  {configListExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </IconButton>
              </Box>
            </Box>
            <Collapse in={configListExpanded}>
              <Box sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                {Object.entries(configs).map(([id, config]) => (
                  <Paper 
                    key={id} 
                    sx={{ 
                      p: 2, 
                      mb: 2,
                      backgroundColor: 'background.default'
                    }}
                  >
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="subtitle1">{config.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        提供商: {config.provider} | 模型: {config.model}
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        display: 'flex', 
                        gap: 1,
                        justifyContent: 'flex-end'
                      }}
                    >
                      <Tooltip title="复制配置">
                        <IconButton
                          size="small"
                          onClick={() => handleCopyConfig(config)}
                        >
                          <ContentCopyIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑配置">
                        <IconButton
                          size="small"
                          onClick={() => handleEditConfig({...config, id})}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除配置">
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteClick({...config, id})}
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Collapse>
          </Paper>
        </Grid>
      </Grid>

      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        disableEscapeKeyDown
        disableBackdropClick
      >
        <DialogTitle>{editingConfig ? '编辑模型配置' : '添加模型配置'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="配置名称"
              value={newConfig.name}
              onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>提供商</InputLabel>
              <Select
                value={newConfig.provider}
                onChange={handleProviderChange}
                label="提供商"
              >
                <MenuItem value="openai">OpenAI</MenuItem>
                <MenuItem value="anthropic">Anthropic</MenuItem>
                <MenuItem value="google">Google</MenuItem>
                <MenuItem value="openai_compatible">OpenAI兼容API</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="API密钥"
              value={newConfig.api_key}
              onChange={(e) => setNewConfig({ ...newConfig, api_key: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="模型名称"
              value={newConfig.model}
              onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })}
              sx={{ mb: 2 }}
            />
            
            {showAdvancedOptions(newConfig.provider) && (
              <>
                <TextField
                  fullWidth
                  label="API基础URL"
                  value={newConfig.api_base || ''}
                  onChange={(e) => setNewConfig({ ...newConfig, api_base: e.target.value })}
                  sx={{ mb: 2 }}
                  helperText="例如: https://api.example.com/v1，留空则使用默认OpenAI地址"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Temperature"
                  value={newConfig.temperature}
                  onChange={(e) => setNewConfig({ ...newConfig, temperature: parseFloat(e.target.value) })}
                  sx={{ mb: 2 }}
                  helperText="0.0-1.0，默认0.7"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Max Tokens"
                  value={newConfig.max_tokens}
                  onChange={(e) => setNewConfig({ ...newConfig, max_tokens: parseInt(e.target.value) })}
                  sx={{ mb: 2 }}
                  helperText="最大生成token数，默认1000"
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button 
            onClick={handleSaveConfig} 
            variant="contained"
            disabled={!newConfig.name || !newConfig.provider || !newConfig.api_key || !newConfig.model}
          >
            {editingConfig ? '保存修改' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除模型配置 "{configToDelete?.name}" 吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>取消</Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={submitSuccess} 
        autoHideDuration={2000} 
        onClose={() => setSubmitSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSubmitSuccess(false)} severity="success" sx={{ width: '100%' }}>
          请求已发送，正在等待响应...
        </Alert>
      </Snackbar>

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default App; 