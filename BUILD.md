# 构建指南

本项目提供了几种构建方式，以确保生产环境中会话存储正常工作。

## 构建选项

1. **标准构建（不推荐用于生产）**
   ```bash
   npm run build
   ```
   ⚠️ 警告：此构建使用`--packages=external`标志，可能不包含会话存储依赖，导致生产环境中的内存泄漏。

2. **安全构建（推荐用于生产）**
   ```bash
   node scripts/build-secure.js
   ```
   ✓ 此脚本会构建前后端，并验证构建输出中是否包含PostgreSQL会话存储配置，确保不会发生会话存储相关的内存泄漏。

3. **生产环境构建（推荐用于生产）**
   ```bash
   node scripts/build-for-production.js
   ```
   ✓ 类似于安全构建，但包含更多验证和错误处理。

## 验证构建配置

在部署前，可以运行以下脚本验证会话存储配置是否正确：

```bash
node scripts/check-session-config.js
```

此脚本会检查：
- 源代码中的会话存储配置
- 构建配置（package.json中的build脚本）
- 构建输出是否包含PostgreSQL会话存储

## 常见问题

### 内存泄漏问题

如果服务器在生产环境中经历内存泄漏，可能是因为会话存储配置不正确。请确保：

1. 使用`node scripts/build-secure.js`或`node scripts/build-for-production.js`进行构建
2. 环境变量`DATABASE_URL`设置正确
3. 使用`NODE_ENV=production node dist/index.js`启动服务器

### 构建问题排查

如果构建过程中出现问题，可以运行：

```bash
node scripts/check-deployment.js
```

此脚本会检查部署前的关键配置，包括环境变量、会话配置和构建输出。