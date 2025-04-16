/**
 * 文件存储桶服务
 * 用于管理用户上传的文件，如背景图片等
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { userFiles } from '../../shared/schema';

// 存储桶根目录
const BUCKET_ROOT = path.join(process.cwd(), 'uploads');
// 默认背景图片目录
const DEFAULT_BACKGROUNDS_DIR = path.join(process.cwd(), 'public', 'backgrounds');

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
      const defaultBgSource = path.join(assetsDir, 'IMG_9907.jpeg');
      const defaultBgDest = path.join(DEFAULT_BACKGROUNDS_DIR, 'default-background.jpg');
      
      if (fs.existsSync(defaultBgSource) && !fs.existsSync(defaultBgDest)) {
        fs.copyFileSync(defaultBgSource, defaultBgDest);
        console.log('默认背景图片已复制到公共目录');
      }
    }
  } catch (error) {
    console.error('复制默认背景图片时出错:', error);
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
): Promise<{ fileId: string; filePath: string; publicUrl: string }> {
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
  
  // 保存文件
  fs.writeFileSync(filePath, fileBuffer);
  
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
  });
  
  return { fileId, filePath, publicUrl };
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
 * 获取默认背景图片
 */
export function getDefaultBackgroundPath(): string {
  return path.join(DEFAULT_BACKGROUNDS_DIR, 'default-background.jpg');
}

/**
 * 获取默认背景图片URL
 */
export function getDefaultBackgroundUrl(): string {
  return '/backgrounds/default-background.jpg';
}

/**
 * 获取用户当前背景图片
 * @param userId 用户ID
 */
export async function getUserBackground(userId: number): Promise<string> {
  const backgrounds = await getUserFiles(userId, 'background');
  
  if (backgrounds && backgrounds.length > 0) {
    // 返回最新的背景图片
    return backgrounds[0].publicUrl;
  }
  
  // 默认背景
  return getDefaultBackgroundUrl();
}