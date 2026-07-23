/* ============================================================
   WELCOME MESSAGE BUILDER
   ============================================================ */
const WE_MACROS = [
    { token: '{user}', desc: 'Pings/mentions the new member' },
    { token: '{username}', desc: "The new member's display name (no ping)" },
    { token: '{usertag}', desc: "The new member's full Discord username" },
    { token: '{membercount}', desc: 'Total member count for the server' },
    { token: '{servername}', desc: "The server's name" },
    { token: '{time}', desc: 'Current time' },
    { token: '{date}', desc: 'Current date' },
    { token: '{joindate}', desc: 'Date the member joined' },
];

let WELCOME_MESSAGES = [];
let EMOJIS = [];
let weEditingId = null;
let weActiveField = null;
let wePickerMode = null; // 'channel' | 'role' | 'emoji' | 'macro'

function weSetActiveField(el){ weActiveField = el; }

/* Grows #weDescription to fit its content instead of scrolling inside a
   fixed box — reset to 'auto' first so it can shrink back down too. */
function weAutoGrow(el){
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

function weInsertAtCursor(text){
    const field = weActiveField || document.getElementById('weOutsideMessage');
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    field.value = field.value.slice(0, start) + text + field.value.slice(end);
    field.focus();
    const cursor = start + text.length;
    field.setSelectionRange(cursor, cursor);
    weAutoGrow(field);
    weUpdatePreview();
}

/* ============================================================
   MACRO AUTOCOMPLETE — type "{" in a message field and get an
   IDE-style suggestion list of matching macros, narrowing as you
   keep typing, with arrow-key navigation and Enter/Tab to accept.
   ============================================================ */
let weAcState = { field: null, braceStart: -1, matches: [], activeIndex: 0 };

function weAutocompleteInit(){
    ['weOutsideMessage', 'weDescription'].forEach(id => {
        const field = document.getElementById(id);
        if (!field) return;
        field.addEventListener('input', () => weAutocompleteCheck(field));
        field.addEventListener('keydown', (e) => weAutocompleteKeydown(e, field));
        field.addEventListener('click', () => weAutocompleteCheck(field));
        // delayed so a mousedown on a suggestion row (see weAutocompleteRender)
        // still lands before we tear the dropdown down
        field.addEventListener('blur', () => setTimeout(weAutocompleteClose, 150));
    });
    window.addEventListener('resize', weAutocompleteClose);
    window.visualViewport?.addEventListener('resize', weAutocompleteClose);
    document.addEventListener('scroll', weAutocompleteClose, true);
}

function weAutocompleteCheck(field){
    const pos = field.selectionStart;
    const textBefore = field.value.slice(0, pos);
    const braceIdx = textBefore.lastIndexOf('{');
    if (braceIdx === -1){ weAutocompleteClose(); return; }

    const fragment = textBefore.slice(braceIdx + 1);
    // bail once the brace is already closed, or once what's been typed
    // couldn't be the start of any macro token (macros are plain letters)
    if (fragment.includes('}') || /[^a-z]/i.test(fragment)){ weAutocompleteClose(); return; }

    const query = fragment.toLowerCase();
    const matches = WE_MACROS.filter(m => m.token.slice(1, -1).toLowerCase().startsWith(query));
    if (!matches.length){ weAutocompleteClose(); return; }

    weAcState = { field, braceStart: braceIdx, matches, activeIndex: 0 };
    weAutocompleteRender();
}

function weAutocompleteRender(){
    const dropdown = document.getElementById('weAcDropdown');
    const { field, matches, activeIndex } = weAcState;
    const coords = weGetCaretCoords(field, field.selectionStart);

    dropdown.innerHTML = '';
    matches.forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'we-picker-row we-ac-row' + (i === activeIndex ? ' we-ac-active' : '');
        row.innerHTML = `<span class="we-picker-row-text"><span>${escapeHtml(m.token)}</span><span class="we-macro-desc">${escapeHtml(m.desc)}</span></span>`;
        // mousedown (not click) + preventDefault so the field never loses
        // focus/selection before we've read braceStart/selectionStart
        row.addEventListener('mousedown', (e) => { e.preventDefault(); weAutocompleteSelect(i); });
        dropdown.appendChild(row);
    });

    dropdown.classList.remove('login-hidden');
    const estHeight = Math.min(matches.length, 6) * 42 + 8;
    // window.innerHeight doesn't shrink when a mobile on-screen keyboard
    // opens, but the visible area actually does — using it here meant the
    // "does this fit below the caret" check thought there was room when
    // the keyboard was covering that space, so the dropdown rendered
    // behind the keyboard instead of flipping above the caret.
    // visualViewport reflects the real visible area and is what we want.
    const viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const viewportWidth = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
    let top = coords.top + coords.lineHeight + 4;
    if (top + estHeight > viewportHeight - 12) top = coords.top - estHeight - 4;
    const maxLeft = viewportWidth - 240;
    dropdown.style.top = Math.max(8, top) + 'px';
    dropdown.style.left = Math.min(Math.max(8, coords.left), maxLeft) + 'px';
}

function weAutocompleteKeydown(e, field){
    if (weAcState.field !== field || !weAcState.matches.length) return;
    if (e.key === 'ArrowDown'){
        e.preventDefault();
        weAcState.activeIndex = (weAcState.activeIndex + 1) % weAcState.matches.length;
        weAutocompleteRender();
    } else if (e.key === 'ArrowUp'){
        e.preventDefault();
        weAcState.activeIndex = (weAcState.activeIndex - 1 + weAcState.matches.length) % weAcState.matches.length;
        weAutocompleteRender();
    } else if (e.key === 'Enter' || e.key === 'Tab'){
        e.preventDefault();
        weAutocompleteSelect(weAcState.activeIndex);
    } else if (e.key === 'Escape'){
        weAutocompleteClose();
    }
}

function weAutocompleteSelect(index){
    const { field, braceStart, matches } = weAcState;
    const token = matches[index].token;
    const pos = field.selectionStart;
    field.value = field.value.slice(0, braceStart) + token + field.value.slice(pos);
    const cursor = braceStart + token.length;
    field.focus();
    field.setSelectionRange(cursor, cursor);
    weAutoGrow(field);
    weUpdatePreview();
    weAutocompleteClose();
}

function weAutocompleteClose(){
    weAcState = { field: null, braceStart: -1, matches: [], activeIndex: 0 };
    document.getElementById('weAcDropdown')?.classList.add('login-hidden');
}

/* Textareas don't expose the caret's pixel position natively, so this
   mirrors the field's text (up to the caret) into an identically-styled
   hidden div and measures where a marker span lands inside it. */
function weGetCaretCoords(field, position){
    const computed = getComputedStyle(field);
    const div = document.createElement('div');
    const style = div.style;

    style.position = 'absolute';
    style.visibility = 'hidden';
    style.whiteSpace = 'pre-wrap';
    style.wordWrap = 'break-word';
    style.top = '-9999px';
    style.left = '-9999px';

    ['boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
     'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight',
     'fontSize', 'fontFamily', 'lineHeight', 'letterSpacing', 'textIndent', 'textTransform']
        .forEach(prop => { style[prop] = computed[prop]; });

    document.body.appendChild(div);
    div.textContent = field.value.slice(0, position);
    const span = document.createElement('span');
    span.textContent = field.value.slice(position) || '.';
    div.appendChild(span);

    const fieldRect = field.getBoundingClientRect();
    const top = fieldRect.top + span.offsetTop - field.scrollTop;
    const left = fieldRect.left + span.offsetLeft - field.scrollLeft;
    const lineHeight = parseInt(computed.lineHeight, 10) || 18;

    document.body.removeChild(div);
    return { top, left, lineHeight };
}

const WE_PAGE_SIZE = 5;
let weListExpanded = false;

async function loadWelcomeMessages(){
    try {
        const data = await api('/api/welcome-messages');
        WELCOME_MESSAGES = data.messages || [];
        weListExpanded = false;
        renderWelcomeMessagesList();
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadWelcomeMessages failed', err);
    }
}

function weShowAll(){
    weListExpanded = true;
    renderWelcomeMessagesList();
}

function renderWelcomeMessagesList(){
    const list = document.getElementById('welcomeMessagesList');
    if (!list) return;

    if (!WELCOME_MESSAGES.length){
        list.innerHTML = '<p class="we-empty">No custom messages yet — using the built-in rotation.</p>';
        return;
    }

    const visible = weListExpanded ? WELCOME_MESSAGES : WELCOME_MESSAGES.slice(0, WE_PAGE_SIZE);
    const remaining = WELCOME_MESSAGES.length - visible.length;

    list.innerHTML = visible.map(m => {
        const title = m.embedTitle || m.outsideMessage || m.embedDescription || 'Untitled message';
        const sub = m.embedDescription || m.outsideMessage || '';
        return `
        <div class="we-item">
            <div class="we-item-body">
                <div class="we-item-title">${escapeHtml(title)}</div>
                ${sub ? `<div class="we-item-sub">${escapeHtml(sub)}</div>` : ''}
            </div>
            <div class="we-item-actions">
                <button class="btn btn-ghost btn-sm" onclick="openWelcomeEditor(${m.id})"><span data-icon="settings" data-size="12"></span></button>
                <button class="btn btn-danger btn-sm" onclick="weDelete(${m.id})"><span data-icon="closeCircle" data-size="12"></span></button>
            </div>
        </div>`;
    }).join('');

    if (remaining > 0){
        list.innerHTML += `<button class="btn btn-ghost btn-block we-viewall-btn" onclick="weShowAll()">View All (${WELCOME_MESSAGES.length})</button>`;
    }

    hydrateStaticIcons(list);
}

function openWelcomeEditor(id){
    weEditingId = id ?? null;
    // Loose match: ids round-trip through onclick="…(${m.id})" as numbers,
    // but API responses aren't guaranteed to already be numbers, so compare
    // as strings rather than risk a silent type-mismatch miss.
    const msg = id != null ? WELCOME_MESSAGES.find(m => String(m.id) === String(id)) : null;

    document.getElementById('weEditorTitle').textContent = msg ? 'Edit Welcome Message' : 'Add Welcome Message';
    document.getElementById('weOutsideMessage').value = msg?.outsideMessage || '';
    document.getElementById('weAuthorName').value = msg?.embedAuthorName || '';
    document.getElementById('weAuthorIcon').value = msg?.embedAuthorIconUrl || '';
    document.getElementById('weTitle').value = msg?.embedTitle || '';
    document.getElementById('weDescription').value = msg?.embedDescription || '';
    weAutoGrow(document.getElementById('weDescription'));
    weSetColor(msg?.embedColor || '#daa520');
    document.getElementById('weImageUrl').value = msg?.embedImageUrl || '';
    document.getElementById('weThumbUrl').value = msg?.embedThumbnailUrl || '';
    document.getElementById('weFooterText').value = msg?.embedFooterText || '';
    document.getElementById('weFooterIcon').value = msg?.embedFooterIconUrl || '';

    weActiveField = document.getElementById('weOutsideMessage');
    weUpdatePreview();

    document.getElementById('weEditorOverlay').classList.add('show');
}

function closeWelcomeEditor(){
    document.getElementById('weEditorOverlay').classList.remove('show');
}

/* ---- Drag the handle down to dismiss a bottom sheet on mobile ----
   Shared by the welcome editor and the channel/role/emoji/macro picker
   (both use the same .sheet-card/.we-sheet-handle markup). */
function initSheetDrag(overlayId, cardSelector, closeFn){
    const overlay = document.getElementById(overlayId);
    const handle = overlay?.querySelector('.we-sheet-handle');
    const card = overlay?.querySelector(cardSelector);
    if (!overlay || !handle || !card) return;

    let dragging = false, startY = 0, currentY = 0, cardHeight = 0;
    const isMobileSheet = () => window.matchMedia('(max-width:699px)').matches;

    handle.addEventListener('pointerdown', (e) => {
        if (!isMobileSheet()) return;
        dragging = true;
        startY = e.clientY;
        currentY = 0;
        cardHeight = card.offsetHeight;
        card.style.transition = 'none'; // follow the finger 1:1 while dragging
        handle.setPointerCapture?.(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        // only allow dragging down — clamp so it can't be pulled up past rest
        currentY = Math.max(0, e.clientY - startY);
        card.style.transform = `translateY(${currentY}px)`;
    });

    function endDrag(){
        if (!dragging) return;
        dragging = false;
        card.style.transition = ''; // hand back to the CSS transition for the settle/close animation
        const pastThreshold = currentY > cardHeight * .25;
        card.style.transform = ''; // let the (possibly-changing) .show class decide the resting position
        if (pastThreshold) closeFn();
    }
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

function initWelcomeSheetDrag(){
    initSheetDrag('weEditorOverlay', '.we-editor-card', closeWelcomeEditor);
    initSheetDrag('wePickerOverlay', '.we-picker-card', weClosePicker);
}

function weSampleValue(token){
    const guildName = document.getElementById('guildBadge')?.textContent || 'this server';
    const memberCount = document.getElementById('statMembers')?.textContent || '128';
    const now = new Date();
    switch (token){
        case '{user}': return '<span class="we-preview-mention">@NewMember</span>';
        case '{username}': return 'NewMember';
        case '{usertag}': return 'newmember';
        case '{membercount}': return memberCount;
        case '{servername}': return guildName;
        case '{time}': return now.toLocaleTimeString();
        case '{date}': return now.toLocaleDateString();
        case '{joindate}': return now.toLocaleDateString();
        default: return token;
    }
}

function weResolvePreviewText(text){
    if (!text) return '';
    let result = escapeHtml(text);
    // Native Discord mention syntax the channel/role pickers insert.
    result = result.replace(/&lt;#(\d+)&gt;/g, (_, id) => {
        const ch = CHANNELS.find(c => c.id === id);
        return `<span class="we-preview-mention">#${ch ? escapeHtml(ch.name) : 'channel'}</span>`;
    });
    result = result.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => {
        const role = ROLES.find(r => r.id === id);
        return `<span class="we-preview-mention">@${role ? escapeHtml(role.name) : 'role'}</span>`;
    });
    // Native Discord custom-emoji syntax the emoji picker inserts.
    result = result.replace(/&lt;(a?):(\w+):(\d+)&gt;/g, (_, animated, name, id) => {
        const ext = animated ? 'gif' : 'png';
        return `<img class="we-preview-emoji" src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${escapeHtml(name)}:" title=":${escapeHtml(name)}:">`;
    });
    for (const { token } of WE_MACROS){
        result = result.split(escapeHtml(token)).join(weSampleValue(token));
    }
    return result;
}

/* ── Advanced embed color picker — swatch + hex + presets + recents ── */

const WE_COLOR_PRESETS = [
    { label: 'Gold',            value: '#daa520' },
    { label: 'Gryffindor Red',  value: '#ae0001' },
    { label: 'Slytherin Green', value: '#2a623d' },
    { label: 'Ravenclaw Blue',  value: '#222f5b' },
    { label: 'Hufflepuff Yellow', value: '#ecb939' },
    { label: 'Discord Blurple', value: '#5865f2' },
    { label: 'White',           value: '#ffffff' },
    { label: 'Black',           value: '#1a1a1a' },
];
const WE_RECENT_COLORS_KEY = 'we_recent_embed_colors';

function weToggleColorPicker(){
    const pop = document.getElementById('weColorPopover');
    const opening = !pop.classList.contains('show');
    pop.classList.toggle('show', opening);
    if (opening) weRenderColorSwatches();
}

function weGetRecentColors(){
    try { return JSON.parse(localStorage.getItem(WE_RECENT_COLORS_KEY) || '[]'); }
    catch { return []; }
}

function weAddRecentColor(hex){
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    let recents = weGetRecentColors().filter(c => c.toLowerCase() !== hex.toLowerCase());
    recents.unshift(hex);
    recents = recents.slice(0, 8);
    try { localStorage.setItem(WE_RECENT_COLORS_KEY, JSON.stringify(recents)); } catch {}
    weRenderColorSwatches();
}

function weRenderSwatchGroup(containerId, colors){
    const wrap = document.getElementById(containerId);
    const current = (document.getElementById('weColor').value || '').toLowerCase();
    wrap.innerHTML = colors.map(c => {
        const active = c.toLowerCase() === current ? ' active' : '';
        return `<button type="button" class="we-color-chip${active}" style="background:${c};" title="${c}" onclick="weSetColor('${c}'); weAddRecentColor('${c}');"></button>`;
    }).join('');
}

function weRenderColorSwatches(){
    weRenderSwatchGroup('weColorPresetSwatches', WE_COLOR_PRESETS.map(p => p.value));
    const recents = weGetRecentColors();
    document.getElementById('weColorRecentLabel').style.display = recents.length ? '' : 'none';
    weRenderSwatchGroup('weColorRecentSwatches', recents);
}

function weSetColor(hex){
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    document.getElementById('weColor').value = hex;
    document.getElementById('weColorNative').value = hex;
    document.getElementById('weColorSwatchBtn').style.background = hex;
    weUpdatePreview();
}

function weOnColorHexInput(){
    let v = document.getElementById('weColor').value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    if (/^#[0-9a-f]{6}$/i.test(v)){
        document.getElementById('weColorNative').value = v;
        document.getElementById('weColorSwatchBtn').style.background = v;
    }
    weUpdatePreview();
}

document.addEventListener('click', (e) => {
    const picker = document.getElementById('weColorPicker');
    const popover = document.getElementById('weColorPopover');
    if (!popover || !popover.classList.contains('show')) return;
    if (picker && !picker.contains(e.target)) popover.classList.remove('show');
});

function weUpdatePreview(){
    const outside = document.getElementById('weOutsideMessage').value;
    const authorName = document.getElementById('weAuthorName').value;
    const authorIcon = document.getElementById('weAuthorIcon').value;
    const title = document.getElementById('weTitle').value;
    const description = document.getElementById('weDescription').value;
    const color = document.getElementById('weColor').value;
    const imageUrl = document.getElementById('weImageUrl').value;
    const thumbUrl = document.getElementById('weThumbUrl').value;
    const footerText = document.getElementById('weFooterText').value;
    const footerIcon = document.getElementById('weFooterIcon').value;

    const hasEmbed = title || description || authorName || footerText || imageUrl || thumbUrl;

    let html = '';
    html += `<div class="we-preview-content">${outside ? weResolvePreviewText(outside) : '<span class="we-preview-empty">(no outside message)</span>'}</div>`;

    if (hasEmbed){
        html += `<div class="we-preview-embed" style="border-left-color:${escapeHtml(color || '#daa520')};">`;
        if (authorName){
            html += `<div class="we-preview-author">${authorIcon ? `<img src="${escapeHtml(authorIcon)}">` : ''}${weResolvePreviewText(authorName)}</div>`;
        }
        if (thumbUrl) html += `<img class="we-preview-thumb" src="${escapeHtml(thumbUrl)}">`;
        if (title) html += `<div class="we-preview-title">${weResolvePreviewText(title)}</div>`;
        if (description) html += `<div class="we-preview-desc">${weResolvePreviewText(description)}</div>`;
        if (imageUrl) html += `<img class="we-preview-image" src="${escapeHtml(imageUrl)}">`;
        if (footerText){
            html += `<div class="we-preview-footer">${footerIcon ? `<img src="${escapeHtml(footerIcon)}">` : ''}<span>${weResolvePreviewText(footerText)}</span></div>`;
        }
        html += `</div>`;
    }

    document.getElementById('wePreview').innerHTML = html;
}

async function weSave(){
    const body = {
        outsideMessage: document.getElementById('weOutsideMessage').value || null,
        embedAuthorName: document.getElementById('weAuthorName').value || null,
        embedAuthorIconUrl: document.getElementById('weAuthorIcon').value || null,
        embedTitle: document.getElementById('weTitle').value || null,
        embedDescription: document.getElementById('weDescription').value || null,
        embedColor: document.getElementById('weColor').value || null,
        embedImageUrl: document.getElementById('weImageUrl').value || null,
        embedThumbnailUrl: document.getElementById('weThumbUrl').value || null,
        embedFooterText: document.getElementById('weFooterText').value || null,
        embedFooterIconUrl: document.getElementById('weFooterIcon').value || null,
    };

    try {
        if (weEditingId){
            await api(`/api/welcome-messages/${weEditingId}`, { method: 'PATCH', body: JSON.stringify(body) });
        } else {
            await api('/api/welcome-messages', { method: 'POST', body: JSON.stringify(body) });
        }
        closeWelcomeEditor();
        showToast('Welcome message saved', 'success');
        loadWelcomeMessages();
    } catch (err) {
        showToast(friendlyError(err.message) || 'Could not save that message.', 'error');
    }
}

function weDelete(id){
    showConfirm({
        title: 'Delete welcome message?',
        message: 'This message will no longer be part of the random rotation.',
        confirmLabel: 'Delete',
        onConfirm: async () => {
            try {
                await api(`/api/welcome-messages/${id}`, { method: 'DELETE' });
                showToast('Welcome message deleted', 'success');
                loadWelcomeMessages();
            } catch (err) {
                showToast('Could not delete that message.', 'error');
            }
        },
    });
}

async function weUploadImage(file, targetInputId){
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
        const data = await api('/api/welcome-messages/upload-image', { method: 'POST', body: form });
        document.getElementById(targetInputId).value = data.url;
        weUpdatePreview();
    } catch (err) {
        showToast('Could not upload that image.', 'error');
    }
}

/* ── Channel / role / macro pickers — shared popup, filled per-mode ── */

function weOpenChannelPicker(){ wePickerMode = 'channel'; weOpenPicker('Insert Channel'); }
function weOpenRolePicker(){ wePickerMode = 'role'; weOpenPicker('Insert Role'); }
function weOpenEmojiPicker(){ wePickerMode = 'emoji'; weOpenPicker('Insert Emoji'); }
function weOpenMacroPicker(){ wePickerMode = 'macro'; weOpenPicker('Insert Macro'); }

function weOpenPicker(title){
    document.getElementById('wePickerTitle').textContent = title;
    document.getElementById('wePickerSearch').value = '';
    weRenderPickerList();
    document.getElementById('wePickerOverlay').classList.add('show');
}

function weClosePicker(){
    document.getElementById('wePickerOverlay').classList.remove('show');
}

function weRenderPickerList(){
    const query = (document.getElementById('wePickerSearch').value || '').toLowerCase();
    const listEl = document.getElementById('wePickerList');

    let items = [];
    if (wePickerMode === 'channel'){
        items = CHANNELS.filter(c => c.name.toLowerCase().includes(query))
            .map(c => ({ label: '#' + c.name, sub: '', onSelect: () => weInsertAtCursor(`<#${c.id}>`) }));
    } else if (wePickerMode === 'role'){
        items = ROLES.filter(r => r.name.toLowerCase().includes(query))
            .map(r => ({ label: '@' + r.name, sub: '', onSelect: () => weInsertAtCursor(`<@&${r.id}>`) }));
    } else if (wePickerMode === 'emoji'){
        items = EMOJIS.filter(e => e.name.toLowerCase().includes(query))
            .map(e => ({
                label: ':' + e.name + ':',
                sub: '',
                icon: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? 'gif' : 'png'}?size=32`,
                onSelect: () => weInsertAtCursor(`<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`),
            }));
    } else {
        items = WE_MACROS.filter(m => m.token.toLowerCase().includes(query) || m.desc.toLowerCase().includes(query))
            .map(m => ({ label: m.token, sub: m.desc, onSelect: () => weInsertAtCursor(m.token) }));
    }

    if (!items.length){
        listEl.innerHTML = wePickerMode === 'emoji' && !EMOJIS.length
            ? '<p class="we-picker-empty">This server has no custom emojis yet.</p>'
            : '<p class="we-picker-empty">Nothing matches that search.</p>';
        return;
    }

    listEl.innerHTML = '';
    items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'we-picker-row' + (item.icon ? ' we-picker-row-emoji' : '');
        const iconHtml = item.icon ? `<img class="we-picker-emoji-icon" src="${item.icon}" alt="">` : '';
        row.innerHTML = `${iconHtml}<span class="we-picker-row-text"><span>${escapeHtml(item.label)}</span>${item.sub ? `<span class="we-macro-desc">${escapeHtml(item.sub)}</span>` : ''}</span>`;
        row.onclick = () => { item.onSelect(); weClosePicker(); };
        listEl.appendChild(row);
    });
}

let settingState = { logs:false, welcome:false, starboard:false, azkaban:false, sortinghat:false, interviews:false, bump:false, leveling:false, airesponse:false };

async function loadSettings(){
    try {
        const s = await api('/api/settings');
        settingState = {
            logs: s.logsEnabled, welcome: s.welcomeEnabled,
            starboard: s.starboardEnabled, azkaban: s.azkabanEnabled,
            sortinghat: s.sortingHatEnabled,
            interviews: s.interviewsEnabled,
            bump: s.bumpEnabled, leveling: s.levelingEnabled,
            airesponse: s.aiResponseEnabled,
        };

        setToggleUI('logs', s.logsEnabled, ddLogs, s.logChannelId);
        setToggleUI('welcome', s.welcomeEnabled, ddWelcome, s.welcomeChannelId);
        setToggleUI('starboard', s.starboardEnabled, ddStarboard, s.starboardChannelId);
        setToggleUI('azkaban', s.azkabanEnabled, ddAzkaban, s.azkabanRoleId);
        setToggleUI('sortinghat', s.sortingHatEnabled, ddSortingHat, s.sortingHatChannelId);
        setToggleUI('interviews', s.interviewsEnabled);
        ddInterviewCategory?.setValue(s.interviewCategoryId);
        ddInterviewLogChannel?.setValue(s.interviewLogChannelId);
        setToggleUI('bump', s.bumpEnabled);
        setToggleUI('leveling', s.levelingEnabled);
        setToggleUI('airesponse', s.aiResponseEnabled);

        document.getElementById('aiResponseProbabilityInput').value = Math.round((s.aiResponseProbability ?? 0.1) * 100);

        document.getElementById('starboardThresholdHint').textContent = `Threshold: ${s.starboardThreshold} reaction${s.starboardThreshold === 1 ? '' : 's'}`;

        ddHouseGryffindor?.setValue(s.gryffindorRoleId);
        ddHouseRavenclaw?.setValue(s.ravenclawRoleId);
        ddHouseHufflepuff?.setValue(s.hufflepuffRoleId);
        ddHouseSlytherin?.setValue(s.slytherinRoleId);

        document.getElementById('xpPerMessageInput').value = s.xpPerMessage;
        document.getElementById('xpCooldownInput').value = s.xpCooldownSeconds;
        document.getElementById('housePointValueInput').value = s.housePointValue;
        document.getElementById('starboardThresholdInput').value = s.starboardThreshold;

        setDefaultHint('xpPerMessageDefault', s.xpPerMessageIsDefault);
        setDefaultHint('xpCooldownDefault', s.xpCooldownIsDefault);
        setDefaultHint('housePointValueDefault', s.housePointValueIsDefault);
        setDefaultHint('starboardThresholdDefault', s.starboardThresholdIsDefault);
        setDefaultHint('botManagerRoleDefault', s.botManagerRoleIds.length === 0);

        renderBotManagerRoles(s.botManagerRoleIds);
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadSettings failed', err);
    }

    loadModChannels();
}

function setDefaultHint(id, isDefault){
    const el = document.getElementById(id);
    if (el) el.textContent = isDefault ? '(using bot default)' : '(custom)';
}

function setToggleUI(key, enabled, dd, value){
    document.getElementById('toggle-'+key).classList.toggle('on', enabled);
    document.getElementById('sub-'+key)?.classList.toggle('open', enabled);
    if (dd && value) dd.setValue(value);
}

async function toggleSetting(key){
    if (!CURRENT_USER?.canManageGuild) { showToast('Requires Manage Server permission', 'warn'); return; }

    settingState[key] = !settingState[key];
    document.getElementById('toggle-'+key).classList.toggle('on', settingState[key]);
    document.getElementById('sub-'+key)?.classList.toggle('open', settingState[key]);

    const fieldMap = { logs:'logsEnabled', welcome:'welcomeEnabled', starboard:'starboardEnabled', azkaban:'azkabanEnabled', sortinghat:'sortingHatEnabled', interviews:'interviewsEnabled', bump:'bumpEnabled', leveling:'levelingEnabled', airesponse:'aiResponseEnabled' };
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ [fieldMap[key]]: settingState[key] }) });
        showToast(settingState[key] ? 'Enabled' : 'Disabled', 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
        settingState[key] = !settingState[key];
        document.getElementById('toggle-'+key).classList.toggle('on', settingState[key]);
        document.getElementById('sub-'+key)?.classList.toggle('open', settingState[key]);
    }
}

async function saveChannelSetting(key, channelId){
    const fieldMap = { logs:'logChannelId', welcome:'welcomeChannelId', starboard:'starboardChannelId', sortinghat:'sortingHatChannelId', interviews:'interviewLogChannelId' };
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ [fieldMap[key]]: channelId }) });
        showToast('Channel saved', 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

async function saveInterviewCategory(categoryId){
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ interviewCategoryId: categoryId }) });
        showToast('Category saved', 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

async function saveRoleSetting(key, roleId){
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ azkabanRoleId: roleId }) });
        showToast('Role saved', 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* Mod Channels list — Deluminator's search scope */
async function loadModChannels(){
    try {
        const { channels } = await api('/api/mod-channels');
        modChannelsMS?.setItems(channels);
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadModChannels failed', err);
    }
}

async function addModChannelUI(channelId){
    try {
        await api('/api/mod-channels', { method:'POST', body: JSON.stringify({ channelId }) });
        showToast('Mod channel added', 'success');
        loadModChannels();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

async function removeModChannelUI(channelId){
    try {
        await api(`/api/mod-channels/${channelId}`, { method:'DELETE' });
        showToast('Mod channel removed', 'success');
        loadModChannels();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* Bot Manager roles — any number of roles, anyone holding one counts */
function renderBotManagerRoles(roleIds){
    const items = roleIds.map(id => ({ id, name: ROLES.find(r => r.id === id)?.name || id }));
    botManagerRolesMS?.setItems(items);
}

async function addBotManagerRoleUI(roleId){
    try {
        await api('/api/settings/bot-manager-roles', { method:'POST', body: JSON.stringify({ roleId }) });
        showToast('Bot Manager role added', 'success');
        loadSettings();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

async function removeBotManagerRoleUI(roleId){
    try {
        await api(`/api/settings/bot-manager-roles/${roleId}`, { method:'DELETE' });
        showToast('Bot Manager role removed', 'success');
        loadSettings();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* Generic role-field save, used by House Roles cards */
async function saveRoleSetting2(field, roleId){
    if (!roleId) return;
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ [field]: roleId }) });
        showToast('Role saved', 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* Generic numeric-field save, used by Leveling & XP card */
async function saveNumberSetting(field, inputId){
    const raw = document.getElementById(inputId).value;
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value) || value < 0) {
        showToast('Enter a valid number', 'warn');
        return;
    }
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ [field]: value }) });
        showToast('Saved', 'success');
        loadSettings();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* AI response probability — stored as a 0.1-1 decimal, edited as a 10-100 percent */
async function saveAiResponseProbability(){
    const raw = document.getElementById('aiResponseProbabilityInput').value;
    const pct = Number(raw);
    if (raw === '' || !Number.isFinite(pct) || pct < 10 || pct > 100) {
        showToast('Enter a number between 10 and 100', 'warn');
        return;
    }
    try {
        await api('/api/settings', { method:'POST', body: JSON.stringify({ aiResponseProbability: pct / 100 }) });
        showToast('Saved', 'success');
        loadSettings();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* House point add/deduct controls — custom amount, same power both directions */
function renderHousePointControls(){
    const houses = Object.keys(HOUSE_META);
    document.getElementById('housePointControls').innerHTML = houses.map(h => `
        <div class="setting-row">
            <div class="setting-text"><div class="sname">${svg(HOUSE_META[h].icon, 14)} ${HOUSE_META[h].name}</div></div>
            <div class="field-input-row" style="max-width:170px;">
                <input class="field-input" type="number" id="hp-amount-${h}" value="10" min="1" step="1" style="text-align:center;">
                <button class="btn btn-ghost btn-sm" onclick="adjustHousePointsCustom('${h}', -1)" ${CURRENT_USER?.canManageGuild?'':'disabled'} title="Deduct">${svg('minus',14)}</button>
                <button class="btn btn-primary btn-sm" onclick="adjustHousePointsCustom('${h}', 1)" ${CURRENT_USER?.canManageGuild?'':'disabled'} title="Add">${svg('plus',14)}</button>
            </div>
        </div>
    `).join('');
}

async function adjustHousePointsCustom(house, sign){
    const input = document.getElementById(`hp-amount-${house}`);
    const amount = Math.abs(Number(input.value)) || 0;
    if (amount === 0) { showToast('Enter a point amount first', 'warn'); return; }
    await adjustHousePoints(house, sign * amount);
}

async function adjustHousePoints(house, delta){
    try {
        const result = await api(`/api/houses/${house}/points`, { method:'POST', body: JSON.stringify({ delta }) });
        showToast(`${delta > 0 ? '+' : ''}${delta} ${HOUSE_META[house].name}: now ${result.points} pts`, 'success');
        renderHome();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

