# 网站项目速查

项目路径：`d:\code\网站项目`
详细文档：见 [website-project.md](website-project.md)

## 当前项目定位
- 家庭共享相册
- Express + 原生 JS
- 强调上传、整理、回忆与互动

## 当前主要文件
- `index.html` — 页面结构
- `style.css` — 所有样式（含响应式）
- `js/main.js` — 前端模块入口
- `js/gallery.js` / `js/upload.js` / `js/lightbox.js` / `js/comments.js` / `js/theme.js` — 业务模块
- `js/dom.js` / `js/state.js` / `js/api.js` — 基础模块
- `server.js` — Express 后端，端口 3000
- `uploads/` — 图片目录
- `photo-data.json` — 点赞 / 评论 / 表情 / 描述 / 标签 / 收藏 / 排序 / 分组等元数据

## 当前关键配置
- 删除密码：`process.env.DELETE_PASSWORD || 'by-2099'`
- 图片压缩：maxSize=2560px，quality=0.92
- 上传限制：10MB，仅图片，一次最多 10 张
- 部署平台：Railway（支持 `RAILWAY_VOLUME_MOUNT_PATH`）

## 当前关键能力
- 上传前压缩 + 上传进度条 + 拖拽上传
- 列表搜索、标签点击筛选、分组导航
- 收藏与“仅看收藏”
- 首页最近新增 / 往年今日
- 灯箱键盘切图 + 手机手势切图
- 全部图片页拖拽排序
