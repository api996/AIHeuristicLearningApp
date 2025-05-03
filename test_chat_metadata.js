// 测试聊天元数据功能
import { storage } from './server/storage.js';

async function testChatMetadata() {
  try {
    console.log('开始测试聊天元数据功能...');
    
    // 1. 找到一个现有的聊天记录
    const chats = await storage.getUserChats(6, true);
    if (!chats || chats.length === 0) {
      console.log('未找到聊天记录，测试结束');
      return;
    }
    
    const testChatId = chats[0].id;
    console.log(`将使用聊天ID: ${testChatId} 进行测试`);
    
    // 2. 获取当前聊天记录
    const chat = await storage.getChat(testChatId);
    console.log('当前聊天记录:', chat);
    
    // 3. 更新聊天元数据
    const testMetadata = {
      dify_conversation_id: 'test-conversation-id-' + Date.now(),
      test_key: 'test_value',
      updated_at: new Date().toISOString()
    };
    
    console.log(`更新聊天元数据为:`, testMetadata);
    await storage.updateChatMetadata(testChatId, testMetadata);
    
    // 4. 验证元数据是否已更新
    const updatedChat = await storage.getChat(testChatId);
    console.log('更新后的聊天记录:', updatedChat);
    
    // 5. 再次更新元数据，测试合并功能
    const additionalMetadata = {
      new_key: 'new_value',
      updated_at: new Date().toISOString()
    };
    
    console.log(`添加新的元数据:`, additionalMetadata);
    await storage.updateChatMetadata(testChatId, additionalMetadata);
    
    // 6. 验证元数据是否已正确合并
    const finalChat = await storage.getChat(testChatId);
    console.log('最终的聊天记录:', finalChat);
    
    console.log('测试完成!');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

testChatMetadata();