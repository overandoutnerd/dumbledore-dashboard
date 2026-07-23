/* ============================================================
   API-WIRED DASHBOARD SCRIPT
   Talks to the dashboard-server backend (Discord OAuth + the
   bot's live Postgres database). No mock data below this line.
   ============================================================ */

/* ── Lock the main page's scroll while any modal overlay is open ────
   Disabled — background scroll should stay active even while the
   welcome message form (or any other overlay) is open. Left commented
   instead of deleted in case this needs to come back later.
(function initModalScrollLock(){
    const overlaySelector = '.confirm-overlay, .crop-overlay';
    const openSelector = '.confirm-overlay.show, .crop-overlay.show';
    const syncLock = () => {
        const anyOpen = document.querySelector(openSelector);
        document.body.classList.toggle('modal-open', !!anyOpen);
    };
    const observer = new MutationObserver(syncLock);
    document.querySelectorAll(overlaySelector).forEach(el => {
        observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
    syncLock();
})();
*/

/* ---- SVG ICON SYSTEM ----
   Icon shapes are sourced live from Lucide (https://lucide.dev), loaded
   via the <script src="https://unpkg.com/lucide"> tag above. This map
   only translates our own semantic names to Lucide's real icon names —
   no path data is hand-drawn here. */
const LUCIDE_ICON_NAMES = {
    home: 'Home',
    message: 'MessageCircle',
    azkaban: 'Lock',
    trophy: 'Trophy',
    calendar: 'Calendar',
    join: 'UserPlus',
    leave: 'LogOut',
    edit: 'Pencil',
    camera: 'Camera',
    image: 'Image',
    undo: 'Undo2',
    close: 'X',
    closeCircle: 'XCircle',
    checkCircle: 'CheckCircle2',
    play: 'Play',
    flame: 'Flame',
    check: 'Check',
    alert: 'AlertTriangle',
    search: 'Search',
    star: 'Star',
    shield: 'Shield',
    wand: 'Wand2',
    globe: 'Globe',
    landmark: 'Landmark',
    users: 'Users',
    crown: 'Crown',
    folder: 'Folder',
    clipboard: 'Clipboard',
    plus: 'Plus',
    minus: 'Minus',
    trendingUp: 'TrendingUp',
    trendingDown: 'TrendingDown',
    rocket: 'Rocket',
    sortinghat: 'GraduationCap',
    moon: 'Moon',
    inbox: 'Inbox',
    power: 'Power',
    book: 'BookOpen',
    settings: 'Settings',
    bot: 'Bot',
    key: 'Key',
    barChart: 'BarChart3',
    chevronDown: 'ChevronDown',
    chevronRight: 'ChevronRight',
    chevronLeft: 'ChevronLeft',
    arrowRight: 'ArrowRight',
    lock: 'Lock',
    unlock: 'Unlock',
    hash: 'Hash',
    scroll: 'ScrollText',
    smile: 'Smile',
    reply: 'CornerUpLeft',
    paperclip: 'Paperclip',
};

function lucideNodeToInnerSvg(iconNode){
    return iconNode.map(([tag, attrs]) => {
        const attrStr = Object.entries(attrs)
            .map(([k, v]) => `${k}="${v}"`)
            .join(' ');
        return `<${tag} ${attrStr}/>`;
    }).join('');
}

/* Lucide doesn't ship lion/eagle/badger/snake, so these four house
   emblems are hand-drawn to match Lucide's own visual grammar
   (24x24 grid, 2px stroke, round caps/joins) rather than sourced
   from the library. Everything else in the app comes from Lucide. */
/* House emblems come from Iconify's "game-icons" collection (mirrors
   game-icons.net, CC BY 3.0 by Lorc & Delapouite) — Lucide has no
   lion/eagle/badger/snake, but these are exact matches for real animals,
   rendered via <iconify-icon> instead of an inline <svg>. */
const GAME_ICON_NAMES = {
    lion: 'game-icons:lion',
    eagle: 'game-icons:eagle-head',
    badger: 'game-icons:badger',
    snake: 'game-icons:snake',
};

function svg(name, size){
    const s = size || 16;
    if (GAME_ICON_NAMES[name]) {
        return `<iconify-icon class="icon" icon="${GAME_ICON_NAMES[name]}" width="${s}" height="${s}" style="color:currentColor;"></iconify-icon>`;
    }
    const lucideName = LUCIDE_ICON_NAMES[name];
    const iconNode = lucideName && window.lucide && window.lucide.icons[lucideName];
    const inner = iconNode ? lucideNodeToInnerSvg(iconNode) : '';
    return `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

function hydrateStaticIcons(root){
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
        const name = el.getAttribute('data-icon');
        const size = el.getAttribute('data-size') || 14;
        const extraClasses = Array.from(el.classList);
        const temp = document.createElement('div');
        temp.innerHTML = svg(name, Number(size));
        const svgEl = temp.firstElementChild;
        extraClasses.forEach(c => svgEl.classList.add(c));
        // Carry over any non-class/non-data attributes (e.g. id, title) too.
        Array.from(el.attributes).forEach(attr => {
            if (attr.name === 'class' || attr.name === 'data-icon' || attr.name === 'data-size') return;
            svgEl.setAttribute(attr.name, attr.value);
        });
        el.replaceWith(svgEl);
    });
}

