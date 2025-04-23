/**
 * 主题生成功能测试脚本
 * 直接测试Gemini主题生成功能
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { genAiService } from './server/services/genai/genai_service.js';
import { memorySummarizer } from './server/services/learning/memory_summarizer.js';

// 检查Gemini API密钥
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('\x1b[31m[ERROR] GEMINI_API_KEY环境变量未设置，测试将使用后备服务\x1b[0m');
} else {
  console.log('\x1b[32m[INFO] 检测到GEMINI_API_KEY环境变量，API密钥长度:'+ GEMINI_API_KEY.length + '\x1b[0m');
}

/**
 * 打印带颜色的日志
 * @param {string} message 
 * @param {string} type 
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m', // 青色
    success: '\x1b[32m', // 绿色
    warn: '\x1b[33m', // 黄色
    error: '\x1b[31m' // 红色
  };
  
  const reset = '\x1b[0m';
  console.log(`${colors[type] || colors.info}[${type.toUpperCase()}] ${message}${reset}`);
}

/**
 * 测试主题生成功能
 * @param {string[]} texts 测试用的文本数组
 */
async function testTopicGeneration(texts) {
  try {
    log(`开始测试主题生成功能，文本数量: ${texts.length}...`);
    
    // 合并文本
    const combinedText = texts.join('\n---\n');
    
    // 1. 使用genAiService直接生成主题
    log('1. 测试genAiService.generateTopicForMemories()...');
    try {
      const topic1 = await genAiService.generateTopicForMemories(texts);
      log(`genAiService直接生成的主题: "${topic1 || '无'}"`, topic1 ? 'success' : 'warn');
    } catch (error) {
      log(`genAiService生成主题失败: ${error}`, 'error');
    }
    
    // 2. 使用memorySummarizer生成主题
    log('2. 测试memorySummarizer.generateTopic()...');
    try {
      const topic2 = await memorySummarizer.generateTopic(combinedText);
      log(`memorySummarizer生成的主题: "${topic2 || '无'}"`, topic2 ? 'success' : 'warn');
    } catch (error) {
      log(`memorySummarizer生成主题失败: ${error}`, 'error');
    }
    
    // 3. 尝试获取关键词
    log('3. 测试关键词提取...');
    try {
      const keywords = await memorySummarizer.extractKeywords(combinedText);
      log(`提取的关键词: ${keywords ? keywords.join(', ') : '无'}`, keywords ? 'success' : 'warn');
    } catch (error) {
      log(`提取关键词失败: ${error}`, 'error');
    }
    
    // 4. 直接使用Gemini API测试（如果API密钥存在）
    if (GEMINI_API_KEY) {
      log('4. 直接测试Gemini API...');
      try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // 准备量子计算主题提示
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: 
              `分析下列相关文本，提取它们讨论的核心学科主题或技术概念，并创建一个简洁专业的主题标签。
  
要求:
1. 长度限制：2-5个词或5-20个字符
2. 使用专业领域术语：如"量子计算"、"卷积神经网络"、"函数式编程"、"线性代数"
3. 专注真实学科主题：避免使用"学习"、"主题"、"分析"等通用词作为标签核心词
4. 专注内容而非格式：关注讨论了什么专业内容，而非"对话"、"问答"等
5. 具体而非抽象：使用精确术语，如"JavaScript闭包"而非"编程概念"
6. 直接输出主题标签：不要包含任何解释、思考过程或引号

文本:
${combinedText}

请直接输出主题标签，只有标签本身，不要思考过程，不要引号。
如果无法确定专业主题，输出"技术讨论"。` 
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            topP: 0.85,
            topK: 40,
            maxOutputTokens: 50
          }
        });
        
        const directTopic = result.response.text().trim();
        log(`直接使用Gemini API生成的主题: "${directTopic}"`, 'success');
      } catch (error) {
        log(`直接使用Gemini API出错: ${error}`, 'error');
      }
    }
    
    log('测试完成!', 'success');
  } catch (error) {
    log(`测试出错: ${error}`, 'error');
  }
}

/**
 * 主函数
 */
async function main() {
  // 测试用的文本样本 - 使用模板字符串避免转义问题
  const testTexts = [
    `用户问: 量子计算的基本原理是什么？

AI回答: 量子计算基于量子力学原理，利用量子比特（qubit）进行信息处理。与经典计算机使用的二进制位（0或1）不同，量子比特可以处于0、1的叠加态。这种叠加态使量子计算机可以同时处理多个计算路径，而量子纠缠则允许量子比特之间产生强相关性。量子计算的其他关键原理包括量子干涉和量子测量。`,
    
    `用户问: 量子计算与经典计算的主要区别是什么？

AI回答: 量子计算与经典计算的主要区别：1)基本单元：量子计算使用量子比特(qubit)，可以同时表示0和1；经典计算使用二进制位，只能是0或1。2)信息处理：量子计算利用叠加态和纠缠效应并行处理大量信息；经典计算只能顺序处理信息。3)运算能力：量子计算在特定问题上呈指数级加速；经典计算在这些问题上需要指数级时间。4)稳定性：量子计算受退相干影响，需要极低温环境；经典计算较为稳定。5)应用场景：两者各有优势，未来可能是混合计算架构。`,
    
    `用户问: 什么是量子纠缠？

AI回答: 量子纠缠是量子力学中的一种现象，指两个或多个量子粒子之间存在的一种特殊关联，使得它们的量子状态无法独立描述。当粒子处于纠缠状态时，测量一个粒子会立即影响另一个粒子的状态，即使它们相距很远。这种关联并非由经典物理可以解释的信号传递造成，而是量子力学的固有特性。爱因斯坦称之为"鬼魅般的超距作用"，但贝尔不等式和后续实验证明了量子纠缠的确实存在。量子纠缠是量子计算、量子密钥分发等量子技术的核心资源。`,
    
    `用户问: 现实中的量子计算机是如何工作的？

AI回答: 现实中的量子计算机工作原理：1)物理实现：通常使用超导量子比特、离子阱、光子或量子点技术。主流是超导量子比特，需在接近绝对零度环境运行。2)初始化：将量子比特设置到已知状态(通常为|0⟩)。3)量子门操作：应用单量子比特和双量子比特门操作，形成量子电路。4)读取结果：通过量子测量将量子态坍缩到经典态，获取计算结果。5)错误修正：实施量子纠错以抵抗退相干和噪声。6)经典控制：量子处理器与经典计算机配合，进行程序控制和结果分析。当前量子计算机仍有规模和错误率限制，处于早期发展阶段。`,
    
    `用户问: 量子算法有哪些？它们解决什么问题？

AI回答: 主要量子算法及其应用：1)Shor算法：用于大数分解，能破解RSA加密，指数级加速；2)Grover算法：提供平方级加速的无序数据库搜索；3)量子傅里叶变换：多种量子算法的基础；4)量子相位估计：估计酉算符特征值的相位，用于模拟量子系统；5)HHL算法：解线性方程组，适用于机器学习；6)VQE和QAOA：近期量子算法，解决优化问题；7)量子机器学习算法：包括量子支持向量机和量子神经网络；8)量子随机游走：用于图分析和搜索；9)量子模拟：模拟量子系统的行为。这些算法在密码学、优化、材料科学和药物发现等领域有巨大潜力。`
  ];
  
  await testTopicGeneration(testTexts);
}

// 执行主函数
main();