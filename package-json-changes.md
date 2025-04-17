# 建议的 package.json 修改

为了更好地支持部署，请将 package.json 的 scripts 部分修改为：

```json
"scripts": {
  "dev": "tsx server/index.ts",
  "build": "vite build && NODE_OPTIONS=\"--max-old-space-size=3072 --experimental-vm-modules\" esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --allow-top-level-await",
  "start": "NODE_ENV=production node dist/index.js",
  "check": "tsc",
  "db:push": "drizzle-kit push",
  "deploy:prepare": "bash deploy-prepare.sh",
  "deploy:start": "node production-start.js"
}
```

这些变更增加了以下功能：
1. `deploy:prepare` - 运行我们创建的部署准备脚本，清理并优化构建过程
2. `deploy:start` - 使用我们的生产启动脚本，提供更稳定的部署体验
3. 在原有的 build 命令中增加内存限制设置，防止构建过程中内存不足