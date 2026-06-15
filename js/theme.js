import { dom } from './dom.js';

const THEME_KEY = 'album_theme';
const GRADIENT_KEY = 'album_gradient';
const THEME_MODE_KEY = 'album_theme_mode';
const THEME_PACKAGE_KEY = 'album_theme_package';

const THEME_PACKAGES = {
    cream: {
        label: '奶油相册',
        copy: '柔软的奶油色适合收纳亲友、散步、咖啡和那些被阳光照到的瞬间。',
        gradient: 'linear-gradient(135deg, #fff8ee 0%, #ffe7d1 52%, #f7d7c2 100%)',
        accent: '#d47c5d',
        accentHover: '#bf6948',
        cardBg: 'rgba(255, 251, 245, 0.62)',
        chipBg: 'rgba(255, 242, 229, 0.92)',
        bodyGlow: 'radial-gradient(circle, rgba(255, 236, 214, 0.86) 0%, rgba(255, 236, 214, 0.08) 62%, rgba(255, 236, 214, 0) 72%)',
        shell: {
            brandTitle: '奶油片段',
            brandSubtitle: '把温柔日常慢慢装订',
            storageKicker: 'CREAM MEMORIES 2026',
            storageTitle: '奶杏柔光存档',
            storageDescription: '亲友、散步和午后光线，会在这里留下柔软的温度。'
        }
    },
    film: {
        label: '胶片相册',
        copy: '胶片色会让旅行、街灯、聚会和晚风多一点旧时光的颗粒感。',
        gradient: 'linear-gradient(145deg, #5d5047 0%, #9a7a5c 42%, #d6be9d 100%)',
        accent: '#5a3f2c',
        accentHover: '#4b3425',
        cardBg: 'rgba(255, 244, 223, 0.54)',
        chipBg: 'rgba(92, 63, 43, 0.14)',
        bodyGlow: 'radial-gradient(circle, rgba(255, 217, 163, 0.55) 0%, rgba(255, 217, 163, 0.08) 60%, rgba(255, 217, 163, 0) 72%)',
        shell: {
            brandTitle: '胶片巡游',
            brandSubtitle: '把故事留在颗粒与暗角里',
            storageKicker: 'FILM MEMORIES 2026',
            storageTitle: '旧时光底片夹',
            storageDescription: '街灯、旅途和晚风，会在这里慢慢显影成更有故事感的回忆。'
        }
    },
    summer: {
        label: '夏日相册',
        copy: '蓝色海风吹过的片段，会在这里慢慢变成自己的夏日档案。',
        gradient: 'linear-gradient(135deg, #fef7d7 0%, #c9f2ee 42%, #8fd5ff 100%)',
        accent: '#0f9fb7',
        accentHover: '#0b8398',
        cardBg: 'rgba(244, 255, 252, 0.56)',
        chipBg: 'rgba(228, 252, 247, 0.88)',
        bodyGlow: 'radial-gradient(circle, rgba(183, 244, 237, 0.72) 0%, rgba(183, 244, 237, 0.08) 62%, rgba(183, 244, 237, 0) 72%)',
        shell: {
            brandTitle: '夏日吹奏',
            brandSubtitle: '记录美好时光',
            storageKicker: 'SUMMER MEMORIES 2026',
            storageTitle: '蓝色海风存档',
            storageDescription: '照片、故事和收藏都在这里慢慢发光。'
        }
    }
};

function updateThemeIcon(theme) {
    dom.themeIcon.innerHTML = theme === 'dark'
        ? '<svg class="theme-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20M6.3 6.3l1.6 1.6M16.1 16.1l1.6 1.6M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6"/><circle cx="12" cy="12" r="3.8"/></svg>'
        : '<svg class="theme-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M20 15.3A7.4 7.4 0 0 1 8.7 4 8.4 8.4 0 1 0 20 15.3z"/></svg>';
    dom.themeToggleBtn.dataset.mode = theme;
    dom.themeToggleBtn.title = theme === 'dark' ? '切换到白天模式' : '切换到夜晚模式';
    dom.themeToggleBtn.setAttribute('aria-label', dom.themeToggleBtn.title);
}

function getFestivalContext() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    if (month === 1 && day <= 7) return { name: '新年团聚', badge: '新年推荐', copy: '新的一年，把第一份笑容继续收藏下来。', packageKey: 'cream' };
    if (month === 2 && day >= 10 && day <= 18) return { name: '元宵团圆', badge: '元宵推荐', copy: '灯火亮起的时候，最适合把热闹留在同一本相册里。', packageKey: 'cream' };
    if (month >= 3 && month <= 5) return { name: '春日漫游', badge: '春日推荐', copy: '把野餐、散步和花开的日子，慢慢装订成春天的回忆。', packageKey: 'cream' };
    if (month >= 6 && month <= 8) return { name: '夏日欢聚', badge: '夏日推荐', copy: '阳光、海风和西瓜的季节，最适合用清爽的色调收纳回忆。', packageKey: 'summer' };
    if (month === 10 && day >= 1 && day <= 7) return { name: '假日出游', badge: '国庆推荐', copy: '假期的旅途和团聚，都值得在归来后继续被翻看很多次。', packageKey: 'film' };
    if (month >= 9 && month <= 11) return { name: '秋日故事', badge: '秋日推荐', copy: '收获和团聚的季节，用带一点胶片感的暖色更有故事味道。', packageKey: 'film' };
    return { name: '冬日收藏', badge: '冬日推荐', copy: '围坐在一起的时刻，总值得被留在一个温暖的角落里。', packageKey: 'film' };
}

function clearPackageStyles() {
    const root = document.documentElement;
    ['--bg-gradient', '--accent', '--accent-hover', '--card-bg', '--theme-chip-bg', '--theme-body-glow'].forEach((key) => root.style.removeProperty(key));
    root.removeAttribute('data-theme-package');
}

function syncThemePackageButtons(activeKey, mode) {
    dom.themePackageBtns.forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.package === activeKey && mode === 'manual');
    });
    dom.autoThemeBtn.classList.toggle('active', mode === 'auto');
}

function syncActivePreset(gradient) {
    dom.themePresets.forEach((preset) => {
        preset.classList.toggle('active', preset.dataset.gradient === gradient);
    });
}

function notifyThemeTextChanged() {
    window.dispatchEvent(new CustomEvent('album-theme-text-change'));
}

function updateHeaderCopyForPackage(packageKey, fallbackCopy = '') {
    const themePackage = THEME_PACKAGES[packageKey];
    dom.headerKicker.textContent = '';
    dom.headerDescription.textContent = themePackage?.copy || fallbackCopy || '换一种背景，就像给同一段回忆换上一层新的光。';
    notifyThemeTextChanged();
}

function updateShellCopy(packageKey) {
    const themePackage = THEME_PACKAGES[packageKey];
    const shellCopy = themePackage?.shell || {
        brandTitle: '自定义主题',
        brandSubtitle: '把相册调成你喜欢的样子',
        storageKicker: 'CUSTOM MEMORIES',
        storageTitle: '专属色调存档',
        storageDescription: '这一页的光线和氛围已经跟着你的配色一起变了。'
    };

    if (dom.sidebarBrandTitle) dom.sidebarBrandTitle.textContent = shellCopy.brandTitle;
    if (dom.sidebarBrandSubtitle) dom.sidebarBrandSubtitle.textContent = shellCopy.brandSubtitle;
    if (dom.sidebarStorageKicker) dom.sidebarStorageKicker.textContent = shellCopy.storageKicker;
    if (dom.sidebarStorageTitle) dom.sidebarStorageTitle.textContent = shellCopy.storageTitle;
    if (dom.sidebarStorageDescription) dom.sidebarStorageDescription.textContent = shellCopy.storageDescription;
}

function applyGradient(gradient, persist = true) {
    clearPackageStyles();
    document.documentElement.style.setProperty('--bg-gradient', gradient);
    document.documentElement.setAttribute('data-theme-package', 'custom');
    updateHeaderCopyForPackage('custom', '当前主题由你亲手调色，这本相册也会跟着长出独一份的气质。');
    updateShellCopy('custom');
    if (persist) {
        localStorage.setItem(GRADIENT_KEY, gradient);
        localStorage.setItem(THEME_MODE_KEY, 'manual');
        localStorage.setItem(THEME_PACKAGE_KEY, 'custom');
    }
    syncActivePreset(gradient);
    syncThemePackageButtons('custom', 'manual');
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
    updateHeaderCopyForPackage(packageKey);
    updateShellCopy(packageKey);

    if (persist) {
        localStorage.setItem(THEME_MODE_KEY, mode);
        localStorage.setItem(THEME_PACKAGE_KEY, packageKey);
    }

    syncThemePackageButtons(packageKey, mode);
}

function refreshFestivalHeader() {
    const festival = getFestivalContext();
    const packageLabel = THEME_PACKAGES[festival.packageKey].label;
    dom.festivalBadge.textContent = festival.badge;
    dom.recommendThemeCopy.textContent = packageLabel;
    dom.recommendThemeBtn.title = `切换到${packageLabel}`;
    dom.recommendThemeBtn.dataset.package = festival.packageKey;
    dom.headerKicker.textContent = '';
    dom.headerDescription.textContent = festival.copy;
    notifyThemeTextChanged();
}

export function initTheme() {
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

    dom.themeToggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateThemeIcon(next);
    });

    dom.themePanelBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        dom.themeDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.theme-panel')) {
            dom.themeDropdown.classList.remove('open');
        }
    });

    dom.themePresets.forEach((preset) => {
        const gradient = preset.dataset.gradient;
        preset.style.background = gradient;
        preset.addEventListener('click', () => applyGradient(gradient));
    });

    dom.themePackageBtns.forEach((btn) => {
        btn.addEventListener('click', () => applyThemePackage(btn.dataset.package));
    });

    dom.autoThemeBtn.addEventListener('click', () => {
        const nextFestival = getFestivalContext();
        localStorage.setItem(THEME_MODE_KEY, 'auto');
        localStorage.removeItem(THEME_PACKAGE_KEY);
        applyThemePackage(nextFestival.packageKey, { persist: false, mode: 'auto' });
        syncThemePackageButtons(nextFestival.packageKey, 'auto');
    });

    dom.applyColorBtn.addEventListener('click', () => {
        applyGradient(`linear-gradient(135deg, ${dom.colorStart.value} 0%, ${dom.colorEnd.value} 100%)`);
    });

    dom.recommendThemeBtn.addEventListener('click', () => {
        applyThemePackage(dom.recommendThemeBtn.dataset.package);
    });
}
