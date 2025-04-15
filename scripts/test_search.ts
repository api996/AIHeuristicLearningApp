
import { webSearchService } from '../server/services/web-search';

async function testSearch() {
  console.log('测试网络搜索功能...');
  
  // 检查API密钥
  const apiKey = process.env.SERPER_API_KEY;
  console.log(`SERPER_API_KEY 是否已设置: ${apiKey ? '是' : '否'}`);
  
  if (!apiKey) {
    console.log('错误: 搜索API密钥未设置。请在 Replit Secrets 中添加 SERPER_API_KEY');
    return;
  }
  
  try {
    // 执行测试搜索
    const searchResults = await webSearchService.search('测试搜索查询');
    console.log(`搜索结果数量: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      console.log('搜索结果示例:');
      console.log(searchResults[0]);
      console.log('搜索功能工作正常!');
    } else {
      console.log('搜索返回了0个结果。这可能是正常的，取决于搜索查询。');
    }
  } catch (error) {
    console.error('搜索测试失败:', error);
  }
}

testSearch();
