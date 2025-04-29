/**
 * 测试图片上传功能
 * 测试Grok API图片上传和文件ID获取
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// 获取API密钥
const apiKey = process.env.GROK_API_KEY;
if (!apiKey) {
  console.error('错误: 缺少GROK_API_KEY环境变量');
  process.exit(1);
}

// 路径设置
const imagePath = './attached_assets/IMG_9219.jpeg'; // 测试使用的图片

async function testImageUpload() {
  try {
    console.log(`开始测试图片上传，路径: ${imagePath}`);
    
    // 读取图片数据
    const imageData = fs.readFileSync(imagePath);
    console.log(`图片文件大小: ${imageData.length} 字节`);
    
    // 得到mime类型
    const fileExtension = path.extname(imagePath).toLowerCase();
    let mimeType = "image/jpeg"; // 默认MIME类型
    if (fileExtension === '.png') mimeType = "image/png";
    else if (fileExtension === '.gif') mimeType = "image/gif";
    else if (fileExtension === '.webp') mimeType = "image/webp";
    
    // 创建FormData
    const formData = new FormData();
    formData.append('file', imageData, {
      filename: path.basename(imagePath),
      contentType: mimeType,
    });
    formData.append('purpose', 'vision');
    
    console.log('开始上传图片...');
    
    // 向Grok API上传图片
    const response = await fetch('https://api.x.ai/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    // 检查响应
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`图片上传失败: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('成功上传图片！');
    console.log(`文件ID: ${result.id}`);
    console.log(`文件大小: ${result.bytes} 字节`);
    console.log(`文件用途: ${result.purpose}`);
    console.log(`创建时间: ${new Date(result.created_at * 1000).toISOString()}`);
    
    // 测试使用该文件ID进行图片分析
    console.log('现在尝试使用该文件ID进行图片分析...');
    const visionResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "grok-vision-beta",
        messages: [
          {
            role: "system",
            content: "请详细分析图片并简要描述其内容"
          },
          {
            role: "user",
            content: [
              { type: "text", text: "请分析这张图片并简要描述其内容:" },
              { 
                type: "image_file", 
                image_file: { file_id: result.id }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });
    
    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`图片分析失败: ${visionResponse.status} - ${errorText}`);
    }
    
    const visionResult = await visionResponse.json();
    console.log('成功分析图片！');
    console.log('图片分析结果:');
    console.log(visionResult.choices[0].message.content);
    
    // 计算token数据
    console.log(`使用的输入token数: ${visionResult.usage.prompt_tokens}`);
    console.log(`使用的输出token数: ${visionResult.usage.completion_tokens}`);
    console.log(`总共使用的token数: ${visionResult.usage.total_tokens}`);
    
    // 对比直接使用base64嵌入数据的token容量
    console.log(`如果使用base64直接嵌入内容，图片大小为 ${Math.ceil(imageData.length * 1.37)} 字节`);
    console.log(`使用base64直接嵌入内容，大约会使用约 ${Math.ceil(imageData.length * 1.37 / 4)} 个token`);
    console.log(`使用file_id可节省约 ${Math.ceil(imageData.length * 1.37 / 4) - visionResult.usage.prompt_tokens} 个token!`);
    
  } catch (error) {
    console.error(`测试遇到错误: ${error.message}`);
  }
}

// 运行测试
testImageUpload();
