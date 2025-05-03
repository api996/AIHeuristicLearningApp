/**
 * 知识图谱生成测试脚本
 * 用于测试知识图谱生成功能
 */

import { generateUserKnowledgeGraph } from './server/services/learning/knowledge_graph.js';

// 测试用户ID
const TEST_USER_ID = 6;

// 主测试函数
async function testKnowledgeGraph() {
  console.log("=== 测试知识图谱生成 ===");
  
  try {
    // 直接调用知识图谱生成函数
    console.log(`为用户ID=${TEST_USER_ID}生成知识图谱...`);
    const startTime = Date.now();
    
    const graph = await generateUserKnowledgeGraph(TEST_USER_ID);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`知识图谱生成完成，耗时: ${duration.toFixed(2)}秒`);
    console.log(`生成了${graph.nodes.length}个节点和${graph.links.length}个连接`);
    
    // 输出节点信息
    if (graph.nodes.length > 0) {
      console.log("\n节点信息示例:");
      for (let i = 0; i < Math.min(5, graph.nodes.length); i++) {
        const node = graph.nodes[i];
        console.log(`- [${node.id}] ${node.label} (类型: ${node.category}, 大小: ${node.size})`);
      }
    } else {
      console.log("没有生成节点");
    }
    
    // 输出连接信息
    if (graph.links.length > 0) {
      console.log("\n连接信息示例:");
      for (let i = 0; i < Math.min(5, graph.links.length); i++) {
        const link = graph.links[i];
        console.log(`- ${link.source} -> ${link.target} (强度: ${link.value.toFixed(2)})`);
      }
    } else {
      console.log("没有生成连接");
    }
    
  } catch (error) {
    console.error(`测试失败: ${error}`);
  }
}

// 执行测试
testKnowledgeGraph();