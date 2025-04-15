/**
 * 网络搜索相关路由
 */
import express from 'express';
import { webSearchService } from '../services/web-search';
import { log } from '../vite';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// 使用身份验证中间件保护所有路由
router.use(isAuthenticated);

// 获取网络搜索状态
router.get('/status', (req, res) => {
  try {
    // 这里可以返回网络搜索服务的当前状态
    const apiKey = process.env.SERPER_API_KEY || '';
    
    res.json({
      enabled: !!apiKey, // 是否启用取决于是否配置了API密钥
      configured: !!apiKey, // 是否已配置API密钥
    });
  } catch (error) {
    log(`获取网络搜索状态失败: ${error}`);
    res.status(500).json({ error: '获取网络搜索状态失败' });
  }
});

// 启用/禁用网络搜索
router.post('/enable', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '参数错误，enabled必须是布尔值' });
    }
    
    // 检查是否配置了API密钥
    const apiKey = process.env.SERPER_API_KEY || '';
    if (!apiKey && enabled) {
      return res.status(400).json({ 
        error: '无法启用网络搜索，未配置SERPER_API_KEY',
        configured: false
      });
    }
    
    // 设置网络搜索缓存状态
    webSearchService.setCacheEnabled(enabled);
    
    return res.json({ 
      success: true, 
      enabled,
      configured: !!apiKey
    });
  } catch (error) {
    log(`设置网络搜索状态失败: ${error}`);
    res.status(500).json({ error: '设置网络搜索状态失败' });
  }
});

// 配置缓存时间
router.post('/cache-expiry', (req, res) => {
  try {
    const { minutes } = req.body;
    
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return res.status(400).json({ error: '参数错误，minutes必须是正整数' });
    }
    
    webSearchService.setCacheExpiryMinutes(minutes);
    
    return res.json({ 
      success: true, 
      cacheExpiryMinutes: minutes 
    });
  } catch (error) {
    log(`设置网络搜索缓存时间失败: ${error}`);
    res.status(500).json({ error: '设置网络搜索缓存时间失败' });
  }
});

// 测试搜索功能
router.post('/test', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '参数错误，query必须是非空字符串' });
    }
    
    // 检查是否配置了API密钥
    const apiKey = process.env.SERPER_API_KEY || '';
    if (!apiKey) {
      return res.status(400).json({ 
        error: '无法执行搜索，未配置SERPER_API_KEY',
        configured: false
      });
    }
    
    // 执行搜索
    const results = await webSearchService.search(query);
    
    return res.json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    log(`测试网络搜索失败: ${error}`);
    res.status(500).json({ error: '测试网络搜索失败，请检查API密钥配置' });
  }
});

export default router;