/* ============================================================
   INTERVIEWS — reached from Settings → "Interviews" row, not a
   top-level nav tab. Two sub-screens sharing the SPA's normal shell
   (topbar/sidebar/background): the list (#panel-interviews) and a
   transcript view (#panel-interview-detail), rendered Discord-style
   via renderInterviewTranscript() in transcript-render.js.
   ============================================================ */
let interviewsCache = [];

async function loadInterviews() {
    try {
        const { interviews } = await api('/api/interviews');
        interviewsCache = interviews;
        renderInterviews(interviews);
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadInterviews failed', err);
    }
}

function renderInterviews(interviews) {
    document.getElementById('interviewCount').textContent =
        `${interviews.length} interview${interviews.length===1?'':'s'}`;

    if (interviews.length === 0) {
        document.getElementById('interviewList').innerHTML =
            `<div class="empty-state"><div class="eicon-wrap">${svg('scroll',22)}</div><p>No interviews yet. Run /interview in Discord to open one.</p></div>`;
        return;
    }

    document.getElementById('interviewList').innerHTML = interviews.map(i => {
        const isClosed = i.status === 'closed';
        const timeLine = isClosed
            ? `Closed ${timeAgo(i.closedAt)}`
            : `Opened ${timeAgo(i.openedAt)}`;

        const inner = `
            <div class="feed-icon">${svg('message',14)}</div>
            <div class="feed-body">
                <div class="ftitle">Interview #${i.number} — <b>${escapeHtml(i.target.username)}</b></div>
                <div class="ftime">By ${escapeHtml(i.creator.username)} · ${timeLine}</div>
            </div>
            ${isClosed
                ? `<span class="settings-link-chevron" data-icon="chevronRight" data-size="16"></span>`
                : `<span class="meta-pill">${svg('play',10)} In progress</span>`}
        `;

        return isClosed
            ? `<button class="interview-row" onclick="openInterviewDetail('${i.publicId}')">${inner}</button>`
            : `<div class="interview-row interview-row-open">${inner}</div>`;
    }).join('');
}

/* ---- Sub-screen navigation ----
   These panels aren't tied to a nav-btn (Interviews isn't a top-level
   tab), so switching to them keeps "Settings" highlighted in the nav —
   conceptually you're still inside Settings, just a level deeper. */
function openSubPanel(panelId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'settings'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openInterviewsScreen(opts = {}) {
    openSubPanel('panel-interviews');
    if (!opts.skipHistory && window.location.pathname !== '/interviews') {
        history.pushState({ view: 'interviews' }, '', '/interviews');
    }
}

function backToSettings() {
    switchTab('settings');
}

function backToInterviewsList() {
    openInterviewsScreen();
}

async function openInterviewDetail(publicId, opts = {}) {
    openSubPanel('panel-interview-detail');

    const path = `/interviews/${encodeURIComponent(publicId)}`;
    if (!opts.skipHistory && window.location.pathname !== path) {
        history.pushState({ view: 'interview-detail', publicId }, '', path);
    }

    const titleEl = document.getElementById('interviewDetailTitle');
    const subtitleEl = document.getElementById('interviewDetailSubtitle');
    const bodyEl = document.getElementById('interviewDetailBody');

    titleEl.textContent = 'Loading…';
    subtitleEl.textContent = '';
    bodyEl.innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('scroll',22)}</div><p>Fetching the transcript…</p></div>`;

    try {
        const payload = await api(`/api/interviews/${encodeURIComponent(publicId)}`);
        const cached = interviewsCache.find(i => i.publicId === publicId);

        titleEl.textContent = cached
            ? `Interview #${payload.interviewNumber} — ${cached.target.username}`
            : `Interview #${payload.interviewNumber}`;
        subtitleEl.textContent = cached
            ? `Opened by ${cached.creator.username}`
            : '';

        if (payload.data) {
            bodyEl.innerHTML = renderInterviewTranscript(payload.data);
            hydrateStaticIcons(bodyEl);
        } else if (payload.legacyHtml) {
            // Legacy transcript closed before structured data existed —
            // still viewable, just not in the Discord-style layout.
            bodyEl.innerHTML = `
                <div class="empty-state" style="margin-bottom:12px;">
                    <p>This transcript was recorded before the newer format — showing the original layout below.</p>
                </div>
                <iframe sandbox="allow-same-origin" referrerpolicy="no-referrer" style="width:100%;min-height:70vh;border:1px solid var(--card-border);border-radius:14px;background:#14151a;"></iframe>
            `;
            bodyEl.querySelector('iframe').srcdoc = payload.legacyHtml;
        } else {
            bodyEl.innerHTML = `<div class="empty-state"><p>This interview doesn't have a saved transcript.</p></div>`;
        }
    } catch (err) {
        titleEl.textContent = 'Interview';
        subtitleEl.textContent = '';
        const message = err.message === 'missing_permission'
            ? "You don't have permission to view this transcript."
            : "Couldn't load this transcript. Please try again.";
        bodyEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
    }
}
