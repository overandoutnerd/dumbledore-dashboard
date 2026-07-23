/* ============================================================
   HTML PARTIALS LOADER
   The page body below only contains empty mount points (e.g.
   <div id="mount-landing"></div>). This fetches the matching
   fragment from /html/*.html and drops its markup in, so each
   section of the UI lives in its own file under public/html/.
   initApp() (see app.js) awaits loadPartials() before running
   anything that touches these elements (dropdowns, bot identity
   buttons, the login gate, etc).
   ============================================================ */
const PARTIALS = [
    ['mount-landing',        'html/landing.html'],
    ['mount-server-picker',  'html/server-picker.html'],
    ['mount-sidebar',        'html/sidebar.html'],
    ['mount-topbar',         'html/topbar.html'],
    ['mount-tab-home',       'html/tab-home.html'],
    ['mount-tab-commands',   'html/tab-commands.html'],
    ['mount-tab-bot',        'html/tab-bot.html'],
    ['mount-tab-interviews', 'html/tab-interviews.html'],
    ['mount-tab-settings',   'html/tab-settings.html'],
    ['mount-bottom-nav',     'html/bottom-nav.html'],
    ['mount-overlays',       'html/overlays.html'],
    ['mount-tour',           'html/tour.html'],
];

async function loadPartials(){
    await Promise.all(PARTIALS.map(async ([mountId, url]) => {
        const mount = document.getElementById(mountId);
        if (!mount) return;
        const res = await fetch(url);
        mount.innerHTML = await res.text();
    }));
}
