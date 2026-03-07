let photos = [];
let currentPhotoIndex = null;

const fileInput = document.getElementById('fileInput');
const gallery = document.getElementById('gallery');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const closeBtn = document.querySelector('.close');
const deleteBtn = document.getElementById('deleteBtn');

// 从服务器加载图片
async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        photos = await response.json();
        renderGallery();
    } catch (error) {
        console.error('加载图片失败:', error);
    }
}

// 文件选择处理 - 上传到服务器
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            formData.append('photos', file);
        }
    });

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            await loadPhotos(); // 重新加载所有图片
        } else {
            alert('上传失败，请重试');
        }
    } catch (error) {
        console.error('上传失败:', error);
        alert('上传失败，请检查网络连接');
    }

    fileInput.value = '';
});

// 渲染相册
function renderGallery() {
    gallery.innerHTML = '';

    photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.style.animationDelay = `${index * 0.1}s`;

        const img = document.createElement('img');
        img.src = photo.src;
        img.alt = photo.name;

        card.appendChild(img);
        card.addEventListener('click', () => openLightbox(index));

        gallery.appendChild(card);
    });
}

// 打开灯箱
function openLightbox(index) {
    currentPhotoIndex = index;
    lightboxImg.src = photos[index].src;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 关闭灯箱
function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto';
    currentPhotoIndex = null;
}

// 删除图片 - 从服务器删除
async function deletePhoto() {
    if (currentPhotoIndex !== null) {
        const photo = photos[currentPhotoIndex];

        try {
            const response = await fetch(`/api/photos/${photo.id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await loadPhotos(); // 重新加载图片列表
                closeLightbox();
            } else {
                alert('删除失败，请重试');
            }
        } catch (error) {
            console.error('删除失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }
}

// 事件监听
closeBtn.addEventListener('click', closeLightbox);
deleteBtn.addEventListener('click', deletePhoto);

lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        closeLightbox();
    }
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (lightbox.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'Delete') {
            deletePhoto();
        } else if (e.key === 'ArrowLeft' && currentPhotoIndex > 0) {
            openLightbox(currentPhotoIndex - 1);
        } else if (e.key === 'ArrowRight' && currentPhotoIndex < photos.length - 1) {
            openLightbox(currentPhotoIndex + 1);
        }
    }
});

// 页面加载时加载图片
loadPhotos();
