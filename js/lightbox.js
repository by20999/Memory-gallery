import { dom, editSliders } from './dom.js';
import { state, getCurrentPhoto, resetEditorState, updatePhotoInStore, updateGroupCoverInStore } from './state.js';
import { fetchPhotoDetails, updatePhotoDetails, setGroupCover } from './api.js';
import { normalizeTags, formatUploadDate, escapeHtml } from './utils.js';
import { getPhotoGroupName, applyTagFilter, applyGroupFilter, togglePhotoFavorite } from './gallery.js';
import { renderComments, updateReactionUI } from './comments.js';
import { showStatusNotice } from './feedback.js';
import { promptAddPhotoToStory } from './story.js';

let renderGalleryHandler = () => {};
let openSingleDeleteModalHandler = () => {};
let loadPhotosHandler = async () => {};
let touchStartPoint = null;

function updateNavBtns() {
    dom.lightboxPrev.disabled = state.currentPhotoIndex <= 0;
    dom.lightboxNext.disabled = state.currentPhotoIndex >= state.visiblePhotos.length - 1;
}

function syncCurrentPhotoIndex(photoId) {
    const nextIndex = state.visiblePhotos.findIndex((item) => item.id === photoId);
    if (nextIndex === -1) {
        showStatusNotice('这张照片已不在当前筛选结果中，已自动返回列表。', { tone: 'info', duration: 2600 });
        closeLightbox();
        return null;
    }
    state.currentPhotoIndex = nextIndex;
    updateNavBtns();
    return state.visiblePhotos[nextIndex];
}

function renderFavoriteBtn(photo) {
    if (!dom.favoriteBtn) return;
    const isFavorited = Boolean(photo?.favorited);
    dom.favoriteBtn.classList.toggle('active', isFavorited);
    dom.favoriteBtn.textContent = isFavorited ? '\u2605 \u5df2\u6536\u85cf' : '\u2606 \u6536\u85cf';
    dom.favoriteBtn.setAttribute('aria-pressed', isFavorited ? 'true' : 'false');
}

function getStoryCommentCount(photo) {
    return Array.isArray(photo.comments) ? photo.comments.length : Number(photo.commentsCount || 0);
}

function getStoryReactionCount(photo) {
    return Object.values(photo.reactions || {}).reduce((sum, count) => sum + Number(count || 0), 0);
}

function getStoryCompletionScore(photo) {
    let score = 20;
    if (String(photo.caption || '').trim()) score += 28;
    if ((photo.tags || []).length > 0) score += 22;
    if (getPhotoGroupName(photo)) score += 12;
    if (getStoryCommentCount(photo) > 0) score += 10;
    if (getStoryReactionCount(photo) > 0) score += 10;
    if (photo.favorited) score += 8;
    return Math.min(100, score);
}

function buildStoryNarration(photo) {
    const dateLabel = formatUploadDate(photo.uploadTime) || '某一天';
    const groupName = getPhotoGroupName(photo);
    const tags = normalizeTags(photo.tags).slice(0, 3).map((tag) => `#${tag}`);
    const commentCount = getStoryCommentCount(photo);
    const reactionCount = getStoryReactionCount(photo);
    const pieces = [];

    pieces.push(groupName ? `${dateLabel}，这张照片被收进了“${groupName}”这一册。` : `${dateLabel}，这张照片被留在了你的相册里。`);
    if (String(photo.caption || '').trim()) pieces.push(`它记下的是：${photo.caption}。`);
    else pieces.push('它还没有写下文字，现在正适合补上一句当时的状态。');
    if (tags.length > 0) pieces.push(`这张图的关键词是 ${tags.join('、')}。`);
    if (commentCount > 0 || reactionCount > 0) pieces.push(`这里已经留下 ${commentCount} 条评论和 ${reactionCount} 次表情回应。`);
    else pieces.push('这里还没有留言或回应，也许下一句评论就会让它更像一个完整片段。');
    if (photo.favorited) pieces.push('它已经被特别收藏，说明这不是一张会被轻易划过去的照片。');
    return pieces.join('');
}

function buildStorySequenceCard(label, photo, index) {
    if (!photo || typeof index !== 'number' || index < 0) {
        return `
            <div class="story-sequence-card is-empty">
                <span class="story-sequence-label">${escapeHtml(label)}</span>
                <strong>这一段暂时还没有更多照片</strong>
                <p>继续往相册里添新照片，这条内容线会在这里慢慢接长。</p>
            </div>
        `;
    }
    return `
        <button class="story-sequence-card" type="button" data-story-jump="${index}">
            <span class="story-sequence-label">${escapeHtml(label)}</span>
            <div class="story-sequence-cover">
                <img src="${escapeHtml(photo.thumbSrc || photo.src || '')}" alt="${escapeHtml(photo.name || '相邻照片')}" loading="lazy">
            </div>
            <strong>${escapeHtml(photo.caption || photo.name || '还没补描述')}</strong>
            <p>${escapeHtml(formatUploadDate(photo.uploadTime) || '还没有记录日期')}</p>
        </button>
    `;
}

function renderLightboxStory(photo) {
    const tags = (photo.tags || [])
        .map((tag) => `<button class="story-tag filter-chip${tag === state.activeTagFilter ? ' active' : ''}" type="button" data-filter-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`)
        .join('');
    const groupName = getPhotoGroupName(photo);
    const groupBlock = groupName
        ? `<div class="story-tags"><button class="story-tag filter-chip${groupName === state.activeGroupName && !state.searchKeyword.trim() ? ' active' : ''}" type="button" data-filter-group="${escapeHtml(groupName)}">分组 · ${escapeHtml(groupName)}</button></div>`
        : '';
    const isCurrentCover = photo.groupCoverPhotoId === photo.id;
    const completionScore = getStoryCompletionScore(photo);
    const commentCount = getStoryCommentCount(photo);
    const reactionCount = getStoryReactionCount(photo);
    const prevPhoto = state.currentPhotoIndex > 0 ? state.visiblePhotos[state.currentPhotoIndex - 1] : null;
    const nextPhoto = state.currentPhotoIndex < state.visiblePhotos.length - 1 ? state.visiblePhotos[state.currentPhotoIndex + 1] : null;
    const sequencePosition = state.currentPhotoIndex === null ? '' : `${state.currentPhotoIndex + 1} / ${state.visiblePhotos.length}`;

    dom.photoStory.innerHTML = `
        <div class="story-shell">
            <div class="story-header">
                <div class="story-header-meta">
                    <div class="story-date">${formatUploadDate(photo.uploadTime) || '刚刚上传'}</div>
                    <div class="story-sequence-index">${escapeHtml(sequencePosition)}</div>
                </div>
                <div class="story-header-actions">
                    ${groupName ? `<button class="story-edit-btn${isCurrentCover ? ' is-current' : ''}" type="button" data-set-group-cover="true" ${isCurrentCover ? 'disabled' : ''}>${isCurrentCover ? '当前封面' : '设为分组封面'}</button>` : ''}
                    <button class="story-edit-btn" type="button" data-add-to-story="true">加入故事</button>
                    <button class="story-edit-btn" type="button" data-edit-field="caption">${photo.caption ? '编辑描述' : '添加描述'}</button>
                    <button class="story-edit-btn" type="button" data-edit-field="eventDate">${photo.eventDate ? '编辑日期' : '添加日期'}</button>
                    <button class="story-edit-btn" type="button" data-edit-field="eventName">${photo.eventName ? '编辑事件' : '添加事件'}</button>
                    <button class="story-edit-btn" type="button" data-edit-field="tags">${(photo.tags || []).length ? '编辑标签' : '添加标签'}</button>
                    <button class="story-edit-btn subtle" type="button" data-edit-field="rename">重命名</button>
                </div>
            </div>
            <div class="story-progress">
                <div class="story-progress-head">
                    <span>内容完整度</span>
                    <strong>${completionScore}%</strong>
                </div>
                <div class="story-progress-track"><span style="width:${completionScore}%"></span></div>
            </div>
            <div class="story-metrics">
                <div class="story-metric"><span>标签</span><strong>${(photo.tags || []).length}</strong></div>
                <div class="story-metric"><span>评论</span><strong>${commentCount}</strong></div>
                <div class="story-metric"><span>回应</span><strong>${reactionCount}</strong></div>
                <div class="story-metric"><span>收藏</span><strong>${photo.favorited ? '已收起' : '未标记'}</strong></div>
            </div>
            ${photo.caption ? `<div class="story-caption">${escapeHtml(photo.caption)}</div>` : '<div class="story-caption empty">这张照片还没有简介，点右上角按钮就可以补上一句描述。</div>'}
            <div class="story-voice">
                <span class="story-voice-kicker">内容旁白</span>
                <p>${escapeHtml(buildStoryNarration(photo))}</p>
            </div>
            ${groupBlock}
            ${tags ? `<div class="story-tags">${tags}</div>` : '<div class="story-caption empty story-caption-inline">还没有标签，补上几个关键词后会更容易搜索和整理。</div>'}
            <div class="story-sequence">
                <div class="story-sequence-head">
                    <span>前后片段</span>
                    <em>${escapeHtml(sequencePosition || '当前照片')}</em>
                </div>
                <div class="story-sequence-grid">
                    ${buildStorySequenceCard('上一段', prevPhoto, state.currentPhotoIndex - 1)}
                    ${buildStorySequenceCard('下一段', nextPhoto, state.currentPhotoIndex + 1)}
                </div>
            </div>
        </div>
    `;
}

async function setCurrentPhotoAsGroupCover() {
    const photo = getCurrentPhoto();
    if (!photo) return;
    const groupName = getPhotoGroupName(photo);
    if (!groupName || photo.groupCoverPhotoId === photo.id) return;

    try {
        const result = await setGroupCover(groupName, photo.id);
        updateGroupCoverInStore(groupName, result.coverPhotoId || photo.id);
        const latestPhoto = getCurrentPhoto();
        if (!latestPhoto) return;
        renderLightboxStory(latestPhoto);
        renderGalleryHandler();
        showStatusNotice(`\u5df2\u5c06\u8fd9\u5f20\u7167\u7247\u8bbe\u4e3a\u201c${groupName}\u201d\u5206\u7ec4\u5c01\u9762`, { tone: 'success' });
    } catch (error) {
        console.error('\u8bbe\u7f6e\u5206\u7ec4\u5c01\u9762\u5931\u8d25:', error);
        showStatusNotice(error.message || '\u8bbe\u7f6e\u5206\u7ec4\u5c01\u9762\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5', { tone: 'error' });
    }
}

async function saveCurrentPhotoDetails(photo, payload, successMessage) {
    try {
        const result = await updatePhotoDetails(photo.id, payload);

        if (result.photoId && result.photoId !== photo.id) {
            await loadPhotosHandler();
            const nextIndex = state.visiblePhotos.findIndex((item) => item.id === result.photoId);
            if (nextIndex === -1) {
                closeLightbox();
                showStatusNotice('文件名已更新，但这张照片已经不在当前筛选结果里。', { tone: 'success' });
                return;
            }
            await openLightbox(nextIndex);
            showStatusNotice(successMessage || '照片文件名已更新', { tone: 'success' });
            return;
        }

        updatePhotoInStore(photo.id, {
            name: result.name || photo.name || '',
            caption: result.caption || '',
            tags: normalizeTags(result.tags),
            thumbSrc: result.thumbSrc || photo.thumbSrc || photo.src,
            groupName: result.groupName || photo.groupName || '',
            groupCoverPhotoId: result.groupCoverPhotoId || photo.groupCoverPhotoId || '',
            eventDate: result.eventDate || '',
            eventName: result.eventName || ''
        });
        renderGalleryHandler();
        const latestPhoto = syncCurrentPhotoIndex(photo.id);
        if (!latestPhoto) return;
        renderLightboxStory(latestPhoto);
        showStatusNotice(successMessage || '照片信息已更新', { tone: 'success' });
    } catch (error) {
        console.error('保存图片信息失败:', error);
        showStatusNotice(error.message || '保存图片信息失败，请重试', { tone: 'error' });
    }
}

async function promptEditPhotoField(field) {
    const photo = getCurrentPhoto();
    if (!photo) return;

    if (field === 'caption') {
        const rawCaption = window.prompt(
            photo.caption ? '修改这张照片的描述，留空可以清除。' : '给这张照片补一句描述，留空表示暂时不写。',
            photo.caption || ''
        );
        if (rawCaption === null) return;
        const caption = rawCaption.trim().slice(0, 80);
        if (caption === (photo.caption || '')) {
            showStatusNotice('描述没有变化', { tone: 'info', duration: 1600 });
            return;
        }
        await saveCurrentPhotoDetails(photo, { caption }, '描述已更新');
        return;
    }

    if (field === 'eventDate') {
        const rawEventDate = window.prompt(
            '补充事件日期，可写 2026-06-12、2026/6/12 或留空清除。',
            photo.eventDate || ''
        );
        if (rawEventDate === null) return;
        const eventDate = rawEventDate.trim();
        if (eventDate === (photo.eventDate || '')) {
            showStatusNotice('日期没有变化', { tone: 'info', duration: 1600 });
            return;
        }
        await saveCurrentPhotoDetails(photo, { eventDate }, '事件日期已更新');
        return;
    }

    if (field === 'eventName') {
        const rawEventName = window.prompt(
            '补充事件名，例如：毕业、旅行、生日、live；留空可以清除。',
            photo.eventName || ''
        );
        if (rawEventName === null) return;
        const eventName = rawEventName.trim().slice(0, 40);
        if (eventName === (photo.eventName || '')) {
            showStatusNotice('事件名没有变化', { tone: 'info', duration: 1600 });
            return;
        }
        await saveCurrentPhotoDetails(photo, { eventName }, '事件名已更新');
        return;
    }

    if (field === 'tags') {
        const rawTags = window.prompt(
            '补充标签，多个标签可用逗号、顿号或空格分开；留空可清除。',
            (photo.tags || []).join('\uFF0C')
        );
        if (rawTags === null) return;
        const tags = normalizeTags(rawTags).slice(0, 12);
        if (JSON.stringify(tags) === JSON.stringify(normalizeTags(photo.tags))) {
            showStatusNotice('标签没有变化', { tone: 'info', duration: 1600 });
            return;
        }
        await saveCurrentPhotoDetails(photo, { tags }, '标签已更新');
        return;
    }

    if (field === 'rename') {
        const rawName = window.prompt(
            '输入新的图片名称即可重命名；留空或取消会保持当前文件名。',
            String(photo.name || '').replace(/\.[^.]+$/u, '')
        );
        if (rawName === null) return;
        const renameTo = String(rawName || '').trim().replace(/\.[^.]+$/u, '').trim();
        const currentName = String(photo.name || '').trim().replace(/\.[^.]+$/u, '').trim();
        if (!renameTo || renameTo === currentName) {
            showStatusNotice('文件名没有变化', { tone: 'info', duration: 1600 });
            return;
        }
        await saveCurrentPhotoDetails(photo, { renameTo }, '照片文件名已更新');
    }
}

function resetFilterBtns() {
    dom.filterBtns.forEach((btn) => btn.classList.remove('active'));
    const noneButton = document.querySelector('.filter-btn[data-filter="none"]');
    if (noneButton) noneButton.classList.add('active');
}

function applyImageStyle() {
    const { brightness, contrast, saturate, blur } = state.currentEdit;
    const editFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px)`;
    const combined = state.currentFilter === 'none' ? editFilter : `${state.currentFilter} ${editFilter}`;
    dom.lightboxImg.style.filter = combined;
}

function resetEditSliders() {
    editSliders.forEach(({ id, valId, key, unit }) => {
        const value = state.currentEdit[key];
        document.getElementById(id).value = value;
        document.getElementById(valId).textContent = `${value}${unit}`;
    });
}

export async function openLightbox(index) {
    state.currentPhotoIndex = index;
    const photo = state.visiblePhotos[index];
    if (!photo) return;

    dom.lightboxImg.src = photo.src;
    dom.lightboxImg.style.filter = '';
    resetEditorState();
    resetEditSliders();
    resetFilterBtns();
    renderLightboxStory(photo);
    renderFavoriteBtn(photo);

    dom.filterBar.classList.remove('visible');
    dom.editBar.classList.remove('visible');
    dom.editToggleBtn.classList.remove('active');
    dom.editToggleBtn.textContent = '编辑图片';
    dom.commentsList.innerHTML = '<p style="color: #999; text-align: center;">评论加载中...</p>';
    dom.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';

    updateNavBtns();
    updateReactionUI(photo.reactions || {});

    try {
        const details = await fetchPhotoDetails(photo.id);
        const merged = {
            name: details.name || photo.name || '',
            likes: details.likes || 0,
            comments: details.comments || [],
            commentsCount: details.comments?.length || 0,
            reactions: details.reactions || {},
            caption: details.caption || '',
            favorited: Boolean(details.favorited),
            tags: normalizeTags(details.tags),
            groupName: details.groupName || '',
            groupCoverPhotoId: details.groupCoverPhotoId || photo.groupCoverPhotoId || '',
            eventDate: details.eventDate || '',
            eventName: details.eventName || '',
            duplicateKey: details.duplicateKey || photo.duplicateKey || '',
            thumbSrc: details.thumbSrc || photo.thumbSrc || photo.src
        };
        updatePhotoInStore(photo.id, merged);
        const latestPhoto = syncCurrentPhotoIndex(photo.id);
        if (!latestPhoto) return;
        updateReactionUI(latestPhoto.reactions || {});
        renderComments(latestPhoto.comments || []);
        renderLightboxStory(latestPhoto);
        renderFavoriteBtn(latestPhoto);
        renderGalleryHandler();
    } catch (error) {
        dom.commentsList.innerHTML = '<p style="color: #ff8aa1; text-align: center;">详情加载失败，可以稍后再试。</p>';
        console.error('加载详情失败:', error);
        showStatusNotice(error.message || '照片详情加载失败，请稍后重试', {
            tone: 'error',
            actionLabel: '重试详情',
            onAction: () => {
                if (state.currentPhotoIndex !== null) openLightbox(state.currentPhotoIndex);
            }
        });
    }
}

export function closeLightbox() {
    dom.lightbox.classList.remove('active');
    document.body.style.overflow = 'auto';
    state.currentPhotoIndex = null;
    dom.commentInput.value = '';
    dom.authorInput.value = '';
    touchStartPoint = null;
}

export function initLightbox({ onRenderGallery, onOpenSingleDeleteModal, onLoadPhotos }) {
    renderGalleryHandler = onRenderGallery;
    openSingleDeleteModalHandler = onOpenSingleDeleteModal;
    loadPhotosHandler = typeof onLoadPhotos === 'function' ? onLoadPhotos : loadPhotosHandler;

    dom.filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            state.currentFilter = btn.dataset.filter;
            applyImageStyle();
            dom.filterBtns.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    editSliders.forEach(({ id, valId, key, unit }) => {
        const input = document.getElementById(id);
        const valueLabel = document.getElementById(valId);
        input.addEventListener('input', () => {
            state.currentEdit[key] = Number(input.value);
            valueLabel.textContent = `${input.value}${unit}`;
            applyImageStyle();
        });
    });

    dom.resetEditBtn.addEventListener('click', () => {
        resetEditorState();
        resetEditSliders();
        resetFilterBtns();
        dom.lightboxImg.style.filter = '';
    });

    dom.saveEditBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = dom.lightboxImg.naturalWidth;
        canvas.height = dom.lightboxImg.naturalHeight;
        const context = canvas.getContext('2d');
        context.filter = dom.lightboxImg.style.filter || 'none';
        context.drawImage(dom.lightboxImg, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `edited_${Date.now()}.jpg`;
            link.click();
            URL.revokeObjectURL(link.href);
        }, 'image/jpeg', 0.92);
    });

    dom.photoStory.addEventListener('click', async (event) => {
        const editBtn = event.target.closest('[data-edit-field]');
        if (editBtn) {
            event.stopPropagation();
            await promptEditPhotoField(editBtn.getAttribute('data-edit-field') || '');
            return;
        }

        const coverBtn = event.target.closest('[data-set-group-cover]');
        if (coverBtn) {
            event.stopPropagation();
            await setCurrentPhotoAsGroupCover();
            return;
        }

        const addToStoryBtn = event.target.closest('[data-add-to-story]');
        if (addToStoryBtn) {
            event.stopPropagation();
            const photo = getCurrentPhoto();
            if (!photo) return;
            await promptAddPhotoToStory(photo.id, { trigger: addToStoryBtn });
            return;
        }

        const jumpBtn = event.target.closest('[data-story-jump]');
        if (jumpBtn) {
            event.stopPropagation();
            const nextIndex = Number(jumpBtn.dataset.storyJump);
            if (!Number.isNaN(nextIndex) && nextIndex >= 0 && nextIndex < state.visiblePhotos.length) openLightbox(nextIndex);
            return;
        }

        const chip = event.target.closest('[data-filter-tag], [data-filter-group]');
        if (!chip) return;
        closeLightbox();
        if (chip.dataset.filterTag) applyTagFilter(chip.dataset.filterTag);
        else if (chip.dataset.filterGroup) applyGroupFilter(chip.dataset.filterGroup);
    });

    if (dom.favoriteBtn) {
        dom.favoriteBtn.addEventListener('click', async () => {
            const photo = getCurrentPhoto();
            if (!photo) return;
            try {
                const favorited = await togglePhotoFavorite(photo.id, { skipNotice: true });
                const latestPhoto = syncCurrentPhotoIndex(photo.id);
                if (!latestPhoto) return;
                const mergedPhoto = { ...latestPhoto, favorited };
                renderFavoriteBtn(mergedPhoto);
                renderLightboxStory(mergedPhoto);
                showStatusNotice(favorited ? '\u5df2\u52a0\u5165\u6536\u85cf' : '\u5df2\u53d6\u6d88\u6536\u85cf', { tone: 'success', duration: 1800 });
            } catch (error) {
                console.error('\u5207\u6362\u6536\u85cf\u5931\u8d25:', error);
                showStatusNotice(error.message || '\u6536\u85cf\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5', { tone: 'error' });
            }
        });
    }

    dom.closeBtn.addEventListener('click', closeLightbox);
    dom.deleteBtn.addEventListener('click', openSingleDeleteModalHandler);
    dom.lightboxPrev.addEventListener('click', () => {
        if (state.currentPhotoIndex > 0) openLightbox(state.currentPhotoIndex - 1);
    });
    dom.lightboxNext.addEventListener('click', () => {
        if (state.currentPhotoIndex < state.visiblePhotos.length - 1) openLightbox(state.currentPhotoIndex + 1);
    });
    dom.editToggleBtn.addEventListener('click', () => {
        const isOpen = dom.filterBar.classList.contains('visible');
        dom.filterBar.classList.toggle('visible', !isOpen);
        dom.editBar.classList.toggle('visible', !isOpen);
        dom.editToggleBtn.classList.toggle('active', !isOpen);
        dom.editToggleBtn.textContent = isOpen ? '编辑图片' : '关闭编辑';
    });
    if (dom.lightboxImgWrap) {
        dom.lightboxImgWrap.addEventListener('touchstart', (event) => {
            if (!dom.lightbox.classList.contains('active') || event.touches.length !== 1) return;
            const touch = event.touches[0];
            touchStartPoint = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        }, { passive: true });

        dom.lightboxImgWrap.addEventListener('touchend', (event) => {
            if (!touchStartPoint || !dom.lightbox.classList.contains('active')) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const deltaX = touch.clientX - touchStartPoint.x;
            const deltaY = touch.clientY - touchStartPoint.y;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            const duration = Date.now() - touchStartPoint.time;
            touchStartPoint = null;

            if (duration > 800) return;
            if (absX > 56 && absX > absY * 1.2) {
                if (deltaX < 0 && state.currentPhotoIndex < state.visiblePhotos.length - 1) openLightbox(state.currentPhotoIndex + 1);
                else if (deltaX > 0 && state.currentPhotoIndex > 0) openLightbox(state.currentPhotoIndex - 1);
                return;
            }

            if (deltaY > 96 && absY > absX * 1.1) closeLightbox();
        }, { passive: true });
    }

    dom.lightbox.addEventListener('click', (event) => {
        if (event.target === dom.lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
        if (!dom.lightbox.classList.contains('active')) return;
        if (event.key === 'Escape') closeLightbox();
        else if (event.key === 'Delete') openSingleDeleteModalHandler();
        else if (event.key === 'ArrowLeft' && state.currentPhotoIndex > 0) openLightbox(state.currentPhotoIndex - 1);
        else if (event.key === 'ArrowRight' && state.currentPhotoIndex < state.visiblePhotos.length - 1) openLightbox(state.currentPhotoIndex + 1);
    });
}



