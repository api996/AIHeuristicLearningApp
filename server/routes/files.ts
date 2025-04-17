/**
 * 文件API路由
 * 处理文件上传、获取和管理
 * 升级版: 支持图像处理、缓存控制和即时更新
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import etag from 'etag';
import sharp from 'sharp';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { userFiles } from '../../shared/schema';
import { 
  saveFileToStorage, 
  getFileFromStorage, 
  getUserFiles, 
  deleteFileFromStorage,
  getUserBackground,
  getDefaultBackgroundPath,
  getDefaultBackgroundUrl,
  migrateToObjectStorage
} from '../services/hybrid-storage.service';
import { requireAuth, requireAdmin } from '../middleware/auth';

// 使用统一的管理员认证中间件
// 简化管理员检查 - 直接使用requireAdmin中间件

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
 * 增强版: 支持进度反馈、图像处理和缓存控制
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未提供文件' });
    }

    // 从会话或请求体中获取用户ID
    const userId = req.session.userId || Number(req.body.userId);
    if (!userId) {
      console.error('文件上传失败: 未提供有效的用户ID');
      return res.status(401).json({ error: '未授权' });
    }

    const fileType = req.body.fileType || 'attachment';
    const allowedTypes = ['background', 'avatar', 'attachment'];
    
    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({ error: '不支持的文件类型' });
    }

    // 检查文件大小
    if (req.file.size > 10 * 1024 * 1024) { // 10MB
      return res.status(400).json({ error: '文件过大，请上传10MB以内的文件' });
    }

    // 检查文件类型
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    if (fileType === 'background' && !allowedImageExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: '背景图片仅支持JPG, JPEG, PNG, WEBP和GIF格式' });
    }

    // 保存文件到存储
    const result = await saveFileToStorage(
      userId,
      req.file.buffer,
      req.file.originalname,
      fileType
    );

    // 生成缓存破坏参数
    const timestamp = Date.now();
    const version = timestamp.toString(36); // 简短的版本标识
    const urlWithCacheBuster = `${result.publicUrl}?v=${version}`;

    // 成功上传响应
    res.json({
      success: true,
      fileId: result.fileId,
      url: urlWithCacheBuster,
      originalUrl: result.publicUrl,
      timestamp,
      version
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
    // 从会话或查询参数中获取用户ID
    const userId = req.session.userId || Number(req.query.userId);
    if (!userId) {
      console.error('获取文件列表失败: 未提供有效的用户ID');
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
 * 增强版: 支持缓存控制和实时更新
 */
router.get('/background', async (req: Request, res: Response) => {
  try {
    // 从请求参数或会话中获取用户ID
    // 重要：用户只能查询自己的背景图片，除非是管理员
    const sessionUserId = req.session.userId;
    const queryUserId = Number(req.query.userId);
    
    // 获取客户端请求的ETag (如果有)
    const ifNoneMatch = req.headers['if-none-match'];
    
    // 根据设备方向选择背景图片，而不是设备类型
    const userAgent = req.headers['user-agent'] || '';
    
    // 从查询参数中获取屏幕方向，如果没有则尝试通过User-Agent推断
    const isPortrait = Boolean(
      req.query.orientation === 'portrait' || // 通过查询参数明确指定方向
      (userAgent.match(/iPhone/i) && !req.query.orientation) // iPhone默认假设为竖屏，除非明确指定
    );
    
    // 验证权限：用户只能访问自己的背景图片或默认背景
    if (queryUserId && queryUserId !== sessionUserId && sessionUserId) {
      console.log(`用户 ${sessionUserId} 尝试查看用户 ${queryUserId} 的背景图片 - 拒绝访问，返回默认背景`);
      const defaultUrl = getDefaultBackgroundUrl(isPortrait);
      return res.json({ url: defaultUrl });
    }
    
    // 使用会话ID或查询ID（如果与会话ID匹配）
    const userId = sessionUserId || (queryUserId === sessionUserId ? queryUserId : null);
    
    console.log(`屏幕方向: ${isPortrait ? '竖屏' : '横屏'}, User-Agent: ${userAgent.substring(0, 50)}...`);
    
    // 如果无法获取用户ID，返回默认背景
    if (!userId) {
      const defaultUrl = getDefaultBackgroundUrl(isPortrait);
      return res.json({ url: defaultUrl });
    }

    // 获取用户背景
    const backgroundUrl = await getUserBackground(userId, isPortrait);
    
    // 生成版本标识 (使用时间戳)
    const timestamp = Date.now();
    const version = timestamp.toString(36);
    
    // 构建带有缓存破坏参数的URL
    const cacheBuster = req.query.noCache ? timestamp : version;
    const urlWithCacheBuster = backgroundUrl.includes('?') 
      ? `${backgroundUrl}&v=${cacheBuster}` 
      : `${backgroundUrl}?v=${cacheBuster}`;
    
    // 生成新的ETag
    const newETag = etag(`${userId}-${backgroundUrl}-${version}`);
    
    // 如果客户端发送了If-None-Match头，并且ETag匹配，返回304 Not Modified
    if (ifNoneMatch && ifNoneMatch === newETag) {
      return res.status(304).end();
    }
    
    // 设置缓存控制头
    res.setHeader('ETag', newETag);
    res.setHeader('Cache-Control', 'max-age=60, must-revalidate'); // 缓存1分钟
    
    // 返回背景URL和版本信息
    res.json({ 
      url: urlWithCacheBuster,
      originalUrl: backgroundUrl,
      timestamp,
      version
    });
  } catch (error) {
    console.error('获取背景图片失败:', error);
    // 出错时也返回默认背景，确保前端始终有图片可用
    res.json({ url: '/backgrounds/default-background.jpg' });
  }
});

/**
 * 获取用户文件
 * 增强版: 支持缓存控制、ETag和条件请求
 */
router.get('/:userId/:fileType/:fileId', async (req: Request, res: Response) => {
  try {
    const { userId, fileType, fileId } = req.params;
    const userIdNum = parseInt(userId);
    
    // 获取客户端缓存控制请求头
    const ifNoneMatch = req.headers['if-none-match'];
    const ifModifiedSince = req.headers['if-modified-since'];
    
    // 两种方式获取用户ID：会话或查询参数
    const sessionUserId = req.session.userId;
    const queryUserId = Number(req.query.userId);
    
    // 安全检查：验证用户访问权限
    const isAuthenticated = !!sessionUserId; // 用户是否已登录
    const isAuthorizedViaQuery = queryUserId === userIdNum; // 通过查询参数是否匹配请求的用户ID
    const isOwner = sessionUserId === userIdNum; // 是否是文件所有者
    const isAdmin = false; // 简化权限模型，暂不使用管理员特权
    
    // 访问控制逻辑（改进版）:
    // 1. 公共文件(public): 所有人可访问
    // 2. 背景图片(background): 可通过会话或查询参数授权访问
    // 3. 其他文件: 只有所有者和管理员可以访问
    
    // 记录访问尝试
    console.log(`文件访问尝试: ${fileType}/${fileId}, 会话ID=${sessionUserId}, 查询ID=${queryUserId}, 目标ID=${userIdNum}`);
    
    // 特殊处理背景图片访问权限
    if (fileType === 'background') {
      // 背景图片可以通过查询参数或会话ID来授权，但仅限自己的背景图片
      if (isOwner || isAdmin || (isAuthenticated && isAuthorizedViaQuery)) {
        // 授权访问
        console.log(`背景图片访问授权通过: ${fileType}/${fileId}`);
      } else {
        console.log(`背景图片访问拒绝: 会话ID=${sessionUserId}, 查询ID=${queryUserId}, 目标ID=${userIdNum}`);
        
        // 当无权访问其他用户背景图片时，返回对应方向的默认背景图片，而不是401错误
        const userAgent = req.headers['user-agent'] || '';
        const isPortrait = Boolean(
          req.query.orientation === 'portrait' || 
          (userAgent.match(/iPhone/i) && !req.query.orientation)
        );
        
        const defaultBgPath = getDefaultBackgroundPath(isPortrait);
        if (fs.existsSync(defaultBgPath)) {
          const defaultData = fs.readFileSync(defaultBgPath);
          const ext = path.extname(defaultBgPath).substring(1);
          res.contentType(`image/${ext}`);
          res.setHeader('Cache-Control', 'max-age=86400'); // 24小时
          res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
          
          console.log(`返回默认${isPortrait ? '竖屏' : '横屏'}背景图片`);
          return res.send(defaultData);
        }
        
        return res.status(401).json({ error: '未授权访问背景图片' });
      }
    }
    // 其他非公共文件的访问控制
    else if (fileType !== 'public') {
      if (!isAuthenticated || (!isOwner && !isAdmin)) {
        console.log(`文件访问权限拒绝: 用户 ${sessionUserId || '未登录'} 尝试访问用户 ${userIdNum} 的 ${fileType} 文件`);
        return res.status(401).json({ error: '未授权访问文件' });
      }
    }

    // 从ID中提取真实的文件ID (去掉扩展名)
    const realFileId = path.parse(fileId).name;
    
    // 查询数据库获取文件记录，获取更多元数据
    const fileRecord = await db.query.userFiles.findFirst({
      where: eq(userFiles.fileId, realFileId)
    });
    
    // 确保文件记录存在并有创建时间
    if (fileRecord && !fileRecord.createdAt) {
      // 如果没有创建时间，设置为当前时间
      fileRecord.createdAt = new Date();
    }
    
    // 获取文件数据
    const fileData = await getFileFromStorage(userIdNum, realFileId);
    
    // 根据屏幕方向而非设备类型选择背景图片
    const userAgent = req.headers['user-agent'] || '';
    const isPortrait = Boolean(
      req.query.orientation === 'portrait' || 
      (userAgent.match(/iPhone/i) && !req.query.orientation) // iPhone默认假设为竖屏，除非明确指定
    );
    
    if (!fileData || !fileRecord) {
      // 如果是背景请求且找不到文件，返回默认背景
      if (fileType === 'background') {
        const defaultBgPath = getDefaultBackgroundPath(isPortrait);
        if (fs.existsSync(defaultBgPath)) {
          const defaultData = fs.readFileSync(defaultBgPath);
          const ext = path.extname(defaultBgPath).substring(1);
          res.contentType(`image/${ext}`);
          
          // 设置缓存控制头 - 默认背景可以缓存更长时间
          res.setHeader('Cache-Control', 'max-age=86400'); // 24小时
          res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
          
          return res.send(defaultData);
        }
      }
      return res.status(404).json({ error: '文件不存在' });
    }
    
    // 生成ETag (基于文件ID和创建时间)
    const createdTime = fileRecord.createdAt ? fileRecord.createdAt.getTime() : Date.now();
    const fileETag = etag(`${fileRecord.fileId}-${createdTime}`);
    
    // 设置缓存控制头
    if (fileType === 'background') {
      // 背景图片缓存时间较短，因为可能被频繁更改
      res.setHeader('Cache-Control', 'max-age=300, must-revalidate'); // 5分钟
    } else {
      // 其他类型文件可以缓存更长时间
      res.setHeader('Cache-Control', 'max-age=86400'); // 24小时
    }
    
    res.setHeader('ETag', fileETag);
    
    // 设置最后修改时间
    const lastModified = fileRecord.createdAt || new Date();
    res.setHeader('Last-Modified', lastModified.toUTCString());
    
    // 支持条件请求 - 如果文件未修改，返回304
    if (
      (ifNoneMatch && ifNoneMatch === fileETag) || 
      (ifModifiedSince && new Date(ifModifiedSince) >= lastModified)
    ) {
      return res.status(304).end();
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
    
    // 设置内容长度和过期时间
    res.setHeader('Content-Length', fileData.length);
    res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
    
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
    // 从会话或请求参数中获取用户ID
    const userId = req.session.userId || Number(req.query.userId);
    if (!userId) {
      console.error('删除文件失败: 未提供有效的用户ID');
      return res.status(401).json({ error: '未授权' });
    }

    const { fileId } = req.params;
    const success = await deleteFileFromStorage(userId, fileId);
    
    if (!success) {
      return res.status(404).json({ error: '文件不存在或无权限删除' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除文件失败:', error);
    res.status(500).json({ error: '删除文件失败' });
  }
});

/**
 * 迁移文件到对象存储
 * 管理员功能
 */
router.post('/migrate', requireAdmin, async (req: Request, res: Response) => {
  try {
    // 管理员验证由requireAdmin中间件完成
    
    // 获取要迁移的特定用户ID (可选)
    const targetUserId = req.body.userId ? Number(req.body.userId) : undefined;
    
    // 开始迁移
    const result = await migrateToObjectStorage(targetUserId);
    
    res.json({
      success: true,
      message: targetUserId 
        ? `已完成用户${targetUserId}的文件迁移` 
        : '已完成所有用户的文件迁移',
      stats: result
    });
  } catch (error) {
    console.error('迁移文件失败:', error);
    res.status(500).json({ error: '迁移文件失败' });
  }
});

/**
 * 迁移文件到对象存储 (GET版本，更易于直接调用)
 * 开发环境使用
 */
router.get('/migrate-to-object-storage', requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log(`开始文件迁移，请求来自: ${req.ip}`);
    
    // 获取要迁移的特定用户ID (可选)
    const targetUserId = req.query.userId ? Number(req.query.userId) : undefined;
    
    // 开始迁移
    const result = await migrateToObjectStorage(targetUserId);
    
    // 返回迁移结果
    res.json({
      success: true,
      message: targetUserId 
        ? `已完成用户${targetUserId}的文件迁移` 
        : '已完成所有用户的文件迁移',
      stats: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('迁移文件失败:', error);
    res.status(500).json({ 
      error: '迁移文件失败', 
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 测试文件存储模式 (仅用于开发环境)
 */
router.get('/storage-test', requireAdmin, async (req: Request, res: Response) => {
  try {
    // 获取查询参数
    const fileType = (req.query.type as string) || 'background';
    const testMode = req.query.mode as string;
    
    // 获取用户ID
    const userId = req.session.userId || Number(req.query.userId) || 3;
    
    if (testMode === 'migrate') {
      // 手动迁移指定用户的文件记录
      await db.update(userFiles)
        .set({ storageType: 'object-storage' as "file-system" | "object-storage" })
        .where(eq(userFiles.userId, userId));
      
      const updatedFiles = await db.query.userFiles.findMany({
        where: eq(userFiles.userId, userId)
      });
      
      return res.json({ 
        success: true, 
        message: `已将用户 ${userId} 的 ${updatedFiles.length} 个文件记录标记为对象存储`,
        files: updatedFiles
      });
    }
    
    // 获取当前存储模式
    const files = await db.query.userFiles.findMany({
      where: eq(userFiles.userId, userId)
    });
    
    // 返回测试结果
    res.json({
      success: true,
      storageMode: 'hybrid',
      activeStorage: process.env.AUTO_MIGRATE_FILES === 'true' ? '对象存储' : '文件系统',
      filesCount: files.length,
      files
    });
  } catch (error) {
    console.error('存储测试失败:', error);
    res.status(500).json({ error: '存储测试失败' });
  }
});

/**
 * 管理默认背景图片 (仅管理员可用)
 * 增强版: 支持横屏和竖屏背景的单独设置
 */
router.post('/admin/default-background', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未提供文件' });
    }

    // 检查文件类型
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    
    if (!allowedImageExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: '背景图片仅支持JPG, JPEG, PNG, WEBP和GIF格式' });
    }

    // 获取背景类型 (横屏或竖屏)
    const backgroundType = req.body.type || 'landscape'; // 默认横屏
    
    if (backgroundType !== 'landscape' && backgroundType !== 'portrait') {
      return res.status(400).json({ error: '背景类型必须是 landscape 或 portrait' });
    }

    // 确保背景目录存在
    const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');
    if (!fs.existsSync(backgroundsDir)) {
      fs.mkdirSync(backgroundsDir, { recursive: true });
    }

    // 根据类型决定文件名
    const fileName = backgroundType === 'portrait' 
      ? 'portrait-background.jpg' 
      : 'landscape-background.jpg';

    // 备份现有文件 (如果存在)
    const filePath = path.join(backgroundsDir, fileName);
    const backupPath = path.join(backgroundsDir, `${fileName}.backup-${Date.now()}`);
    
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`已备份现有${backgroundType === 'portrait' ? '竖屏' : '横屏'}背景到: ${backupPath}`);
    }

    // 处理并保存新背景
    try {
      // 使用sharp处理图像
      await sharp(req.file.buffer)
        .resize({
          width: backgroundType === 'portrait' ? 1080 : 1920,
          height: backgroundType === 'portrait' ? 1920 : 1080,
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toFile(filePath);
        
      console.log(`已更新${backgroundType === 'portrait' ? '竖屏' : '横屏'}默认背景图片`);
      
      // 创建兼容性链接 (向后兼容原有代码)
      if (backgroundType === 'portrait') {
        const compatPath = path.join(backgroundsDir, 'mobile-background.jpg');
        if (fs.existsSync(compatPath)) {
          fs.unlinkSync(compatPath);
        }
        fs.copyFileSync(filePath, compatPath);
      } else {
        const compatPath = path.join(backgroundsDir, 'default-background.jpg');
        if (fs.existsSync(compatPath)) {
          fs.unlinkSync(compatPath);
        }
        fs.copyFileSync(filePath, compatPath);
      }
      
    } catch (error) {
      console.error('图像处理失败:', error);
      // 如果处理失败，直接保存原始文件
      fs.writeFileSync(filePath, req.file.buffer);
    }

    // 获取公共URL
    const publicUrl = backgroundType === 'portrait'
      ? '/backgrounds/portrait-background.jpg'
      : '/backgrounds/landscape-background.jpg';

    // 生成缓存破坏参数
    const timestamp = Date.now();
    const version = timestamp.toString(36);
    const urlWithCacheBuster = `${publicUrl}?v=${version}`;

    // 成功上传响应
    res.json({
      success: true,
      type: backgroundType,
      url: urlWithCacheBuster,
      originalUrl: publicUrl,
      timestamp,
      version
    });
  } catch (error) {
    console.error('更新默认背景图片失败:', error);
    res.status(500).json({ error: '更新默认背景图片失败' });
  }
});

/**
 * 获取默认背景图片信息 (管理员功能)
 */
router.get('/admin/default-background', requireAdmin, async (req: Request, res: Response) => {
  try {
    const backgroundsDir = path.join(process.cwd(), 'public', 'backgrounds');
    
    // 获取横屏背景信息
    const landscapePath = path.join(backgroundsDir, 'landscape-background.jpg');
    const landscapeInfo = fs.existsSync(landscapePath) ? {
      exists: true,
      url: '/backgrounds/landscape-background.jpg',
      size: fs.statSync(landscapePath).size,
      modifiedAt: fs.statSync(landscapePath).mtime
    } : { exists: false };
    
    // 获取竖屏背景信息
    const portraitPath = path.join(backgroundsDir, 'portrait-background.jpg');
    const portraitInfo = fs.existsSync(portraitPath) ? {
      exists: true,
      url: '/backgrounds/portrait-background.jpg',
      size: fs.statSync(portraitPath).size,
      modifiedAt: fs.statSync(portraitPath).mtime
    } : { exists: false };
    
    // 返回背景信息
    res.json({
      landscape: landscapeInfo,
      portrait: portraitInfo
    });
  } catch (error) {
    console.error('获取默认背景图片信息失败:', error);
    res.status(500).json({ error: '获取默认背景图片信息失败' });
  }
});

export default router;