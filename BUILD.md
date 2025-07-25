# 生产构建与部署指南

本文档提供了完整的生产环境构建和部署步骤，解决了ESM/CJS模块冲突问题。

## 最新推荐方法：纯ESM构建流程

最新改进的构建流程从根本上解决了模块冲突问题：

### 一键部署（最推荐）

```bash
# 一步完成构建和启动
node deploy-esm.js
```

### 分开执行

```bash
# 构建
node esm-build.js

# 运行
node esm-run.js
```

## 旧方法

不再推荐使用以下方法，但保留作为参考：

### 方法1：使用增强型构建脚本

```bash
# 执行构建脚本
node scripts/build-fixed.js
```

这个脚本会完成以下步骤：
1. 清理旧的构建文件
2. 使用Vite构建前端代码
3. 使用esbuild构建后端代码
4. 修复构建产物中的模块冲突问题

### 方法2：使用分步构建流程

```bash
# 1. 清理旧构建
rm -rf dist/

# 2. 构建前端
npx vite build

# 3. 构建后端
node esbuild.config.js

# 4. 修复模块冲突
node fix-bundle.js
```

## 旧方法的运行命令

### 方法1：一键构建并启动

```bash
# 一步完成构建和启动
node scripts/start-prod.js
```

### 方法2：分步操作

成功构建后，使用以下命令启动生产服务器：

```bash
# 使用直接启动脚本
node direct-prod.js

# 或者直接运行构建产物
NODE_ENV=production node dist/index.js
```

## 现有功能完整性保证

所有修改都只针对构建流程和部署脚本，不会影响任何应用程序的业务逻辑或功能：

✓ 记忆系统 - 保持完整，使用数据库存储
✓ AI模型集成 - 完全不受影响
✓ 用户认证 - 保持完整
✓ 聊天功能 - 保持完整
✓ 文件上传 - 保持完整
✓ 会话管理 - 保持完整，使用数据库存储

## 技术细节：解决的问题

构建脚本解决了在生产环境中可能出现的模块冲突问题：

1. **createRequire 重复声明** - 通过在构建后处理模块导入语句，确保只保留一个createRequire声明
2. **ESM/CommonJS混合使用冲突** - 通过统一使用ES模块语法
3. **模块解析顺序问题** - 通过自定义启动脚本，避免潜在的模块解析问题

## 部署后的验证

部署后，请验证以下功能是否正常工作：

1. 用户登录/注册
2. 聊天会话创建与历史记录
3. 记忆系统（确认之前的对话内容被正确记住）
4. 文件上传功能

## 故障排除

如果部署后遇到问题：

1. 检查服务器日志，关注任何与模块导入相关的错误
2. 确认环境变量是否正确设置，特别是数据库连接信息
3. 如果模块冲突仍然存在，可以尝试修改fix-bundle.js脚本，添加更多的导入模式匹配