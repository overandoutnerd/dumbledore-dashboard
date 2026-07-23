/* ============================================================
   MISC INTERACTIONS
   ============================================================ */
const TAB_PATHS = { home: '/', commands: '/commands', bot: '/bot', settings: '/settings' };

function switchTab(tab, opts = {}){
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-'+tab).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    window.scrollTo({top:0, behavior:'smooth'});
    if (!opts.skipHistory) {
        const path = TAB_PATHS[tab] || '/';
        if (window.location.pathname !== path) history.pushState({tab}, '', path);
    }
}

/* ============================================================
   ROUTING
   The nav tabs (Home/Commands/Bot/Settings), the Interviews list, and an
   individual interview transcript each get their own URL (/, /commands,
   /bot, /settings, /interviews, /interviews/:publicId) via
   history.pushState in switchTab()/openInterviewsScreen()/
   openInterviewDetail(). routeFromLocation() is the reverse of that: given
   whatever's currently in the address bar, show the matching screen. It
   runs once after the dashboard finishes its initial load (so a reload —
   or a Discord embed link — lands on the right screen instead of always
   Home) and again on browser back/forward.
   ============================================================ */
function routeFromLocation(opts = {}){
    const path = window.location.pathname;

    const interviewMatch = path.match(/^\/interviews\/([^/]+)\/?$/);
    if (interviewMatch) {
        openInterviewDetail(interviewMatch[1], { skipHistory: true });
        return;
    }

    if (path === '/interviews' || path === '/interviews/') {
        openInterviewsScreen({ skipHistory: true });
        return;
    }

    const tab = Object.keys(TAB_PATHS).find(t => TAB_PATHS[t] === path);
    switchTab(tab || 'home', { skipHistory: true });
}

window.addEventListener('popstate', () => {
    const appRoot = document.getElementById('appRoot');
    if (appRoot && !appRoot.classList.contains('login-hidden')) {
        routeFromLocation({ skipHistory: true });
    }
});

/** If the person is signed out and reloads/opens a deep link (an interview
 *  transcript, or just landing back on /settings from a bookmark), point
 *  the landing page's "Sign in" buttons at that same URL via returnTo, so
 *  clicking sign-in (not an automatic redirect) takes them through Discord
 *  OAuth and back to exactly where they were headed. */
function applyDeepLinkReturnTo(){
    const path = window.location.pathname;
    if (path === '/') return; // default post-login redirect already goes here
    const loginUrl = `/auth/login?returnTo=${encodeURIComponent(path)}`;
    ['navSignInBtn', 'ctaBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.href = loginUrl;
    });
}

let toastTimer;
function showToast(msg, type){
    const t = document.getElementById('toast');
    const iconName = type === 'error' ? 'closeCircle' : type === 'warn' ? 'alert' : type === 'success' ? 'checkCircle' : null;
    t.innerHTML = (iconName ? svg(iconName, 14) : '') + `<span>${escapeHtml(msg)}</span>`;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function friendlyError(code){
    const map = {
        missing_permission: "You don't have permission to do that.",
        already_imprisoned: 'That member is already in Azkaban.',
        cannot_sentence_owner: "You can't sentence the server owner.",
        cannot_sentence_bot: "You can't sentence a bot.",
        cannot_sentence_self: "You can't sentence yourself.",
        azkaban_not_configured: 'Azkaban needs a Prisoner role set in Settings first.',
        member_not_found: 'That member could not be found.',
        image_required: 'Please choose an image file.',
        invalid_nickname: 'Nickname must be 32 characters or fewer.',
        not_found_or_already_released: 'That prisoner was already released.',
        not_a_member: "You're not a member of that server anymore.",
        insufficient_permissions: "You don't have mod access to that server.",
        no_active_guild: 'Pick a server first.',
    };
    return map[code] || 'Something went wrong. Please try again.';
}

function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function cap(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }
function timeOfDayGreeting(){
    const hour = new Date().getHours();
    if (hour < 5) return 'Still up, night owl';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    if (hour < 21) return 'Good evening';
    return 'Good evening';
}
function deltaHtml(delta){
    if (delta === null || delta === undefined) return '—';
    const isUp = delta >= 0;
    const cls = isUp ? '' : 'down';
    return `<span class="${cls}" style="display:inline-flex;align-items:center;gap:3px;">${svg(isUp ? 'trendingUp' : 'trendingDown', 12)}${Math.abs(delta)}</span>`;
}
function timeAgo(ts){
    const diff = Date.now() - Number(ts);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

/* ============================================================
   STARFIELD BACKGROUND
   ============================================================ */
(function(){
    const canvas = document.getElementById('stars');
    const ctx = canvas.getContext('2d');
    let stars = [];
    function resize(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const count = Math.floor((canvas.width * canvas.height) / 9000);
        stars = Array.from({length: count}, () => ({
            x: Math.random()*canvas.width,
            y: Math.random()*canvas.height,
            r: Math.random()*1.2 + 0.2,
            s: Math.random()*0.015 + 0.003,
            o: Math.random()
        }));
    }
    function draw(){
        ctx.clearRect(0,0,canvas.width,canvas.height);
        for(const st of stars){
            st.o += st.s;
            const alpha = (Math.sin(st.o) + 1) / 2 * 0.6 + 0.1;
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, Math.PI*2);
            ctx.fillStyle = `rgba(246,236,217,${alpha})`;
            ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize();
    draw();
})();



/* ============================================================
   INIT
   ============================================================ */
async function initApp(){
    await loadPartials();
    wireBotIdentityButtons();
    // wireCropper(); // cropper temporarily disabled — see wireBotIdentityButtons()
    initSettingsControls();
    renderHousePointControls();
    hydrateStaticIcons();
    initLandingAnimations();
    initTour();
    initWelcomeSheetDrag();
    weAutocompleteInit();
    applyDeepLinkReturnTo();
    bootstrap();
}
initApp();

// Chrome (notably on Android when toggling "Desktop site") can restore this
// page from the back-forward cache instead of doing a real reload. When
// that happens, none of the script above re-runs, so whatever was on
// screen at the moment the page got frozen — including a mid-load login
// gate flash — is what you see, permanently, until a real reload happens.
// The 'pageshow' event with persisted=true is how the platform tells us
// "this is a restore, not a fresh load" — re-run bootstrap() so it
// re-checks the real auth state instead of showing stale UI.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) bootstrap();
});
