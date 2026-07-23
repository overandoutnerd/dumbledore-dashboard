/* ============================================================
   LANDING PAGE — "the castle at night"
   Runs once, after loadPartials() has injected html/landing.html.
   Everything here is scoped to #loginGate and turns itself off
   once the gate is hidden (i.e. the person is signed in), so it
   never wastes cycles once the real app is showing.
   ============================================================ */
function initLandingAnimations(){
    const gate = document.getElementById('loginGate');
    if (!gate) return;

    const gateVisible = () => !gate.classList.contains('login-hidden');

    initLandingSky(gate, gateVisible);
    initLandingEmbers(gate, gateVisible);
    initParallax(gate, gateVisible);
    initScrollProgress(gate, gateVisible);
    initWandTrail(gate, gateVisible);
    initScrollReveal();
    initCardTilt();
    initSortingHat();
    initMagneticButton();
    initSpellClick(gate, gateVisible);
    initDumbledoreMascot();
    initCastleGate();
    initAzkabanFog(gate, gateVisible);
    initAzkabanLock();
}

/* ---- Starfield + moon, drawn once per frame on a background canvas ---- */
function initLandingSky(gate, gateVisible){
    const canvas = document.getElementById('landingSky');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, stars = [];

    function resize(){
        w = canvas.width = gate.offsetWidth;
        h = canvas.height = 620;
        stars = [];
        const count = Math.min(90, Math.floor((w * h) / 9000));
        for (let i = 0; i < count; i++){
            stars.push({
                x: Math.random() * w,
                y: Math.random() * h * .75,
                r: .6 + Math.random() * 1.4,
                phase: Math.random() * Math.PI * 2,
                speed: .6 + Math.random() * .8,
            });
        }
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(t){
        requestAnimationFrame(frame);
        if (!gateVisible()) return;
        ctx.clearRect(0, 0, w, h);

        // moon
        const mx = w * .78, my = 70, mr = 34;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 3.2);
        glow.addColorStop(0, 'rgba(255,247,214,.35)');
        glow.addColorStop(1, 'rgba(255,247,214,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

        // stars twinkle via a sine wave on opacity
        for (const s of stars){
            const tw = .5 + .5 * Math.sin(t / 1000 * s.speed + s.phase);
            ctx.globalAlpha = .3 + tw * .7;
            ctx.fillStyle = '#fff7d6';
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        }

        // faint constellation lines between nearby stars
        ctx.strokeStyle = '#fff7d6';
        ctx.lineWidth = .6;
        for (let i = 0; i < stars.length; i++){
            for (let j = i + 1; j < stars.length; j++){
                const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 70){
                    ctx.globalAlpha = (1 - d / 70) * .3;
                    ctx.beginPath();
                    ctx.moveTo(stars[i].x, stars[i].y);
                    ctx.lineTo(stars[j].x, stars[j].y);
                    ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
}

/* ---- Floating candle embers drifting up through the foreground ---- */
function initLandingEmbers(gate, gateVisible){
    const canvas = document.getElementById('landingEmbers');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const colors = ['#ffd873', '#fca503', '#f6ecd9'];
    let particles = [], w = 0, h = 0;

    function resize(){
        w = canvas.width = gate.offsetWidth;
        h = canvas.height = gate.offsetHeight;
    }
    function spawn(n){
        particles = [];
        for (let i = 0; i < n; i++){
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                r: 1 + Math.random() * 2,
                speed: .12 + Math.random() * .3,
                drift: (Math.random() - .5) * .25,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: .2 + Math.random() * .4,
            });
        }
    }
    resize();
    spawn(Math.min(50, Math.floor((w * h) / 22000)));
    window.addEventListener('resize', () => { resize(); spawn(Math.min(50, Math.floor((w * h) / 22000))); });

    function frame(){
        requestAnimationFrame(frame);
        if (!gateVisible()) return;
        ctx.clearRect(0, 0, w, h);
        for (const p of particles){
            p.y -= p.speed;
            p.x += p.drift;
            if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
}

/* ---- Mouse-move parallax across the three background layers ----
   Plain inline transforms driven imperatively, so there's nothing
   here for any CSS animation to conflict with. */
function initParallax(gate, gateVisible){
    const sky = document.getElementById('landingSky');
    const castle = document.getElementById('landingCastle');
    const embers = document.getElementById('landingEmbers');
    if (!sky || !castle || !embers) return;

    gate.addEventListener('pointermove', (e) => {
        if (!gateVisible()) return;
        const rect = gate.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - .5;
        const py = (e.clientY - rect.top) / rect.height - .5;
        sky.style.transform = `translate(${px * 6}px, ${py * 4}px)`;
        castle.style.transform = `translate(${px * -10}px, ${py * -4}px)`;
        embers.style.transform = `translate(${px * 16}px, ${py * 10}px)`;
    });
}

/* ---- Thin gold progress bar tracking scroll through the landing page ---- */
function initScrollProgress(gate, gateVisible){
    const bar = document.getElementById('landingProgress');
    if (!bar) return;
    gate.addEventListener('scroll', () => {
        if (!gateVisible()) return;
        const max = gate.scrollHeight - gate.clientHeight;
        const pct = max > 0 ? (gate.scrollTop / max) * 100 : 0;
        bar.style.width = pct + '%';
    });
}

/* ---- Sparkle trail that follows the cursor / finger ---- */
function initWandTrail(gate, gateVisible){
    let last = 0;
    function spark(x, y){
        const now = Date.now();
        if (now - last < 40) return; // throttle so it doesn't flood the DOM
        last = now;
        const el = document.createElement('div');
        el.className = 'wand-spark';
        el.style.left = (x - 2.5) + 'px';
        el.style.top = (y - 2.5) + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 650);
    }
    gate.addEventListener('pointermove', (e) => {
        if (!gateVisible()) return;
        spark(e.clientX, e.clientY);
    });
}

/* ---- Fade/slide elements in as they scroll into view, igniting each
   feature icon like a torch catching as it appears ---- */
function initScrollReveal(){
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length || !('IntersectionObserver' in window)){
        els.forEach(el => {
            el.classList.add('in-view');
            el.querySelector('.ficon')?.classList.add('lit');
        });
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const group = el.parentElement.classList.contains('landing-features')
                ? [...el.parentElement.children].indexOf(el) : 0;
            el.style.transitionDelay = (group * 80) + 'ms';
            el.classList.add('in-view');
            const ficon = el.querySelector('.ficon');
            if (ficon) setTimeout(() => ficon.classList.add('lit'), group * 80);
            io.unobserve(el);
        });
    }, { threshold: .15 });
    els.forEach(el => io.observe(el));
}

/* ---- Gentle 3D tilt on feature cards, following the pointer ---- */
function initCardTilt(){
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - .5;
            const py = (e.clientY - rect.top) / rect.height - .5;
            card.style.transform = `perspective(600px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 7).toFixed(2)}deg) translateY(-2px)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
}

/* ---- Magnetic pull on the main CTA: it drifts slightly toward the cursor ---- */
function initMagneticButton(){
    const btn = document.getElementById('ctaBtn');
    if (!btn) return;
    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * .25;
        const y = (e.clientY - rect.top - rect.height / 2) * .35;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
}

/* ---- Playful Sorting Hat mini-widget (client-side only, just for fun) ---- */
function initSortingHat(){
    const hat = document.getElementById('swHat');
    const sortBtn = document.getElementById('swSortBtn');
    const againBtn = document.getElementById('swAgainBtn');
    const crestsWrap = document.getElementById('swCrests');
    const result = document.getElementById('swResult');
    const resultIcon = document.getElementById('swResultIcon');
    const resultHouse = document.getElementById('swResultHouse');
    const resultLine = document.getElementById('swResultLine');
    if (!hat || !sortBtn) return;

    const lines = {
        gryffindor: "Brave at heart, first to volunteer, last to back down.",
        ravenclaw:  "Clever and curious — you'd rather understand it than be told.",
        hufflepuff: "Loyal to the bone, and the first to notice when someone's left out.",
        slytherin:  "Ambitious and resourceful — you find the way, whatever it takes.",
    };

    function pickHouse(){
        const houses = Object.keys(HOUSE_META);
        return houses[Math.floor(Math.random() * houses.length)];
    }

    sortBtn.addEventListener('click', () => {
        sortBtn.disabled = true;
        result.classList.add('login-hidden');
        crestsWrap.querySelectorAll('.sw-crest').forEach(c => c.classList.remove('picked'));
        hat.classList.add('sorting');

        // flicker through the crests for a bit of suspense before landing on one
        let ticks = 0;
        const flicker = setInterval(() => {
            crestsWrap.querySelectorAll('.sw-crest').forEach(c => c.classList.remove('picked'));
            const houses = crestsWrap.querySelectorAll('.sw-crest');
            houses[Math.floor(Math.random() * houses.length)].classList.add('picked');
            ticks++;
            if (ticks > 10){
                clearInterval(flicker);
                const house = pickHouse();
                crestsWrap.querySelectorAll('.sw-crest').forEach(c => c.classList.remove('picked'));
                const chosenEl = crestsWrap.querySelector(`[data-house="${house}"]`);
                if (chosenEl) chosenEl.classList.add('picked');

                hat.classList.remove('sorting');
                const meta = HOUSE_META[house];
                resultIcon.innerHTML = `<span data-icon="${meta.icon}" data-size="18"></span>`;
                resultIcon.style.setProperty('--house-color', meta.color);
                resultIcon.style.setProperty('--house-bg', meta.bg);
                resultHouse.textContent = meta.name;
                resultHouse.style.color = meta.color;
                resultLine.textContent = lines[house];
                result.classList.remove('login-hidden');
                hydrateStaticIcons(resultIcon);
                sortBtn.disabled = false;
                dumbledoreReactToHouse(house);
                lightHallBanner(house);
            }
        }, 110);
    });

    if (againBtn){
        againBtn.addEventListener('click', () => {
            result.classList.add('login-hidden');
            crestsWrap.querySelectorAll('.sw-crest').forEach(c => c.classList.remove('picked'));
        });
    }
}

/* ---- Click-to-cast: clicking empty background space (not a real
   control) casts a little spell — a burst of sparks radiating out
   from wherever you tapped. ---- */
function initSpellClick(gate, gateVisible){
    gate.addEventListener('click', (e) => {
        if (!gateVisible()) return;
        if (e.target.closest('a, button, .feature-card, .sw-crest, .dumble-mascot-wrap, iconify-icon')) return;
        spawnSpellBurst(e.clientX, e.clientY);
    });
}

function spawnSpellBurst(x, y){
    const count = 10;
    for (let i = 0; i < count; i++){
        const angle = (Math.PI * 2 * i) / count + Math.random() * .4;
        const dist = 30 + Math.random() * 34;
        const el = document.createElement('div');
        el.className = 'spell-burst-particle';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
        el.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 720);
    }
}

/* ---- Interactive Dumbledore mascot ----
   Click him for a new bit of (original, not-quoted-from-anywhere)
   wisdom. He also chimes in once the Sorting Hat gives you a house. */
const DUMBLE_QUOTES = [
    "Curiosity is not a sin, though we would all do well to exercise a little caution with it. Click again, if you like.",
    "It takes a great deal of bravery to stand up to one's enemies — but just as much to click a small button out of idle curiosity.",
    "Happiness can be found even in the darkest of settings menus, if one only remembers to configure the logging toggle.",
    "I find a little mischief, managed properly, keeps a castle — and a Discord server — running rather well.",
    "Even the wisest of moderators cannot see all ends. That is rather the point of the Recent Activity feed.",
    "Every point earned for one's house is a point earned for the whole castle. Do check the standings now and then.",
    "I have always found that Sorting Hats, much like dashboards, are considerably more accurate than they first appear.",
    "It is our settings, far more than our defaults, that show what we truly are.",
    "Ah — a visitor. How delightfully unpredictable of you, to click on a wizard.",
    "There is some good in this world, and it is worth toggling on.",
];

const DUMBLE_HOUSE_LINES = {
    gryffindor: "Gryffindor! Bravery suits you rather well — though I'd hope the Azkaban list doesn't test it too soon.",
    ravenclaw:  "Ravenclaw. Somehow I suspect you've already read the Settings tab twice.",
    hufflepuff: "Hufflepuff — loyal, and rather good at noticing when the Welcome messages need updating.",
    slytherin:  "Slytherin. Ambitious enough to want Manage Roles permission, I'd wager.",
};

let dumbleQuoteIndex = -1;
let dumbleHideTimer = null;

function initDumbledoreMascot(){
    const btn = document.getElementById('dumbleAvatarBtn');
    const bubble = document.getElementById('dumbleBubble');
    if (!btn || !bubble) return;

    btn.addEventListener('click', () => {
        dumbleQuoteIndex = (dumbleQuoteIndex + 1) % DUMBLE_QUOTES.length;
        showDumbleLine(DUMBLE_QUOTES[dumbleQuoteIndex]);
        nodDumbledore();
    });
}

function showDumbleLine(text){
    const bubble = document.getElementById('dumbleBubble');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.remove('login-hidden');
    // restart the entrance animation each time so repeated clicks still feel responsive
    bubble.style.animation = 'none';
    void bubble.offsetWidth; // eslint-disable-line no-unused-expressions -- forces reflow so the animation restarts
    bubble.style.animation = '';

    clearTimeout(dumbleHideTimer);
    dumbleHideTimer = setTimeout(() => bubble.classList.add('login-hidden'), 6000);
}

function nodDumbledore(){
    const btn = document.getElementById('dumbleAvatarBtn');
    if (!btn) return;
    btn.classList.remove('dumble-nod');
    void btn.offsetWidth;
    btn.classList.add('dumble-nod');
    setTimeout(() => btn.classList.remove('dumble-nod'), 500);

    const wand = document.getElementById('dumbleWand');
    if (wand){
        const rect = wand.getBoundingClientRect();
        spawnSpellBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
}

/* ---- Light up the matching banner in the Great Hall once the
   Sorting Hat has given a result ---- */
function lightHallBanner(house){
    const banners = document.querySelectorAll('.hall-banner');
    banners.forEach(b => b.classList.toggle('lit', b.dataset.house === house));
}

/* ---- Castle gate entrance: remove it from the DOM once it's
   finished swinging open, so it isn't sitting there doing nothing ---- */
function initCastleGate(){
    const gate = document.getElementById('castleGate');
    if (!gate) return;
    setTimeout(() => gate.remove(), 1500);
}

/* ---- Slow grey fog drifting through the Azkaban scene ---- */
function initAzkabanFog(pageGate, pageGateVisible){
    const canvas = document.getElementById('azkabanFog');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let puffs = [], w = 0, h = 0;
    const section = canvas.closest('.azkaban-scene');

    function inView(){
        if (!pageGateVisible()) return false;
        const r = section.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
    }
    function resize(){
        w = canvas.width = section.offsetWidth;
        h = canvas.height = section.offsetHeight;
        puffs = [];
        const count = Math.min(10, Math.floor(w / 140));
        for (let i = 0; i < count; i++){
            puffs.push({
                x: Math.random() * w,
                y: h * .4 + Math.random() * h * .6,
                r: 40 + Math.random() * 60,
                speed: .06 + Math.random() * .08,
                alpha: .04 + Math.random() * .05,
            });
        }
    }
    resize();
    window.addEventListener('resize', resize);

    function frame(){
        requestAnimationFrame(frame);
        if (!inView()) return;
        ctx.clearRect(0, 0, w, h);
        for (const p of puffs){
            p.x += p.speed;
            if (p.x - p.r > w) p.x = -p.r;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            g.addColorStop(0, `rgba(180,190,210,${p.alpha})`);
            g.addColorStop(1, 'rgba(180,190,210,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
    }
    requestAnimationFrame(frame);
}

/* ---- The Azkaban lock just rattles for effect when tapped — no
   real function, just flavor ---- */
function initAzkabanLock(){
    const btn = document.getElementById('azkabanLockBtn');
    if (!btn) return;
    let unlocked = false;
    btn.addEventListener('click', () => {
        unlocked = !unlocked;
        btn.classList.remove('rattle');
        void btn.offsetWidth;
        btn.classList.add('rattle');
        // hydrateStaticIcons already swapped the original data-icon span for
        // a real <svg> by the time this runs, so we regenerate the markup
        // directly with the svg() helper rather than trying to re-hydrate.
        const current = btn.querySelector('svg, iconify-icon');
        if (current) current.outerHTML = svg(unlocked ? 'unlock' : 'lock', 20);
    });
}

function dumbledoreReactToHouse(house){
    const line = DUMBLE_HOUSE_LINES[house];
    if (!line) return;
    showDumbleLine(line);
    nodDumbledore();
}
