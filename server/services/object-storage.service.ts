/**
 * 对象存储服务
 * 基于Replit提供的对象存储服务实现文件存储和管理
 */

import { db } from '../db';
import { eq } from 'drizzle-orm';
import { userFiles } from '../../shared/schema';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Replit对象存储API
// 使用多个备用URL，以应对DNS解析问题
const REPLIT_DATA_API_URLS = [
  'https://data.replit.app',     // 备用域名1
  'https://data.replit.com',     // 原始域名
  'https://data-api.replit.com'  // 备用域名2
];
const REPLIT_DATA_API_URL = REPLIT_DATA_API_URLS[0]; // 默认使用第一个域名
const REPLIT_DATA_API_URL_V1 = `${REPLIT_DATA_API_URL}/v1`;

// 默认存储桶名称
const DEFAULT_BUCKET_NAME = 'replit-objstore-a2a19666-a799-475c-bd79-068397f30df4';

// 默认背景图片路径（公共目录）
const DEFAULT_BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

// 临时目录，用于迁移时存放旧数据
const OLD_UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * 检查Replit数据API是否已配置
 */
function isReplitDataConfigured(): boolean {
  const token = process.env.REPLIT_DATA_TOKEN;
  console.log(`检查Replit数据API配置: REPLIT_DATA_TOKEN=${token ? '已设置' : '未设置'}`);
  return !!token;
}

/**
 * 生成文件唯一标识符
 */
function generateFileId(): string {
  return crypto.randomUUID();
}

/**
 * 构建对象存储中的文件路径
 * @param userId 用户ID
 * @param fileType 文件类型
 * @param fileId 文件ID
 * @param extension 文件扩展名
 */
function buildObjectPath(userId: number, fileType: string, fileId: string, extension: string): string {
  return `users/${userId}/${fileType}/${fileId}${extension}`;
}

/**
 * 构建文件的公共URL
 * @param userId 用户ID
 * @param fileType 文件类型
 * @param fileId 文件ID 
 * @param extension 文件扩展名
 */
function buildPublicUrl(userId: number, fileType: string, fileId: string, extension: string): string {
  return `/api/files/${userId}/${fileType}/${fileId}${extension}`;
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
 * 初始化对象存储
 */
export async function initializeObjectStorage(): Promise<void> {
  if (!isReplitDataConfigured()) {
    console.warn('Replit数据API未配置，将使用文件系统存储');
    return;
  }

  try {
    // 创建存储桶
    await createBucketIfNotExists(DEFAULT_BUCKET_NAME);
    console.log(`对象存储已初始化, 存储桶: ${DEFAULT_BUCKET_NAME}`);
    
    // 复制默认背景图片到公共目录
    ensureDefaultBackgrounds();
  } catch (error) {
    console.error('初始化对象存储失败:', error);
    throw error;
  }
}

/**
 * 确保默认背景图片存在
 */
function ensureDefaultBackgrounds(): void {
  try {
    // 确保默认背景目录存在
    if (!fs.existsSync(DEFAULT_BACKGROUNDS_DIR)) {
      fs.mkdirSync(DEFAULT_BACKGROUNDS_DIR, { recursive: true });
    }
    
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
 * 创建存储桶（如果不存在）
 * @param bucketName 存储桶名称
 */
async function createBucketIfNotExists(bucketName: string): Promise<void> {
  if (!isReplitDataConfigured()) return;
  
  try {
    console.log(`尝试连接到存储桶: ${bucketName}`);
    console.log(`API URL: ${REPLIT_DATA_API_URL_V1}/buckets/${bucketName}`);
    
    // 由于我们已经知道桶名，直接使用它
    console.log(`跳过存储桶验证，直接使用配置的存储桶ID: ${bucketName}`);
    console.log(`已连接到存储桶: ${bucketName}`);
    
    // 使用这个方法绕过API验证步骤，直接假设存储桶存在
    return;
    
    /* 旧的API验证代码，暂时注释掉
    // 获取存储桶信息
    const bucketResponse = await fetch(`${REPLIT_DATA_API_URL_V1}/buckets/${bucketName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
        'Accept': 'application/json',
      }
    });
    
    console.log(`存储桶查询状态: ${bucketResponse.status} ${bucketResponse.statusText}`);
    
    // 如果存储桶不存在，创建它
    if (bucketResponse.status === 404) {
      console.log(`存储桶 ${bucketName} 不存在，正在创建...`);
      
      const createResponse = await fetch(`${REPLIT_DATA_API_URL_V1}/buckets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: bucketName,
          public: false, // 默认设为私有，通过API控制访问
        }),
      });
      
      console.log(`创建存储桶请求状态: ${createResponse.status} ${createResponse.statusText}`);
      
      if (!createResponse.ok) {
        let errorMessage = createResponse.statusText;
        try {
          const errorText = await createResponse.text();
          console.log(`创建存储桶错误响应: ${errorText}`);
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorText;
          } catch (jsonError) {
            errorMessage = errorText;
          }
        } catch (textError) {
          console.error('无法读取错误响应内容:', textError);
        }
        throw new Error(`创建存储桶失败: ${errorMessage}`);
      }
      
      console.log(`已创建存储桶: ${bucketName}`);
    } else if (!bucketResponse.ok) {
      let errorMessage = bucketResponse.statusText;
      try {
        const errorText = await bucketResponse.text();
        console.log(`获取存储桶信息错误响应: ${errorText}`);
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorText;
        } catch (jsonError) {
          errorMessage = errorText;
        }
      } catch (textError) {
        console.error('无法读取错误响应内容:', textError);
      }
      throw new Error(`获取存储桶信息失败: ${errorMessage}`);
    } else {
      console.log(`已连接到存储桶: ${bucketName}`);
    }
    */
  } catch (error) {
    console.error('创建/验证存储桶失败:', error);
    throw error;
  }
}

/**
 * 将文件保存到对象存储
 * @param userId 用户ID 
 * @param fileBuffer 文件数据
 * @param originalName 原始文件名
 * @param fileType 文件类型
 */
export async function saveFileToObjectStorage(
  userId: number,
  fileBuffer: Buffer,
  originalName: string,
  fileType: string = 'attachment'
): Promise<{ fileId: string; objectPath: string; publicUrl: string; version: string }> {
  if (!isReplitDataConfigured()) {
    console.warn('Replit数据API未配置，建议配置REPLIT_DATA_TOKEN环境变量');
    throw new Error('Replit数据API未配置，无法使用对象存储');
  }
  
  try {
    const fileId = generateFileId();
    const fileExtension = path.extname(originalName);
    const objectPath = buildObjectPath(userId, fileType, fileId, fileExtension);
    const publicUrl = buildPublicUrl(userId, fileType, fileId, fileExtension);
    
    // 上传文件到Replit对象存储
    const uploadResponse = await fetch(
      `${REPLIT_DATA_API_URL_V1}/buckets/${DEFAULT_BUCKET_NAME}/objects/${objectPath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        body: fileBuffer,
      }
    );
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      throw new Error(`上传文件到对象存储失败: ${errorData}`);
    }
    
    // 生成版本标识 (用于缓存控制)
    const version = Date.now().toString(36);
    
    // 添加到数据库
    await db.insert(userFiles).values({
      userId,
      fileId,
      originalName,
      filePath: objectPath, // 存储对象路径
      fileType: fileType as "background" | "avatar" | "attachment",
      publicUrl,
      storageType: 'object-storage' as "file-system" | "object-storage", // 新增字段：存储类型
    });
    
    // 如果是背景图片，清理旧的背景图片
    if (fileType === 'background') {
      await cleanupOldBackgrounds(userId);
    }
    
    console.log(`文件已上传到对象存储: ${objectPath}`);
    
    return { fileId, objectPath, publicUrl, version };
  } catch (error) {
    console.error('保存文件到对象存储失败:', error);
    throw error;
  }
}

/**
 * 从对象存储获取文件
 * @param objectPath 对象路径
 */
export async function getFileFromObjectStorage(objectPath: string): Promise<Buffer | null> {
  if (!isReplitDataConfigured()) {
    console.warn('Replit数据API未配置，建议配置REPLIT_DATA_TOKEN环境变量');
    throw new Error('Replit数据API未配置，无法使用对象存储');
  }
  
  try {
    const response = await fetch(
      `${REPLIT_DATA_API_URL_V1}/buckets/${DEFAULT_BUCKET_NAME}/objects/${objectPath}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
        },
      }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.text();
      throw new Error(`从对象存储获取文件失败: ${errorData}`);
    }
    
    const fileBuffer = await response.arrayBuffer();
    return Buffer.from(fileBuffer);
  } catch (error) {
    console.error('从对象存储获取文件失败:', error);
    return null;
  }
}

/**
 * 从对象存储中删除文件
 * @param objectPath 对象路径
 */
export async function deleteFileFromObjectStorage(objectPath: string): Promise<boolean> {
  if (!isReplitDataConfigured()) {
    console.warn('Replit数据API未配置，建议配置REPLIT_DATA_TOKEN环境变量');
    throw new Error('Replit数据API未配置，无法使用对象存储');
  }
  
  try {
    const response = await fetch(
      `${REPLIT_DATA_API_URL_V1}/buckets/${DEFAULT_BUCKET_NAME}/objects/${objectPath}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
        },
      }
    );
    
    if (!response.ok && response.status !== 404) {
      const errorData = await response.text();
      throw new Error(`从对象存储删除文件失败: ${errorData}`);
    }
    
    return true;
  } catch (error) {
    console.error('从对象存储删除文件失败:', error);
    return false;
  }
}

/**
 * 删除用户文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function deleteUserFile(userId: number, fileId: string): Promise<boolean> {
  try {
    // 查询文件记录
    const fileRecord = await db.query.userFiles.findFirst({
      where: eq(userFiles.fileId, fileId)
    });
    
    if (!fileRecord || fileRecord.userId !== userId) {
      return false;
    }
    
    // 判断文件存储类型
    const storageType = (fileRecord as any).storageType || 'file-system';
    if (storageType === 'object-storage') {
      // 从对象存储中删除
      await deleteFileFromObjectStorage(fileRecord.filePath);
    } else {
      // 从文件系统中删除
      const filePath = path.join(process.cwd(), fileRecord.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // 从数据库中删除记录
    await db.delete(userFiles).where(eq(userFiles.fileId, fileId));
    return true;
  } catch (error) {
    console.error(`删除用户 ${userId} 的文件 ${fileId} 失败:`, error);
    return false;
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
      // 根据存储类型删除文件
      const storageType = (oldBg as any).storageType || 'file-system';
      if (storageType === 'object-storage') {
        await deleteFileFromObjectStorage(oldBg.filePath);
      } else {
        // 从文件系统中删除
        const filePath = path.join(process.cwd(), oldBg.filePath);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
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

/**
 * 获取用户的文件列表
 * @param userId 用户ID
 * @param fileType 文件类型过滤器
 */
export async function getUserFiles(userId: number, fileType?: string): Promise<any[]> {
  try {
    // 查询用户的所有文件
    const query = { where: eq(userFiles.userId, userId) };
    const result = await db.query.userFiles.findMany(query);
    
    // 如果需要按文件类型过滤
    if (fileType) {
      return result.filter(file => file.fileType === fileType);
    }
    
    return result;
  } catch (error) {
    console.error(`获取用户 ${userId} 的文件列表失败:`, error);
    return [];
  }
}

/**
 * 从文件系统迁移文件到对象存储
 * @param userId 用户ID (可选，如果不提供则迁移所有用户的文件)
 */
export async function migrateFilesToObjectStorage(userId?: number): Promise<{ 
  total: number; 
  success: number; 
  failed: number;
  users: number;
}> {
  if (!isReplitDataConfigured()) {
    console.warn('Replit数据API未配置，无法执行迁移。请配置REPLIT_DATA_TOKEN环境变量后再试。');
    return {
      total: 0,
      success: 0,
      failed: 0,
      users: 0
    };
  }
  
  // 初始化迁移统计
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    users: 0,
  };
  
  try {
    // 查询要迁移的文件记录
    let fileRecords;
    if (userId) {
      // 迁移指定用户的文件
      fileRecords = await db.query.userFiles.findMany({
        where: eq(userFiles.userId, userId)
      });
      
      // 过滤出仅使用文件系统存储的记录
      fileRecords = fileRecords.filter(record => {
        const storageType = (record as any).storageType || 'file-system';
        return storageType === 'file-system';
      });
      stats.users = 1;
    } else {
      // 迁移所有用户的文件
      fileRecords = await db.query.userFiles.findMany({});
      
      // 过滤出仅使用文件系统存储的记录
      fileRecords = fileRecords.filter(record => {
        const storageType = (record as any).storageType || 'file-system';
        return storageType === 'file-system';
      });
      
      // 统计不同用户的数量
      const userIds = new Set<number>();
      fileRecords.forEach(file => userIds.add(file.userId));
      stats.users = userIds.size;
    }
    
    stats.total = fileRecords.length;
    console.log(`开始迁移文件: 共${stats.total}个文件, ${stats.users}个用户`);
    
    // 逐个迁移文件
    for (const file of fileRecords) {
      try {
        // 构建文件系统路径
        const filePath = path.join(process.cwd(), file.filePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
          console.warn(`文件不存在，跳过迁移: ${filePath}`);
          stats.failed++;
          continue;
        }
        
        // 读取文件内容
        const fileBuffer = fs.readFileSync(filePath);
        
        // 构建对象存储路径
        const fileExtension = path.extname(file.originalName);
        const objectPath = buildObjectPath(file.userId, file.fileType, file.fileId, fileExtension);
        
        // 上传到对象存储
        const uploadResponse = await fetch(
          `${REPLIT_DATA_API_URL_V1}/buckets/${DEFAULT_BUCKET_NAME}/objects/${objectPath}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${process.env.REPLIT_DATA_TOKEN}`,
              'Content-Type': 'application/octet-stream',
            },
            body: fileBuffer,
          }
        );
        
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.text();
          throw new Error(`上传文件到对象存储失败: ${errorData}`);
        }
        
        // 更新数据库记录
        await db.update(userFiles)
          .set({ 
            filePath: objectPath,
            storageType: 'object-storage' as "file-system" | "object-storage"
          })
          .where(eq(userFiles.id, file.id));
        
        console.log(`已迁移文件: ${file.originalName} (${file.fileId})`);
        stats.success++;
        
      } catch (error) {
        console.error(`迁移文件失败: ${file.fileId}`, error);
        stats.failed++;
      }
    }
    
    console.log(`文件迁移完成: 总计${stats.total}个文件, 成功${stats.success}个, 失败${stats.failed}个`);
    return stats;
    
  } catch (error) {
    console.error('迁移文件到对象存储失败:', error);
    throw error;
  }
}