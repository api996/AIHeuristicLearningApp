/**
 * 测试聚类主题生成脚本
 * 直接测试完整的聚类和主题生成流程
 */

// 设置一个简单的日志函数
function colorLog(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m', // 红色
    reset: '\x1b[0m' // 重置
  };

  console.log(`${colors[type]}${message}${colors.reset}`);
}

/**
 * 主测试函数
 */
async function testClusteringWithTopics() {
  try {
    colorLog('开始测试聚类主题生成', 'info');
    
    // 导入聚类缓存服务
    const { clusterCacheService } = await import('./server/services/learning/cluster_cache_service');
    
    // 强制刷新用户6的聚类结果，以测试主题生成
    colorLog('强制刷新用户6的聚类结果...', 'info');
    const clusterResult = await clusterCacheService.getUserClusterResults(6, true);
    
    // 读取主题
    colorLog('聚类结果:', 'success');
    
    // 遍历聚类，输出主题
    if (clusterResult && typeof clusterResult === 'object') {
      for (const [clusterId, cluster] of Object.entries(clusterResult)) {
        // @ts-ignore
        const clusterData = cluster as any;
        colorLog(`聚类 ${clusterId}: 主题 = "${clusterData.topic || '未生成'}", 包含 ${clusterData.memory_ids?.length || 0} 条记忆`, 'info');
      }
    }
    
    colorLog('测试完成！', 'success');
  } catch (error) {
    colorLog(`测试失败: ${error}`, 'error');
  }
}

// 执行测试
testClusteringWithTopics();