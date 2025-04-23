/**
 * 向量维度标准化测试脚本（简化版）
 * 只测试维度标准化功能
 */

// 测试数据
const expectedDimension = 3072;

/**
 * 手动实现维度标准化函数，模拟我们在服务中的实现
 * @param {number[]} vector 输入向量
 * @param {number} targetDimension 目标维度
 * @returns {number[]} 标准化后的向量
 */
function normalizeVectorDimension(vector, targetDimension = 3072) {
  if (!vector || vector.length === 0) {
    console.error("无法标准化空向量");
    return Array.from({ length: targetDimension }, () => 0);
  }
  
  const currentDimension = vector.length;
  
  // 如果已经是目标维度，直接返回
  if (currentDimension === targetDimension) {
    return vector;
  }
  
  console.log(`标准化向量维度: ${currentDimension} -> ${targetDimension}`);
  
  if (currentDimension < targetDimension) {
    // 通过重复向量内容扩展维度
    const repeats = Math.ceil(targetDimension / currentDimension);
    let extendedVector = [];
    
    for (let i = 0; i < repeats; i++) {
      extendedVector = extendedVector.concat(vector);
    }
    
    // 截断到目标维度
    const normalizedVector = extendedVector.slice(0, targetDimension);
    console.log(`向量维度已扩展: ${currentDimension} -> ${normalizedVector.length}`);
    return normalizedVector;
  } else {
    // 如果向量维度大于目标维度，截断为目标维度
    const normalizedVector = vector.slice(0, targetDimension);
    console.log(`向量维度已截断: ${currentDimension} -> ${normalizedVector.length}`);
    return normalizedVector;
  }
}

/**
 * 测试手动维度标准化函数
 */
function testManualNormalization() {
  console.log("\n===== 测试向量维度标准化函数 =====");
  
  // 创建测试向量
  const testCases = [
    { name: "768维向量", vector: Array.from({ length: 768 }, (_, i) => i / 768) },
    { name: "1024维向量", vector: Array.from({ length: 1024 }, (_, i) => i / 1024) },
    { name: "4096维向量", vector: Array.from({ length: 4096 }, (_, i) => i / 4096) },
    { name: "空向量", vector: [] }
  ];
  
  let allTestsPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\n测试情景: ${testCase.name}`);
    console.log(`原始向量维度: ${testCase.vector.length}`);
    
    const normalized = normalizeVectorDimension(testCase.vector);
    console.log(`标准化后的向量维度: ${normalized.length}`);
    
    if (normalized.length === expectedDimension) {
      console.log(`✅ 测试通过: 向量维度符合预期(${expectedDimension})`);
    } else {
      console.error(`❌ 测试失败: 向量维度(${normalized.length})不符合预期(${expectedDimension})`);
      allTestsPassed = false;
    }
  }
  
  return allTestsPassed;
}

/**
 * 主函数
 */
function main() {
  console.log("开始测试向量维度标准化功能...\n");
  
  // 测试维度标准化函数
  const success = testManualNormalization();
  
  // 输出总结果
  console.log("\n===== 测试结果总结 =====");
  console.log(`维度标准化函数测试: ${success ? '通过 ✅' : '失败 ❌'}`);
  
  if (success) {
    console.log("\n🎉 测试通过! 向量维度标准化功能正常工作。");
  } else {
    console.error("\n❌ 测试失败，请检查详细日志分析原因。");
  }
}

// 执行测试
main();