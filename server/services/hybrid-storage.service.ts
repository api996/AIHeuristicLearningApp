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
    try {
      const result = await saveFileToObjectStorage(userId, fileBuffer, originalName, fileType);
      return {
        fileId: result.fileId,
        publicUrl: result.publicUrl,
        fileVersion: result.version
      };
    } catch (error) {
      // 如果对象存储失败，记录错误并回退到文件系统
      console.warn(`对象存储上传失败，回退到文件系统: ${error}`);
      // 继续执行下面的文件系统存储代码
    }
  }
  
  // 使用文件系统 (作为回退方案或默认选项)
  return await saveFileToBucket(userId, fileBuffer, originalName, fileType);
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
    try {
      return await getFilesFromObjectStorage(userId, fileType);
    } catch (error) {
      // 如果对象存储操作失败，记录错误并回退到文件系统
      console.warn(`从对象存储获取文件列表失败，回退到文件系统: ${error}`);
      // 继续执行下面的文件系统获取代码
    }
  }
  
  // 使用文件系统 (作为回退方案或默认选项)
  return await getFilesFromBucket(userId, fileType);
}

/**
 * 删除用户文件
 * @param userId 用户ID
 * @param fileId 文件ID
 */
export async function deleteFileFromStorage(userId: number, fileId: string): Promise<boolean> {
  if (objectStorageEnabled) {
    try {
      return await deleteUserFile(userId, fileId);
    } catch (error) {
      // 如果对象存储操作失败，记录错误并回退到文件系统
      console.warn(`对象存储删除失败，回退到文件系统: ${error}`);
      // 继续执行下面的文件系统删除代码
    }
  }
  
  // 使用文件系统 (作为回退方案或默认选项)
  return await deleteFileFromBucket(userId, fileId);
}

/**
 * 获取用户背景图片
 * @param userId 用户ID
 * @param isPortrait 是否为竖屏方向
 */
export async function getUserBackground(userId: number, isPortrait: boolean = false): Promise<string> {
  if (objectStorageEnabled) {
    try {
      return await getBackgroundFromObjectStorage(userId, isPortrait);
    } catch (error) {
      // 如果对象存储操作失败，记录错误并回退到文件系统
      console.warn(`从对象存储获取背景图片失败，回退到文件系统: ${error}`);
      // 继续执行下面的文件系统获取代码
    }
  }
  
  // 使用文件系统 (作为回退方案或默认选项)
  return await getBackgroundFromBucket(userId, isPortrait);
}

/**
 * 迁移用户文件到对象存储
 * @param userId 用户ID (可选，如果不提供则迁移所有用户的文件)
 */
export async function migrateToObjectStorage(userId?: number) {
  try {
    return await migrateFilesToObjectStorage(userId);
  } catch (error) {
    console.error(`迁移到对象存储失败: ${error}`);
    return {
      total: 0,
      success: 0,
      failed: 0,
      users: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 导出默认背景路径函数
export {
  getDefaultBackgroundPath,
  getDefaultBackgroundUrl
};