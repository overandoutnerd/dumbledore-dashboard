/* ============================================================
   GUIDED TOUR — "shown around by Albus Dumbledore"
   Starts automatically the first time a moderator signs in
   (tracked in localStorage), and can be replayed anytime via
   startTour() — e.g. wired to a "Take the tour" button in
   Settings.
   Each step names a `tab` (so the tour can switch panels as it
   goes) and a `target` CSS selector to spotlight; steps with no
   target are shown centered (used for the intro/outro).
   ============================================================ */
const TOUR_STEPS = [
    {
        line: "Ah, hello there. Albus Dumbledore, at your service — and it looks like you've just been trusted with the keys to this castle. Let me show you where everything actually lives.",
    },
    {
        tab: 'home',
        target: '.stat-grid',
        line: "Home gives you the view from the highest window — members, message activity, who's in Azkaban, and the current House Cup leader, all at a glance.",
    },
    {
        tab: 'home',
        target: '#analyticsCard',
        line: "For the deeper numbers, Message Activity tracks today, this week, and this month, with a two-week trend underneath — pulled live, updated roughly every 30 minutes.",
    },
    {
        tab: 'home',
        target: '#houseCupCard',
        line: "The House Cup standings live here, straight from the same ledger the bot writes to when members earn points. Four houses, one running total, no mock numbers.",
    },
    {
        tab: 'home',
        target: '#azkabanCard',
        line: "Azkaban Watch. Sentence someone here and they genuinely lose their roles in Discord — this is connected to the real thing, not just a list, so handle it kindly.",
    },
    {
        tab: 'home',
        target: '#recentActivityCard',
        line: "Recent Activity keeps a running log of what's happened in the server — joins, leaves, sentences, points awarded — so you're never digging through Discord's audit log to piece it together.",
    },
    {
        tab: 'bot',
        target: '#identityCard',
        line: "Over in Wand & Robes, this is my avatar and banner in this server. Change either one from right here and it goes through Discord's real API — exactly as if you'd uploaded it there yourself.",
    },
    {
        tab: 'settings',
        target: '#row-logs',
        line: "Logging keeps a record of message edits and deletes, joins, leaves, bans, and role changes. This flips the whole system on or off.",
    },
    {
        tab: 'settings',
        target: '#row-starboard',
        line: "The Starboard pins messages that earn enough star reactions into a showcase channel — a nice way to surface the best of the server.",
    },
    {
        tab: 'settings',
        target: '#row-sortinghat',
        line: "Sorting Hat lets members run /sortme themselves and get placed into a house on their own. Turn it off if you'd rather sort people by hand.",
    },
    {
        tab: 'settings',
        target: '#row-azkaban-toggle',
        line: "This is what actually powers the prison system you saw back on Home — sentencing only works if this one's switched on.",
    },
    {
        tab: 'settings',
        target: '#row-bump',
        line: "Bump Thank System thanks whoever bumps the server and reminds them once the cooldown ends, so the server keeps getting relisted without anyone forgetting.",
    },
    {
        tab: 'settings',
        target: '#row-welcome',
        line: "And this turns Welcome Messages on or off — greeting new witches and wizards automatically the moment they arrive.",
    },
    {
        tab: 'settings',
        target: '.we-add-btn',
        line: "Add a few messages of your own here and the bot picks one at random for each new arrival. Leave it empty and it falls back to a built-in rotation instead.",
    },
    {
        tab: 'settings',
        target: '#guildBadge',
        line: "One more thing worth knowing — if you moderate more than one server, this badge lets you switch between them without signing out.",
    },
    {
        line: "That's everything that matters day to day. All of it reads and writes the same live database the bot uses, so nothing you've just seen is ever only for show. Off you go, then — mischief managed.",
    },
];

const TOUR_STORAGE_KEY = 'dumbledoreTourSeen';
let tourState = { index: 0, active: false };
let tourTrackingHandle = null;

function initTour(){
    const skipBtn = document.getElementById('tourSkipBtn');
    const nextBtn = document.getElementById('tourNextBtn');
    const backBtn = document.getElementById('tourBackBtn');
    const closeBtn = document.getElementById('tourCloseBtn');
    if (!nextBtn) return;

    nextBtn.addEventListener('click', () => {
        if (tourState.index >= TOUR_STEPS.length - 1) { endTour(); return; }
        tourState.index++;
        renderTourStep();
    });
    backBtn.addEventListener('click', () => {
        if (tourState.index <= 0) return;
        tourState.index--;
        renderTourStep();
    });
    skipBtn.addEventListener('click', endTour);
    closeBtn.addEventListener('click', endTour);

    // Auto-start once per browser, only after we know sign-in actually
    // succeeded (bootstrap() calls maybeAutoStartTour() once the app is
    // showing — see auth.js).
}

function maybeAutoStartTour(){
    let seen = null;
    try { seen = localStorage.getItem(TOUR_STORAGE_KEY); } catch (e) { /* storage may be unavailable (private mode etc.) — just skip auto-start */ }
    if (seen) return;
    startTour();
}

function startTour(){
    tourState = { index: 0, active: true };
    document.getElementById('tourOverlay').classList.remove('login-hidden');
    lockBackgroundScroll();
    renderTourStep();
}

function endTour(){
    tourState.active = false;
    stopSpotlightTracking();
    unlockBackgroundScroll();
    document.getElementById('tourOverlay').classList.add('login-hidden');
    clearTourHighlight();
    try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
}

function clearTourHighlight(){
    document.querySelectorAll('.tour-highlighted').forEach(el => el.classList.remove('tour-highlighted'));
}

/* Picks the first match for `selector` that's actually rendered.
   Needed because things like .nav-btn[data-tab="home"] exist twice in
   the DOM (once in the desktop sidebar, once in the mobile bottom-nav)
   and only one copy is visible at any given screen width. */
function findVisibleTarget(selector){
    const candidates = document.querySelectorAll(selector);
    for (const el of candidates){
        if (el.offsetParent !== null) return el;
    }
    return null;
}

/* ---- Background scroll lock ----
   We don't touch `overflow` on <body>/<html>, because that would also
   block the tour's own target.scrollIntoView() call below (which relies
   on a genuinely scrollable ancestor). Instead we just swallow the
   *input* events that cause scrolling — wheel/touch/arrow keys — while
   letting anything inside the tour card itself through, and programmatic
   scrollIntoView is untouched either way since it never fires those
   events in the first place. */
const TOUR_SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

function preventBackgroundScroll(e){
    if (e.target.closest && e.target.closest('.tour-card')) return;
    e.preventDefault();
}
function preventScrollKeys(e){
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (TOUR_SCROLL_KEYS.has(e.key)) e.preventDefault();
}
function lockBackgroundScroll(){
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false });
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    document.addEventListener('keydown', preventScrollKeys);
}
function unlockBackgroundScroll(){
    document.removeEventListener('touchmove', preventBackgroundScroll);
    document.removeEventListener('wheel', preventBackgroundScroll);
    document.removeEventListener('keydown', preventScrollKeys);
}

function renderTourStep(){
    const step = TOUR_STEPS[tourState.index];
    if (step.tab) switchTab(step.tab);

    document.getElementById('tourLine').textContent = step.line;
    document.getElementById('tourStepLabel').textContent = `Step ${tourState.index + 1} of ${TOUR_STEPS.length}`;
    document.getElementById('tourBackBtn').classList.toggle('login-hidden', tourState.index === 0);
    document.getElementById('tourNextBtn').textContent = tourState.index === TOUR_STEPS.length - 1 ? 'Finish' : 'Next';

    const dotsWrap = document.getElementById('tourDots');
    dotsWrap.innerHTML = TOUR_STEPS.map((_, i) => `<span class="tour-dot${i === tourState.index ? ' active' : ''}"></span>`).join('');

    positionTourSpotlight();
}

function positionTourSpotlight(){
    const step = TOUR_STEPS[tourState.index];
    const spotlight = document.getElementById('tourSpotlight');
    const card = document.getElementById('tourCard');
    clearTourHighlight();
    stopSpotlightTracking();

    // Selectors like .nav-btn[data-tab="home"] match BOTH the desktop
    // sidebar and the mobile bottom-nav — only one is actually visible
    // at a given screen width, so we scan all matches for the first
    // one that's actually rendered rather than blindly taking the
    // first DOM match.
    const target = step.target ? findVisibleTarget(step.target) : null;
    if (!target){
        spotlight.classList.add('tour-no-target');
        card.style.top = '50%';
        card.style.left = '50%';
        card.style.transform = 'translate(-50%, -50%)';
        return;
    }

    target.classList.add('tour-highlighted');
    target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });

    // Dashboard panels load their content asynchronously (member counts,
    // the sparkline, house standings, etc.), which keeps shifting page
    // height for a bit after the tab switch — and scrollIntoView's own
    // smooth-scroll animation takes time too. A single measurement taken
    // some fixed delay after switching tabs was landing on stale
    // coordinates once the layout had moved on (this is what made the
    // spotlight land on the wrong section). Instead we keep re-measuring
    // every frame for as long as this step is showing, so the spotlight
    // and card track the target wherever it actually ends up.
    card.style.transform = 'none';
    trackSpotlight(target, spotlight, card);
}

function trackSpotlight(target, spotlight, card){
    function tick(){
        if (!tourState.active) return;
        if (!document.body.contains(target)){ stopSpotlightTracking(); return; }
        updateSpotlightPosition(target, spotlight, card);
        tourTrackingHandle = requestAnimationFrame(tick);
    }
    tick();
}

function stopSpotlightTracking(){
    if (tourTrackingHandle) cancelAnimationFrame(tourTrackingHandle);
    tourTrackingHandle = null;
}

function updateSpotlightPosition(target, spotlight, card){
    const rect = target.getBoundingClientRect();
    const pad = 8;
    spotlight.classList.remove('tour-no-target');
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';

    const cardWidth = card.offsetWidth || 340;
    const cardHeight = card.offsetHeight || 180;
    const margin = 14;
    const vw = window.innerWidth, vh = window.innerHeight;

    // We scroll the target to the top of the viewport above, so there's
    // reliably more room below it than above — prefer that. Only fall
    // back to placing the card above the target if it genuinely fits
    // there without being clamped (otherwise we'd end up overlapping the
    // very thing we're trying to point at, at the top of the screen).
    let top = rect.bottom + margin;
    if (top + cardHeight > vh - margin){
        const above = rect.top - cardHeight - margin;
        top = above >= margin ? above : Math.max(margin, vh - margin - cardHeight);
    }
    let left = rect.left + rect.width / 2 - cardWidth / 2;
    left = Math.min(Math.max(left, margin), vw - cardWidth - margin);

    card.style.top = top + 'px';
    card.style.left = left + 'px';
}
