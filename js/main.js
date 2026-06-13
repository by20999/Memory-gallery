import { dom } from './dom.js';
import { initTheme } from './theme.js';
import { initNickname } from './profile.js';
import { initGallery, loadPhotos, renderGallery, exitBatchMode } from './gallery.js';
import { initComments } from './comments.js';
import { initDeleteFlow, openBatchDeleteModal, openSingleDeleteModal, openGroupDeleteModal } from './delete.js';
import { initLightbox, openLightbox, closeLightbox } from './lightbox.js';
import { initUpload } from './upload.js';
import { initStory, loadStories, refreshStoryView } from './story.js';
import { initSystemPanel } from './system.js';
import { initEnhancedSelects } from './select.js';
import { state } from './state.js';
import { showStatusNotice } from './feedback.js';

function getDayPhaseLabel() {
    const hour = new Date().getHours();
    if (hour < 5) return '夜深时分';
    if (hour < 11) return '清晨到午前';
    if (hour < 14) return '午后开场';
    if (hour < 18) return '傍晚之前';
    if (hour < 22) return '夜色刚刚亮起';
    return '深夜档';
}

function buildDynamicSubtitles() {
    const total = state.photos.length;
    const captionedCount = state.photos.filter((photo) => Boolean(String(photo.caption || '').trim())).length;
    const favoriteCount = state.photos.filter((photo) => photo.favorited).length;
    const groupedCount = state.photos.filter((photo) => Boolean(String(photo.groupName || '').trim())).length;
    const phaseLabel = getDayPhaseLabel();
    const themePackage = document.documentElement.getAttribute('data-theme-package') || 'summer';
    const themeLines = {
        cream: [
            '用柔软的奶油色收住日常，把照片翻成一页温热的小册子。',
            '适合慢慢整理亲友、散步、咖啡和那些被阳光照到的瞬间。'
        ],
        film: [
            '让回忆带一点胶片颗粒，旧时光会在暗角里重新亮起来。',
            '旅行、街灯、聚会和晚风，都会在这一册里更有故事感。'
        ],
        summer: [
            '阳光、海风和西瓜汽水的季节，适合把照片排成清爽的时间流。',
            '蓝色海风吹过的片段，会在这里慢慢变成自己的夏日档案。'
        ],
        custom: [
            '当前主题由你亲手调色，这本相册也会跟着长出独一份的气质。',
            '换一种背景，就像给同一段回忆换上一层新的光。'
        ]
    };
    const lines = [
        ...(themeLines[themePackage] || themeLines.summer),
        `${phaseLabel}，很适合回来翻一页自己的照片流。`,
        total === 0
            ? '先放进第一张照片吧，这里会慢慢长成你的私人视觉档案。'
            : total < 12
                ? `已经存下 ${total} 张照片，这本相册正在长出自己的气质。`
                : `你已经收进了 ${total} 张照片，足够拼出一条很完整的个人时间线。`,
        captionedCount === 0
            ? '给任意一张补一句描述，画面会立刻从存档变成片段。'
            : `已经有 ${captionedCount} 张照片写下了描述，故事感正在慢慢变浓。`,
        favoriteCount === 0
            ? '看到特别想反复点开的那张，就顺手给它一个收藏标记。'
            : `${favoriteCount} 张照片已经被你特别收起，主页开始有了自己的偏爱。`,
        groupedCount === 0
            ? '试试把照片分进不同小册子里，浏览时会更像翻一本杂志。'
            : `${groupedCount} 张照片已经归进分组，整理感会让整个站点更耐看。`
    ];
    return [...new Set(lines.filter(Boolean))];
}

function startSubtitleRotation() {
    let subtitleIndex = 0;
    const renderSubtitle = (nextIndex = subtitleIndex) => {
        const subtitles = buildDynamicSubtitles();
        if (subtitles.length === 0) return;
        subtitleIndex = nextIndex % subtitles.length;
        dom.dynamicSubtitle.textContent = subtitles[subtitleIndex];
        dom.dynamicSubtitle.style.opacity = '1';
    };

    renderSubtitle(0);
    setInterval(() => {
        const subtitles = buildDynamicSubtitles();
        if (subtitles.length === 0) return;
        dom.dynamicSubtitle.style.opacity = '0';
        setTimeout(() => {
            renderSubtitle(subtitleIndex + 1);
        }, 400);
    }, 3800);

    window.addEventListener('album-theme-text-change', () => {
        subtitleIndex = 0;
        renderSubtitle(0);
    });
}

function setShellActive(action) {
    const normalized = action === 'favorites'
        ? 'favorites'
        : action === 'story'
            ? 'story'
            : action === 'system'
                ? 'system'
                : action === 'overview'
                    ? 'overview'
                    : 'album';

    document.querySelectorAll('.sidebar-nav-btn[data-shell-action]').forEach((button) => {
        const active = button.dataset.shellAction === normalized;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function switchToAlbum(filter = 'all') {
    state.siteView = 'album';
    state.contentFilter = filter;
    if (dom.contentFilterSelect) dom.contentFilterSelect.value = filter;
    if (dom.systemPanel) dom.systemPanel.hidden = true;
    if (dom.systemToggleBtn) dom.systemToggleBtn.setAttribute('aria-expanded', 'false');
    dom.siteViewBtns.forEach((button) => {
        const active = button.dataset.siteView === 'album';
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.body.classList.remove('story-view-active');
    if (dom.albumWorkspace) dom.albumWorkspace.hidden = false;
    if (dom.storyWorkspace) dom.storyWorkspace.hidden = true;
    renderGallery();
}

function initSummerShell() {
    setShellActive(state.siteView);

    document.querySelectorAll('[data-shell-action]').forEach((button) => {
        button.addEventListener('click', async () => {
            const action = button.dataset.shellAction;

            if (action === 'overview' || action === 'album') {
                switchToAlbum('all');
                setShellActive(action);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'favorites') {
                switchToAlbum('favorites');
                setShellActive('favorites');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'story') {
                document.querySelector('.site-view-btn[data-site-view="story"]')?.click();
                setShellActive('story');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'system') {
                switchToAlbum(state.contentFilter || 'all');
                setShellActive('system');
                dom.systemToggleBtn?.click();
                dom.systemPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            if (action === 'trash') {
                switchToAlbum('all');
                setShellActive('album');
                showStatusNotice('当前相册采用直接删除确认流程，暂未启用独立回收站。', { tone: 'info', duration: 2600 });
                return;
            }

            if (action === 'create-story') {
                document.querySelector('.site-view-btn[data-site-view="story"]')?.click();
                setShellActive('story');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => dom.storyCreateBtn?.click(), 120);
                return;
            }

            if (action === 'refresh') {
                await Promise.all([loadPhotos(), loadStories()]);
                showStatusNotice('相册数据已刷新', { tone: 'success', duration: 1600 });
            }
        });
    });

    dom.siteViewBtns.forEach((button) => {
        button.addEventListener('click', () => {
            setShellActive(button.dataset.siteView === 'story' ? 'story' : 'album');
        });
    });
}

async function bootstrap() {
    initTheme();
    initNickname();
    initComments({ onRenderGallery: renderGallery });
    initDeleteFlow({
        onLoadPhotos: loadPhotos,
        onCloseLightbox: closeLightbox,
        onExitBatchMode: exitBatchMode
    });
    initLightbox({
        onRenderGallery: renderGallery,
        onOpenSingleDeleteModal: openSingleDeleteModal,
        onLoadPhotos: loadPhotos
    });
    initGallery({
        onOpenLightbox: openLightbox,
        onOpenBatchDeleteModal: openBatchDeleteModal,
        onOpenGroupDeleteModal: openGroupDeleteModal
    });
    initStory();
    initSummerShell();
    initSystemPanel();
    initUpload({ onLoadPhotos: loadPhotos });
    initEnhancedSelects();
    await Promise.all([loadPhotos(), loadStories()]);
    refreshStoryView();
    startSubtitleRotation();
}

bootstrap();
