/**
 * 测试数据生成路由
 * 仅用于开发测试，不应在生产环境中启用
 */

import { Router } from 'express';
import { generateTestGraph } from '../scripts/generate-test-graph';

const router = Router();

// 仅允许指定的测试用户ID（目前是用户ID=6）使用此功能
const ALLOWED_TEST_USER_ID = 6;

/**
 * 为指定用户ID生成测试知识图谱数据
 * GET /api/test-data/generate-graph/:userId?count=50
 */
router.get('/generate-graph/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // 安全检查：仅允许为指定的测试用户ID生成数据
    if (userId !== ALLOWED_TEST_USER_ID) {
      return res.status(403).json({
        success: false,
        message: `安全限制：仅允许为测试用户ID=${ALLOWED_TEST_USER_ID}生成测试数据`
      });
    }
    
    const count = parseInt(req.query.count as string) || 50; // 默认生成50条记忆
    const maxCount = 100; // 最大允许生成的记忆数量
    
    if (count > maxCount) {
      return res.status(400).json({
        success: false,
        message: `测试数据生成数量超过最大限制(${maxCount})`
      });
    }
    
    // 调用测试数据生成函数
    const result = await generateTestGraph(userId, count);
    
    return res.json(result);
  } catch (error) {
    console.error('生成测试数据失败:', error);
    return res.status(500).json({
      success: false,
      message: `服务器错误: ${error.message}`
    });
  }
});

/**
 * 删除测试用户的所有记忆数据
 * DELETE /api/test-data/clear-memories/:userId
 */
router.delete('/clear-memories/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    // 安全检查：仅允许删除指定的测试用户ID的数据
    if (userId !== ALLOWED_TEST_USER_ID) {
      return res.status(403).json({
        success: false,
        message: `安全限制：仅允许删除测试用户ID=${ALLOWED_TEST_USER_ID}的测试数据`
      });
    }
    
    // 这里可以实现删除测试用户的所有记忆数据的逻辑
    // 目前先返回未实现
    return res.status(501).json({
      success: false,
      message: `功能尚未实现`
    });
  } catch (error) {
    console.error('删除测试数据失败:', error);
    return res.status(500).json({
      success: false,
      message: `服务器错误: ${error.message}`
    });
  }
});

export default router;