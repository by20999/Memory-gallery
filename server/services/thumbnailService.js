const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { uploadDir } = require('../config');
const { getThumbnailFilename, getThumbnailPath, normalizePhotoEntry, savePhotoData } = require('../data/photoStore');

const THUMB_SIZE = 1600;
const THUMB_QUALITY = 92;
const THUMB_CONCURRENCY = 4;

async function shouldRegenerateThumbnail(photoPath, thumbPath) {
    if (!fs.existsSync(thumbPath)) return true;

    try {
        const [photoMeta, thumbMeta] = await Promise.all([
            sharp(photoPath).metadata(),
            sharp(thumbPath).metadata()
        ]);
        const sourceMaxSide = Math.max(Number(photoMeta.width || 0), Number(photoMeta.height || 0));
        const thumbMaxSide = Math.max(Number(thumbMeta.width || 0), Number(thumbMeta.height || 0));
        const targetMaxSide = Math.min(THUMB_SIZE, sourceMaxSide);
        return thumbMaxSide < targetMaxSide;
    } catch (error) {
        console.warn(`检查缩略图尺寸失败，将尝试重建: ${path.basename(thumbPath)}`, error.message);
        return true;
    }
}

async function ensureThumbnailForPhoto(photoId, photoData) {
    const entry = normalizePhotoEntry(photoData[photoId]);
    const thumbFilename = getThumbnailFilename(photoId, entry);
    const thumbPath = getThumbnailPath(photoId, entry);
    const nextEntry = { ...entry, thumbnail: thumbFilename };

    const photoPath = path.join(uploadDir, photoId);
    const needsRegenerate = await shouldRegenerateThumbnail(photoPath, thumbPath);

    if (!needsRegenerate) {
        if (entry.thumbnail !== thumbFilename) {
            photoData[photoId] = nextEntry;
            return true;
        }
        return false;
    }

    await sharp(photoPath)
        .rotate()
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
        .toFile(thumbPath);

    photoData[photoId] = nextEntry;
    return true;
}

async function ensureThumbnails(photoIds, photoData) {
    let changed = false;
    let index = 0;

    async function worker() {
        while (index < photoIds.length) {
            const currentIndex = index;
            index += 1;
            const photoId = photoIds[currentIndex];
            try {
                const didChange = await ensureThumbnailForPhoto(photoId, photoData);
                if (didChange) changed = true;
            } catch (error) {
                console.error(`生成缩略图失败: ${photoId}`, error);
            }
        }
    }

    const workerCount = Math.min(THUMB_CONCURRENCY, Math.max(photoIds.length, 1));
    await Promise.all(Array.from({ length: workerCount }, worker));

    return changed;
}

async function ensureAndPersistThumbnails(photoIds, photoData) {
    const changed = await ensureThumbnails(photoIds, photoData);
    if (changed) {
        savePhotoData(photoData);
    }
    return changed;
}

module.exports = {
    THUMB_SIZE,
    ensureThumbnailForPhoto,
    ensureThumbnails,
    ensureAndPersistThumbnails
};
