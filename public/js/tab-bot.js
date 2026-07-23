/* ============================================================
   BOT TAB
   ============================================================ */
async function loadBotIdentity(){
    try {
        const bot = await api('/api/bot');
        const displayName = bot.nickname || bot.username;
        document.getElementById('botDisplayName').textContent = displayName;
        document.getElementById('botTag').textContent = `Headmaster Bot · in ${bot.guildName || 'this server'}`;
        document.getElementById('nicknameInput').value = bot.nickname || '';
        document.getElementById('nicknameInput').placeholder = bot.username;
        document.getElementById('statServerName').textContent = bot.guildName || '—';
        document.getElementById('statServerMembers').textContent = bot.memberCount ?? '—';

        const avatarUrl = bot.guildAvatarUrl || bot.globalAvatarUrl;
        if (avatarUrl) {
            document.getElementById('botAvatarWrap').innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" alt="">`;
            document.getElementById('topbarBotAvatarWrap').innerHTML = `<img src="${avatarUrl}" alt="">`;
        }
        const bannerUrl = bot.guildBannerUrl || bot.globalBannerUrl;
        if (bannerUrl) {
            const wrap = document.getElementById('botBannerWrap');
            wrap.style.backgroundImage = `url(${bannerUrl})`;
            wrap.style.backgroundSize = 'cover';
            wrap.style.backgroundPosition = 'center';
        }

        document.getElementById('topbarBotName').textContent = displayName;
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadBotIdentity failed', err);
    }
}

function wireBotIdentityButtons(){
    document.getElementById('editAvatarBtn').onclick = () => document.getElementById('avatarFileInput').click();
    document.getElementById('changeAvatarBtn').onclick = () => document.getElementById('avatarFileInput').click();
    document.getElementById('editBannerBtn').onclick = () => document.getElementById('bannerFileInput').click();
    document.getElementById('changeBannerBtn').onclick = () => document.getElementById('bannerFileInput').click();

    // --- Cropper temporarily disabled: uploads go straight through. ---
    // To re-enable, comment the block below back out and uncomment the
    // openCropper(...) block above it.
    document.getElementById('avatarFileInput').onchange = (e) => uploadIdentityImage('avatar', e.target.files[0]);
    document.getElementById('bannerFileInput').onchange = (e) => uploadIdentityImage('banner', e.target.files[0]);
    /*
    document.getElementById('avatarFileInput').onchange = (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (file) openCropper('avatar', file);
    };
    document.getElementById('bannerFileInput').onchange = (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (file) openCropper('banner', file);
    };
    */

    document.getElementById('resetAvatarBtn').onclick = () => confirmResetIdentityImage('avatar');
    document.getElementById('resetBannerBtn').onclick = () => confirmResetIdentityImage('banner');
}

/* ============================================================
   IMAGE CROPPER (avatar 1:1 / banner 5:2, matching Discord's own
   upload ratios) — pans via pointer drag, zooms via wheel, pinch,
   or the slider, then exports the visible crop to a canvas.
   ============================================================ */
const CROP_RATIOS = {
    avatar: { cls: 'ratio-avatar', outW: 512, outH: 512, hint: "Discord avatars are square and shown as a circle — drag to reposition, pinch or scroll to zoom." },
    banner: { cls: 'ratio-banner', outW: 1200, outH: 480, hint: "Discord banners crop to a 5:2 strip — this is exactly what will show." },
};

let CROP_STATE = null;
let cropDrag = null;
let cropPinch = null;
const cropPointers = new Map();

function openCropper(kind, file) {
    const ratio = CROP_RATIOS[kind];
    const url = URL.createObjectURL(file);
    const img = document.getElementById('cropImage');
    const viewport = document.getElementById('cropViewport');

    viewport.className = 'crop-viewport ' + ratio.cls;
    document.getElementById('cropModalTitle').textContent = kind === 'avatar' ? 'Crop Avatar' : 'Crop Banner';
    document.getElementById('cropModalHint').textContent = ratio.hint;
    document.getElementById('cropOverlay').classList.add('show');

    img.onload = () => {
        const rect = viewport.getBoundingClientRect();
        const minScale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
        CROP_STATE = {
            kind, file, url, ratio,
            natW: img.naturalWidth, natH: img.naturalHeight,
            viewportW: rect.width, viewportH: rect.height,
            scale: minScale, minScale, maxScale: minScale * 4,
            tx: (rect.width - img.naturalWidth * minScale) / 2,
            ty: (rect.height - img.naturalHeight * minScale) / 2,
        };
        cropClamp();
        cropApplyTransform();

        const slider = document.getElementById('cropZoomSlider');
        slider.min = String(minScale);
        slider.max = String(CROP_STATE.maxScale);
        slider.step = String((CROP_STATE.maxScale - minScale) / 100 || 0.001);
        slider.value = String(minScale);
    };
    img.src = url;
}

function closeCropper() {
    if (CROP_STATE) URL.revokeObjectURL(CROP_STATE.url);
    CROP_STATE = null;
    cropDrag = null;
    cropPinch = null;
    cropPointers.clear();
    document.getElementById('cropOverlay').classList.remove('show');
}

function cropClamp() {
    const st = CROP_STATE;
    const dispW = st.natW * st.scale, dispH = st.natH * st.scale;
    const minTx = Math.min(0, st.viewportW - dispW);
    const minTy = Math.min(0, st.viewportH - dispH);
    st.tx = Math.min(0, Math.max(minTx, st.tx));
    st.ty = Math.min(0, Math.max(minTy, st.ty));
}

function cropApplyTransform() {
    document.getElementById('cropImage').style.transform = `translate(${CROP_STATE.tx}px, ${CROP_STATE.ty}px) scale(${CROP_STATE.scale})`;
}

function cropSetScale(newScale, focalX, focalY) {
    const st = CROP_STATE;
    newScale = Math.min(st.maxScale, Math.max(st.minScale, newScale));
    const imgX = (focalX - st.tx) / st.scale;
    const imgY = (focalY - st.ty) / st.scale;
    st.scale = newScale;
    st.tx = focalX - imgX * newScale;
    st.ty = focalY - imgY * newScale;
    cropClamp();
    cropApplyTransform();
    document.getElementById('cropZoomSlider').value = String(newScale);
}

function cropConfirm() {
    const st = CROP_STATE;
    if (!st) return;
    const canvas = document.createElement('canvas');
    canvas.width = st.ratio.outW;
    canvas.height = st.ratio.outH;
    const ctx = canvas.getContext('2d');
    const sx = (0 - st.tx) / st.scale;
    const sy = (0 - st.ty) / st.scale;
    const sW = st.viewportW / st.scale;
    const sH = st.viewportH / st.scale;
    ctx.drawImage(document.getElementById('cropImage'), sx, sy, sW, sH, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
        if (!blob) {
            showToast('Could not process that image', 'error');
            return;
        }
        const cropped = new File([blob], `${st.kind}.png`, { type: 'image/png' });
        const kind = st.kind;
        closeCropper();
        uploadIdentityImage(kind, cropped);
    }, 'image/png', 0.95);
}

function cropDist(p1, p2) { return Math.hypot(p1.x - p2.x, p1.y - p2.y); }
function cropMid(p1, p2) { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }

function wireCropper() {
    const viewport = document.getElementById('cropViewport');

    document.getElementById('cropCancelBtn').onclick = closeCropper;
    document.getElementById('cropConfirmBtn').onclick = cropConfirm;
    document.getElementById('cropOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'cropOverlay') closeCropper();
    });

    document.getElementById('cropZoomSlider').oninput = (e) => {
        if (!CROP_STATE) return;
        cropSetScale(parseFloat(e.target.value), CROP_STATE.viewportW / 2, CROP_STATE.viewportH / 2);
    };

    viewport.addEventListener('wheel', (e) => {
        if (!CROP_STATE) return;
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * 0.001);
        cropSetScale(CROP_STATE.scale * factor, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    viewport.addEventListener('pointerdown', (e) => {
        if (!CROP_STATE) return;
        viewport.setPointerCapture(e.pointerId);
        const rect = viewport.getBoundingClientRect();
        cropPointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (cropPointers.size === 1) {
            const p = [...cropPointers.values()][0];
            cropDrag = { startX: p.x, startY: p.y, tx0: CROP_STATE.tx, ty0: CROP_STATE.ty };
            cropPinch = null;
        } else if (cropPointers.size === 2) {
            const [p1, p2] = [...cropPointers.values()];
            const mid = cropMid(p1, p2);
            cropPinch = {
                dist: cropDist(p1, p2), scale0: CROP_STATE.scale, mid,
                imgX: (mid.x - CROP_STATE.tx) / CROP_STATE.scale,
                imgY: (mid.y - CROP_STATE.ty) / CROP_STATE.scale,
            };
            cropDrag = null;
        }
    });

    viewport.addEventListener('pointermove', (e) => {
        if (!CROP_STATE || !cropPointers.has(e.pointerId)) return;
        const rect = viewport.getBoundingClientRect();
        cropPointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });

        if (cropPointers.size === 1 && cropDrag) {
            const p = [...cropPointers.values()][0];
            CROP_STATE.tx = cropDrag.tx0 + (p.x - cropDrag.startX);
            CROP_STATE.ty = cropDrag.ty0 + (p.y - cropDrag.startY);
            cropClamp();
            cropApplyTransform();
        } else if (cropPointers.size === 2 && cropPinch) {
            const [p1, p2] = [...cropPointers.values()];
            const newScale = Math.min(CROP_STATE.maxScale, Math.max(CROP_STATE.minScale,
                cropPinch.scale0 * (cropDist(p1, p2) / cropPinch.dist)));
            CROP_STATE.scale = newScale;
            CROP_STATE.tx = cropPinch.mid.x - cropPinch.imgX * newScale;
            CROP_STATE.ty = cropPinch.mid.y - cropPinch.imgY * newScale;
            cropClamp();
            cropApplyTransform();
            document.getElementById('cropZoomSlider').value = String(newScale);
        }
    });

    function endPointer(e) {
        cropPointers.delete(e.pointerId);
        if (!CROP_STATE) return;
        if (cropPointers.size === 1) {
            const p = [...cropPointers.values()][0];
            cropDrag = { startX: p.x, startY: p.y, tx0: CROP_STATE.tx, ty0: CROP_STATE.ty };
            cropPinch = null;
        } else {
            cropDrag = null;
            cropPinch = null;
        }
    }
    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
    viewport.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') endPointer(e); });
}

async function uploadIdentityImage(kind, file){
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
        showToast(`Uploading ${kind}…`);
        await api(`/api/bot/${kind}`, { method:'POST', body: form });
        showToast(`${cap(kind)} updated`, 'success');
        loadBotIdentity();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

