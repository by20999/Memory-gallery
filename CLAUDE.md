# 项目：家庭共享相册

轻量家庭相册网站，技术栈为 `Express + 原生 HTML/CSS/JS`。当前已经支持上传、浏览、评论、表情回应、图片编辑、主题切换、搜索、分组、拖拽排序、收藏、首页记忆区与移动端手势浏览。

## 技术栈
- 前端：原生 HTML / CSS / JS
- 后端：Node.js + Express + multer
- 存储：本地文件系统（原图 + 缩略图）+ JSON 元数据（`photo-data.json`）

## 当前文件结构
- `index.html` — 页面结构
- `style.css` — 所有样式（含响应式）
- `js/main.js` — 前端模块入口
- `js/dom.js` / `js/state.js` / `js/api.js` — DOM、状态与请求封装
- `js/gallery.js` / `js/upload.js` / `js/lightbox.js` / `js/comments.js` / `js/theme.js` / `js/feedback.js` — 业务模块
- `server.js` — Express 启动入口，端口 3000
- `server/routes/` / `server/data/` / `server/services/` — 后端路由、存储与服务层
- `uploads/` — 原图目录
- `uploads/thumbnails/` 或 `thumbnails/` — 缩略图目录
- `photo-data.json` — 点赞 / 评论 / 表情 / 描述 / 标签 / 收藏 / 排序 / 分组 / 缩略图数据

## 关键配置
- 删除密码：`process.env.DELETE_PASSWORD || 'by-2099'`
- 图片压缩：`maxSize=2560px`，`quality=0.92`
- 上传限制：10MB，仅图片，一次最多 10 张
- 部署平台：Railway（支持 `RAILWAY_VOLUME_MOUNT_PATH`，Volume 挂载 `/data`）

## 当前已实现功能

### 上传与管理
- 图片多选上传
- 上传前压缩
- 上传进度条
- 本地上传预览
- 拖拽到上传区上传
- 上传时填写描述、标签、分组
- 批量删除
- 批量写简介
- 批量加入 / 新建分组
- 单张删除密码保护

### 浏览与查看
- 4 列网格展示
- 图片 1:1 比例卡片
- 懒加载
- 灯箱查看
- 左右切换按钮
- 键盘左右切图
- 手机端左右滑动切图
- 手机端下滑关闭灯箱

### 内容整理
- 标签点击即筛选
- 单张照片编辑描述 / 标签
- 搜索：文件名 / 描述 / 标签 / 分组 / 上传月份
- 分组导航与封面图
- 手动拖拽排序
- 收藏功能
- “仅看收藏”筛选
- 首页“最近新增”
- 首页“往年今日”

### 互动与氛围
- 表情回应（❤️😂😮😢👍）
- 评论系统（发表 / 删除）
- 昵称系统
- 深色 / 浅色主题切换
- 背景渐变预设 + 自定义渐变
- 主题包：奶油相册 / 胶片相册 / 夏日相册
- 节日主题推荐
- Header 家庭氛围文案 + 动态副标题

## API 路由（当前）
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

## 关键前端状态 / 函数
```text
photos[]              — 服务端正式照片数组
localUploadPreviews[] — 本地上传预览数组
visiblePhotos[]       — 当前可见图片数组
currentPhotoIndex     — 当前灯箱图片索引
batchMode             — 是否处于批量选择模式
selectedIds           — Set，批量选中的图片 id
searchKeyword         — 当前搜索关键词
activeTagFilter       — 当前标签筛选
activeGroupName       — 当前分组
sortMode              — custom / newest / oldest / name
contentFilter         — all / captioned / favorites
reorderSaving         — 是否正在保存拖拽排序

togglePhotoFavorite() — 切换收藏
openPhotoById()       — 按 id 打开照片
renderMemoryBoard()   — 渲染首页最近新增 / 往年今日
loadPhotos()          — 从 /api/photos 拉取数据并渲染
renderGallery()       — 渲染列表、筛选、拖拽、首页模块
openLightbox(index)   — 打开灯箱并拉取详情
canDragReorder()      — 判断当前是否允许拖拽排序
persistPhotoOrder()   — 提交拖拽排序到后端
```

## 当前拖拽排序规则（很重要）
拖拽排序**只允许**在以下条件下启用：
- 当前是 `全部图片`
- `sortMode === 'custom'`
- `contentFilter === 'all'`
- 没有搜索关键词
- 没有标签筛选
- 不在批量模式
- 不在排序保存中
- 没有本地上传预览

不要把拖拽排序默认开放到：
- 分组页
- 收藏页
- 搜索页
- 批量模式
- 上传预览态

## 当前数据结构补充
`photo-data.json` 中每张图可能包含：
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

## 当前样式与交互注意事项
- 回复用中文
- 修改时注意保持现有功能不被破坏
- `pwdConfirmBtn` 的事件绑定只能保留一个
- `upload-section` 的 `margin-bottom` 是 `16px`
- 深色模式 CSS 变量 `--accent` 的语义不要随意改坏
- 新功能如果涉及搜索 / 分组 / 收藏 / 首页记忆区，要同时检查状态切换后的列表是否正确

## 关于 `style.css` 的实际现状
理想约束是：`@media (max-width: 768px)` 只有一个块并放在文件末尾。

**但当前仓库实际还保留两个同类 media block。**
因此：
- 后续不要再新增第三个
- 如果要整理样式，建议单开一次“样式结构清理”任务，把两个块合并

## 运行
```bash
npm install
npm start
```
