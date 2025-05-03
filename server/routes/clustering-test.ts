/**
 * 聚类测试路由
 * 提供用于测试Python聚类服务的API端点
 */
import express from 'express';
import { log } from '../vite';
import { memoryService } from '../services/learning/memory_service';

const router = express.Router();

/**
 * 测试Python聚类服务
 * GET /api/test/python-clustering
 * 运行测试并返回结果
 */
router.get('/python-clustering', async (req, res) => {
  try {
    log('[API] 开始测试Python聚类服务');
    
    // 执行Python聚类测试
    const success = await memoryService.testPythonClustering();
    
    // 返回测试结果
    return res.json({
      success,
      message: success ? 'Python聚类服务测试成功' : 'Python聚类服务测试失败'
    });
  } catch (error) {
    log(`[API] 测试Python聚类服务出错: ${error}`, "error");
    return res.status(500).json({
      success: false,
      message: `测试Python聚类服务时发生错误: ${error}`
    });
  }
});

export default router;