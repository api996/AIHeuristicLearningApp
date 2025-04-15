import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { log } from '../vite';

const router = express.Router();

// 获取所有提示词模板
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(401).json({ message: "请先登录" });
    }

    // 验证用户是否为管理员
    const user = await storage.getUser(Number(userId));
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "需要管理员权限" });
    }

    const templates = await storage.getAllPromptTemplates();
    log(`获取了${templates.length}个提示词模板`);
    res.json(templates);
  } catch (error) {
    log(`获取提示词模板错误: ${error}`);
    res.status(500).json({ message: "获取提示词模板失败", error: String(error) });
  }
});

// 获取指定模型的提示词模板
router.get('/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(401).json({ message: "请先登录" });
    }

    // 验证用户是否为管理员
    const user = await storage.getUser(Number(userId));
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "需要管理员权限" });
    }

    if (!modelId) {
      return res.status(400).json({ message: "需要提供模型ID" });
    }

    const template = await storage.getPromptTemplate(modelId);
    
    if (!template) {
      return res.status(404).json({ message: `未找到模型 ${modelId} 的提示词模板` });
    }

    log(`获取了模型 ${modelId} 的提示词模板`);
    res.json(template);
  } catch (error) {
    log(`获取特定提示词模板错误: ${error}`);
    res.status(500).json({ message: "获取提示词模板失败", error: String(error) });
  }
});

// 创建或更新提示词模板
router.post('/', async (req: Request, res: Response) => {
  try {
    const { 
      modelId, 
      promptTemplate,
      baseTemplate,
      kTemplate,
      wTemplate,
      lTemplate, 
      qTemplate,
      styleTemplate,
      policyTemplate,
      sensitiveWords
    } = req.body;
    
    const userId = req.body.userId || req.query.userId as string;
    
    if (!userId) {
      return res.status(401).json({ message: "请先登录" });
    }

    // 验证用户是否为管理员
    const user = await storage.getUser(Number(userId));
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "需要管理员权限" });
    }

    if (!modelId || !promptTemplate) {
      return res.status(400).json({ message: "需要提供模型ID和提示词模板" });
    }

    const savedTemplate = await storage.createOrUpdatePromptTemplate(
      modelId,
      promptTemplate,
      Number(userId),
      baseTemplate,
      kTemplate,
      wTemplate,
      lTemplate,
      qTemplate,
      styleTemplate,
      policyTemplate,
      sensitiveWords
    );

    log(`${savedTemplate ? '更新' : '创建'}了模型 ${modelId} 的提示词模板`);
    res.json(savedTemplate);
  } catch (error) {
    log(`保存提示词模板错误: ${error}`);
    res.status(500).json({ message: "保存提示词模板失败", error: String(error) });
  }
});

// 删除提示词模板
router.delete('/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(401).json({ message: "请先登录" });
    }

    // 验证用户是否为管理员
    const user = await storage.getUser(Number(userId));
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "需要管理员权限" });
    }

    if (!modelId) {
      return res.status(400).json({ message: "需要提供模型ID" });
    }

    await storage.deletePromptTemplate(modelId);
    log(`删除了模型 ${modelId} 的提示词模板`);
    
    res.json({ success: true, message: `已删除模型 ${modelId} 的提示词模板` });
  } catch (error) {
    log(`删除提示词模板错误: ${error}`);
    res.status(500).json({ message: "删除提示词模板失败", error: String(error) });
  }
});

export default router;