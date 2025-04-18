# 生产环境部署工具

这个目录包含用于确保应用程序在生产环境中正确运行的各种脚本和工具，特别是解决会话存储问题。

## 问题背景

在生产环境中，应用程序曾出现以下错误：

```
Warning: connect. session() MemoryStore is not
designed for a production environment, as it will leak
memory, and will not scale past a single process.

command finished with error [sh -c NODE_ENV=production node dist/index.js]: signal: terminated
```

这是因为会话数据被存储在内存中，导致内存泄漏，最终使应用程序崩溃。解决方案是使用PostgreSQL数据库存储会话数据。

## 工具列表

### 1. 构建工具 (build-prod.js)

用于生产环境的构建脚本，确保PostgreSQL会话存储正确包含在构建中。

**使用方法:**
```bash
node scripts/build-prod.js
```

这个脚本会：
- 执行前端和后端构建
- 确保构建输出包含PostgreSQL会话存储配置
- 验证最终构建内容

### 2. 改进的生产构建工具 (build-for-production.js)

解决特定问题：构建命令中的 `--packages=external` 标志导致会话存储配置丢失。

**使用方法:**
```bash
node scripts/build-for-production.js
```

这个脚本会：
- 执行前端和后端构建，但不使用 `--packages=external` 标志
- 确保构建输出包含所有依赖，特别是会话存储相关代码
- 验证最终构建并在必要时修复

### 3. 会话管理模块 (db-session.js)

提供基于PostgreSQL的会话存储功能，解决内存泄漏问题。

**使用方法:**
```javascript
const { createSessionConfig } = require('./scripts/db-session');

// 在Express应用中使用
app.use(session(createSessionConfig()));
```

### 4. 部署检查工具 (check-deployment.js)

在部署前检查关键生产配置，特别是会话存储设置。

**使用方法:**
```bash
node scripts/check-deployment.js
```

这个脚本会检查：
- 关键环境变量
- 会话存储配置
- 构建输出中的会话存储代码

### 5. 会话存储验证工具 (verify-session-storage.js)

检查数据库中的会话表，验证会话存储是否正确配置。

**使用方法:**
```bash
node scripts/verify-session-storage.js
```

这个脚本会：
- 检查数据库会话表是否存在
- 显示当前会话记录数量
- 检查过期会话并建议清理

### 6. 会话配置检查工具 (check-session-config.js)

全面检查应用程序的会话配置，从源代码到构建配置到最终构建输出。

**使用方法:**
```bash
# 开发环境检查
node scripts/check-session-config.js

# 生产环境检查
NODE_ENV=production node scripts/check-session-config.js
```

这个脚本会检查：
- 源代码中的会话配置（导入、创建、使用）
- package.json中的构建脚本配置
- 构建输出中是否包含会话存储相关代码
- 提供修复建议

### 7. 过期会话清理工具 (cleanup-expired-sessions.js)

定期清理数据库中的过期会话记录，优化数据库性能。

**使用方法:**
```bash
node scripts/cleanup-expired-sessions.js
```

这个脚本会：
- 检查并显示当前会话总数
- 识别并删除过期会话
- 显示清理后的会话表统计信息

## 解决生产环境会话问题的步骤

1. 确保 `server/index.ts` 中已配置PostgreSQL会话存储
2. 运行 `check-session-config.js` 全面检查会话配置
3. 使用 `build-for-production.js` 进行构建，确保包含所有依赖
4. 部署前运行 `check-deployment.js` 进行验证
5. 部署后运行 `verify-session-storage.js` 确认会话表正确创建
6. 定期运行 `cleanup-expired-sessions.js` 清理过期会话

## 注意事项

- 请确保设置了正确的 `DATABASE_URL` 环境变量
- 会话表 `session` 会自动创建（如果不存在）
- 官方构建脚本中的 `--packages=external` 标志会导致会话存储相关代码被排除在构建之外
- 定期清理过期会话有助于优化数据库性能