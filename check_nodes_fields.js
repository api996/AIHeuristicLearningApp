/**
 * 快速检查节点字段脚本，特别关注颜色和聚类ID字段
 */

import axios from 'axios';

// 清除知识图谱缓存
async function clearCache() {
  try {
    console.log("清除缓存...");
    await axios.post("http://localhost:5000/api/learning-path/6/clear-cache");
    console.log("缓存已清除");
  } catch (error) {
    console.error("清除缓存出错:", error.message);
  }
}

// 检查学习路径节点字段
async function checkLearningPathFields() {
  try {
    console.log("\n检查学习路径节点字段...");
    const response = await axios.get("http://localhost:5000/api/learning-path/6");
    
    if (response.data.nodes && response.data.nodes.length > 0) {
      const node = response.data.nodes[0];
      console.log("学习路径节点样例:", JSON.stringify(node, null, 2));
      
      // 检查关键字段
      console.log("\n节点字段检查:");
      console.log(`- id: ${node.id ? '✓' : '✗'}`);
      console.log(`- label: ${node.label ? '✓' : '✗'}`);
      console.log(`- size: ${node.size ? '✓' : '✗'}`);
      console.log(`- clusterId: ${node.clusterId ? '✓' : '✗'}`);
      console.log(`- color: ${node.color ? '✓' : '✗'}`);
    } else {
      console.log("无法获取学习路径节点");
    }
  } catch (error) {
    console.error("检查学习路径出错:", error.message);
  }
}

// 执行测试
async function main() {
  try {
    await clearCache();
    await checkLearningPathFields();
  } catch (error) {
    console.error("测试出错:", error.message);
  }
}

main();