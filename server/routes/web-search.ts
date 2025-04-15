import express from 'express';
import { chatService } from '../services/chat';
import { log } from '../vite';
import { requireLogin, requireAdmin } from '../middleware/auth';

const router = express.Router();

// 获取当前网络搜索状态
router.get('/status', requireAdmin, (req, res) => {
  try {
    const status = chatService.isWebSearchEnabled();
    res.json({
      success: true,
      enabled: status
    });
  } catch (error) {
    log(`获取网络搜索状态时出错: ${error}`);
    res.status(500).json({
      success: false,
      message: '获取网络搜索状态时出错'
    });
  }
});

// 启用网络搜索
router.post('/enable', requireAdmin, (req, res) => {
  try {
    chatService.setWebSearchEnabled(true);
    res.json({
      success: true,
      enabled: chatService.isWebSearchEnabled(),
      message: '网络搜索已启用'
    });
  } catch (error) {
    log(`启用网络搜索时出错: ${error}`);
    res.status(500).json({
      success: false,
      message: '启用网络搜索时出错'
    });
  }
});

// 禁用网络搜索
router.post('/disable', requireLogin, (req, res) => {
  try {
    chatService.setWebSearchEnabled(false);
    res.json({
      success: true,
      enabled: false,
      message: '网络搜索已禁用'
    });
  } catch (error) {
    log(`禁用网络搜索时出错: ${error}`);
    res.status(500).json({
      success: false,
      message: '禁用网络搜索时出错'
    });
  }
});

// 切换网络搜索状态
router.post('/toggle', requireLogin, (req, res) => {
  try {
    const newStatus = chatService.toggleWebSearch();
    res.json({
      success: true,
      enabled: newStatus,
      message: `网络搜索已${newStatus ? '启用' : '禁用'}`
    });
  } catch (error) {
    log(`切换网络搜索状态时出错: ${error}`);
    res.status(500).json({
      success: false,
      message: '切换网络搜索状态时出错'
    });
  }
});

export default router;