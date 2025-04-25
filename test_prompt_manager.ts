/**
 * 提示词管理器功能测试脚本 (TypeScript版本)
 * 
 * 用于验证提示词模块化功能、多模型切换和对话阶段变更自检
 */

import { storage } from './server/storage';
import { promptManagerService } from './server/services/prompt-manager';
import { conversationAnalyticsService, type ConversationPhase } from './server/services/conversation-analytics';

// 测试配置
const TEST_USER_ID = 6;       // 使用系统中存在的用户ID
let TEST_CHAT_ID: number;     // 将在测试过程中创建并获取实际ID

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

// 创建测试用的临时对话
async function setupTestEnvironment(): Promise<void> {
  try {
    log('设置测试环境...');
    
    // 创建一个新的聊天
    const chat = await storage.createChat(TEST_USER_ID, '提示词管理器测试', 'gemini');
    TEST_CHAT_ID = chat.id;
    log(`创建了新的测试聊天，ID: ${TEST_CHAT_ID}`);
    
    // 创建初始对话阶段分析记录 (K阶段)
    await storage.saveConversationAnalytic(
      TEST_CHAT_ID,
      'K',
      '用户开始了解异步编程基础知识'
    );
    log(`创建了初始对话阶段分析记录 (K阶段)`);
    
    log('测试环境设置完成', 'success');
  } catch (error) {
    log(`设置测试环境失败: ${error}`, 'error');
    throw error;
  }
}

// 清理测试数据
async function cleanupTestEnvironment(): Promise<void> {
  try {
    log('清理测试数据...');
    
    // 因为外键约束，删除聊天会自动删除相关的对话分析记录
    if (TEST_CHAT_ID) {
      await storage.deleteChat(TEST_CHAT_ID, TEST_USER_ID, true);
      log(`删除了测试聊天 ID: ${TEST_CHAT_ID}`);
    }
    
    log('测试数据清理完成', 'success');
  } catch (error) {
    log(`清理测试数据失败: ${error}`, 'error');
  }
}

// 测试基本提示词生成
async function testBasePromptGeneration(): Promise<boolean> {
  log('测试基本提示词生成...');
  
  try {
    // 使用gemini模型生成提示词
    const basePrompt = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '什么是异步编程？'
    );
    
    // 打印提示词片段
    log(`生成的基本提示词 (截取前100字符):\n${basePrompt.substring(0, 100)}...`);
    
    // 验证提示词中是否包含关键内容
    const containsSystem = basePrompt.includes('启发式教育导师') || basePrompt.includes('AI学习助手');
    const containsKWLQ = basePrompt.includes('KWLQ') || basePrompt.includes('stage') || 
                          basePrompt.includes('K 阶段') || basePrompt.includes('W 阶段') || 
                          basePrompt.includes('L 阶段') || basePrompt.includes('Q 阶段');
    const containsRunState = basePrompt.includes('state') || basePrompt.includes('progress') || 
                              basePrompt.includes('进度') || basePrompt.includes('状态');
    
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
async function testPhaseChangeDetection(): Promise<boolean> {
  log('测试阶段变更检测与校验...');
  
  try {
    // 获取K阶段的提示词
    const promptK = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '什么是函数式编程？'
    );
    
    log('获取了K阶段的提示词');
    
    // 变更为W阶段
    await storage.saveConversationAnalytic(
      TEST_CHAT_ID,
      'W',
      '用户对函数式编程表达疑惑'
    );
    
    log('保存了W阶段的对话分析记录');
    
    // 获取W阶段的提示词，应该包含阶段变更检测
    const promptW = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '函数式编程比面向对象有什么优势？'
    );
    
    // 验证提示词中是否包含阶段变更校验
    const containsPhaseCheck = 
      promptW.includes('已检测到对话阶段变更') || 
      promptW.includes('请简要列出当前阶段') || 
      promptW.includes('Wondering') ||
      promptW.includes('阶段变更');
    
    log(`包含阶段变更校验: ${containsPhaseCheck ? '✓' : '✗'}`, containsPhaseCheck ? 'success' : 'error');
    
    if (!containsPhaseCheck) {
      // 打印部分提示词以进行调试
      log(`W阶段提示词片段(末尾200字符): ${promptW.substring(promptW.length - 200)}`, 'warning');
    }
    
    return containsPhaseCheck;
  } catch (error) {
    log(`测试阶段变更检测失败: ${error}`, 'error');
    return false;
  }
}

// 测试模型切换检测与校验
async function testModelSwitchDetection(): Promise<boolean> {
  log('测试模型切换检测与校验...');
  
  try {
    // 首先使用gemini模型
    const promptGemini = await promptManagerService.getDynamicPrompt(
      'gemini', 
      TEST_CHAT_ID, 
      '面向对象编程的基本原则是什么？'
    );
    
    log('使用gemini模型生成了提示词');
    log(`Gemini提示词长度: ${promptGemini.length} 字符`);
    
    // 然后切换到deepseek模型
    const promptDeepseek = await promptManagerService.getDynamicPrompt(
      'deepseek', 
      TEST_CHAT_ID, 
      '如何应用SOLID原则？'
    );
    
    log('切换到deepseek模型生成了提示词');
    log(`Deepseek提示词长度: ${promptDeepseek.length} 字符`);
    
    // 验证提示词中是否包含模型切换校验
    const modelCheckString = '已切换至 deepseek 模型';
    const alternateSwitchText = '*** 模型切换检测 ***';
    const confirmText = '确认你已加载所有系统指令';
    
    const containsModelCheck = 
      promptDeepseek.includes(modelCheckString) || 
      promptDeepseek.includes(confirmText) ||
      promptDeepseek.includes(alternateSwitchText);
    
    log(`包含 "${modelCheckString}": ${promptDeepseek.includes(modelCheckString)}`);
    log(`包含 "${alternateSwitchText}": ${promptDeepseek.includes(alternateSwitchText)}`);
    log(`包含 "${confirmText}": ${promptDeepseek.includes(confirmText)}`);
    log(`包含模型切换校验: ${containsModelCheck ? '✓' : '✗'}`, containsModelCheck ? 'success' : 'error');
    
    if (!containsModelCheck) {
      // 打印部分提示词以进行调试
      log(`Deepseek提示词前200字符: ${promptDeepseek.substring(0, 200)}`, 'warning');
      log(`Deepseek提示词末尾200字符: ${promptDeepseek.substring(promptDeepseek.length - 200)}`, 'warning');
    }
    
    return containsModelCheck;
  } catch (error) {
    log(`测试模型切换检测失败: ${error}`, 'error');
    return false;
  }
}

// 运行所有测试
async function runAllTests(): Promise<void> {
  log('====== 提示词管理器功能测试开始 ======', 'info');
  
  try {
    // 设置测试环境
    await setupTestEnvironment();
    
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
    
    // 清理测试环境
    await cleanupTestEnvironment();
  } catch (error) {
    log(`测试过程中发生未捕获的错误: ${error}`, 'error');
  } finally {
    log('====== 提示词管理器功能测试结束 ======', 'info');
  }
}

// 执行测试
runAllTests().catch(error => {
  log(`执行测试过程中发生严重错误: ${error}`, 'error');
  process.exit(1);
});