/**
 * 文件API路由
 * 处理文件上传、获取和管理
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { 
  saveFileToBucket, 
  getFileFromBucket, 
  getUserFiles, 
  deleteFileFromBucket,
  getUserBackground,
  getDefaultBackgroundPath
} from '../services/file-bucket.service';

const router = Router();

// 内存存储，文件会被处理后存储到磁盘
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制10MB
  }
});

/**
 * 上传文件
 * 支持背景图片、头像和其他附件
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未提供文件' });
    }

    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const fileType = req.body.fileType || 'attachment';
    const allowedTypes = ['background', 'avatar', 'attachment'];
    
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ error: '不支持的文件类型' });
    }

    // 保存文件到存储桶
    const result = await saveFileToBucket(
      userId,
      req.file.buffer,
      req.file.originalname,
      fileType
    );

    res.json({
      success: true,
      fileId: result.fileId,
      url: result.publicUrl
    });
  } catch (error) {
    console.error('文件上传失败:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

/**
 * 获取用户文件列表
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const fileType = req.query.type as string;
    const files = await getUserFiles(userId, fileType);
    
    res.json({ files });
  } catch (error) {
    console.error('获取文件列表失败:', error);
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

/**
 * 获取背景图片
 */
router.get('/background', async (req: Request, res: Response) => {
  try {
    // 从请求参数或会话中获取用户ID
    const userId = Number(req.query.userId) || req.session.userId;
    
    // 如果无法获取用户ID，返回默认背景
    if (!userId) {
      return res.json({ url: '/backgrounds/default-background.png' });
    }

    const backgroundUrl = await getUserBackground(userId);
    res.json({ url: backgroundUrl });
  } catch (error) {
    console.error('获取背景图片失败:', error);
    // 出错时也返回默认背景，确保前端始终有图片可用
    res.json({ url: '/backgrounds/default-background.png' });
  }
});

/**
 * 获取用户文件
 */
router.get('/:userId/:fileType/:fileId', async (req: Request, res: Response) => {
  try {
    const { userId, fileType, fileId } = req.params;
    const userIdNum = parseInt(userId);
    
    // 安全检查：仅允许获取当前用户或公共文件
    if (!req.session.userId && req.session.userId !== userIdNum) {
      if (fileType !== 'public') {
        return res.status(401).json({ error: '未授权' });
      }
    }

    // 从ID中提取真实的文件ID (去掉扩展名)
    const realFileId = path.parse(fileId).name;
    const fileData = await getFileFromBucket(userIdNum, realFileId);
    
    if (!fileData) {
      // 如果是背景请求且找不到文件，返回默认背景
      if (fileType === 'background') {
        const defaultBgPath = getDefaultBackgroundPath();
        if (fs.existsSync(defaultBgPath)) {
          const defaultData = fs.readFileSync(defaultBgPath);
          const ext = path.extname(defaultBgPath).substring(1);
          res.contentType(`image/${ext}`);
          return res.send(defaultData);
        }
      }
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 设置适当的Content-Type
    const ext = path.extname(fileId).substring(1);
    if (ext) {
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext.toLowerCase())) {
        res.contentType(`image/${ext}`);
      } else if (['mp3', 'wav', 'ogg'].includes(ext.toLowerCase())) {
        res.contentType(`audio/${ext}`);
      } else {
        res.contentType('application/octet-stream');
      }
    } else {
      res.contentType('application/octet-stream');
    }
    
    res.send(fileData);
  } catch (error) {
    console.error('获取文件失败:', error);
    res.status(500).json({ error: '获取文件失败' });
  }
});

/**
 * 删除文件
 */
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const { fileId } = req.params;
    const success = await deleteFileFromBucket(userId, fileId);
    
    if (!success) {
      return res.status(404).json({ error: '文件不存在或无权限删除' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: '删除文件失败' });
  }
});

export default router;