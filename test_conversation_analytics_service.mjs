/**
 * 对话阶段分析服务测试脚本
 * 用于测试服务器端的增强型对话分析服务
 */

import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 模拟聊天会话
const testChat = {
  id: 99999, // 测试用ID
  title: "测试会话",
  messages: [
    {
      role: "user",
      content: "请解释下JavaScript中的Promise是什么？"
    },
    {
      role: "assistant",
      content: "Promise是JavaScript中用于处理异步操作的对象，它代表一个最终会完成的操作，并返回一个值或者错误原因。Promise有三种状态：pending（进行中）、fulfilled（已成功）和rejected（已失败）。\n\n基本用法示例：\n```javascript\nconst myPromise = new Promise((resolve, reject) => {\n  // 异步操作\n  setTimeout(() => {\n    const success = true;\n    if (success) {\n      resolve('操作成功!');\n    } else {\n      reject('操作失败!');\n    }\n  }, 1000);\n});\n\nmyPromise\n  .then(result => console.log(result)) // 成功时\n  .catch(error => console.error(error)); // 失败时\n```\n\nPromise的主要优点是它可以链式调用，使得异步代码更加扁平和可读，解决了所谓的"回调地狱"问题。"
    },
    {
      role: "user",
      content: "我对Promise的链式调用有点不明白，能给我详细解释一下吗？"
    },
    {
      role: "assistant", 
      content: "我理解你对Promise链式调用的困惑。让我详细解释一下。\n\nPromise的链式调用是指你可以在一个Promise的then方法后面继续调用then方法，形成一个"链"，每个then会返回一个新的Promise对象。这样就可以依次处理一系列的异步操作。\n\n### 链式调用的基本原理\n\n1. **每个then返回新Promise**：当你调用.then()时，它会返回一个全新的Promise，而不是原来的Promise\n2. **值的传递**：前一个then的返回值会作为参数传递给下一个then的回调函数\n3. **错误处理**：你可以在链的任何地方添加.catch()来处理错误\n\n### 详细例子：\n\n```javascript\nfunction fetchUserData(userId) {\n  return fetch(`/api/users/${userId}`)      // 返回一个Promise\n    .then(response => {\n      if (!response.ok) {\n        throw new Error('获取用户数据失败');\n      }\n      return response.json();              // 返回一个新Promise\n    })\n    .then(userData => {\n      console.log('用户数据:', userData);\n      return fetch(`/api/posts?userId=${userData.id}`); // 返回新Promise\n    })\n    .then(response => {\n      if (!response.ok) {\n        throw new Error('获取用户文章失败');\n      }\n      return response.json();              // 返回新Promise\n    })\n    .then(posts => {\n      console.log('用户的文章:', posts);\n      return { user: userData, posts: posts }; // 返回组合数据\n    })\n    .catch(error => {\n      console.error('发生错误:', error);\n      return null;                          // 错误时返回null\n    });\n}\n```\n\n这个例子展示了：\n1. 首先获取用户数据\n2. 然后用用户ID获取该用户的文章\n3. 最后组合数据返回\n4. 任何步骤出错都会跳到catch\n\n如果你用传统回调方式写，就会变成嵌套的"回调地狱"：\n\n```javascript\nfunction fetchUserData(userId) {\n  fetch(`/api/users/${userId}`, (err, response) => {\n    if (err) {\n      console.error(err);\n      return;\n    }\n    response.json((err, userData) => {\n      if (err) {\n        console.error(err);\n        return;\n      }\n      console.log('用户数据:', userData);\n      fetch(`/api/posts?userId=${userData.id}`, (err, response) => {\n        if (err) {\n          console.error(err);\n          return;\n        }\n        response.json((err, posts) => {\n          if (err) {\n            console.error(err);\n            return;\n          }\n          console.log('用户的文章:', posts);\n          // 更多嵌套...\n        });\n      });\n    });\n  });\n}\n```\n\n这样对比，Promise的链式调用优势就很明显了：代码更加线性、扁平，而不是层层嵌套，更容易理解和维护。\n\n还有问题吗？"
    }
  ]
};

// 调用API发送测试请求
async function sendAnalyzeRequest() {
  try {
    console.log("发送对话分析请求...");
    
    const response = await fetch("http://localhost:5000/api/analyze-conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chatId: testChat.id,
        messages: testChat.messages
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API错误: ${response.status} - ${errorText}`);
      return null;
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`请求失败: ${error.message}`);
    return null;
  }
}

// 主测试函数
async function runTest() {
  console.log("===== 测试对话阶段分析服务 =====");
  
  // 创建测试API端点
  await createTestAnalysisEndpoint();
  
  // 发送第一次请求
  console.log("\n第一次请求：");
  const firstStartTime = Date.now();
  const firstResult = await sendAnalyzeRequest();
  const firstDuration = Date.now() - firstStartTime;
  
  if (firstResult) {
    console.log(`分析结果 (${firstDuration}ms):`, firstResult);
  } else {
    console.error("请求失败");
    return;
  }
  
  // 等待一秒
  console.log("\n等待1秒...");
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 发送第二次请求（应该使用缓存）
  console.log("\n第二次请求（应使用缓存）：");
  const secondStartTime = Date.now();
  const secondResult = await sendAnalyzeRequest();
  const secondDuration = Date.now() - secondStartTime;
  
  if (secondResult) {
    console.log(`分析结果 (${secondDuration}ms):`, secondResult);
    
    // 验证缓存有效性
    const cachingWorked = secondDuration < firstDuration * 0.8;
    console.log(`\n缓存效果验证: ${cachingWorked ? '有效 ✓' : '无效 ✗'}`);
    console.log(`第一次请求: ${firstDuration}ms, 第二次请求: ${secondDuration}ms`);
    console.log(`性能提升: ${Math.round((1 - secondDuration/firstDuration) * 100)}%`);
  } else {
    console.error("请求失败");
  }
}

// 创建测试API端点
async function createTestAnalysisEndpoint() {
  try {
    // 先检查服务器是否已启动
    const pingResponse = await fetch("http://localhost:5000/api/ping");
    if (!pingResponse.ok) {
      console.log("创建临时API测试端点...");
      
      // 如果没有ping端点，创建一个简单的分析API端点
      const response = await fetch("http://localhost:5000/api/create-test-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          endpoint: "/api/analyze-conversation"
        })
      });
      
      if (!response.ok) {
        console.error("无法创建测试端点，将使用模拟测试");
      } else {
        console.log("测试端点已创建");
      }
    } else {
      console.log("服务器已启动并响应");
    }
  } catch (error) {
    console.log("服务器可能未启动，将使用模拟测试");
    // 模拟对话分析服务的API接口
    // 简单的HTTP服务器用于测试
    const http = await import('http');
    
    const server = http.createServer((req, res) => {
      if (req.url === '/api/analyze-conversation' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            // 模拟处理
            const result = {
              currentPhase: 'W', // 示例阶段
              summary: '用户对Promise链式调用表示困惑',
              confidence: 0.9
            };
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    server.listen(5001, () => {
      console.log('模拟服务器在端口5001上启动');
    });
  }
}

// 运行测试
runTest();