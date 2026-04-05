# 家庭共享相册

一个轻量但功能完整的家庭共享相册网站，基于 `Node.js + Express + 原生 HTML/CSS/JS`。适合家庭成员一起上传照片、浏览回忆、留言互动，并通过标签、分组、收藏、搜索和主题把照片整理得更有温度。

## 当前亮点

- 多图上传，前端自动压缩
- 支持拖拽到上传区上传
- 上传时可填写描述、标签、分组
- 4 列相册网格，懒加载
- 灯箱查看、键盘切图、手机手势切图
- 图片滤镜与基础编辑
- 评论系统、表情回应、昵称系统
- 深色 / 浅色模式与主题包
- 标签点击即筛选
- 单张照片编辑描述 / 标签
- 收藏功能与“仅看收藏”筛选
- 首页“最近新增 / 往年今日”模块
- 全部图片页支持拖拽排序，刷新后顺序保留
- 批量删除、批量写简介、批量加入分组

## 技术栈

- 前端：原生 `HTML / CSS / JavaScript`
- 后端：`Node.js + Express`
- 上传：`multer`
- 数据存储：
  - 原图：`uploads/`
  - 缩略图：`uploads/thumbnails/`（本地）或 `thumbnails/`（Railway Volume）
  - 元数据：`photo-data.json`

## 主要文件

- `index.html`：页面结构
- `style.css`：所有样式与响应式
- `js/main.js`：前端模块入口
- `js/dom.js` / `js/state.js` / `js/api.js`：基础模块
- `js/gallery.js` / `js/upload.js` / `js/lightbox.js` / `js/theme.js` / `js/comments.js` / `js/feedback.js`：业务模块
- `server.js`：后端启动入口
- `server/routes/` / `server/data/` / `server/services/`：后端路由、存储与缩略图逻辑
- `uploads/`：原图目录
- `uploads/thumbnails/` 或 `thumbnails/`：缩略图目录
- `photo-data.json`：点赞、评论、标签、描述、收藏、排序、分组、缩略图文件名等数据
- `CLAUDE.md`：项目约定与修改注意事项
- `CODEX.md`：给 Codex 快速接手项目用的上下文文档

## 已实现功能

### 照片管理
- 多图上传
- 上传进度条
- 上传前压缩（最大边 2560px，质量 0.92）
- 本地上传预览
- 拖拽上传
- 上传时填写描述 / 标签 / 分组
- 平铺模式拖拽排序
- 批量删除
- 批量写简介
- 批量加入 / 新建分组
- 单张删除密码保护

### 浏览体验
- 4 列网格展示
- 图片 1:1 比例裁切
- 懒加载
- 灯箱查看
- 左右切换
- 键盘方向键切换
- 手机端左右滑切图
- 手机端下滑关闭
- 照片故事区显示日期、描述、标签、分组信息
- 首页最近新增
- 首页往年今日

### 图片互动
- 表情回应：`❤️ 😂 😮 😢 👍`
- 评论系统
- 昵称系统（首次进入必填）
- 收藏 / 取消收藏
- 仅看收藏筛选

### 主题与外观
- 深色 / 浅色模式
- 预设背景渐变
- 自定义渐变背景
- 家庭氛围标题区
- 节日主题推荐
- 主题包切换

### 查找与整理
- 搜索文件名、描述、标签、分组、月份
- 标签点击即筛选
- 分组导航
- 单张照片编辑描述 / 标签
- 只有在“全部图片 + 手动顺序 + 非搜索/非批量/非上传预览/非收藏筛选”时允许拖拽排序

## API

```text
GET    /api/photos
GET    /api/photos/:id
PATCH  /api/photos/:id
PATCH  /api/photos/:id/favorite
PATCH  /api/photos/batch/caption
POST   /api/upload
POST   /api/photos/reorder
DELETE /api/photos/:id
POST   /api/photos/:id/like
POST   /api/photos/:id/react
POST   /api/photos/:id/comment
DELETE /api/photos/:photoId/comment/:commentId
```

## 本地运行

```bash
npm install
npm start
```

默认访问：`http://localhost:3000`

## 重要配置

- 删除密码：`DELETE_PASSWORD`，默认值 `by-2099`
- 端口：`PORT`，默认 `3000`
- Railway 持久化目录：`RAILWAY_VOLUME_MOUNT_PATH`
- 上传限制：单张 10MB，一次最多 10 张

## 拖拽排序规则

拖拽排序只在以下条件同时满足时启用：
- 当前在“全部图片”
- 排序方式为“手动顺序”
- 当前不是搜索结果
- 当前没有标签筛选
- 当前不是批量模式
- 当前没有本地上传预览
- 当前内容筛选是“全部照片”而不是“仅看简介”或“仅看收藏”

## 部署

详细步骤见 [部署教程.md](./部署教程.md)

Railway 部署时建议：
- 添加 Volume 挂载 `/data`
- 设置 `RAILWAY_VOLUME_MOUNT_PATH=/data`
- 设置 `DELETE_PASSWORD`

## 注意事项

- `photo-data.json` 当前会保存：`caption`、`favorited`、`tags`、`order`、`groupName`、`thumbnail` 等信息
- 如果你在新对话里直接让我继续开发，优先让我看 `CODEX.md`
- 如果要修改项目约定和注意事项，优先更新 `CLAUDE.md`
