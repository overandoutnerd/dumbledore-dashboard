/* ============================================================
   CONFIRM MODAL (replaces native confirm())
   ============================================================ */
function showConfirm({ title, message, confirmLabel = 'Confirm', onConfirm }) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmIcon').innerHTML = svg('alert', 22);
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;

    const okBtn = document.getElementById('confirmOkBtn');
    okBtn.textContent = confirmLabel;

    const cancelBtn = document.getElementById('confirmCancelBtn');

    function close(){
        overlay.classList.remove('show');
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', close);
        overlay.removeEventListener('click', overlayClick);
    }
    function handleOk(){ close(); onConfirm(); }
    function overlayClick(e){ if (e.target === overlay) close(); }

    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', overlayClick);

    overlay.classList.add('show');
}

async function resetIdentityImage(kind){
    try {
        await api(`/api/bot/${kind}`, { method:'DELETE' });
        showToast(`${cap(kind)} reset to default`, 'success');
        loadBotIdentity();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

function confirmResetIdentityImage(kind){
    showConfirm({
        title: `Reset ${cap(kind)}?`,
        message: `This will remove the server-specific ${kind} and revert to the bot's default. This can't be undone from here.`,
        confirmLabel: 'Reset',
        onConfirm: () => resetIdentityImage(kind),
    });
}

function confirmResetHouseCup(){
    if (!CURRENT_USER?.canManageGuild) { showToast('Requires Manage Server permission', 'warn'); return; }
    showConfirm({
        title: 'Reset House Cup?',
        message: "This sets Gryffindor, Ravenclaw, Hufflepuff and Slytherin's points back to zero. This can't be undone.",
        confirmLabel: 'Reset',
        onConfirm: resetHouseCup,
    });
}

async function resetHouseCup(){
    try {
        await api('/api/houses/reset', { method:'POST' });
        showToast('House Cup reset', 'success');
        renderHome();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

function confirmResetLeveling(){
    if (!CURRENT_USER?.canManageGuild) { showToast('Requires Manage Server permission', 'warn'); return; }
    showConfirm({
        title: 'Reset Leveling Data?',
        message: "This wipes every member's XP, level and message count back to zero. This can't be undone.",
        confirmLabel: 'Reset',
        onConfirm: resetLeveling,
    });
}

async function resetLeveling(){
    try {
        await api('/api/leveling/reset', { method:'POST' });
        showToast('Leveling data reset', 'success');
        renderHome();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

async function saveNickname(){
    const v = document.getElementById('nicknameInput').value.trim();
    try {
        await api('/api/bot/nickname', { method:'POST', body: JSON.stringify({ nickname: v }) });
        showToast(`Nickname saved: ${v || 'default'}`, 'success');
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

function copyCmd(cmd){
    if(navigator.clipboard) navigator.clipboard.writeText(cmd).catch(()=>{});
    showToast(`Copied ${cmd}`, 'success');
}

