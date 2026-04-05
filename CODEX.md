# CODEX 项目接手文档

这是一份给 Codex 在新对话里快速接手项目使用的上下文文档。
如果用户说：
- “先看 `CODEX.md` 再继续”
- “按 `CODEX.md` 继续做这个项目”

通常就可以直接进入开发，不需要重新通读整个仓库。

## 项目一句话概述

这是一个 **家庭共享相册** 项目，技术栈是 **Node.js + Express + 原生 HTML/CSS/JS**，目标不是做通用图库，而是做一套偏“家庭回忆册”的轻量网站。

## 当前产品定位

核心关键词：
- 温馨
- 简单
- 适合家庭成员共同使用
- 同时照顾桌面端和手机端
- 强调“回忆感 + 整理感 + 互动感”

## 当前技术结构

### 前端
- 原生 HTML / CSS / JS
- 按模块拆分在 `js/` 目录，而不是单文件脚本
- 入口：`js/main.js`

### 后端
- Node.js + Express
- `multer` 负责上传
- 本地文件系统保存图片
- `photo-data.json` 保存元数据

### 存储
- 原图：`uploads/`
- 缩略图：`uploads/thumbnails/` 或 `thumbnails/`
- 元数据：`photo-data.json`

## 当前已落地功能

### 浏览与互动
- 4 列相册网格
- 懒加载
- 灯箱查看
- 键盘左右切图
- 手机端灯箱左右滑动切图
- 手机端灯箱下滑关闭
- 评论系统
- 表情回应
- 昵称系统

### 图片处理
- 上传前压缩
- 上传进度条
- 图片滤镜
- 图片编辑（亮度 / 对比度 / 饱和度 / 模糊）

### 外观与主题
- 深色 / 浅色模式
- 预设渐变背景
- 自定义渐变背景
- 主题包：`奶油相册`、`胶片相册`、`夏日相册`
- 节日自动推荐主题
- Header 家庭氛围文案与动态副标题

### 内容整理
- 上传时填写描述 `caption`
- 上传时填写标签 `tags`
- 上传时选择分组 `groupName`
- 标签点击即筛选
- 搜索：文件名 / 描述 / 标签 / 分组 / 上传月份
- 分组导航
- 单张照片编辑描述 / 标签
- 批量写简介
- 批量加入 / 新建分组
- 首页“最近新增”
- 首页“往年今日”
- 收藏功能
- “仅看收藏”筛选

### 上传体验
- 本地上传预览
- 拖拽到上传区上传
- 拖拽上传时沿用当前描述 / 标签 / 分组
- 上传成功后自动滚动回相册区

### 管理能力
- 单张删除
- 批量删除
- 删除密码保护
- 手动拖拽排序并持久化
- 拖拽排序视觉反馈增强

## 当前关键交互规则

### 拖拽排序限制
**只允许在以下条件同时满足时启用拖拽排序：**
- 当前在 `全部图片`
- 排序模式为 `手动顺序`（`custom`）
- 当前不是搜索结果
- 当前没有标签筛选
- 当前不是批量模式
- 当前不是上传本地预览状态
- 当前内容筛选为 `all`，不是 `captioned` / `favorites`
- 当前不在保存排序中

也就是：**不能把拖拽排序随意开放到分组页、搜索页、收藏页、上传预览态。**

### 首页记忆区显示规则
首页“最近新增 / 往年今日”只在默认首页视图显示：
- `全部图片`
- `contentFilter === 'all'`
- 无搜索
- 无标签筛选
- 非批量模式

### 收藏功能规则
- 收藏支持在卡片列表和灯箱中操作
- 收藏状态保存在 `photo-data.json`
- “仅看收藏”下取消收藏后，该照片会自动从当前视图移出

## 当前数据结构重点

`photo-data.json` 中单张照片当前可能包含：

```json
{
  "likes": 0,
  "comments": [],
  "reactions": {},
  "caption": "春天一起去公园",
  "favorited": false,
  "tags": ["春天", "散步"],
  "order": 0,
  "groupName": "生日",
  "thumbnail": "1711111111111-abc123def.jpg"
}
```

字段说明：
- `caption`：照片描述
- `favorited`：是否收藏
- `tags`：标签数组
- `order`：人工排序顺序，数值越小越靠前
- `groupName`：所属分组
- `thumbnail`：缩略图文件名

## 后端关键接口

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

说明：
- `PATCH /api/photos/:id`：更新单张照片描述 / 标签
- `PATCH /api/photos/:id/favorite`：切换收藏状态
- `PATCH /api/photos/batch/caption`：批量更新简介

## 关键文件职责速览

- `index.html`：页面结构和主要 DOM
- `style.css`：全部样式
- `js/main.js`：前端入口
- `js/dom.js`：DOM 引用集中管理
- `js/state.js`：前端状态存储
- `js/gallery.js`：列表渲染、筛选、分组、拖拽排序、首页记忆区、收藏列表入口
- `js/upload.js`：上传、压缩、拖拽上传、进度反馈
- `js/lightbox.js`：灯箱、详情、手势、灯箱收藏
- `js/comments.js`：评论与表情互动
- `js/feedback.js`：状态提示
- `js/api.js`：前端 API 请求封装
- `server/routes/photos.js`：图片相关接口
- `server/data/photoStore.js`：图片元数据读写与规范化
- `CLAUDE.md`：项目规则、约束、注意事项
- `README.md`：面向使用者 / 维护者的项目说明
- `部署教程.md`：部署说明

## 修改时必须注意

- 回复用中文
- 不要随意破坏现有功能
- `pwdConfirmBtn` 只能保留一个事件绑定
- `upload-section` 的 `margin-bottom` 仍然要求是 `16px`
- 涉及拖拽排序时，优先保持当前限制规则
- 首页记忆区、收藏筛选、分组、搜索现在已经互相联动，改动时要检查状态冲突

## 当前样式层面的实际情况

文档原约定是：`style.css` 最终只保留一个 `@media (max-width: 768px)` 且放在文件末尾。

**但当前仓库实际仍有两个 `@media (max-width: 768px)` 块，尚未统一合并。**

因此后续开发建议：
- 先不要再新增第三个同类 media block
- 如果要做样式大清理，单开一轮专门整理 `style.css`

## 如果新对话要继续开发，推荐起手式

建议先做：
1. 读 `CODEX.md`
2. 如有必要再读 `CLAUDE.md`
3. 只查看和当前需求直接相关的模块文件

## 当前更适合继续做的方向

- 手机端细节继续打磨
- `style.css` 结构清理与 media block 合并
- 灯箱动效和列表视觉统一
- 时间线 / 回忆流视图
- 分组管理继续增强
- 上传后的定位与成功态优化
- 更多家庭相册型首页模块
