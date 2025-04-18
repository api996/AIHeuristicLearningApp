# 生产环境部署指南

## 简单两步构建与部署

### 步骤 1: 构建前端

```bash
node build-frontend.js
```

这个命令会：
- 清理旧的构建文件
- 使用Vite构建优化的前端资源
- 将所有静态资源放入`dist/public`目录
- 复制静态资源到`server/public`目录以确保服务器能找到它们

### 步骤 2: 启动生产服务器

```bash
node production.js
```

这个命令会：
- 在端口5001上启动生产服务器
- 使用数据库进行会话存储
- 使用数据库进行记忆存储
- 提供构建好的前端资源

## 最新改进内容

1. 解决了静态资源路径问题，确保服务器能正确加载前端资源
2. 自动复制构建文件到服务器能找到的位置
3. 简化了构建流程，移除了不必要的复杂性

## 注意事项

1. 生产服务器使用端口5001，避免与开发服务器冲突
2. 所有ESM/CommonJS模块冲突已在启动脚本中解决
3. 记忆系统使用数据库存储，无需额外配置

## 自动化部署

Replit部署配置已更新，建议修改`.replit`文件中的部署配置：

```toml
[deployment]
deploymentTarget = "cloudrun"
run = ["sh", "-c", "NODE_ENV=production node production.js"]
build = ["sh", "-c", "node build-frontend.js"]
```

## 验证部署

部署后，您可以通过以下URL访问应用：
- `https://[your-repl-name].replit.app`

## 故障排除

如果部署后页面是空白的：
1. 检查`server/public`目录是否存在并包含index.html和其他静态资源
2. 确认`node build-frontend.js`执行成功且没有错误
3. 检查服务器日志，查看是否有关于静态文件的警告或错误