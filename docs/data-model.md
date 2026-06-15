# 数据模型

项目以图片文件 + JSON 元数据为持久化核心。

## 文件位置

本地默认：

```text
uploads/
uploads/thumbnails/
photo-data.json
group-data.json
story-data.json
```

设置 `RAILWAY_VOLUME_MOUNT_PATH` 后：

```text
<volume>/
<volume>/thumbnails/
<volume>/photo-data.json
<volume>/group-data.json
<volume>/story-data.json
```

## `photo-data.json`

顶层是以照片文件名为 key 的对象。

```json
{
  "memory-trip.jpg": {
    "likes": 0,
    "comments": [],
    "reactions": {},
    "caption": "海边合照",
    "favorited": false,
    "tags": ["旅行", "纪念"],
    "order": 0,
    "groupName": "暑假",
    "thumbnail": "memory-trip.jpg",
    "eventDate": "2026-06-09",
    "eventName": "海边旅行",
    "contentHash": "sha256...",
    "fileSize": 123456
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `likes` | number | 历史点赞计数。 |
| `comments` | array | 评论列表。 |
| `reactions` | object | 表情回应计数。 |
| `caption` | string | 照片描述。 |
| `favorited` | boolean | 是否收藏。 |
| `tags` | string[] | 标签。 |
| `order` | number/null | 手动排序值。 |
| `groupName` | string | 所属分组名。 |
| `thumbnail` | string | 缩略图文件名。 |
| `eventDate` | string | 用户整理时填写的事件日期，格式为 `YYYY-MM-DD`。 |
| `eventName` | string | 用户整理时填写的事件名称。 |
| `contentHash` | string | 上传时计算的图片内容 hash，用于重复检测。 |
| `fileSize` | number | 上传文件大小，单位字节。 |

评论结构：

```json
{
  "id": "timestamp-random",
  "text": "评论内容",
  "author": "昵称",
  "time": "2026-06-09T00:00:00.000Z"
}
```

## `group-data.json`

顶层是以分组名为 key 的对象。

```json
{
  "春节": {
    "coverPhotoId": "new-year.jpg"
  }
}
```

分组成员关系不存储在 `group-data.json`，而是存储在每张照片的 `groupName` 字段中。`group-data.json` 只保存分组扩展信息。

## `story-data.json`

```json
{
  "stories": [
    {
      "id": "story-xxx",
      "name": "一次旅行",
      "description": "短描述",
      "content": "长文本内容",
      "showcaseSubtitle": "全屏标题下方短文案",
      "showcaseFooter": "全屏底部寄语",
      "createdAt": "2026-06-09T00:00:00.000Z",
      "updatedAt": "2026-06-09T00:00:00.000Z",
      "items": [
        {
          "id": "story-item-xxx",
          "photoId": "memory-trip.jpg",
          "position": 0,
          "curveOffset": 0.18,
          "note": "",
          "sourceType": "photo",
          "sourceGroupName": "",
          "createdAt": "2026-06-09T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

故事条目字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 故事条目 ID。 |
| `photoId` | string | 对应照片文件名。 |
| `position` | number | 故事内排序位置。 |
| `curveOffset` | number | 时间线曲线偏移，范围 `-1` 到 `1`。 |
| `note` | string | 条目备注，当前预留。 |
| `sourceType` | string | `photo` 或 `group`。 |
| `sourceGroupName` | string | 来源分组名。 |
| `createdAt` | string | 创建时间。 |

## 数据一致性规则

- 照片文件名是照片 ID。
- 删除照片时必须同步删除 `photo-data.json` 中对应记录。
- 重命名照片时必须同步缩略图、分组封面和元数据 key。
- 分组列表由照片元数据反推，空分组不会长期保留。
- 故事条目引用不存在的照片时，接口响应会过滤掉该条目对应的照片展示数据。
- 修改数据模型必须先更新 normalize 函数，再更新文档。

## 浏览器本地个性化数据

昵称和头像属于当前浏览器的轻量个性化设置：

- `album_nickname`：昵称，保存在 `localStorage`。
- `album_avatar_image`：头像图片，前端裁剪压缩后的 data URL，保存在 `localStorage`。
- `album_story_showcase_text_layout_<storyId>`：故事全屏展示中标题下方文案栏与底部文案栏的位置偏移，保存在当前浏览器 `localStorage`，不影响 `story-data.json`。

这些字段不写入 `photo-data.json`、`group-data.json` 或 `story-data.json`，也不会上传服务器。清理浏览器数据、换设备或换浏览器后需要重新设置。
## 2026-06-12 补充：故事背景字段

`story-data.json` 的每个故事对象新增两个外观字段：

```json
{
  "backgroundPhotoId": "a.jpg",
  "backgroundOpacity": 0.18
}
```

- `backgroundPhotoId`：引用 `uploads/` 中已存在的相册图片文件名；空字符串表示不使用相册背景。
- `backgroundOpacity`：故事背景透明度，规范化范围为 `0` 到 `1`，默认 `0.18`，用于普通故事模式和全屏回忆剧场；全屏展示会尽量保留背景图片原始色彩与内容。
- 本地上传的故事背景图不写入 `story-data.json`，仅保存在当前浏览器 `localStorage`，键名为 `album_story_background_<storyId>`。

## 2026-06-15 补充：全屏展示短文案字段

`story-data.json` 的每个故事对象新增两个全屏展示专用短文案字段：

```json
{
  "showcaseSubtitle": "我们的青春、梦想、爱与感动",
  "showcaseFooter": "感谢这些年，我们一起走过的每一段"
}
```

- `showcaseSubtitle`：全屏展示标题下方短文案，最长 36 个字符。
- `showcaseFooter`：全屏展示底部寄语，最长 96 个字符。
- `content` 继续作为普通故事页“故事叙述”的长文本，不再承担全屏底部寄语用途。
