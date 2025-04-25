# AI学习伴侣系统 - 数据库迁移指南

*文档日期：2025年4月25日*

## 概述

本指南详细说明如何将AI学习伴侣系统的数据库从现有环境完整迁移到新环境，适用于系统管理员和开发人员。迁移过程设计为最小化停机时间并确保数据完整性。

## 前提条件

在开始迁移前，请确保以下条件已满足：

1. **源环境**：
   - PostgreSQL 15或更高版本
   - 拥有数据库备份权限的用户账号
   - 足够的磁盘空间用于备份文件(至少100MB)

2. **目标环境**：
   - PostgreSQL 15或更高版本
   - 具有创建数据库权限的用户账号
   - 至少500MB可用磁盘空间

3. **网络要求**：
   - 源环境和目标环境之间的网络连接(如需直接迁移)
   - 或用于传输备份文件的共享存储/媒介

## 一、备份文件说明

### 备份文件内容

备份文件`ai_learning_companion_backup.sql`(4.3MB)包含：

- 完整的数据库架构(表、索引、约束、触发器等)
- 所有表的数据
- 序列和其他数据库对象

备份文件经过压缩，比实际数据库大小(约30MB)小很多，这是正常现象，因为：

1. SQL备份以文本形式存储数据，比数据库的二进制存储更紧凑
2. 备份不包含索引的实际数据(仅包含重建索引的命令)
3. 数据库中的某些空间用于管理和优化目的，不包含在备份中

### 数据库大小分析

数据库主要空间分布：

| 表名                 | 大小   | 说明                      |
|----------------------|--------|---------------------------|
| session              | 13 MB  | 用户会话数据，占总空间的43% |
| memory_embeddings    | 4 MB   | 向量嵌入数据，占总空间的13% |
| cluster_result_cache | 2.3 MB | 聚类结果缓存，占总空间的8%  |
| 其他表               | 11 MB  | 剩余表，占总空间的36%      |
| **总计**             | **30 MB** | PostgreSQL报告的数据库大小 |

## 二、备份步骤

### 方法1：使用pg_dump (推荐)

```bash
# 1. 创建完整SQL备份
pg_dump -U username -h hostname -p port -d database_name > ai_learning_companion_backup.sql

# 2. 或创建压缩备份以节省空间
pg_dump -U username -h hostname -p port -d database_name | gzip > ai_learning_companion_backup.sql.gz
```

### 方法2：使用环境变量(适用于Replit)

```bash
# 确保环境变量PGUSER、PGHOST、PGPORT和PGDATABASE已设置
pg_dump > ai_learning_companion_backup.sql
```

### 方法3：使用pgAdmin等图形工具

1. 连接到数据库
2. 右键点击数据库名称
3. 选择"Backup..."选项
4. 填写备份设置，选择"Plain"格式
5. 点击"Backup"按钮

## 三、迁移到新数据库

### 方法1：使用psql命令行工具

```bash
# 1. 创建目标数据库
createdb -U username -h target_host -p target_port new_database_name

# 2. 导入备份文件
psql -U username -h target_host -p target_port -d new_database_name -f ai_learning_companion_backup.sql
```

### 方法2：使用环境变量(适用于Replit)

```bash
# 1. 确保目标环境变量已配置
export PGUSER=target_username
export PGHOST=target_host
export PGPORT=target_port
export PGDATABASE=new_database_name

# 2. 创建新数据库
createdb

# 3. 导入备份
psql -f ai_learning_companion_backup.sql
```

### 方法3：使用pgAdmin等图形工具

1. 连接到目标PostgreSQL服务器
2. 创建新数据库
3. 右键点击新数据库
4. 选择"Restore..."选项
5. 选择备份文件，确保格式为"Plain"
6. 点击"Restore"按钮

## 四、数据验证步骤

迁移完成后，执行以下步骤验证数据完整性：

```bash
# 连接到新数据库
psql -U username -h target_host -p target_port -d new_database_name

# 执行验证查询
SELECT COUNT(*) FROM users;           # 验证用户数据
SELECT COUNT(*) FROM memories;        # 验证记忆数据
SELECT COUNT(*) FROM messages;        # 验证消息数据

# 验证与系统相关的上下文菜单
SELECT * FROM system_config LIMIT 5;  # 验证系统配置

# 验证索引
\di                                  # 列出所有索引
```

验证要点：

1. 记录数量应与源数据库匹配
2. 所有表、索引和约束应正确创建
3. 应能成功执行简单的SELECT查询
4. 外键关系应保持完整

## 五、移动端迁移考虑

在移动设备上进行数据库迁移需要特别注意以下事项：

### 备份文件传输

1. **云存储传输**：
   - 将备份文件上传到云存储(Dropbox、Google Drive等)
   - 在移动设备上下载

2. **直接传输**：
   - 使用AirDrop(iOS)或附近共享(Android)
   - 通过USB连接传输

### 移动端PostgreSQL客户端

推荐以下移动端PostgreSQL客户端应用：

1. **iOS**:
   - PostgreSQL Client
   - pgAdmin 4 (浏览器访问)

2. **Android**:
   - SQL Manager for PostgreSQL
   - pgAdmin 4 (浏览器访问)

### 移动端导入步骤

1. 在移动设备上安装PostgreSQL客户端
2. 配置连接到目标PostgreSQL服务器
3. 创建新数据库
4. 使用客户端的导入/恢复功能导入备份

## 六、常见问题与解决方案

### 导入时出现权限错误

**错误**: `ERROR: permission denied for relation [table_name]`

**解决方案**:
1. 确保导入用户具有足够权限
2. 执行：`GRANT ALL PRIVILEGES ON DATABASE new_database_name TO username;`

### 序列值不正确

**问题**: 自增ID从1开始而不是继续原有值

**解决方案**:
导入后执行序列重置脚本：
```sql
SELECT setval(pg_get_serial_sequence('table_name', 'id'), 
              (SELECT MAX(id) FROM table_name), true);
```

### 空间不足错误

**错误**: `No space left on device`

**解决方案**:
1. 清理目标环境上不必要的文件
2. 考虑使用压缩的备份文件减小传输大小
3. 验证目标环境至少有备份文件大小5倍的可用空间

### 版本兼容性问题

**错误**: 版本兼容性警告或错误

**解决方案**:
1. 确保目标PostgreSQL版本不低于源版本
2. 如需降级，使用`pg_dump --compatible=版本号`创建兼容备份

## 七、恢复计划

如果迁移过程失败或数据验证未通过，请执行以下恢复步骤：

1. **记录错误信息**，包括完整的错误消息和执行的命令
2. **保留不完整的目标数据库**用于诊断
3. **重新创建目标数据库**并重试导入过程
4. 如果继续失败，尝试创建不同格式的备份(例如，使用`pg_dump -Fc`创建自定义格式)

## 八、迁移后配置

成功导入数据后，执行以下后续步骤：

1. **更新应用配置**以指向新数据库
2. **重建索引**以优化性能：
   ```sql
   REINDEX DATABASE new_database_name;
   ```
3. **更新统计信息**以优化查询计划：
   ```sql
   ANALYZE;
   ```
4. **设置适当的权限**，确保最小权限原则
5. **验证应用连接**，确保应用能成功连接到新数据库

## 结论

通过本指南，您应能成功将AI学习伴侣系统的数据库迁移到新环境。迁移过程设计为最小化风险并确保数据完整性。如遇到指南中未涵盖的问题，请参考PostgreSQL官方文档或寻求专业数据库管理员的帮助。

---

### 附录A：备份脚本

```bash
#!/bin/bash
# 数据库备份脚本

# 配置变量
DB_USER="your_username"
DB_HOST="your_host"
DB_PORT="5432"
DB_NAME="your_database"
BACKUP_DIR="/path/to/backup/directory"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="${BACKUP_DIR}/ai_learning_companion_${DATE}.sql"

# 创建备份
pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME > $BACKUP_FILE

# 检查备份成功
if [ $? -eq 0 ]; then
  echo "备份成功: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"
else
  echo "备份失败!"
  exit 1
fi

# 压缩备份
gzip $BACKUP_FILE
echo "备份已压缩: ${BACKUP_FILE}.gz ($(du -h ${BACKUP_FILE}.gz | cut -f1))"
```

### 附录B：恢复脚本

```bash
#!/bin/bash
# 数据库恢复脚本

# 配置变量
DB_USER="target_username"
DB_HOST="target_host"
DB_PORT="5432"
DB_NAME="new_database_name"
BACKUP_FILE="/path/to/ai_learning_companion_backup.sql"

# 创建数据库
createdb -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME
if [ $? -ne 0 ]; then
  echo "创建数据库失败!"
  exit 1
fi

# 恢复备份
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f $BACKUP_FILE
if [ $? -eq 0 ]; then
  echo "恢复成功!"
else
  echo "恢复失败!"
  exit 1
fi

# 验证数据
echo "验证数据..."
USER_COUNT=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -t -c "SELECT COUNT(*) FROM users;")
MEMORY_COUNT=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -t -c "SELECT COUNT(*) FROM memories;")
echo "用户数: $USER_COUNT"
echo "记忆数: $MEMORY_COUNT"
```