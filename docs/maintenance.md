# 维护手册

## 常见任务

### 清理无效缩略图

当前没有自动脚本。建议后续新增维护命令，对比 `uploads/` 和缩略图目录，删除无对应原图的缩略图。

### 重建缩略图

当前缩略图会在读取照片和故事时自动补齐；如果发现旧缩略图低于当前 1600px 目标尺寸，也会自动重建为高质量预览。若需要强制批量重建，建议后续新增脚本，而不是手动删除线上文件。

### 修复数据文件

优先通过 `server/data/*Store.js` 的 normalize 函数兼容旧数据。不要直接在路由里写一次性修复逻辑。

### 数据体检

执行：

```bash
npm run audit:data
```

如果报告 `missingFilesForMetadata`，说明 JSON 元数据中存在照片记录，但上传目录缺少对应原图。不要直接删除这些记录，先确认是否能从旧备份恢复。

### 本地备份

执行：

```bash
npm run backup:data
```

备份会写入 `backups/backup-<时间戳>/`。该目录默认被 Git 忽略。

### 修改删除密码

设置环境变量：

```bash
DELETE_PASSWORD=your-strong-password
```

生产环境不要使用默认值。

### 收尾一轮项目建设

每次完成新功能、重要修复、UI/交互调整或文档治理后，按以下顺序留痕：

1. 在 `docs/project-log.md` 追加当天记录，写明完成内容、关键决策、验证结果、风险和后续事项。
2. 如果涉及项目定位、架构边界、存储策略或长期维护习惯，同步更新 `memory/decision-log.md`。
3. 如果涉及阶段性体验或功能变化，同步更新 `memory/release-notes.md` 和 `docs/progress.md`。
4. 如果涉及模块、目录、API、数据字段、部署或运维方式，同步更新对应专题文档，例如 `docs/module-map.md`、`docs/api.md`、`docs/data-model.md` 或 `docs/deployment-operations.md`。

## 故障排查

### 首页能打开但没有照片

检查：

- `uploads/` 是否为空。
- `photo-data.json` 是否损坏。
- `/api/photos` 是否返回错误。
- 服务进程是否有读写权限。

### 上传失败

检查：

- 单张图片是否超过 100MB；超大图会由前端尝试高质量降采样，但极端大文件仍可能被后端拒绝。
- 上传目录是否可写。
- 磁盘是否满。
- 文件类型是否为图片。

### 缩略图不显示

检查：

- `sharp` 是否安装成功。
- 缩略图目录是否可写。
- `/thumbnails/<file>` 是否能访问。

### 删除失败

检查：

- `DELETE_PASSWORD` 是否正确。
- 原图文件是否存在。
- 服务是否有文件删除权限。
