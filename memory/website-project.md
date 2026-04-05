# 网站项目详细文档

## 项目概述
家庭共享相册网站，Express + 原生 JS，无前端框架。支持图片上传、浏览、评论、表情回应、主题切换、标签筛选、搜索、分组、收藏、首页记忆区与拖拽排序。

## 技术栈
- 后端：Node.js + Express + multer（文件上传）
- 前端：原生 HTML / CSS / JS，无框架
- 存储：本地文件系统（原图 + 缩略图）+ JSON 文件（`photo-data.json`）

## 已实现功能清单
- 图片上传（多选、压缩、进度条）
- 拖拽到上传区上传
- 本地上传预览
- 上传时填写描述 / 标签 / 分组
- 4 列网格展示，图片 1:1 比例
- 懒加载（IntersectionObserver）
- 灯箱查看（左右切换按钮 + 键盘方向键）
- 手机端左右滑动切图 / 下滑关闭
- 图片滤镜（黑白 / 复古 / 鲜艳 / 明亮 / 冷峻 / 赛博）
- 图片编辑（亮度 / 对比度 / 饱和度 / 模糊滑块）
- 表情回应（❤️😂😮😢👍）
- 评论系统（发表 / 删除，昵称绑定）
- 昵称系统（首次进入必填，localStorage 存储）
- 批量删除（多选模式，密码验证）
- 批量写简介
- 批量加入 / 新建分组
- 标签点击即筛选
- 单张图片编辑描述 / 标签
- 收藏功能与“仅看收藏”筛选
- 首页最近新增 / 往年今日
- 深色 / 浅色主题切换 + 预设渐变 + 自定义颜色
- Header 动态文字 + 主题包 + 节日推荐主题

## JS 关键模块
```text
js/main.js       — 模块入口
js/dom.js        — DOM 引用集中管理
js/state.js      — 前端状态管理
js/api.js        — API 封装
js/gallery.js    — 列表渲染、筛选、分组、排序、收藏、首页记忆区
js/upload.js     — 上传、压缩、拖拽上传、上传反馈
js/lightbox.js   — 灯箱详情、编辑、收藏、移动端手势
js/comments.js   — 评论与表情回应
js/theme.js      — 主题逻辑
js/feedback.js   — 顶部状态提示
```

## API 路由
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

## 当前拖拽排序规则
拖拽排序只在以下场景启用：
- `全部图片`
- `sortMode === custom`
- `contentFilter === all`
- 无搜索关键词
- 无标签筛选
- 非批量模式
- 非上传本地预览态
- 非保存中

## 当前数据结构补充
`photo-data.json` 中每张图现在可能包含：
```json
{
  "likes": 0,
  "comments": [],
  "reactions": {},
  "caption": "家庭聚餐",
  "favorited": false,
  "tags": ["家宴", "周末"],
  "order": 0,
  "groupName": "生日",
  "thumbnail": "1711111111111-abc123def.jpg"
}
```

## 已知注意事项
- `pwdConfirmBtn` 的事件绑定只能保留一个
- `upload-section` 的 `margin-bottom` 是 16px
- 理想上 `style.css` 只应保留一个 `@media (max-width: 768px)`，但当前仓库实际还有两个，后续整理时要统一合并，不要再新增第三个
- 涉及收藏、搜索、分组、首页记忆区时，要注意状态联动是否正确
- 拖拽排序规则不要随意放宽
