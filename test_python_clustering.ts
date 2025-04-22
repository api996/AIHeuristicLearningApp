/**
 * Python聚类服务测试脚本
 * 直接调用memory_service.ts中的testPythonClustering函数
 */
import { memoryService } from './server/services/learning/memory_service';

async function main() {
  console.log('开始测试Python聚类服务...');
  
  try {
    // 直接调用内存服务中的测试函数
    const success = await memoryService.testPythonClustering();
    
    if (success) {
      console.log('✅ 测试成功: Python聚类服务正常工作，能够处理3072维向量');
    } else {
      console.log('❌ 测试失败: Python聚类服务未能正确聚类测试数据');
    }
  } catch (error) {
    console.error('❌ 测试出错:', error);
  }
}

// 执行测试
main().catch(console.error);