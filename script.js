let photos = [];
let visiblePhotos = [];
let currentPhotoIndex = null;
let galleryObserver = null;
let batchMode = false;
let selectedIds = new Set();
let searchKeyword = '';
let groupMode = 'none';
let draggedPhotoId = null;
let dragMoved = false;
let reorderSaving = false;

let currentFilter = 'none';
let currentEdit = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };

const fileInput = document.getElementById('fileInput');
const gallery = document.getElementById('gallery');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeBtn = document.querySelector('.close');
const deleteBtn = document.getElementById('deleteBtn');
const submitCommentBtn = document.getElementById('submitComment');
const commentInput = document.getElementById('commentInput');
const authorInput = document.getElementById('authorInput');
const commentsList = document.getElementById('commentsList');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const groupToggleBtn = document.getElementById('groupToggleBtn');
const searchHint = document.getElementById('searchHint');
const captionInput = document.getElementById('captionInput');
const tagsInput = document.getElementById('tagsInput');
const photoStory = document.getElementById('photoStory');
const festivalBadge = document.getElementById('festivalBadge');
const recommendThemeBtn = document.getElementById('recommendThemeBtn');
const headerKicker = document.getElementById('headerKicker');
const headerDescription = document.getElementById('headerDescription');

const NICKNAME_KEY = 'album_nickname';

function getNickname() {
    return localStorage.getItem(NICKNAME_KEY) || '';
}

function setNickname(name) {
    localStorage.setItem(NICKNAME_KEY, name);
}

function getAvatarChar(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function updateUserBadge(name) {
    document.getElementById('userAvatar').textContent = getAvatarChar(name);
    document.getElementById('userName').textContent = name;
}

function openNicknameModal(required = false) {
    const modal = document.getElementById('nicknameModal');
    const input = document.getElementById('nicknameInput');
    input.value = getNickname();
    document.getElementById('nicknameError').textContent = '';
    modal.classList.add('open');
    modal._required = required;
    setTimeout(() => input.focus(), 100);
}

function closeNicknameModal() {
    document.getElementById('nicknameModal').classList.remove('open');
}

document.getElementById('nicknameConfirmBtn').addEventListener('click', () => {
    const input = document.getElementById('nicknameInput');
    const name = input.value.trim();
    if (name.length < 2) {
        document.getElementById('nicknameError').textContent = '昵称至少2个字';
        return;
    }
    setNickname(name);
    updateUserBadge(name);
    closeNicknameModal();
});

document.getElementById('nicknameInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('nicknameConfirmBtn').click();
});

document.getElementById('nicknameModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('nicknameModal') && !e.target._required) {
        closeNicknameModal();
    }
});

document.getElementById('userEditBtn').addEventListener('click', () => openNicknameModal(false));

function initNickname() {
    const name = getNickname();
    if (!name) {
        openNicknameModal(true);
    } else {
        updateUserBadge(name);
    }
}

const THEME_KEY = 'album_theme';
const GRADIENT_KEY = 'album_gradient';
const THEME_MODE_KEY = 'album_theme_mode';
const THEME_PACKAGE_KEY = 'album_theme_package';

const THEME_PACKAGES = {
    cream: {
        label: '奶油相册',
        gradient: 'linear-gradient(135deg, #fff8ee 0%, #ffe7d1 52%, #f7d7c2 100%)',
        accent: '#d47c5d',
        accentHover: '#bf6948',
        cardBg: 'rgba(255, 251, 245, 0.62)',
        chipBg: 'rgba(255, 242, 229, 0.92)',
        bodyGlow: 'radial-gradient(circle, rgba(255, 236, 214, 0.86) 0%, rgba(255, 236, 214, 0.08) 62%, rgba(255, 236, 214, 0) 72%)'
    },
    film: {
        label: '胶片相册',
        gradient: 'linear-gradient(145deg, #5d5047 0%, #9a7a5c 42%, #d6be9d 100%)',
        accent: '#5a3f2c',
        accentHover: '#4b3425',
        cardBg: 'rgba(255, 244, 223, 0.54)',
        chipBg: 'rgba(92, 63, 43, 0.14)',
        bodyGlow: 'radial-gradient(circle, rgba(255, 217, 163, 0.55) 0%, rgba(255, 217, 163, 0.08) 60%, rgba(255, 217, 163, 0) 72%)'
    },
    summer: {
        label: '夏日相册',
        gradient: 'linear-gradient(135deg, #fef7d7 0%, #c9f2ee 42%, #8fd5ff 100%)',
        accent: '#0f9fb7',
        accentHover: '#0b8398',
        cardBg: 'rgba(244, 255, 252, 0.56)',
        chipBg: 'rgba(228, 252, 247, 0.88)',
        bodyGlow: 'radial-gradient(circle, rgba(183, 244, 237, 0.72) 0%, rgba(183, 244, 237, 0.08) 62%, rgba(183, 244, 237, 0) 72%)'
    }
};

function updateThemeIcon(theme) {
    document.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
    document.getElementById('themeToggleBtn').title = theme === 'dark' ? '切换到白天模式' : '切换到夜晚模式';
}

function getFestivalContext() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month === 1 && day <= 7) {
        return { name: '新年团聚', badge: '新年推荐', copy: '新的一年，把全家的第一份笑容继续收藏下来。', packageKey: 'cream' };
    }
    if (month === 2 && day >= 10 && day <= 18) {
        return { name: '元宵团圆', badge: '元宵推荐', copy: '灯火亮起的时候，最适合把家人的热闹留在同一本相册里。', packageKey: 'cream' };
    }
    if (month >= 3 && month <= 5) {
        return { name: '春日漫游', badge: '春日推荐', copy: '把野餐、散步和花开的日子，慢慢装订成春天的家庭回忆。', packageKey: 'cream' };
    }
    if (month >= 6 && month <= 8) {
        return { name: '夏日欢聚', badge: '夏日推荐', copy: '阳光、海风和西瓜的季节，最适合用清爽的色调收纳回忆。', packageKey: 'summer' };
    }
    if (month === 10 && day >= 1 && day <= 7) {
        return { name: '假日出游', badge: '国庆推荐', copy: '假期的旅途和团聚，都值得在回家后继续被翻看很多次。', packageKey: 'film' };
    }
    if (month >= 9 && month <= 11) {
        return { name: '秋日故事', badge: '秋日推荐', copy: '收获和团聚的季节，用带一点胶片感的暖色更有故事味道。', packageKey: 'film' };
    }
    return { name: '冬日收藏', badge: '冬日推荐', copy: '围坐在一起的时刻，总值得被留在一个温暖的角落里。', packageKey: 'film' };
}

function clearPackageStyles() {
    const root = document.documentElement;
    ['--bg-gradient', '--accent', '--accent-hover', '--card-bg', '--theme-chip-bg', '--theme-body-glow'].forEach((key) => root.style.removeProperty(key));
    document.documentElement.removeAttribute('data-theme-package');
}

function syncThemePackageButtons(activeKey, mode) {
    document.querySelectorAll('.theme-package-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.package === activeKey && mode === 'manual');
    });
    document.getElementById('autoThemeBtn').classList.toggle('active', mode === 'auto');
}

function applyGradient(gradient, persist = true) {
    clearPackageStyles();
    document.documentElement.style.setProperty('--bg-gradient', gradient);
    document.documentElement.setAttribute('data-theme-package', 'custom');
    if (persist) {
        localStorage.setItem(GRADIENT_KEY, gradient);
        localStorage.setItem(THEME_MODE_KEY, 'manual');
        localStorage.setItem(THEME_PACKAGE_KEY, 'custom');
    }
    syncActivePreset(gradient);
    syncThemePackageButtons('custom', 'manual');
}

function syncActivePreset(gradient) {
    document.querySelectorAll('.theme-preset').forEach((p) => {
        p.classList.toggle('active', p.dataset.gradient === gradient);
    });
}

function applyThemePackage(packageKey, options = {}) {
    const { persist = true, mode = 'manual' } = options;
    const themePackage = THEME_PACKAGES[packageKey];
    if (!themePackage) return;

    const root = document.documentElement;
    root.setAttribute('data-theme-package', packageKey);
    root.style.setProperty('--bg-gradient', themePackage.gradient);
    root.style.setProperty('--accent', themePackage.accent);
    root.style.setProperty('--accent-hover', themePackage.accentHover);
    root.style.setProperty('--card-bg', themePackage.cardBg);
    root.style.setProperty('--theme-chip-bg', themePackage.chipBg);
    root.style.setProperty('--theme-body-glow', themePackage.bodyGlow);
    localStorage.removeItem(GRADIENT_KEY);
    syncActivePreset('');

    if (persist) {
        localStorage.setItem(THEME_MODE_KEY, mode);
        localStorage.setItem(THEME_PACKAGE_KEY, packageKey);
    }

    syncThemePackageButtons(packageKey, mode);
}

function refreshFestivalHeader() {
    const festival = getFestivalContext();
    festivalBadge.textContent = `${festival.badge} · ${THEME_PACKAGES[festival.packageKey].label}`;
    recommendThemeBtn.textContent = `一键切换到${THEME_PACKAGES[festival.packageKey].label}`;
    recommendThemeBtn.dataset.package = festival.packageKey;
    headerKicker.textContent = `${festival.name} · 把寻常日子装订成家的回忆册`;
    headerDescription.textContent = festival.copy;
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    const themeMode = localStorage.getItem(THEME_MODE_KEY) || 'auto';
    const savedPackage = localStorage.getItem(THEME_PACKAGE_KEY);
    const savedGradient = localStorage.getItem(GRADIENT_KEY);
    const festival = getFestivalContext();

    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    refreshFestivalHeader();

    if (themeMode === 'auto') {
        applyThemePackage(festival.packageKey, { persist: false, mode: 'auto' });
        syncThemePackageButtons(festival.packageKey, 'auto');
    } else if (savedPackage && savedPackage !== 'custom') {
        applyThemePackage(savedPackage, { persist: false, mode: 'manual' });
    } else if (savedGradient) {
        applyGradient(savedGradient, false);
        syncThemePackageButtons('custom', 'manual');
    } else {
        applyThemePackage(festival.packageKey, { persist: false, mode: 'auto' });
        syncThemePackageButtons(festival.packageKey, 'auto');
    }
}

document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(THEME_KEY, next);
    updateThemeIcon(next);
});

document.getElementById('themePanelBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('themeDropdown').classList.toggle('open');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.theme-panel')) {
        document.getElementById('themeDropdown').classList.remove('open');
    }
});

document.querySelectorAll('.theme-preset').forEach((preset) => {
    const gradient = preset.dataset.gradient;
    preset.style.background = gradient;
    preset.addEventListener('click', () => applyGradient(gradient));
});

document.querySelectorAll('.theme-package-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyThemePackage(btn.dataset.package));
});

document.getElementById('autoThemeBtn').addEventListener('click', () => {
    const festival = getFestivalContext();
    localStorage.setItem(THEME_MODE_KEY, 'auto');
    localStorage.removeItem(THEME_PACKAGE_KEY);
    applyThemePackage(festival.packageKey, { persist: false, mode: 'auto' });
    syncThemePackageButtons(festival.packageKey, 'auto');
});

document.getElementById('applyColorBtn').addEventListener('click', () => {
    const c1 = document.getElementById('colorStart').value;
    const c2 = document.getElementById('colorEnd').value;
    const gradient = `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
    applyGradient(gradient);
});

recommendThemeBtn.addEventListener('click', () => {
    applyThemePackage(recommendThemeBtn.dataset.package);
});

function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
        return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
    }
    return [...new Set(String(tags).split(/[，,、\s]+/).map((tag) => tag.trim()).filter(Boolean))];
}

function formatUploadMonth(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '未标记月份';
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatUploadDate(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updatePhotoInStore(photoId, patch) {
    photos = photos.map((photo) => photo.id === photoId ? { ...photo, ...patch } : photo);
    visiblePhotos = visiblePhotos.map((photo) => photo.id === photoId ? { ...photo, ...patch } : photo);
}

function getCurrentPhoto() {
    return currentPhotoIndex === null ? null : visiblePhotos[currentPhotoIndex];
}

function getPhotoLikeCount(photo) {
    const reactions = photo.reactions || {};
    return (photo.likes || 0) + (reactions['❤️'] || 0) + (reactions['👍'] || 0);
}
function getSearchableText(photo) {
    return [photo.name, photo.caption, (photo.tags || []).join(' '), formatUploadMonth(photo.uploadTime)].join(' ').toLowerCase();
}

function getFilteredPhotos() {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return [...photos];
    return photos.filter((photo) => getSearchableText(photo).includes(keyword));
}

function buildGroups(list) {
    if (groupMode === 'month') {
        const monthGroups = new Map();
        list.forEach((photo) => {
            const key = formatUploadMonth(photo.uploadTime);
            if (!monthGroups.has(key)) monthGroups.set(key, []);
            monthGroups.get(key).push(photo);
        });
        return [...monthGroups.entries()].map(([title, items]) => ({ title, items }));
    }

    if (groupMode === 'tag') {
        const tagGroups = new Map();
        list.forEach((photo) => {
            const key = photo.tags && photo.tags.length ? photo.tags[0] : '未分类';
            if (!tagGroups.has(key)) tagGroups.set(key, []);
            tagGroups.get(key).push(photo);
        });
        return [...tagGroups.entries()].map(([title, items]) => ({ title: `标签 · ${title}`, items }));
    }

    return [{ title: '', items: list }];
}

function updateHeaderStats(totalCount, filteredCount) {
    const stats = document.getElementById('headerStats');
    const pieces = [`共 ${totalCount} 张照片`];
    if (searchKeyword.trim()) pieces.push(`搜索到 ${filteredCount} 张`);
    if (groupMode === 'month') pieces.push('按月份分组');
    if (groupMode === 'tag') pieces.push('按标签分组');
    stats.textContent = pieces.join(' · ');
}

function updateGroupButton() {
    const modeText = {
        none: '分组：平铺',
        month: '分组：月份',
        tag: '分组：标签'
    };
    groupToggleBtn.textContent = modeText[groupMode];
}

function updateSearchHint(filteredCount) {
    if (searchKeyword.trim()) {
        searchHint.textContent = `正在搜索“${searchKeyword.trim()}”，搜索结果中已禁用拖拽排序。`;
        clearSearchBtn.hidden = false;
        return;
    }

    if (batchMode) {
        searchHint.textContent = '批量模式下已禁用拖拽排序，避免和多选操作冲突。';
    } else if (groupMode === 'month') {
        searchHint.textContent = '当前按月份查看，更适合回看某一段时间的家庭照片。分组模式下已禁用拖拽。';
    } else if (groupMode === 'tag') {
        searchHint.textContent = '当前按标签查看，适合按场景快速收纳一组照片。分组模式下已禁用拖拽。';
    } else if (reorderSaving) {
        searchHint.textContent = '正在保存新的照片顺序...';
    } else {
        searchHint.textContent = `可以搜索照片名称、描述或标签，例如“生日”“旅行”“奶奶”。当前共 ${filteredCount} 张，支持鼠标拖动排序。`;
    }
    clearSearchBtn.hidden = true;
}

function canDragReorder() {
    return groupMode === 'none' && !batchMode && !searchKeyword.trim() && !reorderSaving;
}

function movePhotoToTarget(photoList, draggedId, targetId) {
    const fromIndex = photoList.findIndex((photo) => photo.id === draggedId);
    const toIndex = photoList.findIndex((photo) => photo.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return false;

    const nextPhotos = [...photoList];
    const [dragged] = nextPhotos.splice(fromIndex, 1);
    nextPhotos.splice(toIndex, 0, dragged);
    photos = nextPhotos;
    visiblePhotos = [...nextPhotos];
    return true;
}

async function persistPhotoOrder() {
    reorderSaving = true;
    updateSearchHint(visiblePhotos.length);
    try {
        const response = await fetch('/api/photos/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderedIds: photos.map((photo) => photo.id) })
        });
        if (!response.ok) throw new Error('保存排序失败');
    } catch (error) {
        console.error('保存排序失败:', error);
        alert('照片顺序保存失败，请重试');
        await loadPhotos();
    } finally {
        reorderSaving = false;
        renderGallery();
    }
}

function renderGallery() {
    const filteredPhotos = getFilteredPhotos();
    const groups = buildGroups(filteredPhotos);
    visiblePhotos = groups.flatMap((group) => group.items);
    const dragEnabled = canDragReorder();

    gallery.innerHTML = '';
    updateHeaderStats(photos.length, visiblePhotos.length);
    updateSearchHint(visiblePhotos.length);
    updateGroupButton();
    gallery.classList.toggle('drag-enabled', dragEnabled);

    if (visiblePhotos.length === 0) {
        gallery.innerHTML = `
            <div class="gallery-empty">
                <div class="gallery-empty-icon">📷</div>
                <div class="gallery-empty-title">${searchKeyword.trim() ? '没有找到匹配的照片' : '还没有图片，快来上传第一张吧'}</div>
                <div class="gallery-empty-desc">${searchKeyword.trim() ? '试试更短的关键词，或者换一个标签名。' : '上传时写上一句描述或标签，后面找照片会更轻松。'}</div>
            </div>
        `;
        return;
    }

    if (batchMode) {
        gallery.classList.add('batch-mode');
    } else {
        gallery.classList.remove('batch-mode');
        selectedIds.clear();
    }

    let animationIndex = 0;
    groups.forEach((group) => {
        if (group.title) {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'gallery-group-title';
            groupTitle.innerHTML = `<span>${group.title}</span><em>${group.items.length} 张</em>`;
            gallery.appendChild(groupTitle);
        }

        group.items.forEach((photo) => {
            const visibleIndex = visiblePhotos.findIndex((item) => item.id === photo.id);
            const card = document.createElement('div');
            card.className = 'photo-card';
            if (batchMode && selectedIds.has(photo.id)) card.classList.add('selected');
            if (dragEnabled) {
                card.classList.add('draggable-card');
                card.setAttribute('draggable', 'true');
            }
            card.style.animationDelay = `${animationIndex * 0.04}s`;
            animationIndex += 1;

            const img = document.createElement('img');
            img.dataset.src = photo.src;
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
            img.alt = photo.name;
            img.classList.add('lazy');

            const caption = photo.caption ? `<div class="card-caption">${escapeHtml(photo.caption)}</div>` : '';
            const tags = (photo.tags || []).slice(0, 2).map((tag) => `<span class="card-tag">#${escapeHtml(tag)}</span>`).join('');

            const cardInfo = document.createElement('div');
            cardInfo.className = 'card-info';

            const reactions = photo.reactions || {};
            const reactionSummary = Object.keys(reactions).filter((emoji) => reactions[emoji] > 0).slice(0, 3).join('');

            cardInfo.innerHTML = `
                <div class="card-meta-row">
                    <div class="likes-count">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        <span>${getPhotoLikeCount(photo)}</span>
                    </div>
                    <div class="comments-count">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <span>${photo.commentsCount || 0}</span>
                    </div>
                    ${reactionSummary ? `<div class="card-reactions">${reactionSummary}</div>` : ''}
                </div>
                ${caption}
                ${tags ? `<div class="card-tags">${tags}</div>` : ''}
            `;

            card.appendChild(img);
            card.appendChild(cardInfo);

            if (dragEnabled) {
                card.addEventListener('dragstart', (event) => {
                    draggedPhotoId = photo.id;
                    dragMoved = false;
                    card.classList.add('dragging');
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', photo.id);
                });

                card.addEventListener('dragover', (event) => {
                    event.preventDefault();
                    if (draggedPhotoId && draggedPhotoId !== photo.id) {
                        card.classList.add('drag-over');
                    }
                });

                card.addEventListener('dragleave', () => {
                    card.classList.remove('drag-over');
                });

                card.addEventListener('drop', async (event) => {
                    event.preventDefault();
                    card.classList.remove('drag-over');
                    if (!draggedPhotoId || draggedPhotoId === photo.id) return;
                    const moved = movePhotoToTarget(photos, draggedPhotoId, photo.id);
                    draggedPhotoId = null;
                    dragMoved = moved;
                    if (!moved) return;
                    renderGallery();
                    await persistPhotoOrder();
                });

                card.addEventListener('dragend', () => {
                    draggedPhotoId = null;
                    card.classList.remove('dragging');
                    document.querySelectorAll('.photo-card.drag-over').forEach((item) => item.classList.remove('drag-over'));
                    setTimeout(() => { dragMoved = false; }, 0);
                });
            }

            card.addEventListener('click', () => {
                if (dragMoved) return;
                if (batchMode) {
                    if (selectedIds.has(photo.id)) {
                        selectedIds.delete(photo.id);
                        card.classList.remove('selected');
                    } else {
                        selectedIds.add(photo.id);
                        card.classList.add('selected');
                    }
                    updateBatchCount();
                } else {
                    openLightbox(visibleIndex);
                }
            });

            gallery.appendChild(card);
        });
    });

    if (galleryObserver) galleryObserver.disconnect();
    galleryObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                galleryObserver.unobserve(img);
            }
        });
    }, { rootMargin: '300px 0px' });

    document.querySelectorAll('img.lazy').forEach((img) => galleryObserver.observe(img));
}

async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        photos = await response.json();
        renderGallery();
    } catch (error) {
        console.error('加载图片失败:', error);
    }
}

async function loadPhotoDetails(photoId) {
    const response = await fetch(`/api/photos/${photoId}`);
    if (!response.ok) throw new Error('加载图片详情失败');
    return response.json();
}

function compressImage(file) {
    return new Promise((resolve) => {
        const maxSize = 2560;
        const quality = 0.92;
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width <= maxSize && height <= maxSize) {
                resolve(file);
                return;
            }
            if (width > height) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
            } else {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, file.type, quality);
        };
        img.src = url;
    });
}

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;

    const uploadBtn = document.getElementById('uploadBtn');
    const progressWrap = document.getElementById('uploadProgressWrap');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadProgressText');

    uploadBtn.style.pointerEvents = 'none';
    uploadBtn.style.opacity = '0.6';
    progressWrap.classList.add('visible');

    try {
        const formData = new FormData();
        formData.append('caption', captionInput.value.trim());
        formData.append('tags', tagsInput.value.trim());

        for (let i = 0; i < files.length; i += 1) {
            progressText.textContent = `压缩中 ${i + 1} / ${files.length}...`;
            progressBar.style.width = `${((i + 0.5) / files.length) * 50}%`;
            const compressed = await compressImage(files[i]);
            formData.append('photos', compressed, files[i].name);
        }

        progressText.textContent = '上传中...';
        progressBar.style.width = '60%';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const pct = 60 + (event.loaded / event.total) * 35;
                progressBar.style.width = `${pct}%`;
                progressText.textContent = `上传中 ${Math.round(event.loaded / 1024)}KB / ${Math.round(event.total / 1024)}KB`;
            }
        };

        await new Promise((resolve, reject) => {
            xhr.onload = () => xhr.status === 200 ? resolve() : reject(new Error('上传失败'));
            xhr.onerror = () => reject(new Error('网络错误'));
            xhr.send(formData);
        });

        progressBar.style.width = '100%';
        progressText.textContent = `上传成功 ${files.length} 张 ✓`;
        await loadPhotos();
        captionInput.value = '';
        tagsInput.value = '';
        setTimeout(() => {
            progressWrap.classList.remove('visible');
            progressBar.style.width = '0%';
        }, 1200);
    } catch (error) {
        console.error('上传失败:', error);
        progressText.textContent = '上传失败，请重试';
        progressBar.style.background = '#ff4757';
        setTimeout(() => {
            progressWrap.classList.remove('visible');
            progressBar.style.width = '0%';
            progressBar.style.background = '';
        }, 2000);
    } finally {
        uploadBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg> 上传图片`;
        uploadBtn.style.pointerEvents = 'auto';
        uploadBtn.style.opacity = '1';
        fileInput.value = '';
    }
});
function updateNavBtns() {
    document.getElementById('lightboxPrev').disabled = currentPhotoIndex <= 0;
    document.getElementById('lightboxNext').disabled = currentPhotoIndex >= visiblePhotos.length - 1;
}

function renderLightboxStory(photo) {
    const tags = (photo.tags || []).map((tag) => `<span class="story-tag">#${escapeHtml(tag)}</span>`).join('');
    photoStory.innerHTML = `
        <div class="story-date">${formatUploadDate(photo.uploadTime) || '刚刚上传'}</div>
        ${photo.caption ? `<div class="story-caption">${escapeHtml(photo.caption)}</div>` : '<div class="story-caption empty">这张照片还没有描述，上传下一组时可以顺手写一句小故事。</div>'}
        ${tags ? `<div class="story-tags">${tags}</div>` : ''}
    `;
}

async function openLightbox(index) {
    currentPhotoIndex = index;
    const photo = visiblePhotos[index];
    if (!photo) return;

    lightboxImg.src = photo.src;
    lightboxImg.style.filter = '';
    currentFilter = 'none';
    currentEdit = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
    resetEditSliders();
    resetFilterBtns();
    renderLightboxStory(photo);

    document.getElementById('filterBar').classList.remove('visible');
    document.getElementById('editBar').classList.remove('visible');
    document.getElementById('editToggleBtn').classList.remove('active');
    document.getElementById('editToggleBtn').textContent = '✏️ 编辑图片';

    commentsList.innerHTML = '<p style="color: #999; text-align: center;">评论加载中...</p>';
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';

    updateNavBtns();
    updateReactionUI(photo.reactions || {});

    try {
        const details = await loadPhotoDetails(photo.id);
        const merged = {
            likes: details.likes || 0,
            comments: details.comments || [],
            commentsCount: details.comments?.length || 0,
            reactions: details.reactions || {},
            caption: details.caption || '',
            tags: normalizeTags(details.tags)
        };
        updatePhotoInStore(photo.id, merged);
        const latestPhoto = visiblePhotos[currentPhotoIndex];
        updateReactionUI(latestPhoto.reactions || {});
        renderComments(latestPhoto.comments || []);
        renderLightboxStory(latestPhoto);
        renderGallery();
    } catch (error) {
        commentsList.innerHTML = '<p style="color: #ff4757; text-align: center;">评论加载失败，请重试</p>';
        console.error('加载详情失败:', error);
    }
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentPhotoIndex = null;
    commentInput.value = '';
    authorInput.value = '';
}

document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;
        applyImageStyle();
        document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');
    });
});

function resetFilterBtns() {
    document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="none"]').classList.add('active');
}

const sliders = [
    { id: 'editBrightness', valId: 'brightnessVal', key: 'brightness', unit: '%' },
    { id: 'editContrast', valId: 'contrastVal', key: 'contrast', unit: '%' },
    { id: 'editSaturate', valId: 'saturateVal', key: 'saturate', unit: '%' },
    { id: 'editBlur', valId: 'blurVal', key: 'blur', unit: 'px' }
];

sliders.forEach(({ id, valId, key, unit }) => {
    const input = document.getElementById(id);
    const valSpan = document.getElementById(valId);
    input.addEventListener('input', () => {
        currentEdit[key] = Number(input.value);
        valSpan.textContent = input.value + unit;
        applyImageStyle();
    });
});

function applyImageStyle() {
    const { brightness, contrast, saturate, blur } = currentEdit;
    const editFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) blur(${blur}px)`;
    const combined = currentFilter === 'none' ? editFilter : `${currentFilter} ${editFilter}`;
    lightboxImg.style.filter = combined;
}

function resetEditSliders() {
    sliders.forEach(({ id, valId, key, unit }) => {
        const defaults = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
        document.getElementById(id).value = defaults[key];
        document.getElementById(valId).textContent = defaults[key] + unit;
    });
}

document.getElementById('resetEditBtn').addEventListener('click', () => {
    currentEdit = { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
    currentFilter = 'none';
    resetEditSliders();
    resetFilterBtns();
    lightboxImg.style.filter = '';
});

document.getElementById('saveEditBtn').addEventListener('click', () => {
    const img = lightboxImg;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.filter = lightboxImg.style.filter || 'none';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `edited_${Date.now()}.jpg`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, 'image/jpeg', 0.92);
});

const emojiToId = { '❤️': 'react-heart', '😂': 'react-laugh', '😮': 'react-wow', '😢': 'react-sad', '👍': 'react-like' };
const reactedKey = (photoId) => `reacted_${photoId}`;

function updateReactionUI(reactions) {
    const photo = getCurrentPhoto();
    if (!photo) return;
    const reacted = JSON.parse(localStorage.getItem(reactedKey(photo.id)) || 'null');

    Object.entries(emojiToId).forEach(([emoji, elId]) => {
        const element = document.getElementById(elId);
        if (element) element.textContent = reactions[emoji] || 0;
    });

    document.querySelectorAll('.reaction-btn').forEach((btn) => {
        btn.classList.toggle('reacted', btn.dataset.emoji === reacted);
    });
}

document.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
        const photo = getCurrentPhoto();
        if (!photo) return;

        const emoji = btn.dataset.emoji;
        const alreadyReacted = localStorage.getItem(reactedKey(photo.id));
        if (alreadyReacted === JSON.stringify(emoji)) return;

        try {
            const response = await fetch(`/api/photos/${photo.id}/react`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emoji })
            });

            if (response.ok) {
                const data = await response.json();
                updatePhotoInStore(photo.id, { reactions: data.reactions });
                localStorage.setItem(reactedKey(photo.id), JSON.stringify(emoji));
                updateReactionUI(data.reactions);
                renderGallery();
                btn.classList.add('pop');
                setTimeout(() => btn.classList.remove('pop'), 300);
            }
        } catch (error) {
            console.error('表情回应失败:', error);
        }
    });
});

function renderComments(comments) {
    commentsList.innerHTML = '';

    if (comments.length === 0) {
        commentsList.innerHTML = '<p style="color: #999; text-align: center;">还没有评论，快来抢沙发吧！</p>';
        return;
    }

    comments.forEach((comment) => {
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        const timeStr = new Date(comment.time).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const isOwn = comment.author === getNickname();

        commentItem.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.author)}</span>
                <span class="comment-time">${timeStr}</span>
            </div>
            <div class="comment-text">${escapeHtml(comment.text)}</div>
            ${isOwn ? `<button class="comment-delete" data-comment-id="${comment.id}">删除</button>` : ''}
        `;
        commentsList.appendChild(commentItem);
    });

    document.querySelectorAll('.comment-delete').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            await deleteComment(event.target.dataset.commentId);
        });
    });
}

async function submitComment() {
    const photo = getCurrentPhoto();
    if (!photo) return;

    const text = commentInput.value.trim();
    if (!text) {
        alert('请输入评论内容');
        return;
    }

    const author = getNickname() || authorInput.value.trim() || '匿名';

    try {
        const response = await fetch(`/api/photos/${photo.id}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, author })
        });

        if (response.ok) {
            const data = await response.json();
            const latest = getCurrentPhoto();
            const comments = [...(latest.comments || []), data.comment];
            updatePhotoInStore(photo.id, { comments, commentsCount: comments.length });
            renderComments(comments);
            renderGallery();
            commentInput.value = '';
            authorInput.value = '';
        }
    } catch (error) {
        console.error('评论失败:', error);
        alert('评论失败，请重试');
    }
}

async function deleteComment(commentId) {
    const photo = getCurrentPhoto();
    if (!photo) return;

    try {
        const response = await fetch(`/api/photos/${photo.id}/comment/${commentId}`, { method: 'DELETE' });
        if (response.ok) {
            const latest = getCurrentPhoto();
            const comments = (latest.comments || []).filter((comment) => comment.id !== commentId);
            updatePhotoInStore(photo.id, { comments, commentsCount: comments.length });
            renderComments(comments);
            renderGallery();
        }
    } catch (error) {
        console.error('删除评论失败:', error);
        alert('删除失败，请重试');
    }
}
const pwdModal = document.getElementById('pwdModal');
const pwdInput = document.getElementById('pwdInput');
const pwdError = document.getElementById('pwdError');

function closePwdModal() {
    pwdModal.classList.remove('open');
}

document.getElementById('pwdCancelBtn').addEventListener('click', closePwdModal);

pwdModal.addEventListener('click', (e) => {
    if (e.target === pwdModal) closePwdModal();
});

pwdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('pwdConfirmBtn').click();
    if (e.key === 'Escape') closePwdModal();
});

async function deletePhoto() {
    if (!getCurrentPhoto()) return;
    pwdInput.value = '';
    pwdError.textContent = '';
    document.getElementById('pwdModal')._batchMode = false;
    document.getElementById('pwdModal').classList.add('open');
    setTimeout(() => pwdInput.focus(), 100);
}

function updateBatchCount() {
    document.getElementById('batchCount').textContent = `已选 ${selectedIds.size} 张`;
    document.getElementById('batchDeleteBtn').disabled = selectedIds.size === 0;
}

function enterBatchMode() {
    batchMode = true;
    selectedIds.clear();
    document.getElementById('batchDeleteToggleBtn').classList.add('active');
    document.getElementById('batchBar').classList.add('visible');
    updateBatchCount();
    renderGallery();
}

function exitBatchMode() {
    batchMode = false;
    selectedIds.clear();
    document.getElementById('batchDeleteToggleBtn').classList.remove('active');
    document.getElementById('batchBar').classList.remove('visible');
    renderGallery();
}

document.getElementById('batchDeleteToggleBtn').addEventListener('click', () => {
    if (batchMode) exitBatchMode();
    else enterBatchMode();
});

document.getElementById('batchCancelBtn').addEventListener('click', exitBatchMode);

document.getElementById('batchSelectAllBtn').addEventListener('click', () => {
    const allSelected = selectedIds.size === visiblePhotos.length;
    if (allSelected) {
        selectedIds.clear();
    } else {
        visiblePhotos.forEach((photo) => selectedIds.add(photo.id));
    }
    updateBatchCount();
    renderGallery();
});

document.getElementById('batchDeleteBtn').addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    pwdInput.value = '';
    pwdError.textContent = '';
    document.getElementById('pwdModal').classList.add('open');
    setTimeout(() => pwdInput.focus(), 100);
    document.getElementById('pwdModal')._batchMode = true;
});

searchInput.addEventListener('input', () => {
    searchKeyword = searchInput.value.trim();
    renderGallery();
});

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchKeyword = '';
    renderGallery();
});

groupToggleBtn.addEventListener('click', () => {
    const nextMode = { none: 'month', month: 'tag', tag: 'none' };
    groupMode = nextMode[groupMode];
    renderGallery();
});

closeBtn.addEventListener('click', closeLightbox);
deleteBtn.addEventListener('click', deletePhoto);
submitCommentBtn.addEventListener('click', submitComment);

document.getElementById('lightboxPrev').addEventListener('click', () => {
    if (currentPhotoIndex > 0) openLightbox(currentPhotoIndex - 1);
});

document.getElementById('lightboxNext').addEventListener('click', () => {
    if (currentPhotoIndex < visiblePhotos.length - 1) openLightbox(currentPhotoIndex + 1);
});

document.getElementById('pwdConfirmBtn').addEventListener('click', async () => {
    const password = document.getElementById('pwdInput').value;
    const modal = document.getElementById('pwdModal');

    if (!password) {
        pwdError.textContent = '请输入密码';
        return;
    }

    if (modal._batchMode) {
        const ids = [...selectedIds];
        let failed = 0;
        for (const id of ids) {
            try {
                const res = await fetch(`/api/photos/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                if (!res.ok) {
                    const data = await res.json();
                    if (data.error === '密码错误') {
                        pwdError.textContent = '密码错误';
                        document.getElementById('pwdInput').value = '';
                        document.getElementById('pwdInput').focus();
                        return;
                    }
                    failed += 1;
                }
            } catch {
                failed += 1;
            }
        }

        modal._batchMode = false;
        document.getElementById('pwdModal').classList.remove('open');
        exitBatchMode();
        await loadPhotos();
        if (failed > 0) alert(`${failed} 张删除失败`);
        return;
    }

    const photo = getCurrentPhoto();
    if (!photo) {
        document.getElementById('pwdModal').classList.remove('open');
        return;
    }

    try {
        const response = await fetch(`/api/photos/${photo.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (response.ok) {
            document.getElementById('pwdModal').classList.remove('open');
            await loadPhotos();
            closeLightbox();
        } else {
            const data = await response.json();
            pwdError.textContent = data.error || '密码错误';
            document.getElementById('pwdInput').value = '';
            document.getElementById('pwdInput').focus();
        }
    } catch (error) {
        console.error('删除失败:', error);
        pwdError.textContent = '网络错误，请重试';
    }
});

document.getElementById('editToggleBtn').addEventListener('click', () => {
    const filterBar = document.getElementById('filterBar');
    const editBar = document.getElementById('editBar');
    const btn = document.getElementById('editToggleBtn');
    const isOpen = filterBar.classList.contains('visible');
    filterBar.classList.toggle('visible', !isOpen);
    editBar.classList.toggle('visible', !isOpen);
    btn.classList.toggle('active', !isOpen);
    btn.textContent = isOpen ? '✏️ 编辑图片' : '✖ 关闭编辑';
});

commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) submitComment();
});

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'Delete') deletePhoto();
        else if (e.key === 'ArrowLeft' && currentPhotoIndex > 0) openLightbox(currentPhotoIndex - 1);
        else if (e.key === 'ArrowRight' && currentPhotoIndex < visiblePhotos.length - 1) openLightbox(currentPhotoIndex + 1);
    }
});

const subtitles = [
    '把散落在日子里的笑脸，留在同一本家庭相册里',
    '今天上传的每一张，都会成为以后最想重看的那一张',
    '给照片配上一句描述，回忆会比画面更完整',
    '试试标签和分组，让旅行、生日、团聚都更好找'
];
let subtitleIdx = 0;
const subtitleEl = document.getElementById('dynamicSubtitle');
setInterval(() => {
    subtitleEl.style.opacity = '0';
    setTimeout(() => {
        subtitleIdx = (subtitleIdx + 1) % subtitles.length;
        subtitleEl.textContent = subtitles[subtitleIdx];
        subtitleEl.style.opacity = '1';
    }, 400);
}, 3500);

initTheme();
initNickname();
loadPhotos();


