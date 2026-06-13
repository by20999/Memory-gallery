import { dom } from './dom.js';
import { state, setStories, getActiveStory, replaceStoryInStore, removeStoryFromStore } from './state.js';
import {
    addStoryItemsRequest,
    createStoryRequest,
    deleteStoryItemRequest,
    deleteStoryRequest,
    fetchStories,
    updateStoryItemsLayoutRequest,
    updateStoryRequest
} from './api.js';
import { showStatusNotice } from './feedback.js';
import { refreshEnhancedSelects } from './select.js';
import { escapeHtml, formatUploadDate, formatUploadMonth } from './utils.js';

const STORY_TIMELINE = {
    step: 280,
    height: 340,
    padding: 116,
    midY: 128,
    waveAmplitude: 18,
    offsetAmplitude: 18,
    maxOffset: 1,
    minY: 98,
    maxY: 188,
    nudgeStep: 0.14
};

const STORY_BACKGROUND_STORAGE_PREFIX = 'album_story_background_';
const SHOWCASE_TIMELINE = {
    step: 330,
    height: 680,
    padding: 230,
    midY: 330,
    waveAmplitude: 60,
    autoplayTail: 820
};

let autosaveTimer = null;
let viewportDragState = null;
let nodeDragState = null;
let showcaseDragState = null;
let showcasePanY = 0;
let showcaseAutoplayFrame = 0;
let showcaseAutoplayLastTime = 0;
let storyChoiceState = null;

const SHOWCASE_PAN_Y_LIMIT = 220;
const SHOWCASE_AUTOPLAY_SPEED = 56;

function clampShowcasePanY(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-SHOWCASE_PAN_Y_LIMIT, Math.min(SHOWCASE_PAN_Y_LIMIT, numeric));
}

function applyShowcasePanY(value) {
    showcasePanY = clampShowcasePanY(value);
    if (dom.storyShowcaseTrack) {
        dom.storyShowcaseTrack.style.setProperty('--showcase-pan-y', `${showcasePanY}px`);
    }
}

function isShowcaseAutoplaying() {
    return Boolean(showcaseAutoplayFrame);
}

function updateShowcaseAutoplayButton() {
    if (!dom.storyShowcaseAutoplayBtn) return;
    const playing = isShowcaseAutoplaying();
    dom.storyShowcaseAutoplayBtn.textContent = playing ? '停止播放' : '自动播放';
    dom.storyShowcaseAutoplayBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
}

function stopShowcaseAutoplay() {
    if (showcaseAutoplayFrame) {
        window.cancelAnimationFrame(showcaseAutoplayFrame);
        showcaseAutoplayFrame = 0;
    }
    showcaseAutoplayLastTime = 0;
    updateShowcaseAutoplayButton();
}

function stepShowcaseAutoplay(timestamp) {
    if (!dom.storyShowcaseViewport || !dom.storyShowcase || dom.storyShowcase.hidden) {
        stopShowcaseAutoplay();
        return;
    }

    if (!showcaseAutoplayLastTime) showcaseAutoplayLastTime = timestamp;
    const elapsed = Math.min(80, timestamp - showcaseAutoplayLastTime);
    showcaseAutoplayLastTime = timestamp;

    const viewport = dom.storyShowcaseViewport;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (viewport.scrollLeft >= maxScrollLeft - 1) {
        stopShowcaseAutoplay();
        return;
    }

    viewport.scrollLeft = Math.min(maxScrollLeft, viewport.scrollLeft + (SHOWCASE_AUTOPLAY_SPEED * elapsed) / 1000);
    showcaseAutoplayFrame = window.requestAnimationFrame(stepShowcaseAutoplay);
}

function startShowcaseAutoplay() {
    if (!dom.storyShowcaseViewport) return;
    if (isShowcaseAutoplaying()) return;

    const viewport = dom.storyShowcaseViewport;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    if (viewport.scrollLeft >= maxScrollLeft - 1) {
        viewport.scrollLeft = 0;
    }

    showcaseAutoplayLastTime = 0;
    showcaseAutoplayFrame = window.requestAnimationFrame(stepShowcaseAutoplay);
    updateShowcaseAutoplayButton();
}

function toggleShowcaseAutoplay() {
    if (isShowcaseAutoplaying()) {
        stopShowcaseAutoplay();
    } else {
        startShowcaseAutoplay();
    }
}

function clampStoryOffset(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(-STORY_TIMELINE.maxOffset, Math.min(STORY_TIMELINE.maxOffset, numeric));
}

function roundStoryOffset(value) {
    return Math.round(clampStoryOffset(value) * 100) / 100;
}

function cloneStory(story) {
    if (!story) return null;
    return {
        ...story,
        coverPhoto: story.coverPhoto ? { ...story.coverPhoto } : story.coverPhoto,
        items: Array.isArray(story.items)
            ? story.items.map((item) => ({
                ...item,
                photo: item.photo ? { ...item.photo } : item.photo
            }))
            : []
    };
}

function withStoryItems(story, items) {
    const nextItems = items.map((item, index) => ({
        ...item,
        position: index,
        curveOffset: roundStoryOffset(item.curveOffset)
    }));
    return {
        ...story,
        items: nextItems,
        itemCount: nextItems.length,
        coverPhoto: nextItems[0]?.photo || null,
        updatedAt: new Date().toISOString()
    };
}

function buildLayoutPayload(items) {
    return items.map((item, index) => ({
        id: item.id,
        position: index,
        curveOffset: roundStoryOffset(item.curveOffset)
    }));
}

function hasLayoutChanged(previousStory, nextStory) {
    const prevItems = previousStory?.items || [];
    const nextItems = nextStory?.items || [];
    if (prevItems.length !== nextItems.length) return true;
    return prevItems.some((item, index) => (
        item.id !== nextItems[index]?.id
        || roundStoryOffset(item.curveOffset) !== roundStoryOffset(nextItems[index]?.curveOffset)
    ));
}

function ensureActiveStory() {
    if (!state.stories.some((story) => story.id === state.activeStoryId)) {
        state.activeStoryId = state.stories[0]?.id || '';
    }
}

function getStoryTime(story, key) {
    const time = new Date(story?.[key] || story?.createdAt || story?.updatedAt || 0).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function sortStoriesByCreatedAt(stories) {
    return [...(Array.isArray(stories) ? stories : [])].sort((a, b) => (
        getStoryTime(a, 'createdAt') - getStoryTime(b, 'createdAt')
        || getStoryTime(a, 'updatedAt') - getStoryTime(b, 'updatedAt')
        || String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN')
    ));
}

function normalizeStoryOrder(stories) {
    setStories(sortStoriesByCreatedAt(stories));
}

function updateActiveStory(story) {
    replaceStoryInStore(story);
    normalizeStoryOrder(state.stories);
    if (!state.activeStoryId) {
        state.activeStoryId = story.id;
    }
    ensureActiveStory();
}

function setEditorStatus(text) {
    if (dom.storyEditorStatus) {
        dom.storyEditorStatus.textContent = text;
    }
}

function getTimelineWidth(itemCount, viewportWidth = dom.storyFlowViewport?.clientWidth || 960) {
    return Math.max(viewportWidth, STORY_TIMELINE.padding * 2 + Math.max(itemCount - 1, 0) * STORY_TIMELINE.step + 136);
}

function getPreviewBackgroundOpacity(story) {
    const savedOpacity = getStoryBackgroundOpacity(story);
    return Math.min(0.42, Math.max(0.12, savedOpacity || 0.18));
}

function getBasePointForIndex(index) {
    return {
        x: STORY_TIMELINE.padding + index * STORY_TIMELINE.step,
        y: STORY_TIMELINE.midY + Math.sin(index * 0.92) * STORY_TIMELINE.waveAmplitude
    };
}

function getStoryPoints(items) {
    return items.map((item, index) => {
        const base = getBasePointForIndex(index);
        return {
            x: base.x,
            y: base.y + (roundStoryOffset(item.curveOffset) * STORY_TIMELINE.offsetAmplitude)
        };
    });
}

function clampStoryPointX(x, itemCount) {
    const minX = STORY_TIMELINE.padding - 40;
    const maxX = STORY_TIMELINE.padding + Math.max(itemCount - 1, 0) * STORY_TIMELINE.step + 40;
    return Math.max(minX, Math.min(maxX, x));
}

function clampStoryPointY(y) {
    return Math.max(STORY_TIMELINE.minY, Math.min(STORY_TIMELINE.maxY, y));
}

function getTargetInsertIndex(x, itemCount) {
    if (itemCount <= 1) return 0;
    const rawIndex = Math.round((x - STORY_TIMELINE.padding) / STORY_TIMELINE.step);
    return Math.max(0, Math.min(itemCount - 1, rawIndex));
}

function getCurveOffsetForPoint(index, y) {
    const basePoint = getBasePointForIndex(index);
    return roundStoryOffset((clampStoryPointY(y) - basePoint.y) / STORY_TIMELINE.offsetAmplitude);
}

function buildStoryPath(points) {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const controlX = (previous.x + current.x) / 2;
        path += ` C ${controlX} ${previous.y}, ${controlX} ${current.y}, ${current.x} ${current.y}`;
    }
    return path;
}

function buildTimelineMetaText(itemCount) {
    return `共 ${itemCount} 张图片，按加入顺序铺开；需要微调时可拖动节点。`;
}

function getStoryDisplayPhotoSrc(photo) {
    return photo?.src || photo?.thumbSrc || '';
}

function getStoryPreviewPhotoSrc(photo) {
    return photo?.thumbSrc || photo?.src || '';
}

function getPhotoDescription(photo, fallback = '这张图片还没有写描述，可以在主相册里继续补充。') {
    const caption = String(photo?.caption || '').trim();
    return caption || fallback;
}

function getStoryItemDescription(item, fallback) {
    const note = String(item?.note || '').trim();
    return getPhotoDescription(item?.photo || {}, note || fallback);
}

function getStoryPhotoById(photoId) {
    const id = String(photoId || '').trim();
    if (!id) return null;
    return state.photos.find((photo) => photo.id === id) || null;
}

function getPhotoOptionLabel(photo, index) {
    const description = getPhotoDescription(photo, '');
    const date = formatUploadDate(photo?.uploadTime);
    if (description && date) return `${description} · ${date}`;
    if (description) return description;
    if (date) return `未写描述的照片 · ${date}`;
    return `未写描述的照片 ${index + 1}`;
}

function getStoryLocalBackgroundKey(storyId) {
    return `${STORY_BACKGROUND_STORAGE_PREFIX}${storyId}`;
}

function readLocalStoryBackground(storyId) {
    try {
        return window.localStorage.getItem(getStoryLocalBackgroundKey(storyId)) || '';
    } catch {
        return '';
    }
}

function writeLocalStoryBackground(storyId, value) {
    try {
        const key = getStoryLocalBackgroundKey(storyId);
        if (value) {
            window.localStorage.setItem(key, value);
        } else {
            window.localStorage.removeItem(key);
        }
    } catch (error) {
        console.error('保存本地故事背景失败:', error);
        showStatusNotice('本地背景保存失败，可能是图片过大。', { tone: 'error' });
    }
}

function clampBackgroundOpacity(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.18;
    return Math.max(0, Math.min(0.55, Math.round(numeric * 100) / 100));
}

function getStoryBackgroundOpacity(story) {
    return clampBackgroundOpacity(story?.backgroundOpacity);
}

function getPhotoBackgroundSrc(photo) {
    return photo ? getStoryDisplayPhotoSrc(photo) : '';
}

function getStoryBackgroundSrc(story) {
    if (!story) return '';
    const localBackground = readLocalStoryBackground(story.id);
    if (localBackground) return localBackground;
    const backgroundPhoto = story.backgroundPhoto || getStoryPhotoById(story.backgroundPhotoId);
    return getPhotoBackgroundSrc(backgroundPhoto);
}

function applyStoryBackground(story) {
    const src = getStoryBackgroundSrc(story);
    const opacity = getPreviewBackgroundOpacity(story);
    const targets = [
        dom.storyStage,
        dom.storyFlowViewport?.closest('.story-timeline-panel')
    ].filter(Boolean);
    targets.forEach((target) => {
        target.style.setProperty('--story-bg-image', src ? `url("${src.replace(/"/g, '\\"')}")` : 'none');
        target.style.setProperty('--story-bg-opacity', String(opacity));
        target.classList.toggle('has-story-background', Boolean(src));
    });
}

function updateStoryBackgroundControls(story) {
    if (!story) return;
    if (dom.storyBackgroundSelect) {
        const currentValue = story.backgroundPhotoId || '';
        const options = ['<option value="">不使用相册背景</option>']
            .concat(state.photos.map((photo, index) => {
                const selected = photo.id === currentValue ? ' selected' : '';
                return `<option value="${escapeHtml(photo.id)}"${selected}>${escapeHtml(getPhotoOptionLabel(photo, index))}</option>`;
            }));
        dom.storyBackgroundSelect.innerHTML = options.join('');
        dom.storyBackgroundSelect.value = currentValue;
    }
    const opacityPercent = Math.round(getStoryBackgroundOpacity(story) * 100);
    if (dom.storyBackgroundOpacityInput) dom.storyBackgroundOpacityInput.value = String(opacityPercent);
    if (dom.storyBackgroundOpacityValue) dom.storyBackgroundOpacityValue.textContent = `${opacityPercent}%`;
    refreshEnhancedSelects();
}

function buildDragMetaText(targetIndex, curveOffset) {
    const direction = curveOffset > 0 ? '向下' : curveOffset < 0 ? '向上' : '归中';
    const intensity = Math.abs(Math.round(curveOffset * 100));
    return `松开后排到第 ${targetIndex + 1} 张，位置${direction}${intensity}% 。`;
}

function buildStoryCard(story) {
    const active = story.id === state.activeStoryId;
    const cover = story.coverPhoto
        ? `<img src="${escapeHtml(getStoryPreviewPhotoSrc(story.coverPhoto))}" alt="${escapeHtml(story.name)}">`
        : '<div class="story-list-cover-fallback">忆</div>';

    return `
        <button class="story-list-card${active ? ' active' : ''}" type="button" data-story-id="${escapeHtml(story.id)}" aria-pressed="${active ? 'true' : 'false'}">
            <div class="story-list-cover">${cover}</div>
            <div class="story-list-meta">
                <strong>${escapeHtml(story.name)}</strong>
                <span>${story.itemCount || story.items?.length || 0} 张图片 · ${escapeHtml(formatUploadMonth(story.createdAt) || '刚刚创建')}</span>
            </div>
        </button>
    `;
}

function buildStoryCompactSelector(activeStory) {
    if (!activeStory) return '';
    if (state.stories.length <= 1) return '';
    const options = state.stories.map((story) => (
        `<option value="${escapeHtml(story.id)}"${story.id === activeStory.id ? ' selected' : ''}>${escapeHtml(story.name)}</option>`
    )).join('');
    return `
        <label class="story-compact-select">
            <span>切换故事</span>
            <select id="storyCompactSelect">${options}</select>
        </label>
    `;
}

function buildStoryNode(item, point, index) {
    const photo = item.photo || {};
    const tags = (photo.tags || []).slice(0, 3).map((tag) => `<span class="story-node-tag">#${escapeHtml(tag)}</span>`).join('');
    const sourceLabel = item.sourceType === 'group' && item.sourceGroupName
        ? `来自分组 · ${escapeHtml(item.sourceGroupName)}`
        : '来自主相册';
    const description = getStoryItemDescription(item, '');
    const shortDescription = description.length > 26 ? `${description.slice(0, 26)}...` : description;
    const imageAlt = description || `故事片段 ${index + 1}`;
    const descriptionMarkup = description
        ? `
                    <h4>${escapeHtml(shortDescription)}</h4>
                    <p>${escapeHtml(description)}</p>`
        : '';

    return `
        <article class="story-node" data-story-item-id="${escapeHtml(item.id)}" data-story-item-index="${index}" style="left:${point.x}px; top:${point.y}px; animation-delay:${(index * 0.06).toFixed(2)}s;">
            <div class="story-node-controls">
                <span class="story-node-order">${String(index + 1).padStart(2, '0')}</span>
                <button class="story-node-handle" type="button" data-story-drag-handle="${escapeHtml(item.id)}">拖动</button>
                <button class="story-adjust-btn" type="button" data-story-adjust="up" data-story-adjust-item="${escapeHtml(item.id)}">上移</button>
                <button class="story-adjust-btn" type="button" data-story-adjust="down" data-story-adjust-item="${escapeHtml(item.id)}">下移</button>
                <button class="story-adjust-btn subtle" type="button" data-story-adjust="reset" data-story-adjust-item="${escapeHtml(item.id)}">归位</button>
            </div>
            <div class="story-node-card">
                <button class="story-node-remove" type="button" data-story-remove-item="${escapeHtml(item.id)}" aria-label="移出故事">×</button>
                <div class="story-node-media">
                    <img src="${escapeHtml(getStoryDisplayPhotoSrc(photo))}" alt="${escapeHtml(imageAlt)}" loading="lazy">
                </div>
                <div class="story-node-body">
                    <div class="story-node-date">${escapeHtml(formatUploadDate(photo.uploadTime) || '未记录日期')}</div>
                    ${descriptionMarkup}
                    <div class="story-node-foot">
                        <span class="story-node-source">${sourceLabel}</span>
                        ${photo.groupName ? `<span class="story-node-group">${escapeHtml(photo.groupName)}</span>` : ''}
                    </div>
                    ${tags ? `<div class="story-node-tags">${tags}</div>` : ''}
                </div>
            </div>
        </article>
    `;
}

function updateStoryPathPreview(points) {
    const path = buildStoryPath(points);
    dom.storyFlowSurface.querySelector('.story-flow-shadow')?.setAttribute('d', path);
    dom.storyFlowSurface.querySelector('.story-flow-line')?.setAttribute('d', path);
}

function hideDragGuide() {
    const guide = dom.storyFlowSurface?.querySelector('.story-flow-drop-guide');
    if (!guide) return;
    guide.hidden = true;
}

function updateDragGuide(targetIndex) {
    const guide = dom.storyFlowSurface?.querySelector('.story-flow-drop-guide');
    if (!guide) return;
    guide.hidden = false;
    guide.style.left = `${STORY_TIMELINE.padding + (targetIndex * STORY_TIMELINE.step)}px`;
    const label = guide.querySelector('span');
    if (label) label.textContent = `第 ${targetIndex + 1} 张`;
}

function renderStoryTimeline(story) {
    if (!dom.storyFlowSurface || !dom.storyFlowViewport || !dom.storyTimelineMeta) return;

    const items = Array.isArray(story.items) ? story.items : [];
    if (items.length === 0) {
        dom.storyTimelineMeta.textContent = '这个故事还没有图片，可以从主相册卡片或分组卡片加入内容。';
        dom.storyFlowSurface.className = 'story-flow-surface is-empty';
        dom.storyFlowSurface.style.width = '100%';
        dom.storyFlowSurface.innerHTML = `
            <div class="story-flow-empty-card">
                <strong>这本故事还没有图片</strong>
                <p>回到主相册，选择照片上的“加入故事”，它会按加入顺序出现在这里。</p>
            </div>
        `;
        return;
    }

    const previousScrollLeft = dom.storyFlowViewport.scrollLeft;
    const viewportWidth = dom.storyFlowViewport.clientWidth || 960;
    const width = getTimelineWidth(items.length, viewportWidth);
    const points = getStoryPoints(items);
    const path = buildStoryPath(points);

    dom.storyTimelineMeta.textContent = buildTimelineMetaText(items.length);
    dom.storyFlowSurface.className = 'story-flow-surface';
    dom.storyFlowSurface.style.width = `${width}px`;
    dom.storyFlowSurface.innerHTML = `
        <div class="story-flow-ambient"></div>
        <svg class="story-flow-svg" viewBox="0 0 ${width} ${STORY_TIMELINE.height}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id="storyFlowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="color-mix(in srgb, var(--accent) 34%, white)"></stop>
                    <stop offset="48%" stop-color="var(--accent)"></stop>
                    <stop offset="100%" stop-color="color-mix(in srgb, var(--accent) 48%, #ffd9b8)"></stop>
                </linearGradient>
            </defs>
            <path class="story-flow-shadow" d="${path}"></path>
            <path class="story-flow-line" d="${path}"></path>
        </svg>
        <div class="story-flow-drop-guide" hidden><span></span></div>
        ${items.map((item, index) => buildStoryNode(item, points[index], index)).join('')}
    `;
    dom.storyFlowViewport.scrollLeft = Math.min(previousScrollLeft, Math.max(0, width - dom.storyFlowViewport.clientWidth));
}

function renderStoryView() {
    if (!dom.storyWorkspace) return;

    ensureActiveStory();
    const activeStory = getActiveStory();
    const hasStories = state.stories.length > 0;

    if (dom.storyList) {
        dom.storyList.innerHTML = hasStories
            ? `${buildStoryCard(activeStory || state.stories[0])}${buildStoryCompactSelector(activeStory || state.stories[0])}`
            : '<div class="story-list-placeholder">还没有故事视图，先创建第一本回忆录吧。</div>';

        dom.storyList.querySelectorAll('[data-story-id]').forEach((button) => {
            button.addEventListener('click', () => {
                state.activeStoryId = button.dataset.storyId || '';
                renderStoryView();
            });
        });
        dom.storyList.querySelector('#storyCompactSelect')?.addEventListener('change', (event) => {
            state.activeStoryId = event.currentTarget.value || '';
            renderStoryView();
        });
    }

    if (!activeStory) {
        if (dom.storyEmpty) dom.storyEmpty.hidden = false;
        if (dom.storyDetail) dom.storyDetail.hidden = true;
        setEditorStatus('创建故事后会自动保存文案');
        return;
    }

    if (dom.storyEmpty) dom.storyEmpty.hidden = true;
    if (dom.storyDetail) dom.storyDetail.hidden = false;

    if (dom.storyTitle) dom.storyTitle.textContent = activeStory.name;
    if (dom.storyDateMeta) dom.storyDateMeta.textContent = `最近整理于 ${formatUploadDate(activeStory.updatedAt) || '刚刚'}`;
    if (dom.storySummary) {
        const count = activeStory.itemCount || activeStory.items?.length || 0;
        dom.storySummary.textContent = count === 0
            ? '这本故事已经创建好。回到主相册，把想讲的照片加入进来。'
            : `现在收进了 ${count} 张图片，按加入顺序组成这条故事线。`;
    }

    if (dom.storyContentInput && dom.storyContentInput.value !== activeStory.content) {
        dom.storyContentInput.value = activeStory.content || '';
    }
    applyStoryBackground(activeStory);
    updateStoryBackgroundControls(activeStory);
    setEditorStatus('故事文案会自动保存');
    renderStoryTimeline(activeStory);
}

function renderSiteView() {
    const isStoryView = state.siteView === 'story';
    document.body.classList.toggle('story-view-active', isStoryView);
    if (dom.albumWorkspace) dom.albumWorkspace.hidden = isStoryView;
    if (dom.storyWorkspace) dom.storyWorkspace.hidden = !isStoryView;
    dom.siteViewBtns.forEach((button) => {
        const active = button.dataset.siteView === state.siteView;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (isStoryView) {
        renderStoryView();
    }
}

async function persistStoryContent(storyId, content) {
    try {
        const data = await updateStoryRequest(storyId, { content });
        updateActiveStory(data.story);
        if (state.activeStoryId === storyId) {
            setEditorStatus('已自动保存');
            renderStoryView();
        }
    } catch (error) {
        console.error('保存故事文案失败:', error);
        setEditorStatus('保存失败，请稍后重试');
        showStatusNotice(error.message || '保存故事文案失败', { tone: 'error' });
    }
}

async function persistStoryAppearance(storyId, patch) {
    const story = getActiveStory();
    if (!story || story.id !== storyId) return;
    const nextStory = { ...story, ...patch, updatedAt: new Date().toISOString() };
    updateActiveStory(nextStory);
    renderStoryView();

    try {
        const data = await updateStoryRequest(storyId, patch);
        updateActiveStory(data.story);
        if (state.activeStoryId === storyId) {
            renderStoryView();
        }
        showStatusNotice('故事外观已保存', { tone: 'success', duration: 1600 });
    } catch (error) {
        console.error('保存故事外观失败:', error);
        updateActiveStory(story);
        renderStoryView();
        showStatusNotice(error.message || '保存故事外观失败，请稍后重试', { tone: 'error' });
    }
}

async function persistStoryLayout(nextStory, previousStory) {
    try {
        const data = await updateStoryItemsLayoutRequest(nextStory.id, buildLayoutPayload(nextStory.items));
        updateActiveStory(data.story);
        if (state.activeStoryId === nextStory.id) {
            renderStoryView();
        }
    } catch (error) {
        console.error('保存故事布局失败:', error);
        if (previousStory) {
            updateActiveStory(previousStory);
            renderStoryView();
        }
        showStatusNotice(error.message || '保存故事布局失败，请稍后重试', { tone: 'error' });
    }
}

async function createStoryFlow(name = '') {
    const data = await createStoryRequest(name);
    const nextStory = data.story;
    updateActiveStory({
        ...nextStory,
        itemCount: nextStory.items?.length || 0,
        coverPhoto: null,
        items: []
    });
    state.siteView = 'story';
    renderSiteView();
    renderStoryView();
    showStatusNotice(`已创建故事“${nextStory.name}”`, { tone: 'success' });
    return nextStory;
}

function buildStoryChoiceCard(story) {
    const cover = story.coverPhoto
        ? `<img src="${escapeHtml(getStoryPreviewPhotoSrc(story.coverPhoto))}" alt="${escapeHtml(story.name)}">`
        : '<span>忆</span>';
    const count = story.itemCount || story.items?.length || 0;
    return `
        <button class="story-choice-item" type="button" data-story-choice-id="${escapeHtml(story.id)}">
            <span class="story-choice-cover">${cover}</span>
            <span class="story-choice-meta">
                <strong>${escapeHtml(story.name)}</strong>
                <em>${count} 张图片 · ${escapeHtml(formatUploadMonth(story.createdAt) || '刚刚创建')}</em>
            </span>
        </button>
    `;
}

function closeStoryChoiceModal(result = null) {
    if (!storyChoiceState) return;
    const { resolve } = storyChoiceState;
    storyChoiceState = null;
    if (dom.storyChoiceModal) dom.storyChoiceModal.hidden = true;
    document.body.classList.remove('story-choice-open');
    resolve(result);
}

function openStoryChoiceModal(targetLabel = '加入故事') {
    if (!dom.storyChoiceModal || !dom.storyChoiceList) return Promise.resolve(null);
    if (storyChoiceState) closeStoryChoiceModal(null);

    dom.storyChoiceTitle.textContent = `${targetLabel}到哪一本故事？`;
    if (dom.storyChoiceKicker) dom.storyChoiceKicker.textContent = state.stories.length > 1 ? `共 ${state.stories.length} 本故事` : '选择故事';
    dom.storyChoiceList.innerHTML = state.stories.map((story) => buildStoryChoiceCard(story)).join('');
    dom.storyChoiceModal.hidden = false;
    document.body.classList.add('story-choice-open');

    return new Promise((resolve) => {
        storyChoiceState = { resolve };
    });
}

async function chooseStory(targetLabel = '加入故事') {
    if (state.stories.length === 0) {
        const name = window.prompt('还没有故事视图。先创建一个吧，给这次故事起个名字：', '新的图片故事');
        if (name === null) return null;
        return createStoryFlow(name);
    }

    if (state.stories.length === 1) {
        showStatusNotice(`将加入“${state.stories[0].name}”`, { tone: 'info', duration: 1200 });
        return state.stories[0];
    }

    return openStoryChoiceModal(targetLabel);
}

function buildStoryAfterItemMove(story, itemId, targetIndex, curveOffset) {
    const movingItem = story.items.find((item) => item.id === itemId);
    if (!movingItem) return cloneStory(story);

    const remainingItems = story.items.filter((item) => item.id !== itemId);
    const insertIndex = Math.max(0, Math.min(remainingItems.length, targetIndex));
    remainingItems.splice(insertIndex, 0, {
        ...movingItem,
        curveOffset: roundStoryOffset(curveOffset)
    });
    return withStoryItems(story, remainingItems);
}

function buildStoryAfterItemAdjust(story, itemId, direction) {
    const delta = direction === 'up'
        ? -STORY_TIMELINE.nudgeStep
        : direction === 'down'
            ? STORY_TIMELINE.nudgeStep
            : 0;

    const nextItems = story.items.map((item) => {
        if (item.id !== itemId) return item;
        if (direction === 'reset') {
            return { ...item, curveOffset: 0 };
        }
        return {
            ...item,
            curveOffset: roundStoryOffset((item.curveOffset || 0) + delta)
        };
    });

    return withStoryItems(story, nextItems);
}

function getShowcaseWidth(itemCount, viewportWidth = dom.storyShowcaseViewport?.clientWidth || window.innerWidth || 1280) {
    const timelineWidth = SHOWCASE_TIMELINE.padding * 2 + Math.max(itemCount - 1, 0) * SHOWCASE_TIMELINE.step;
    return Math.max(viewportWidth + SHOWCASE_TIMELINE.autoplayTail, timelineWidth + SHOWCASE_TIMELINE.autoplayTail);
}

function getShowcasePoint(index) {
    return {
        x: SHOWCASE_TIMELINE.padding + index * SHOWCASE_TIMELINE.step,
        y: SHOWCASE_TIMELINE.midY
            + Math.sin(index * 1.08) * SHOWCASE_TIMELINE.waveAmplitude
            + Math.cos(index * 0.58) * 22
    };
}

function buildShowcasePath(itemCount) {
    const points = Array.from({ length: itemCount }, (_, index) => getShowcasePoint(index));
    return buildStoryPath(points);
}

function buildShowcaseFrame(item, index) {
    const photo = item.photo || {};
    const point = getShowcasePoint(index);
    const lane = [
        { className: 'lane-high caption-above', captionAbove: true, offset: -140, tilt: -1.8 },
        { className: 'lane-low caption-below', captionAbove: false, offset: 155, tilt: 1.4 },
        { className: 'lane-soft-high caption-above', captionAbove: true, offset: -138, tilt: 0.8 },
        { className: 'lane-soft-low caption-below', captionAbove: false, offset: 155, tilt: -1.2 },
        { className: 'lane-high caption-above', captionAbove: true, offset: -132, tilt: 1.7 },
        { className: 'lane-soft-low caption-below', captionAbove: false, offset: 150, tilt: -0.7 }
    ][index % 6];
    const placement = lane.className;
    const tilt = lane.tilt;
    const itemY = point.y + lane.offset;
    const caption = String(photo.caption || item.note || '').trim();
    const imageAlt = caption || formatUploadDate(photo.uploadTime) || `故事片段 ${index + 1}`;
    const captionMarkup = caption
        ? `<div class="story-showcase-caption"><span>${escapeHtml(caption)}</span></div>`
        : '';
    const captionBefore = lane.captionAbove ? captionMarkup : '';
    const captionAfter = lane.captionAbove ? '' : captionMarkup;

    return `
        <article class="story-showcase-item ${placement}" style="left:${point.x}px; top:${itemY}px; --tilt:${tilt}deg;">
            <div class="story-showcase-time">${escapeHtml(formatUploadDate(photo.uploadTime) || '未记录时间')}</div>
            ${captionBefore}
            <div class="story-showcase-frame">
                <img src="${escapeHtml(getStoryDisplayPhotoSrc(photo))}" alt="${escapeHtml(imageAlt)}" loading="lazy">
            </div>
            ${captionAfter}
        </article>
    `;
}

function renderShowcase(story) {
    if (!dom.storyShowcase || !dom.storyShowcaseTrack || !dom.storyShowcaseViewport) return;
    const items = Array.isArray(story?.items) ? story.items : [];
    const width = getShowcaseWidth(items.length);
    const path = buildShowcasePath(items.length);
    const bgSrc = getStoryBackgroundSrc(story);
    const bgOpacity = Math.min(0.42, Math.max(0.1, getStoryBackgroundOpacity(story) || 0.18));

    if (dom.storyShowcaseTitle) dom.storyShowcaseTitle.textContent = story?.name || '图片故事';
    if (dom.storyShowcaseMeta) {
        dom.storyShowcaseMeta.textContent = items.length
            ? `${items.length} 个回忆片段 · 拖动查看更早或更晚`
            : '这本故事还没有图片';
    }
    if (dom.storyShowcaseNarration) {
        const content = String(story?.content || '').trim();
        dom.storyShowcaseNarration.textContent = content || '把鼠标按在时间流线上轻轻拖动，让照片沿着回忆的方向慢慢出现。';
    }
    if (dom.storyShowcaseBg) {
        dom.storyShowcaseBg.style.backgroundImage = bgSrc ? `url("${bgSrc.replace(/"/g, '\\"')}")` : '';
        dom.storyShowcaseBg.style.opacity = String(bgSrc ? bgOpacity : 0);
    }

    dom.storyShowcaseTrack.style.width = `${width}px`;
    dom.storyShowcaseTrack.style.setProperty('--showcase-pan-y', `${showcasePanY}px`);
    dom.storyShowcaseTrack.innerHTML = items.length
        ? `
            <div class="story-showcase-stars" aria-hidden="true"></div>
            <div class="story-showcase-particles" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <svg class="story-showcase-line" viewBox="0 0 ${width} ${SHOWCASE_TIMELINE.height}" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                    <linearGradient id="storyShowcaseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#ffe9ba"></stop>
                        <stop offset="42%" stop-color="#ffffff"></stop>
                        <stop offset="100%" stop-color="#ffb0a0"></stop>
                    </linearGradient>
                </defs>
                <path class="story-showcase-line-glow" d="${path}"></path>
                <path class="story-showcase-line-core" d="${path}"></path>
            </svg>
            ${items.map((item, index) => buildShowcaseFrame(item, index)).join('')}
        `
        : `
            <div class="story-showcase-empty">
                <strong>这本故事还在等第一张照片</strong>
                <span>回到相册，把想讲述的图片加入故事后再打开全屏展示。</span>
            </div>
        `;
}

async function openStoryShowcase() {
    const story = getActiveStory();
    if (!story || !dom.storyShowcase) return;
    renderShowcase(story);
    dom.storyShowcase.hidden = false;
    document.body.classList.add('story-showcase-open');
    stopShowcaseAutoplay();
    window.setTimeout(() => {
        if (dom.storyShowcaseViewport) dom.storyShowcaseViewport.scrollLeft = 0;
        applyShowcasePanY(0);
    }, 0);
    try {
        if (dom.storyShowcase.requestFullscreen && !document.fullscreenElement) {
            await dom.storyShowcase.requestFullscreen();
        }
    } catch {
        // Fixed overlay remains available when the browser blocks fullscreen.
    }
}

async function closeStoryShowcase() {
    if (!dom.storyShowcase) return;
    dom.storyShowcase.hidden = true;
    document.body.classList.remove('story-showcase-open');
    stopShowcaseAutoplay();
    if (dom.storyShowcaseMenu) dom.storyShowcaseMenu.hidden = true;
    if (dom.storyShowcaseMenuBtn) dom.storyShowcaseMenuBtn.setAttribute('aria-expanded', 'false');
    if (document.fullscreenElement === dom.storyShowcase) {
        try {
            await document.exitFullscreen();
        } catch {
            // Ignore browser fullscreen exit errors; the overlay is already closed.
        }
    }
}

function getActiveStoryItem(itemId) {
    const story = getActiveStory();
    if (!story) return { story: null, item: null, index: -1 };
    const index = story.items.findIndex((item) => item.id === itemId);
    return {
        story,
        item: index >= 0 ? story.items[index] : null,
        index
    };
}

async function handleStoryAdjust(itemId, direction) {
    const { story, item, index } = getActiveStoryItem(itemId);
    if (!story || !item || index < 0) return;

    const previousStory = cloneStory(story);
    const nextStory = buildStoryAfterItemAdjust(story, itemId, direction);
    if (!hasLayoutChanged(previousStory, nextStory)) return;

    updateActiveStory(nextStory);
    renderStoryView();
    await persistStoryLayout(nextStory, previousStory);
    showStatusNotice('故事节点位置已更新', { tone: 'success', duration: 1400 });
}

function cleanupNodeDrag() {
    window.removeEventListener('pointermove', handleNodeDragMove);
    window.removeEventListener('pointerup', handleNodeDragEnd);
    window.removeEventListener('pointercancel', handleNodeDragCancel);
    document.body.classList.remove('story-node-dragging');
    dom.storyFlowSurface?.classList.remove('is-editing-layout');
    nodeDragState?.handle?.classList.remove('is-dragging');
    hideDragGuide();
    nodeDragState = null;
}

function handleNodeDragMove(event) {
    if (!nodeDragState || event.pointerId !== nodeDragState.pointerId) return;
    event.preventDefault();

    const nextX = clampStoryPointX(nodeDragState.startPoint.x + (event.clientX - nodeDragState.startClientX), nodeDragState.itemCount);
    const nextY = clampStoryPointY(nodeDragState.startPoint.y + (event.clientY - nodeDragState.startClientY));
    nodeDragState.previewPoint = { x: nextX, y: nextY };

    const activeNode = dom.storyFlowSurface?.querySelector(`[data-story-item-id="${nodeDragState.itemId}"]`);
    if (activeNode) {
        activeNode.classList.add('dragging');
        activeNode.style.left = `${nextX}px`;
        activeNode.style.top = `${nextY}px`;
    }

    const previewPoints = nodeDragState.basePoints.map((point, index) => (
        index === nodeDragState.itemIndex ? { x: nextX, y: nextY } : point
    ));
    updateStoryPathPreview(previewPoints);

    const targetIndex = getTargetInsertIndex(nextX, nodeDragState.itemCount);
    const curveOffset = getCurveOffsetForPoint(targetIndex, nextY);
    updateDragGuide(targetIndex);
    if (dom.storyTimelineMeta) {
        dom.storyTimelineMeta.textContent = buildDragMetaText(targetIndex, curveOffset);
    }
}

async function finalizeNodeDrag() {
    if (!nodeDragState) return;

    const storySnapshot = nodeDragState.storySnapshot;
    const targetIndex = getTargetInsertIndex(nodeDragState.previewPoint.x, nodeDragState.itemCount);
    const curveOffset = getCurveOffsetForPoint(targetIndex, nodeDragState.previewPoint.y);
    const nextStory = buildStoryAfterItemMove(storySnapshot, nodeDragState.itemId, targetIndex, curveOffset);

    cleanupNodeDrag();

    if (!hasLayoutChanged(storySnapshot, nextStory)) {
        renderStoryView();
        return;
    }

    updateActiveStory(nextStory);
    renderStoryView();
    await persistStoryLayout(nextStory, storySnapshot);
}

function handleNodeDragEnd(event) {
    if (!nodeDragState || event.pointerId !== nodeDragState.pointerId) return;
    finalizeNodeDrag();
}

function handleNodeDragCancel(event) {
    if (!nodeDragState || event.pointerId !== nodeDragState.pointerId) return;
    const storySnapshot = nodeDragState.storySnapshot;
    cleanupNodeDrag();
    if (storySnapshot) {
        updateActiveStory(storySnapshot);
        renderStoryView();
    }
}

function startNodeDrag(event, handle) {
    const itemId = handle.getAttribute('data-story-drag-handle') || '';
    const { story, index } = getActiveStoryItem(itemId);
    if (!story || index < 0) return;

    event.preventDefault();
    event.stopPropagation();

    const points = getStoryPoints(story.items);
    nodeDragState = {
        pointerId: event.pointerId,
        itemId,
        itemIndex: index,
        itemCount: story.items.length,
        storySnapshot: cloneStory(story),
        basePoints: points,
        startPoint: points[index],
        previewPoint: points[index],
        startClientX: event.clientX,
        startClientY: event.clientY,
        handle
    };

    document.body.classList.add('story-node-dragging');
    dom.storyFlowSurface?.classList.add('is-editing-layout');
    handle.classList.add('is-dragging');
    if (handle.setPointerCapture) {
        try {
            handle.setPointerCapture(event.pointerId);
        } catch {
            // Some browsers may reject capture if the pointer was already released.
        }
    }
    window.addEventListener('pointermove', handleNodeDragMove, { passive: false });
    window.addEventListener('pointerup', handleNodeDragEnd);
    window.addEventListener('pointercancel', handleNodeDragCancel);
}

async function handleCreateStory() {
    const name = window.prompt('给新故事起个名字吧', '新的图片故事');
    if (name === null) return;

    try {
        const story = await createStoryFlow(name);
        state.activeStoryId = story.id;
        renderStoryView();
    } catch (error) {
        console.error('创建故事失败:', error);
        showStatusNotice(error.message || '创建故事失败，请稍后重试', { tone: 'error' });
    }
}

async function handleRenameStory() {
    const story = getActiveStory();
    if (!story) return;

    const name = window.prompt('重命名当前故事', story.name);
    if (name === null) return;
    const nextName = name.trim();
    if (!nextName || nextName === story.name) return;

    try {
        const data = await updateStoryRequest(story.id, { name: nextName });
        updateActiveStory(data.story);
        renderStoryView();
        showStatusNotice('故事名称已更新', { tone: 'success' });
    } catch (error) {
        console.error('重命名故事失败:', error);
        showStatusNotice(error.message || '重命名故事失败，请稍后重试', { tone: 'error' });
    }
}

async function handleDeleteStory() {
    const story = getActiveStory();
    if (!story) return;
    const confirmed = window.confirm(`确定删除故事“${story.name}”吗？故事文案和时间流线条目会一起移除。`);
    if (!confirmed) return;

    try {
        await deleteStoryRequest(story.id);
        removeStoryFromStore(story.id);
        renderStoryView();
        showStatusNotice('故事已删除', { tone: 'success' });
    } catch (error) {
        console.error('删除故事失败:', error);
        showStatusNotice(error.message || '删除故事失败，请稍后重试', { tone: 'error' });
    }
}

function bindViewportDragging() {
    if (!dom.storyFlowViewport) return;

    const shouldIgnoreViewportDrag = (event) => (
        nodeDragState
        || event.target.closest('button, textarea, input, select, [contenteditable="true"]')
    );

    const startViewportDrag = (event, pointerId = null) => {
        event.preventDefault();
        viewportDragState = {
            pointerId,
            startX: event.clientX,
            startScrollLeft: dom.storyFlowViewport.scrollLeft
        };
        dom.storyFlowViewport.classList.add('dragging');
    };

    const moveViewportDrag = (event) => {
        event.preventDefault();
        const deltaX = event.clientX - viewportDragState.startX;
        dom.storyFlowViewport.scrollLeft = viewportDragState.startScrollLeft - deltaX;
    };

    dom.storyFlowViewport.addEventListener('pointerdown', (event) => {
        if (event.pointerType === 'mouse') return;
        if (shouldIgnoreViewportDrag(event)) return;
        startViewportDrag(event, event.pointerId);
        dom.storyFlowViewport.setPointerCapture(event.pointerId);
    });

    dom.storyFlowViewport.addEventListener('pointermove', (event) => {
        if (!viewportDragState || viewportDragState.pointerId !== event.pointerId) return;
        moveViewportDrag(event);
    }, { passive: false });

    const finishDrag = (event) => {
        if (!viewportDragState || viewportDragState.pointerId !== event.pointerId) return;
        dom.storyFlowViewport.classList.remove('dragging');
        if (dom.storyFlowViewport.hasPointerCapture(event.pointerId)) {
            dom.storyFlowViewport.releasePointerCapture(event.pointerId);
        }
        viewportDragState = null;
    };

    dom.storyFlowViewport.addEventListener('pointerup', finishDrag);
    dom.storyFlowViewport.addEventListener('pointercancel', finishDrag);
    dom.storyFlowViewport.addEventListener('lostpointercapture', () => {
        dom.storyFlowViewport.classList.remove('dragging');
        viewportDragState = null;
    });

    dom.storyFlowViewport.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || shouldIgnoreViewportDrag(event)) return;
        startViewportDrag(event);
        window.addEventListener('mousemove', handleMouseViewportDrag, { passive: false });
        window.addEventListener('mouseup', finishMouseViewportDrag);
    });

    dom.storyFlowViewport.addEventListener('dragstart', (event) => {
        if (event.target.closest('.story-node-media img')) {
            event.preventDefault();
        }
    });

    function handleMouseViewportDrag(event) {
        if (!viewportDragState || viewportDragState.pointerId !== null) return;
        moveViewportDrag(event);
    }

    function finishMouseViewportDrag() {
        if (!viewportDragState || viewportDragState.pointerId !== null) return;
        dom.storyFlowViewport.classList.remove('dragging');
        viewportDragState = null;
        window.removeEventListener('mousemove', handleMouseViewportDrag);
        window.removeEventListener('mouseup', finishMouseViewportDrag);
    }
}

function bindShowcaseDragging() {
    if (!dom.storyShowcaseViewport) return;

    dom.storyShowcaseViewport.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        showcaseDragState = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            startScrollLeft: dom.storyShowcaseViewport.scrollLeft,
            startPanY: showcasePanY
        };
        dom.storyShowcaseViewport.classList.add('dragging');
        dom.storyShowcaseViewport.setPointerCapture(event.pointerId);
    });

    dom.storyShowcaseViewport.addEventListener('pointermove', (event) => {
        if (!showcaseDragState || showcaseDragState.pointerId !== event.pointerId) return;
        event.preventDefault();
        const deltaX = event.clientX - showcaseDragState.startX;
        const deltaY = event.clientY - showcaseDragState.startY;
        dom.storyShowcaseViewport.scrollLeft = showcaseDragState.startScrollLeft - deltaX;
        applyShowcasePanY(showcaseDragState.startPanY + deltaY);
    }, { passive: false });

    const finishDrag = (event) => {
        if (!showcaseDragState || showcaseDragState.pointerId !== event.pointerId) return;
        dom.storyShowcaseViewport.classList.remove('dragging');
        if (dom.storyShowcaseViewport.hasPointerCapture(event.pointerId)) {
            dom.storyShowcaseViewport.releasePointerCapture(event.pointerId);
        }
        showcaseDragState = null;
    };

    dom.storyShowcaseViewport.addEventListener('pointerup', finishDrag);
    dom.storyShowcaseViewport.addEventListener('pointercancel', finishDrag);
    dom.storyShowcaseViewport.addEventListener('lostpointercapture', () => {
        dom.storyShowcaseViewport.classList.remove('dragging');
        showcaseDragState = null;
    });
}

function readStoryBackgroundFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('读取背景图片失败'));
        reader.readAsDataURL(file);
    });
}

function showInlineStoryFeedback(trigger, message = '加入成功') {
    if (!trigger) return;
    const host = trigger.closest('.photo-card, .group-nav-card, .group-nav-btn') || trigger.parentElement;
    if (!host) return;
    host.querySelector('.inline-story-feedback')?.remove();
    const bubble = document.createElement('span');
    bubble.className = 'inline-story-feedback';
    bubble.textContent = message;
    host.appendChild(bubble);
    window.setTimeout(() => {
        bubble.classList.add('is-hiding');
        window.setTimeout(() => bubble.remove(), 260);
    }, 1300);
}

async function addItemsToStory(photoIds, options = {}) {
    const story = await chooseStory(options.targetLabel || '加入故事');
    if (!story) {
        if (state.stories.length > 0) {
            showStatusNotice('没有找到对应的故事，请重试一次。', { tone: 'info', duration: 2200 });
        }
        return;
    }

    showStatusNotice(`正在加入“${story.name}”...`, { tone: 'info', duration: 0 });
    const data = await addStoryItemsRequest(story.id, {
        photoIds,
        sourceType: options.sourceType || 'photo',
        sourceGroupName: options.sourceGroupName || ''
    });

    updateActiveStory(data.story);
    renderStoryView();

    const baseMessage = data.addedCount > 0
        ? `已加入 ${data.addedCount} 张到“${data.story.name}”`
        : `该图已添加到“${data.story.name}”`;
    const skippedMessage = data.skippedCount > 0
        ? `，${data.skippedCount} 张已添加过，已跳过`
        : '';

    showStatusNotice(`${baseMessage}${skippedMessage}`, {
        tone: 'success',
        duration: 5200,
        actionLabel: '打开故事模式',
        onAction: () => {
            state.siteView = 'story';
            state.activeStoryId = data.story.id;
            renderSiteView();
        }
    });
    showInlineStoryFeedback(options.trigger, data.addedCount > 0 ? '加入成功' : '该图已添加');
}

export async function promptAddPhotoToStory(photoId, options = {}) {
    const normalizedId = String(photoId || '').trim();
    if (!normalizedId) return;

    try {
        await addItemsToStory([normalizedId], { targetLabel: '加入故事', sourceType: 'photo', trigger: options.trigger || null });
    } catch (error) {
        console.error('加入故事失败:', error);
        showStatusNotice(error.message || '加入故事失败，请稍后重试', { tone: 'error' });
    }
}

export async function promptAddGroupToStory(groupName, options = {}) {
    const normalizedGroupName = String(groupName || '').trim();
    if (!normalizedGroupName) return;
    const photoIds = state.photos
        .filter((photo) => String(photo.groupName || '').trim() === normalizedGroupName)
        .map((photo) => photo.id);

    if (photoIds.length === 0) {
        showStatusNotice('这个分组里暂时没有可加入故事的图片。', { tone: 'info', duration: 2200 });
        return;
    }

    try {
        await addItemsToStory(photoIds, {
            targetLabel: '加入故事',
            sourceType: 'group',
            sourceGroupName: normalizedGroupName,
            trigger: options.trigger || null
        });
    } catch (error) {
        console.error('分组加入故事失败:', error);
        showStatusNotice(error.message || '分组加入故事失败，请稍后重试', { tone: 'error' });
    }
}

export async function loadStories() {
    try {
        const data = await fetchStories();
        normalizeStoryOrder(data.stories || []);
        ensureActiveStory();
        renderSiteView();
    } catch (error) {
        console.error('加载故事失败:', error);
        showStatusNotice(error.message || '加载故事失败，请稍后重试', { tone: 'error' });
    }
}

export function refreshStoryView() {
    renderStoryView();
}

export function initStory() {
    dom.siteViewBtns.forEach((button) => {
        button.addEventListener('click', () => {
            state.siteView = button.dataset.siteView === 'story' ? 'story' : 'album';
            renderSiteView();
        });
    });

    dom.storyCreateBtn?.addEventListener('click', handleCreateStory);
    dom.storyCreateEmptyBtn?.addEventListener('click', handleCreateStory);
    dom.storyRenameBtn?.addEventListener('click', handleRenameStory);
    dom.storyDeleteBtn?.addEventListener('click', handleDeleteStory);
    dom.storyShowcaseBtn?.addEventListener('click', openStoryShowcase);

    dom.storyBackgroundSelect?.addEventListener('change', () => {
        const story = getActiveStory();
        if (!story) return;
        writeLocalStoryBackground(story.id, '');
        persistStoryAppearance(story.id, { backgroundPhotoId: dom.storyBackgroundSelect.value || '' });
    });

    dom.storyBackgroundOpacityInput?.addEventListener('input', () => {
        const opacity = clampBackgroundOpacity(Number(dom.storyBackgroundOpacityInput.value) / 100);
        if (dom.storyBackgroundOpacityValue) {
            dom.storyBackgroundOpacityValue.textContent = `${Math.round(opacity * 100)}%`;
        }
        const story = getActiveStory();
        if (story) {
            applyStoryBackground({ ...story, backgroundOpacity: opacity });
            if (dom.storyShowcase && !dom.storyShowcase.hidden) {
                renderShowcase({ ...story, backgroundOpacity: opacity });
            }
        }
    });

    dom.storyBackgroundOpacityInput?.addEventListener('change', () => {
        const story = getActiveStory();
        if (!story) return;
        const opacity = clampBackgroundOpacity(Number(dom.storyBackgroundOpacityInput.value) / 100);
        persistStoryAppearance(story.id, { backgroundOpacity: opacity });
    });

    dom.storyBackgroundFileInput?.addEventListener('change', async () => {
        const story = getActiveStory();
        const file = dom.storyBackgroundFileInput.files?.[0];
        if (!story || !file) return;
        try {
            const dataUrl = await readStoryBackgroundFile(file);
            writeLocalStoryBackground(story.id, dataUrl);
            updateActiveStory({ ...story, backgroundPhotoId: '' });
            await persistStoryAppearance(story.id, { backgroundPhotoId: '' });
            renderStoryView();
            showStatusNotice('本地背景已应用到当前浏览器', { tone: 'success', duration: 2200 });
        } catch (error) {
            console.error('读取本地故事背景失败:', error);
            showStatusNotice(error.message || '读取本地背景失败', { tone: 'error' });
        } finally {
            dom.storyBackgroundFileInput.value = '';
        }
    });

    dom.storyTimelinePrevBtn?.addEventListener('click', () => {
        dom.storyFlowViewport?.scrollBy({ left: -(dom.storyFlowViewport.clientWidth * 0.78), behavior: 'smooth' });
    });

    dom.storyTimelineNextBtn?.addEventListener('click', () => {
        dom.storyFlowViewport?.scrollBy({ left: dom.storyFlowViewport.clientWidth * 0.78, behavior: 'smooth' });
    });

    dom.storyContentInput?.addEventListener('input', () => {
        const story = getActiveStory();
        if (!story) return;

        const content = dom.storyContentInput.value;
        updateActiveStory({ ...story, content });
        setEditorStatus('保存中...');
        if (autosaveTimer) clearTimeout(autosaveTimer);
        autosaveTimer = window.setTimeout(() => {
            persistStoryContent(story.id, content);
        }, 650);
    });

    dom.storyStage?.addEventListener('click', async (event) => {
        const removeBtn = event.target.closest('[data-story-remove-item]');
        if (removeBtn) {
            event.preventDefault();
            event.stopPropagation();
            const story = getActiveStory();
            const itemId = removeBtn.getAttribute('data-story-remove-item') || '';
            if (!story || !itemId) return;

            try {
                const data = await deleteStoryItemRequest(story.id, itemId);
                updateActiveStory(data.story);
                renderStoryView();
                showStatusNotice('这张图片已从当前故事移出', { tone: 'success', duration: 2200 });
            } catch (error) {
                console.error('移出故事失败:', error);
                showStatusNotice(error.message || '移出故事失败，请稍后重试', { tone: 'error' });
            }
            return;
        }

        const adjustBtn = event.target.closest('[data-story-adjust-item]');
        if (adjustBtn) {
            event.preventDefault();
            event.stopPropagation();
            const itemId = adjustBtn.getAttribute('data-story-adjust-item') || '';
            const direction = adjustBtn.getAttribute('data-story-adjust') || '';
            if (!itemId || !direction) return;
            await handleStoryAdjust(itemId, direction);
        }
    });

    dom.storyStage?.addEventListener('pointerdown', (event) => {
        const handle = event.target.closest('[data-story-drag-handle]');
        if (!handle) return;
        startNodeDrag(event, handle);
    });

    dom.storyShowcaseMenuBtn?.addEventListener('click', () => {
        const isHidden = dom.storyShowcaseMenu?.hidden !== false;
        if (dom.storyShowcaseMenu) dom.storyShowcaseMenu.hidden = !isHidden;
        dom.storyShowcaseMenuBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    });

    dom.storyShowcasePrevBtn?.addEventListener('click', () => {
        dom.storyShowcaseViewport?.scrollBy({ left: -(dom.storyShowcaseViewport.clientWidth * 0.76), behavior: 'smooth' });
    });

    dom.storyShowcaseNextBtn?.addEventListener('click', () => {
        dom.storyShowcaseViewport?.scrollBy({ left: dom.storyShowcaseViewport.clientWidth * 0.76, behavior: 'smooth' });
    });

    dom.storyShowcaseAutoplayBtn?.addEventListener('click', () => {
        toggleShowcaseAutoplay();
    });

    dom.storyShowcaseResetBtn?.addEventListener('click', () => {
        stopShowcaseAutoplay();
        dom.storyShowcaseViewport?.scrollTo({ left: 0, behavior: 'auto' });
        applyShowcasePanY(0);
    });

    dom.storyShowcaseCloseBtn?.addEventListener('click', closeStoryShowcase);

    dom.storyChoiceList?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-story-choice-id]');
        if (!button) return;
        const storyId = button.getAttribute('data-story-choice-id') || '';
        closeStoryChoiceModal(state.stories.find((story) => story.id === storyId) || null);
    });

    dom.storyChoiceCreateBtn?.addEventListener('click', async () => {
        const name = window.prompt('给新故事起个名字吧', '新的图片故事');
        if (name === null) return;
        try {
            const story = await createStoryFlow(name);
            closeStoryChoiceModal(story);
        } catch (error) {
            console.error('创建故事失败:', error);
            showStatusNotice(error.message || '创建故事失败，请稍后重试', { tone: 'error' });
        }
    });

    dom.storyChoiceModal?.addEventListener('click', (event) => {
        if (event.target.closest('[data-story-choice-cancel]')) {
            closeStoryChoiceModal(null);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && dom.storyShowcase && !dom.storyShowcase.hidden) {
            closeStoryShowcase();
        } else if (event.key === 'Escape' && dom.storyChoiceModal && !dom.storyChoiceModal.hidden) {
            closeStoryChoiceModal(null);
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && dom.storyShowcase && !dom.storyShowcase.hidden) {
            dom.storyShowcase.hidden = true;
            document.body.classList.remove('story-showcase-open');
        }
    });

    bindViewportDragging();
    bindShowcaseDragging();
    window.addEventListener('resize', () => {
        if (state.siteView === 'story') {
            renderStoryView();
        }
        if (dom.storyShowcase && !dom.storyShowcase.hidden) {
            const story = getActiveStory();
            if (story) renderShowcase(story);
        }
    });
    renderSiteView();
}
