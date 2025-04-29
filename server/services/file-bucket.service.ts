/**
 * 文件存储桶服务
 * 用于管理用户上传的文件，如背景图片等
 * 增强版: 支持图片处理、压缩和缓存优化
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { userFiles } from '../../shared/schema';
import sharp from 'sharp';
import etag from 'etag';

// 存储桶根目录
const BUCKET_ROOT = path.join(process.cwd(), 'uploads');
// 默认背景图片目录
const DEFAULT_BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');
// 图像处理配置
const IMAGE_PROCESS_CONFIG = {
  background: {
    quality: 85,
    maxWidth: 1920,
    maxHeight: 1080
  },
  avatar: {
    quality: 90,
    maxWidth: 500,
    maxHeight: 500
  }
};

/**
 * 确保存储目录存在
 */
function ensureDirectoryExists(directory: string): void {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * 初始化存储桶
 */
export async function initializeBucket(): Promise<void> {
  ensureDirectoryExists(BUCKET_ROOT);
  ensureDirectoryExists(DEFAULT_BACKGROUNDS_DIR);
  
  // 复制默认背景图片到公共目录
  try {
    const assetsDir = path.join(process.cwd(), 'attached_assets');
    if (fs.existsSync(assetsDir)) {
      // 横屏默认背景 (原桌面端背景)
      const landscapeBgSource = path.join(assetsDir, 'IMG_9907.jpeg');
      const landscapeBgDest = path.join(DEFAULT_BACKGROUNDS_DIR, 'landscape-background.jpg');
      
      // 竖屏默认背景 (原移动端背景)
      const portraitBgSource = path.join(assetsDir, 'IMG_9918.jpeg');
      const portraitBgDest = path.join(DEFAULT_BACKGROUNDS_DIR, 'portrait-background.jpg');
      
      // 创建兼容性链接 (向后兼容原有代码)
      const oldLandscapeBgDest = path.join(DEFAULT_BACKGROUNDS_DIR, 'default-background.jpg');
      const oldPortraitBgDest = path.join(DEFAULT_BACKGROUNDS_DIR, 'mobile-background.jpg');
      
      // 复制横屏默认背景
      if (fs.existsSync(landscapeBgSource) && !fs.existsSync(landscapeBgDest)) {
        fs.copyFileSync(landscapeBgSource, landscapeBgDest);
        // 同时创建旧名称的副本以保持兼容性
        if (!fs.existsSync(oldLandscapeBgDest)) {
          fs.copyFileSync(landscapeBgSource, oldLandscapeBgDest);
        }
        console.log('横屏默认背景图片已复制到公共目录');
      }
      
      // 复制竖屏默认背景
      if (fs.existsSync(portraitBgSource) && !fs.existsSync(portraitBgDest)) {
        fs.copyFileSync(portraitBgSource, portraitBgDest);
        // 同时创建旧名称的副本以保持兼容性
        if (!fs.existsSync(oldPortraitBgDest)) {
          fs.copyFileSync(portraitBgSource, oldPortraitBgDest);
        }
        console.log('竖屏默认背景图片已复制到公共目录');
      }
    }
  } catch (error) {
    console.error('复制默认背景图片时出错:', error);
  }
}

/**
 * 清理用户旧的背景图片
 * @param userId 用户ID
 */
export async function cleanupOldBackgrounds(userId: number): Promise<number> {
  try {
    // 查询用户的所有背景图片，按创建时间降序排序
    const backgrounds = await db.query.userFiles.findMany({
      where: (userFiles) => {
        return eq(userFiles.userId, userId) && eq(userFiles.fileType, 'background');
      },
      orderBy: (userFiles, { desc }) => [desc(userFiles.createdAt)],
    });
    
    // 如果只有一张或没有背景图片，不需要清理
    if (backgrounds.length <= 1) {
      return 0;
    }
    
    // 保留最新的背景图片，删除其余的
    let deletedCount = 0;
    for (let i = 1; i < backgrounds.length; i++) {
      const oldBg = backgrounds[i];
      // 删除文件
      const filePath = path.join(process.cwd(), oldBg.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // 从数据库中删除记录
      await db.delete(userFiles).where(eq(userFiles.id, oldBg.id));
      deletedCount++;
    }
    
    console.log(`已清理用户 ${userId} 的 ${deletedCount} 张旧背景图片`);
    return deletedCount;
  } catch (error) {
    console.error(`清理用户 ${userId} 旧背景图片时出错:`, error);
    return 0;
  }
}

/**
 * 处理和优化图像文件
 * @param fileBuffer 原始文件缓冲区
 * @param filePath 保存路径
 * @param fileType 文件类型，用于应用不同的优化配置
 * @param fileExtension 文件扩展名
 */
async function processImageFile(
  fileBuffer: Buffer, 
  filePath: string, 
  fileType: string,
  fileExtension: string
): Promise<void> {
  try {
    // 检查文件是否为支持的图像格式
    const supportedImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const isImage = supportedImageExts.includes(fileExtension.toLowerCase());
    
    if (!isImage) {
      // 不是图像，直接保存
      fs.writeFileSync(filePath, fileBuffer);
      return;
    }
    
    // 选择合适的处理配置
    const config = IMAGE_PROCESS_CONFIG[fileType as keyof typeof IMAGE_PROCESS_CONFIG] || {
      quality: 80,
      maxWidth: 1200,
      maxHeight: 1200
    };
    
    // 创建图像处理器
    let imageProcessor = sharp(fileBuffer);
    
    // 确保图像方向正确
    imageProcessor = imageProcessor.rotate();
    
    // 调整图像大小，保持宽高比
    if (config.maxWidth || config.maxHeight) {
      imageProcessor = imageProcessor.resize({
        width: config.maxWidth,
        height: config.maxHeight,
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // 根据文件类型设置输出格式和质量
    const ext = fileExtension.toLowerCase();
    
    if (ext === '.jpg' || ext === '.jpeg') {
      await imageProcessor.jpeg({ quality: config.quality }).toFile(filePath);
    } else if (ext === '.png') {
      await imageProcessor.png({ compressionLevel: 9 }).toFile(filePath);
    } else if (ext === '.webp') {
      await imageProcessor.webp({ quality: config.quality }).toFile(filePath);
    } else if (ext === '.gif') {
      // GIF文件直接保存，保留动画
      fs.writeFileSync(filePath, fileBuffer);
    } else {
      // 未知格式，直接保存
      fs.writeFileSync(filePath, fileBuffer);
    }
    
    console.log(`图片 ${path.basename(filePath)} 已处理并优化`);
  } catch (error) {
    console.error(`图片处理失败: ${error}`);
    // 处理失败时，回退到直接保存原始文件
    fs.writeFileSync(filePath, fileBuffer);
  }
}

/**
 * 保存文件到存储桶
 * @param userId 用户ID
 * @param fileBuffer 文件数据
 * @param originalName 原始文件名
 * @param fileType 文件类型 (例如 'background', 'avatar')
 */
export async function saveFileToBucket(
  userId: number, 
  fileBuffer: Buffer, 
  originalName: string,
  fileType: string = 'attachment'
): Promise<{ fileId: string; filePath: string; publicUrl: string; fileVersion: string }> {
  try {
    // 为用户创建目录
    const userDir = path.join(BUCKET_ROOT, userId.toString());
    ensureDirectoryExists(userDir);
    
    // 创建文件类型子目录
    const typeDir = path.join(userDir, fileType);
    ensureDirectoryExists(typeDir);
    
    // 生成唯一文件名
    const fileExtension = path.extname(originalName);
    const fileId = uuidv4();
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(typeDir, fileName);
    
    // 为文件生成版本标识符（用于缓存控制）
    const fileVersion = Date.now().toString(36);
    
    // 处理并保存文件
    await processImageFile(fileBuffer, filePath, fileType, fileExtension);
    
    // 计算公共URL
    const relativePath = path.relative(process.cwd(), filePath);
    const publicUrl = `/api/files/${userId}/${fileType}/${fileName}`;
    
    // 添加到数据库
    await db.insert(userFiles).values({
      userId,
      fileId,
      originalName,
      filePath: relativePath,
      fileType: fileType as "background" | "avatar" | "attachment",
      publicUrl,
      storageType: 'file-system' as "file-system" | "object-storage", // 明确指定为文件系统存储
    });
    
    // 如果是背景图片，清理旧的背景图片
    if (fileType === 'background') {
      await cleanupOldBackgrounds(userId);
      
      // 记录日志
      console.log(`用户 ${userId} 上传了新背景图片: ${fileId}`);
    }
    
    return { fileId, filePath, publicUrl, fileVersion };
  } catch (error) {
    console.error(`保存文件到存储桶失败: ${error}`);
    throw error;
  }
}

/**
 * 从存储桶获取文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function getFileFromBucket(userId: number, fileId: string): Promise<Buffer | null> {
  const fileRecord = await db.query.userFiles.findFirst({
    where: eq(userFiles.fileId, fileId)
  });
  
  if (!fileRecord || fileRecord.userId !== userId) {
    return null;
  }
  
  const filePath = path.join(process.cwd(), fileRecord.filePath);
  
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }
  
  return null;
}

/**
 * 获取用户的文件列表
 * @param userId 用户ID
 * @param fileType 文件类型过滤器
 */
export async function getUserFiles(userId: number, fileType?: string): Promise<any[]> {
  const query = { where: eq(userFiles.userId, userId) };
  const result = await db.query.userFiles.findMany(query);
  
  if (fileType) {
    // 使用JavaScript filter而不是SQL过滤
    return result.filter(file => file.fileType === fileType);
  } else {
    return result;
  }
}

/**
 * 删除存储桶中的文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function deleteFileFromBucket(userId: number, fileId: string): Promise<boolean> {
  const fileRecord = await db.query.userFiles.findFirst({
    where: eq(userFiles.fileId, fileId)
  });
  
  if (!fileRecord || fileRecord.userId !== userId) {
    return false;
  }
  
  const filePath = path.join(process.cwd(), fileRecord.filePath);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  await db.delete(userFiles).where(eq(userFiles.fileId, fileId));
  return true;
}

/**
 * 获取默认背景图片路径
 * @param isPortrait 是否为竖屏设备/竖屏方向
 */
export function getDefaultBackgroundPath(isPortrait: boolean = false): string {
  return isPortrait 
    ? path.join(DEFAULT_BACKGROUNDS_DIR, 'portrait-background.jpg')  // 竖屏背景
    : path.join(DEFAULT_BACKGROUNDS_DIR, 'landscape-background.jpg'); // 横屏背景
}

/**
 * 获取默认背景图片URL
 * @param isPortrait 是否为竖屏设备/竖屏方向
 */
export function getDefaultBackgroundUrl(isPortrait: boolean = false): string {
  return isPortrait
    ? '/backgrounds/portrait-background.jpg'  // 竖屏背景
    : '/backgrounds/landscape-background.jpg'; // 横屏背景
}

/**
 * 获取用户当前背景图片
 * @param userId 用户ID
 * @param isPortrait 是否为竖屏方向
 */
export async function getUserBackground(userId: number, isPortrait: boolean = false): Promise<string> {
  try {
    // 直接从数据库查询最新的背景图片
    const result = await db.query.userFiles.findMany({
      where: (userFiles) => {
        return eq(userFiles.userId, userId) && eq(userFiles.fileType, 'background');
      },
      orderBy: (userFiles, { desc }) => [desc(userFiles.createdAt)],
      limit: 1
    });
    
    if (result && result.length > 0) {
      console.log(`用户 ${userId} 的最新背景图片: ${result[0].fileId}, 创建时间: ${result[0].createdAt}`);
      return result[0].publicUrl;
    }
  } catch (error) {
    console.error(`获取用户 ${userId} 背景图片时出错:`, error);
  }
  
  // 如果没有找到背景或出错，返回默认背景
  return getDefaultBackgroundUrl(isPortrait);
}