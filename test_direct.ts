/**
 * 提示词管理器直接功能测试脚本
 * 这个脚本直接导入服务并调用其方法进行测试
 */

// 导入必要的服务
import { conversationAnalyticsService } from './server/services/conversation-analytics';
import { promptManagerService } from './server/services/prompt-manager';
import { storage } from './server/storage';

// 测试配置
const TEST_USER_ID = 6;  // 使用系统中存在的用户ID
const TEST_CHAT_ID = 1;  // 使用固定的聊天ID进行测试

// 颜色日志输出
function log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',     // 青色
    success: '\x1b[32m%s\x1b[0m',  // 绿色
    warning: '\x1b[33m%s\x1b[0m',  // 黄色
    error: '\x1b[31m%s\x1b[0m'     // 红色
  };
  
  console.log(colors[type], `[${type.toUpperCase()}] ${message}`);
}

// 测试基本提示词生成
async function testBasePromptGeneration() {
  log('测试基本提示词生成...');
  
  try {
    // 设置初始阶段为K
    await conversationAnalyticsService.savePhase(TEST_CHAT_ID, 'K');
    log('设置初始对话阶段为K (Knowledge Activation)');
    
    // 生成基本提示词
    const basePrompt = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '什么是异步编程？'
    );
    
    // 显示截取的结果
    log(`生成的基本提示词 (截取前200字符):\n${basePrompt.substring(0, 200)}...`);
    
    // 验证提示词中是否包含关键内容
    const containsSystem = basePrompt.includes('启发式教育导师');
    const containsKWLQ = basePrompt.includes('KWLQ') || basePrompt.includes('stage');
    const containsRunState = basePrompt.includes('state') || basePrompt.includes('progress');
    
    log(`包含系统角色定义: ${containsSystem ? '✓' : '✗'}`, containsSystem ? 'success' : 'error');
    log(`包含KWLQ相关内容: ${containsKWLQ ? '✓' : '✗'}`, containsKWLQ ? 'success' : 'error');
    log(`包含运行状态相关内容: ${containsRunState ? '✓' : '✗'}`, containsRunState ? 'success' : 'error');
    
    return containsSystem && containsKWLQ && containsRunState;
  } catch (error) {
    log(`测试基本提示词生成失败: ${error}`, 'error');
    return false;
  }
}

// 测试阶段变更检测与校验
async function testPhaseChangeDetection() {
  log('测试阶段变更检测与校验...');
  
  try {
    // 设置初始阶段为K
    await conversationAnalyticsService.savePhase(TEST_CHAT_ID, 'K');
    log('设置初始对话阶段为K (Knowledge Activation)');
    
    // 获取K阶段的提示词
    const promptK = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '什么是函数式编程？'
    );
    
    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 变更为W阶段
    await conversationAnalyticsService.savePhase(TEST_CHAT_ID, 'W');
    log('变更对话阶段为W (Wondering)');
    
    // 获取W阶段的提示词，应该包含阶段变更检测
    const promptW = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '函数式编程比面向对象有什么优势？'
    );
    
    // 验证提示词中是否包含阶段变更校验
    const containsPhaseCheck = promptW.includes('请简要列出当前阶段') || 
                              promptW.includes('阶段(问题疑惑)') ||
                              promptW.includes('Wondering');
    
    log(`包含阶段变更校验: ${containsPhaseCheck ? '✓' : '✗'}`, containsPhaseCheck ? 'success' : 'error');
    
    if (containsPhaseCheck) {
      log('阶段变更检测和校验工作正常!', 'success');
    } else {
      log('阶段变更校验功能可能存在问题', 'warning');
      // 打印部分提示词以进行调试
      log(`W阶段提示词片段: ${promptW.substring(promptW.length - 200)}`);
    }
    
    return containsPhaseCheck;
  } catch (error) {
    log(`测试阶段变更检测失败: ${error}`, 'error');
    return false;
  }
}

// 测试模型切换检测与校验
async function testModelSwitchDetection() {
  log('测试模型切换检测与校验...');
  
  try {
    // 首先使用gemini模型
    const promptGemini = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '面向对象编程的基本原则是什么？'
    );
    log('使用gemini模型生成提示词');
    
    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 然后切换到deepseek模型
    const promptDeepseek = await promptManagerService.getDynamicPrompt(
      'deepseek', 
      TEST_CHAT_ID, 
      '如何应用SOLID原则？'
    );
    log('切换到deepseek模型生成提示词');
    
    // 验证提示词中是否包含模型切换校验
    const containsModelCheck = promptDeepseek.includes('已切换至 deepseek 模型') || 
                              promptDeepseek.includes('确认你已加载所有系统指令');
    
    log(`包含模型切换校验: ${containsModelCheck ? '✓' : '✗'}`, containsModelCheck ? 'success' : 'error');
    
    if (containsModelCheck) {
      log('模型切换检测和校验工作正常!', 'success');
    } else {
      log('模型切换校验功能可能存在问题', 'warning');
      // 打印部分提示词以进行调试
      log(`Deepseek提示词片段: ${promptDeepseek.substring(promptDeepseek.length - 200)}`);
    }
    
    return containsModelCheck;
  } catch (error) {
    log(`测试模型切换检测失败: ${error}`, 'error');
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  log('开始提示词管理器功能测试...', 'info');
  
  // 测试基本提示词生成
  const basePromptTest = await testBasePromptGeneration();
  
  // 测试阶段变更检测与校验
  const phaseChangeTest = await testPhaseChangeDetection();
  
  // 测试模型切换检测与校验
  const modelSwitchTest = await testModelSwitchDetection();
  
  // 汇总测试结果
  log('\n===== 测试结果汇总 =====', 'info');
  log(`基本提示词生成: ${basePromptTest ? '✓ 通过' : '✗ 失败'}`, basePromptTest ? 'success' : 'error');
  log(`阶段变更检测与校验: ${phaseChangeTest ? '✓ 通过' : '✗ 失败'}`, phaseChangeTest ? 'success' : 'error');
  log(`模型切换检测与校验: ${modelSwitchTest ? '✓ 通过' : '✗ 失败'}`, modelSwitchTest ? 'success' : 'error');
  
  const allPassed = basePromptTest && phaseChangeTest && modelSwitchTest;
  log(`\n总体结果: ${allPassed ? '✓ 所有测试通过' : '✗ 部分测试失败'}`, allPassed ? 'success' : 'warning');
}

// 执行测试
runAllTests().catch(error => {
  log(`测试过程中发生未捕获的错误: ${error}`, 'error');
});