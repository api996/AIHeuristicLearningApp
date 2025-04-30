import http from 'http';

// 测试查询learning_paths表
function checkLearningPaths() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/debug/learning-paths',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    console.log(`状态码: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('查询学习轨迹表结果:');
      try {
        const result = JSON.parse(data);
        console.log(JSON.stringify(result, null, 2));
        
        // 如果表中无数据，测试保存功能
        if (result.count === 0) {
          console.log('表中无数据，正在测试保存功能...');
          saveLearningPath();
        }
      } catch (e) {
        console.error('解析JSON出错:', e);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求出错:', error);
  });

  req.end();
}

// 测试保存学习轨迹
function saveLearningPath() {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/debug/save-learning-path?userId=6',
    method: 'POST'
  };

  const req = http.request(options, (res) => {
    console.log(`保存状态码: ${res.statusCode}`);
    
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('保存学习轨迹结果:');
      try {
        const result = JSON.parse(data);
        console.log(JSON.stringify(result, null, 2));
        
        // 保存后再次查询验证
        if (result.success) {
          console.log('保存成功，再次查询验证...');
          setTimeout(checkLearningPaths, 1000);
        }
      } catch (e) {
        console.error('解析JSON出错:', e);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('保存请求出错:', error);
  });

  req.end();
}

// 开始测试流程
console.log('开始测试学习轨迹API...');
checkLearningPaths();