/* ============================================================
   AUTH / BOOTSTRAP
   ============================================================ */
function hideAllGates(){
    document.getElementById('loginGate').classList.add('login-hidden');
    document.getElementById('serverPicker').classList.add('login-hidden');
    document.getElementById('appRoot').classList.add('login-hidden');
    document.getElementById('bottomNav').classList.add('login-hidden');
    document.getElementById('desktopSidebar').classList.add('login-hidden');
}

function showLoginGate(errorMsg) {
    hideAllGates();
    document.getElementById('loginGate').classList.remove('login-hidden');
    if (errorMsg) {
        const el = document.getElementById('loginError');
        el.textContent = errorMsg;
        el.classList.remove('login-hidden');
    }
}

async function showServerPicker(errorMsg) {
    hideAllGates();
    document.getElementById('serverPicker').classList.remove('login-hidden');
    document.getElementById('pickerUsername').textContent = CURRENT_USER?.username || '';

    if (errorMsg) {
        const el = document.getElementById('pickerError');
        el.textContent = errorMsg;
        el.classList.remove('login-hidden');
    } else {
        document.getElementById('pickerError').classList.add('login-hidden');
    }

    const listEl = document.getElementById('serverPickerList');
    await populateGuildList(listEl, 'selectServer');
}

/** Fetches the mod-eligible guild list and renders it into `listEl`, wiring
 *  each row to call `window[onSelectFnName](guildId)` when clicked. Shared by
 *  the full-screen server picker and the switch-server modal. */
async function populateGuildList(listEl, onSelectFnName) {
    listEl.innerHTML = `<p class="no-params">Looking for servers you moderate…</p>`;

    try {
        const { guilds } = await api('/api/guilds');
        if (guilds.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('search',22)}</div><p>No servers found where you have mod access and the bot is installed.</p></div>`;
            return;
        }
        listEl.innerHTML = guilds.map(g => `
            <div class="server-row" onclick="${onSelectFnName}('${g.id}')">
                ${g.iconUrl ? `<img class="server-icon" src="${g.iconUrl}" alt="">` : `<div class="server-icon-fallback">${escapeHtml(g.name.slice(0,2).toUpperCase())}</div>`}
                <div class="server-info">
                    <div class="sname">${escapeHtml(g.name)}</div>
                    <div class="sbadge">${g.isOwner ? svg('crown',11)+' Owner' : g.isBotManager ? svg('wand',11)+' Bot Manager' : svg('shield',11)+' Mod access'}</div>
                </div>
                <span class="server-arrow">→</span>
            </div>
        `).join('');
    } catch (err) {
        listEl.innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('alert',22)}</div><p>Couldn't load your servers. Try refreshing.</p></div>`;
    }
}

async function selectServer(guildId){
    try {
        await api(`/api/guilds/${guildId}/select`, { method:'POST' });
        location.reload();
    } catch (err) {
        showServerPicker(friendlyError(err.message));
    }
}

/* ============================================================
   SWITCH SERVER (popup dialog over the current dashboard)
   ============================================================ */
function openSwitchServerModal(){
    const overlay = document.getElementById('switchServerOverlay');
    overlay.classList.add('show');
    document.getElementById('switchServerError').classList.add('login-hidden');
    populateGuildList(document.getElementById('switchServerList'), 'selectServerFromModal');
}

function closeSwitchServerModal(){
    document.getElementById('switchServerOverlay').classList.remove('show');
}

async function selectServerFromModal(guildId){
    const errEl = document.getElementById('switchServerError');
    errEl.classList.add('login-hidden');
    try {
        await api(`/api/guilds/${guildId}/select`, { method:'POST' });
        const { user } = await api('/api/me');
        CURRENT_USER = user;
        closeSwitchServerModal();
        await loadDashboard();
    } catch (err) {
        errEl.textContent = friendlyError(err.message) || "Couldn't switch to that server. Try again.";
        errEl.classList.remove('login-hidden');
    }
}

function showApp() {
    hideAllGates();
    document.getElementById('appRoot').classList.remove('login-hidden');
    document.getElementById('bottomNav').classList.remove('login-hidden');
    document.getElementById('desktopSidebar').classList.remove('login-hidden');
    maybeAutoStartTour();
}

function logout() {
    showConfirm({
        title: 'Sign out?',
        message: "You'll need to sign in with Discord again to get back into this dashboard.",
        confirmLabel: 'Sign out',
        onConfirm: () => {
            api('/auth/logout', { method:'POST' }).finally(() => location.reload());
        },
    });
}

function applyPermissionGates() {
    const u = CURRENT_USER;
    if (!u) return;

    document.getElementById('userAvatar').src = u.avatar;
    document.getElementById('userName').textContent = u.username;
    document.getElementById('guildBadge').textContent = u.guildName || 'this server';
    document.getElementById('homeGreeting').textContent = `${timeOfDayGreeting()}, ${u.nickname || u.username}`;

    // Rebuild controls whose disabled-state was baked in at pre-login render time.
    renderHousePointControls();

    // Bot identity — Bot Manager only
    const botManagerOk = u.isBotManager;
    ['editAvatarBtn','editBannerBtn','changeAvatarBtn','resetAvatarBtn','changeBannerBtn','resetBannerBtn','saveNicknameBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !botManagerOk;
    });
    document.getElementById('nicknameInput').disabled = !botManagerOk;
    document.getElementById('nicknameLock').classList.toggle('login-hidden', botManagerOk);
    document.getElementById('avatarLock').classList.toggle('login-hidden', botManagerOk);

    // Settings — Manage Server
    const manageGuildOk = u.canManageGuild;
    document.querySelectorAll('#panel-settings .toggle').forEach(t => t.classList.toggle('disabled', !manageGuildOk));
    document.querySelectorAll('#panel-settings input').forEach(i => i.disabled = !manageGuildOk);
    document.querySelectorAll('#panel-settings .btn-primary').forEach(b => b.disabled = !manageGuildOk);
    [ddLogs, ddWelcome, ddStarboard, ddSortingHat, ddAzkaban, ddHouseGryffindor, ddHouseRavenclaw, ddHouseHufflepuff, ddHouseSlytherin, ddInterviewCategory, ddInterviewLogChannel].forEach(dd => dd?.setDisabled(!manageGuildOk));
    modChannelsMS?.setDisabled(!manageGuildOk);
    botManagerRolesMS?.setDisabled(!manageGuildOk);
    document.getElementById('settingsLock').classList.toggle('login-hidden', manageGuildOk);
    document.getElementById('housePointsLock').classList.toggle('login-hidden', manageGuildOk);
    document.getElementById('modChannelsLock').classList.toggle('login-hidden', manageGuildOk);
    document.getElementById('xpSettingsLock').classList.toggle('login-hidden', manageGuildOk);
    document.getElementById('houseRolesLock').classList.toggle('login-hidden', manageGuildOk);
    document.getElementById('accessRolesLock').classList.toggle('login-hidden', manageGuildOk);

    // Azkaban — Manage Roles
    const manageRolesOk = u.canManageRoles;
    document.getElementById('sentenceForm').classList.toggle('login-hidden', !manageRolesOk);
    document.getElementById('azkabanLock').classList.toggle('login-hidden', manageRolesOk);
}

async function bootstrap() {
    const params = new URLSearchParams(location.search);
    const authError = params.get('authError');
    if (authError) {
        // Don't trust this blindly and bail out — Chrome's "Request Desktop
        // Site" reload (and possibly other history-replay navigations) can
        // resurrect an OLD, stale URL for this tab that still has an
        // authError query param on it from a genuine failed-login moment
        // way earlier, even though history.replaceState() below already
        // scrubbed it from the visible address bar for THIS session. If we
        // trust it unconditionally, a perfectly valid, still-logged-in
        // session gets shown the login gate every time that stale URL gets
        // replayed. Strip it immediately, and only actually show the error
        // message further down if the real /api/me check confirms we're
        // genuinely not authenticated.
        history.replaceState({}, '', location.pathname);
    }

    try {
        // Raw fetch (not api()) for this very first check: right after a hard
        // UA-switching reload (e.g. toggling "Desktop site" on Android Chrome)
        // the session cookie can occasionally lag by a beat. Retry once,
        // silently, before letting api() flash the login gate over it.
        let meRes = await fetch('/api/me', { credentials: 'include' });
        for (const delayMs of [300, 600]) {
            if (meRes.status !== 401) break;
            await new Promise(r => setTimeout(r, delayMs));
            meRes = await fetch('/api/me', { credentials: 'include' });
        }
        if (meRes.status === 401) {
            const messages = {
                invalid_state: "Login expired, please try again.",
                server_error: "Something went wrong signing you in. Please try again.",
            };
            showLoginGate(authError ? (messages[authError] || 'Could not sign you in. Please try again.') : undefined);
            throw new Error('not_authenticated');
        }
        if (!meRes.ok) throw new Error(`request_failed_${meRes.status}`);
        const { user } = await meRes.json();
        CURRENT_USER = user;

        if (!user.activeGuildId) {
            showServerPicker();
            return;
        }

        await loadDashboard();
    } catch {
        showLoginGate();
    }
}

/** Renders the app shell + all guild-scoped data for CURRENT_USER. Shared by
 *  initial bootstrap and by switching servers in place (no page reload). */
async function loadDashboard() {
    // Mark the correct panel active BEFORE the app becomes visible. The
    // static HTML's default-active panel is Home, so if we revealed the
    // app first and only called routeFromLocation() at the end (after all
    // the awaited data loads below), a reload on e.g. /settings would
    // flash Home for a moment before jumping to Settings. Routing first
    // means the right panel is already showing the instant login-hidden
    // is removed. This only toggles CSS classes / history state — none of
    // it depends on the data fetched below, so it's safe to run early.
    //
    // Wrapped in try/catch: bootstrap()'s caller treats ANY error thrown
    // out of loadDashboard() as an auth failure and shows the login gate
    // (see bootstrap()'s catch block) — a bad/unexpected URL should never
    // be able to bounce an otherwise-valid session back to sign-in.
    try {
        routeFromLocation({ skipHistory: true });
    } catch (err) {
        console.error('routeFromLocation failed, falling back to Home', err);
        switchTab('home', { skipHistory: true });
    }

    showApp();
    applyPermissionGates();
    await Promise.all([
        loadCommands(),
        loadCommandUsage(),
        loadChannelsAndRoles(),
        renderHome(),
        loadInterviews(),
    ]);
    renderCategoryChips();
    renderCommands();
    loadSettings();
    loadBotIdentity();
    loadWelcomeMessages();
}

