const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const DELETE_PASSWORD = process.env.DELETE_PASSWORD || 'by-2099';
const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? process.env.RAILWAY_VOLUME_MOUNT_PATH
    : path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? process.env.RAILWAY_VOLUME_MOUNT_PATH
    : __dirname;
const dataFile = path.join(dataDir, 'photo-data.json');

function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
        return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
    }
    return [...new Set(String(tags).split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeOrder(order) {
    return Number.isFinite(Number(order)) ? Number(order) : null;
}

function normalizePhotoEntry(entry = {}) {
    return {
        likes: Number(entry.likes) || 0,
        comments: Array.isArray(entry.comments) ? entry.comments : [],
        reactions: entry.reactions && typeof entry.reactions === 'object' ? entry.reactions : {},
        caption: typeof entry.caption === 'string' ? entry.caption.trim() : '',
        tags: normalizeTags(entry.tags),
        order: normalizeOrder(entry.order)
    };
}

function loadPhotoData() {
    if (!fs.existsSync(dataFile)) return {};
    try {
        const raw = fs.readFileSync(dataFile, 'utf8').trim();
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return Object.fromEntries(Object.entries(parsed).map(([photoId, entry]) => [photoId, normalizePhotoEntry(entry)]));
    } catch {
        return {};
    }
}

function savePhotoData(data) {
    const normalized = Object.fromEntries(Object.entries(data).map(([photoId, entry]) => [photoId, normalizePhotoEntry(entry)]));
    fs.writeFileSync(dataFile, JSON.stringify(normalized, null, 2));
}

function getPhotoMeta(photoId, photoData) {
    const data = normalizePhotoEntry(photoData[photoId]);
    return {
        likes: data.likes,
        commentsCount: data.comments.length,
        reactions: data.reactions,
        caption: data.caption,
        tags: data.tags,
        order: data.order
    };
}

function getPhotoDetails(photoId, photoData) {
    const data = normalizePhotoEntry(photoData[photoId]);
    return {
        likes: data.likes,
        comments: data.comments,
        reactions: data.reactions,
        caption: data.caption,
        tags: data.tags,
        order: data.order
    };
}

function ensurePhotoOrders(photos, photoData) {
    let changed = false;
    const ordered = [...photos].sort((a, b) => b.uploadTime - a.uploadTime);
    ordered.forEach((photo, index) => {
        const entry = normalizePhotoEntry(photoData[photo.id]);
        if (entry.order === null) {
            entry.order = index;
            photoData[photo.id] = entry;
            changed = true;
        }
    });
    if (changed) savePhotoData(photoData);
}

function sortPhotos(photos) {
    return photos.sort((a, b) => {
        const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
        const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return b.uploadTime - a.uploadTime;
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('只允许上传图片文件'));
    }
});

app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));
app.use(express.json());

app.get('/api/photos', (req, res) => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return res.status(500).json({ error: '读取图片失败' });

        const photoData = loadPhotoData();
        const photos = files
            .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map((file) => {
                const stats = fs.statSync(path.join(uploadDir, file));
                const meta = getPhotoMeta(file, photoData);
                return {
                    id: file,
                    src: `/uploads/${file}`,
                    name: file,
                    uploadTime: stats.mtime,
                    likes: meta.likes,
                    commentsCount: meta.commentsCount,
                    reactions: meta.reactions,
                    caption: meta.caption,
                    tags: meta.tags,
                    order: meta.order
                };
            });

        ensurePhotoOrders(photos, photoData);
        const refreshedData = loadPhotoData();
        const sortedPhotos = sortPhotos(photos.map((photo) => ({
            ...photo,
            order: getPhotoMeta(photo.id, refreshedData).order
        })));

        res.json(sortedPhotos);
    });
});

app.get('/api/photos/:id', (req, res) => {
    const photoId = req.params.id;
    const filePath = path.join(uploadDir, photoId);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: '图片不存在' });
    }

    const photoData = loadPhotoData();
    const details = getPhotoDetails(photoId, photoData);

    res.json({
        id: photoId,
        src: `/uploads/${photoId}`,
        likes: details.likes,
        comments: details.comments,
        reactions: details.reactions,
        caption: details.caption,
        tags: details.tags,
        order: details.order
    });
});

app.post('/api/upload', upload.array('photos', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    const caption = typeof req.body.caption === 'string' ? req.body.caption.trim() : '';
    const tags = normalizeTags(req.body.tags);
    const photoData = loadPhotoData();
    const existingOrders = Object.values(photoData)
        .map((entry) => normalizePhotoEntry(entry).order)
        .filter((order) => order !== null);
    const minOrder = existingOrders.length ? Math.min(...existingOrders) : 0;
    const startOrder = minOrder - req.files.length;

    const photos = req.files.map((file, index) => {
        const existing = normalizePhotoEntry(photoData[file.filename]);
        const order = startOrder + index;
        photoData[file.filename] = {
            ...existing,
            caption,
            tags,
            order
        };
        return {
            id: file.filename,
            src: `/uploads/${file.filename}`,
            name: file.originalname,
            caption,
            tags,
            order
        };
    });

    savePhotoData(photoData);
    res.json({ success: true, photos });
});

app.post('/api/photos/reorder', (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ error: '排序数据无效' });
    }

    const existingFiles = fs.readdirSync(uploadDir)
        .filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    const existingSet = new Set(existingFiles);

    if (orderedIds.length !== existingFiles.length) {
        return res.status(400).json({ error: '排序数量不匹配' });
    }

    const uniqueIds = new Set(orderedIds);
    if (uniqueIds.size !== orderedIds.length) {
        return res.status(400).json({ error: '排序数据重复' });
    }

    const hasUnknownId = orderedIds.some((photoId) => !existingSet.has(photoId));
    if (hasUnknownId) {
        return res.status(400).json({ error: '包含无效图片' });
    }

    const photoData = loadPhotoData();
    orderedIds.forEach((photoId, index) => {
        const entry = normalizePhotoEntry(photoData[photoId]);
        photoData[photoId] = {
            ...entry,
            order: index
        };
    });
    savePhotoData(photoData);
    res.json({ success: true });
});

app.delete('/api/photos/:id', (req, res) => {
    const photoId = req.params.id;
    const { password } = req.body;

    if (!password || password !== DELETE_PASSWORD) {
        return res.status(403).json({ error: '密码错误' });
    }

    const filePath = path.join(uploadDir, photoId);
    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ error: '删除失败' });

        const photoData = loadPhotoData();
        delete photoData[photoId];
        savePhotoData(photoData);
        res.json({ success: true });
    });
});

app.post('/api/photos/:id/like', (req, res) => {
    const photoId = req.params.id;
    const photoData = loadPhotoData();
    const entry = normalizePhotoEntry(photoData[photoId]);
    entry.likes += 1;
    photoData[photoId] = entry;
    savePhotoData(photoData);
    res.json({ success: true, likes: entry.likes });
});

app.post('/api/photos/:id/react', (req, res) => {
    const photoId = req.params.id;
    const { emoji } = req.body;
    const allowed = ['❤️', '😂', '😮', '😢', '👍'];

    if (!emoji || !allowed.includes(emoji)) {
        return res.status(400).json({ error: '无效的表情' });
    }

    const photoData = loadPhotoData();
    const entry = normalizePhotoEntry(photoData[photoId]);
    entry.reactions[emoji] = (entry.reactions[emoji] || 0) + 1;
    photoData[photoId] = entry;
    savePhotoData(photoData);
    res.json({ success: true, reactions: entry.reactions });
});

app.post('/api/photos/:id/comment', (req, res) => {
    const photoId = req.params.id;
    const { text, author } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: '评论内容不能为空' });
    }

    const photoData = loadPhotoData();
    const entry = normalizePhotoEntry(photoData[photoId]);
    const comment = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        text: text.trim(),
        author: author || '匿名',
        time: new Date().toISOString()
    };

    entry.comments.push(comment);
    photoData[photoId] = entry;
    savePhotoData(photoData);
    res.json({ success: true, comment });
});

app.delete('/api/photos/:photoId/comment/:commentId', (req, res) => {
    const { photoId, commentId } = req.params;
    const photoData = loadPhotoData();

    if (!photoData[photoId]) {
        return res.status(404).json({ error: '图片不存在' });
    }

    const entry = normalizePhotoEntry(photoData[photoId]);
    entry.comments = entry.comments.filter((comment) => comment.id !== commentId);
    photoData[photoId] = entry;
    savePhotoData(photoData);
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ 相册服务器运行在 http://localhost:${PORT}`);
    console.log(`📁 图片保存在: ${uploadDir}`);
    console.log(`💾 点赞评论数据保存在: ${dataFile}`);
});

