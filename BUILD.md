# 生产环境构建与部署说明

## 1. 开发环境启动
```
npm run dev
```

## 2. 生产环境构建和部署步骤
构建和部署生产环境需要几个关键步骤:

### 步骤 1: 构建应用程序

使用特制的构建脚本以避免ESM模块导入冲突:
```bash
node scripts/build-direct.js
```

### 步骤 2: 启动生产服务器

使用专用的生产启动脚本，它解决了ESM模块冲突问题:
```bash
node production.js
```

## 3. 部署常见问题解决方案

### 3.1 ESM模块导入冲突
如果遇到 `SyntaxError: Identifier 'createRequire' has already been declared` 错误，请确保:
- 使用 `production.js` 启动应用程序，而不是直接启动 `dist/index.js`
- 生产环境中使用 `package-prod.json` 列出的最小依赖集

### 3.2 PostgreSQL会话存储问题
如果会话存储相关错误出现，请确保:
- 正确配置了 `DATABASE_URL` 环境变量
- 会话表已经在数据库中创建
- 使用 `connect-pg-simple` 在生产环境中管理会话

## 4. 环境变量配置

确保生产环境中配置以下环境变量:
- `DATABASE_URL`: PostgreSQL数据库连接URL
- `NODE_ENV`: 设置为 "production"
- `PORT`: 可选，默认为5000
- `SESSION_SECRET`: 用于会话加密的密钥
- `GEMINI_API_KEY`: Gemini AI API密钥
- 其他AI模型相关API密钥

## 5. 数据库迁移

数据库迁移通过Drizzle自动完成。如果需要手动迁移:
```bash
npm run db:push
```