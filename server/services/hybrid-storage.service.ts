/**
 * 混合存储服务
 * 支持同时使用文件系统和对象存储，进行平滑迁移
 */

import {
  saveFileToBucket,
  getFileFromBucket,
  getUserFiles as getFilesFromBucket,
  deleteFileFromBucket,
  getUserBackground as getBackgroundFromBucket,
  getDefaultBackgroundPath,
  getDefaultBackgroundUrl
} from './file-bucket.service';

import {
  saveFileToObjectStorage,
  getFileFromObjectStorage,
  getUserFiles as getFilesFromObjectStorage,
  deleteUserFile,
  getUserBackground as getBackgroundFromObjectStorage,
  migrateFilesToObjectStorage
} from './object-storage.service';

// 确定使用哪种存储模式
let objectStorageEnabled = false;

/**
 * 初始化混合存储服务
 * @param useObjectStorage 是否使用对象存储
 */
export function initializeStorage(useObjectStorage: boolean = false): void {
  objectStorageEnabled = useObjectStorage;
  console.log(`文件存储模式: ${objectStorageEnabled ? '对象存储' : '文件系统'}`);
}

/**
 * 保存文件到存储
 * @param userId 用户ID
 * @param fileBuffer 文件数据
 * @param originalName 原始文件名
 * @param fileType 文件类型
 */
export async function saveFileToStorage(
  userId: number,
  fileBuffer: Buffer,
  originalName: string,
  fileType: string = 'attachment'
) {
  if (objectStorageEnabled) {
    // 使用对象存储
    const result = await saveFileToObjectStorage(userId, fileBuffer, originalName, fileType);
    return {
      fileId: result.fileId,
      publicUrl: result.publicUrl,
      fileVersion: result.version
    };
  } else {
    // 使用文件系统
    return await saveFileToBucket(userId, fileBuffer, originalName, fileType);
  }
}

/**
 * 从存储获取文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function getFileFromStorage(userId: number, fileId: string): Promise<Buffer | null> {
  // 首先尝试从对象存储获取
  if (objectStorageEnabled) {
    try {
      // 查询文件记录获取对象路径
      const files = await getFilesFromObjectStorage(userId);
      const fileRecord = files.find(f => f.fileId === fileId);
      
      if (fileRecord) {
        const fileBuffer = await getFileFromObjectStorage(fileRecord.filePath);
        if (fileBuffer) {
          return fileBuffer;
        }
      }
    } catch (error) {
      console.error(`从对象存储获取文件失败, 回退到文件系统: ${error}`);
    }
  }
  
  // 如果从对象存储获取失败或未启用，回退到文件系统
  return await getFileFromBucket(userId, fileId);
}

/**
 * 获取用户文件列表
 * @param userId 用户ID
 * @param fileType 文件类型过滤器
 */
export async function getUserFiles(userId: number, fileType?: string): Promise<any[]> {
  if (objectStorageEnabled) {
    return await getFilesFromObjectStorage(userId, fileType);
  } else {
    return await getFilesFromBucket(userId, fileType);
  }
}

/**
 * 删除用户文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function deleteFileFromStorage(userId: number, fileId: string): Promise<boolean> {
  if (objectStorageEnabled) {
    return await deleteUserFile(userId, fileId);
  } else {
    return await deleteFileFromBucket(userId, fileId);
  }
}

/**
 * 获取用户背景图片
 * @param userId 用户ID
 * @param isPortrait 是否为竖屏方向
 */
export async function getUserBackground(userId: number, isPortrait: boolean = false): Promise<string> {
  if (objectStorageEnabled) {
    return await getBackgroundFromObjectStorage(userId, isPortrait);
  } else {
    return await getBackgroundFromBucket(userId, isPortrait);
  }
}

/**
 * 迁移用户文件到对象存储
 * @param userId 用户ID (可选，如果不提供则迁移所有用户的文件)
 */
export async function migrateToObjectStorage(userId?: number) {
  return await migrateFilesToObjectStorage(userId);
}

// 导出默认背景路径函数
export {
  getDefaultBackgroundPath,
  getDefaultBackgroundUrl
};