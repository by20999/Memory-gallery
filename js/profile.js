import { dom } from './dom.js';

const NICKNAME_KEY = 'album_nickname';
const AVATAR_KEY = 'album_avatar_image';
const AVATAR_SIZE = 160;

export function getNickname() {
    return localStorage.getItem(NICKNAME_KEY) || '';
}

function setNickname(name) {
    localStorage.setItem(NICKNAME_KEY, name);
}

function getAvatarImage() {
    return localStorage.getItem(AVATAR_KEY) || '';
}

function setAvatarImage(dataUrl) {
    if (dataUrl) localStorage.setItem(AVATAR_KEY, dataUrl);
    else localStorage.removeItem(AVATAR_KEY);
}

function getAvatarChar(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

function renderAvatarElement(element, name, imageUrl) {
    if (!element) return;
    element.textContent = imageUrl ? '' : getAvatarChar(name);
    element.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : '';
    element.classList.toggle('has-image', Boolean(imageUrl));
}

function updateUserBadge(name) {
    const avatarImage = getAvatarImage();
    renderAvatarElement(dom.userAvatar, name, avatarImage);
    renderAvatarElement(dom.avatarPreview, name, avatarImage);
    dom.userName.textContent = name;
}

function openNicknameModal(required = false) {
    dom.nicknameInput.value = getNickname();
    dom.nicknameError.textContent = '';
    updateUserBadge(getNickname());
    dom.nicknameModal.classList.add('open');
    dom.nicknameModal._required = required;
    setTimeout(() => dom.nicknameInput.focus(), 100);
}

function closeNicknameModal() {
    dom.nicknameModal.classList.remove('open');
}

function readAvatarFile(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('请选择图片文件'));
            return;
        }

        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_SIZE;
            canvas.height = AVATAR_SIZE;
            const context = canvas.getContext('2d');
            const sourceSize = Math.min(image.width, image.height);
            const sourceX = (image.width - sourceSize) / 2;
            const sourceY = (image.height - sourceSize) / 2;
            context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
            resolve(canvas.toDataURL('image/jpeg', 0.84));
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('头像读取失败，请换一张图片'));
        };
        image.src = url;
    });
}

export function initNickname() {
    const refreshPreviewFromInput = () => {
        renderAvatarElement(dom.avatarPreview, dom.nicknameInput.value.trim() || getNickname(), getAvatarImage());
    };

    dom.nicknameConfirmBtn.addEventListener('click', () => {
        const name = dom.nicknameInput.value.trim();
        if (name.length < 2) {
            dom.nicknameError.textContent = '昵称至少2个字';
            return;
        }
        setNickname(name);
        updateUserBadge(name);
        closeNicknameModal();
    });

    dom.nicknameInput.addEventListener('input', refreshPreviewFromInput);

    dom.nicknameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') dom.nicknameConfirmBtn.click();
    });

    dom.avatarPreviewBtn?.addEventListener('click', () => dom.avatarInput?.click());

    dom.avatarInput?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await readAvatarFile(file);
            setAvatarImage(dataUrl);
            updateUserBadge(dom.nicknameInput.value.trim() || getNickname());
            dom.nicknameError.textContent = '';
        } catch (error) {
            dom.nicknameError.textContent = error.message || '头像设置失败';
        } finally {
            dom.avatarInput.value = '';
        }
    });

    dom.avatarRemoveBtn?.addEventListener('click', () => {
        setAvatarImage('');
        updateUserBadge(dom.nicknameInput.value.trim() || getNickname());
    });

    dom.nicknameModal.addEventListener('click', (event) => {
        if (event.target === dom.nicknameModal && !dom.nicknameModal._required) {
            closeNicknameModal();
        }
    });

    dom.userAvatar.addEventListener('click', () => openNicknameModal(false));
    dom.userEditBtn.addEventListener('click', () => openNicknameModal(false));

    const nickname = getNickname();
    if (!nickname) {
        openNicknameModal(true);
    } else {
        updateUserBadge(nickname);
    }
}
