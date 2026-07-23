/* ============================================================
   SETTINGS TAB
   ============================================================ */
/* ============================================================
   CUSTOM DROPDOWN COMPONENT (replaces native <select>)
   ============================================================ */
const ALL_DROPDOWNS = [];

function closeAllDropdowns(except){
    ALL_DROPDOWNS.forEach(dd => { if (dd !== except) dd.close(); });
}

function createDropdown(containerId, { placeholder = 'Select…', searchable = true, onChange } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.classList.add('dd');
    container.innerHTML = `
        <button type="button" class="dd-trigger">
            <span class="dd-label">${placeholder}</span>
            <span class="dd-chevron">${svg('chevronDown', 14)}</span>
        </button>
        <div class="dd-panel"></div>
    `;

    const trigger = container.querySelector('.dd-trigger');
    const label = container.querySelector('.dd-label');
    const panel = container.querySelector('.dd-panel');

    const state = { options: [], value: null, disabled: false };

    function renderPanel(){
        const q = state._query?.toLowerCase() || '';
        const filtered = state.options.filter(o => !q || o.label.toLowerCase().includes(q));

        const searchHtml = searchable && state.options.length > 6
            ? `<input class="dd-search" type="text" placeholder="Search…" value="${state._query || ''}">`
            : '';

        const optionsHtml = filtered.length === 0
            ? `<div class="dd-empty">No matches</div>`
            : filtered.map(o => `
                <div class="dd-option ${o.value === state.value ? 'selected' : ''}" data-value="${o.value}">
                    <span>${o.label}</span>
                    ${o.value === state.value ? `<span class="dd-check">${svg('check', 13)}</span>` : ''}
                </div>
            `).join('');

        panel.innerHTML = searchHtml + optionsHtml;

        const searchInput = panel.querySelector('.dd-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state._query = e.target.value;
                renderPanel();
            });
            searchInput.addEventListener('click', (e) => e.stopPropagation());
        }

        panel.querySelectorAll('.dd-option').forEach(el => {
            el.addEventListener('click', () => {
                const v = el.dataset.value;
                state.value = v;
                updateLabel();
                close();
                if (onChange) onChange(v);
            });
        });
    }

    function updateLabel(){
        const match = state.options.find(o => o.value === state.value);
        label.textContent = match ? match.label : placeholder;
        label.classList.toggle('filled', !!match);
    }

    function open(){
        if (state.disabled) return;
        closeAllDropdowns(api_);
        container.classList.add('open');
        state._query = '';
        renderPanel();
    }
    function close(){ container.classList.remove('open'); }
    function toggle(){ container.classList.contains('open') ? close() : open(); }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    container.addEventListener('click', (e) => e.stopPropagation());

    const api_ = {
        setOptions(options){ state.options = options; updateLabel(); if (container.classList.contains('open')) renderPanel(); },
        setValue(value){ state.value = value ?? null; updateLabel(); },
        getValue(){ return state.value; },
        setDisabled(disabled){
            state.disabled = disabled;
            trigger.classList.toggle('disabled', disabled);
        },
        close,
    };

    ALL_DROPDOWNS.push(api_);
    return api_;
}

document.addEventListener('click', () => closeAllDropdowns());

/* ============================================================
   CUSTOM MULTI-SELECT COMPONENT (mod channels)
   ============================================================ */
function createMultiSelect(containerId, { onAdd, onRemove, prefix = '#', emptyText = 'Nothing configured yet.', addPlaceholder = 'Add…' } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    container.innerHTML = `
        <div class="ms-selected"></div>
        <div class="ms-empty-note" style="display:none;">${escapeHtml(emptyText)}</div>
        <div class="dd" id="${containerId}-picker"></div>
    `;

    const selectedWrap = container.querySelector('.ms-selected');
    const emptyNote = container.querySelector('.ms-empty-note');

    let items = []; // [{id, name}]
    let allOptions = []; // [{value, label}]
    let disabled = false;

    const picker = createDropdown(`${containerId}-picker`, {
        placeholder: addPlaceholder,
        onChange: (id) => {
            if (!id) return;
            picker.setValue(null);
            if (onAdd) onAdd(id);
        },
    });

    function render(){
        selectedWrap.innerHTML = items.map(it => `
            <span class="ms-chip">${prefix}${escapeHtml(it.name || it.id)}<button data-id="${it.id}">${svg('close', 12)}</button></span>
        `).join('');
        emptyNote.style.display = items.length === 0 ? 'block' : 'none';

        selectedWrap.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => { if (!disabled && onRemove) onRemove(btn.dataset.id); });
        });

        const selectedIds = new Set(items.map(i => i.id));
        picker.setOptions(allOptions.filter(o => !selectedIds.has(o.value)));
    }

    return {
        setItems(newItems){ items = newItems; render(); },
        setAllOptions(options){ allOptions = options; render(); },
        setDisabled(d){ disabled = d; picker.setDisabled(d); },
    };
}

/* ============================================================
   INSTANTIATE ALL SETTINGS DROPDOWNS
   ============================================================ */
let ddLogs, ddWelcome, ddStarboard, ddSortingHat, ddAzkaban;
let ddHouseGryffindor, ddHouseRavenclaw, ddHouseHufflepuff, ddHouseSlytherin;
let ddInterviewCategory, ddInterviewLogChannel;
let modChannelsMS, botManagerRolesMS;

function initSettingsControls(){
    ddLogs = createDropdown('dd-logs', { placeholder:'— choose a channel —', onChange: v => saveChannelSetting('logs', v) });
    ddWelcome = createDropdown('dd-welcome', { placeholder:'— choose a channel —', onChange: v => saveChannelSetting('welcome', v) });
    ddStarboard = createDropdown('dd-starboard', { placeholder:'— choose a channel —', onChange: v => saveChannelSetting('starboard', v) });
    ddSortingHat = createDropdown('dd-sortinghat', { placeholder:'— choose a channel —', onChange: v => saveChannelSetting('sortinghat', v) });
    ddAzkaban = createDropdown('dd-azkaban', { placeholder:'— choose a role —', onChange: v => saveRoleSetting('azkaban', v) });

    ddHouseGryffindor = createDropdown('dd-house-gryffindor', { placeholder:'— choose a role —', onChange: v => saveRoleSetting2('gryffindorRoleId', v) });
    ddHouseRavenclaw = createDropdown('dd-house-ravenclaw', { placeholder:'— choose a role —', onChange: v => saveRoleSetting2('ravenclawRoleId', v) });
    ddHouseHufflepuff = createDropdown('dd-house-hufflepuff', { placeholder:'— choose a role —', onChange: v => saveRoleSetting2('hufflepuffRoleId', v) });
    ddHouseSlytherin = createDropdown('dd-house-slytherin', { placeholder:'— choose a role —', onChange: v => saveRoleSetting2('slytherinRoleId', v) });

    ddInterviewCategory = createDropdown('dd-interview-category', {
        placeholder:'— choose a category —',
        onChange: v => saveInterviewCategory(v),
    });
    ddInterviewLogChannel = createDropdown('dd-interview-log-channel', {
        placeholder:'— choose a channel —',
        onChange: v => saveChannelSetting('interviews', v),
    });

    modChannelsMS = createMultiSelect('modChannelsMultiSelect', {
        prefix: '#',
        emptyText: 'No mod channels configured yet.',
        addPlaceholder: 'Add a channel…',
        onAdd: (channelId) => addModChannelUI(channelId),
        onRemove: (channelId) => removeModChannelUI(channelId),
    });

    botManagerRolesMS = createMultiSelect('botManagerRolesMultiSelect', {
        prefix: '@',
        emptyText: 'No Bot Manager roles configured — falls back to Administrator.',
        addPlaceholder: 'Add a role…',
        onAdd: (roleId) => addBotManagerRoleUI(roleId),
        onRemove: (roleId) => removeBotManagerRoleUI(roleId),
    });
}

async function loadChannelsAndRoles(){
    try {
        const [ch, rl, cat] = await Promise.all([api('/api/channels'), api('/api/roles'), api('/api/categories')]);
        CHANNELS = ch.channels;
        ROLES = rl.roles;
        INTERVIEW_CATEGORIES = cat.categories;

        const chanOptions = CHANNELS.map(c => ({ value: c.id, label: '#' + c.name }));
        const roleOptions = ROLES.map(r => ({ value: r.id, label: '@' + r.name }));
        const categoryOptions = INTERVIEW_CATEGORIES.map(c => ({ value: c.id, label: c.name }));

        [ddLogs, ddWelcome, ddStarboard, ddSortingHat, ddInterviewLogChannel].forEach(dd => dd?.setOptions(chanOptions));
        [ddAzkaban, ddHouseGryffindor, ddHouseRavenclaw, ddHouseHufflepuff, ddHouseSlytherin].forEach(dd => dd?.setOptions(roleOptions));
        ddInterviewCategory?.setOptions(categoryOptions);
        modChannelsMS?.setAllOptions(chanOptions);
        botManagerRolesMS?.setAllOptions(roleOptions);
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadChannelsAndRoles failed', err);
    }

    // Fetched separately so a hiccup here (e.g. bot missing an emoji scope)
    // never blocks the channel/role dropdowns above from loading.
    try {
        const em = await api('/api/emojis');
        EMOJIS = em.emojis;
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadEmojis failed', err);
    }
}

