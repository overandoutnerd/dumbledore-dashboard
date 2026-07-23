/* ============================================================
   HOME TAB
   ============================================================ */
async function renderHome() {
    try {
        const [stats, houses, leaderboard, azkaban, activity, overview] = await Promise.all([
            api('/api/stats'),
            api('/api/houses'),
            api('/api/leaderboard?limit=5'),
            api('/api/azkaban'),
            api('/api/activity'),
            api('/api/analytics/overview'),
        ]);

        document.getElementById('statMembers').textContent = stats.memberCount ?? '—';
        document.getElementById('statMessages').textContent = stats.messagesLast7Days ?? '—';
        document.getElementById('statPrisoners').textContent = stats.activePrisoners ?? 0;
        document.getElementById('statLeader').innerHTML = stats.houseLeader
            ? `${cap(stats.houseLeader.house)}`
            : '—';

        document.getElementById('statMembersDelta').innerHTML =
            overview.members.weeklyGrowth == null ? 'no data yet' : deltaHtml(overview.members.weeklyGrowth) + ' this week';
        document.getElementById('statMessagesDelta').innerHTML = deltaHtml(stats.messagesWeekDelta) + ' vs previous 7 days';
        document.getElementById('statPrisonersDelta').textContent = azkaban.active.length > 0 ? 'active now' : 'all clear';
        document.getElementById('statPrisonersDelta').classList.toggle('down', azkaban.active.length > 0);
        document.getElementById('statLeaderDelta').textContent = stats.houseLeader ? `${stats.houseLeader.points} points` : '—';

        renderHouseCup(houses.houses);
        renderLeaderboard(leaderboard.leaderboard);
        renderAzkaban(azkaban);
        renderActivity(activity.activity);
        renderAnalytics(overview);
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('renderHome failed', err);
    }
}

function renderAnalytics(overview){
    document.getElementById('anMsgToday').textContent = overview.messages.today;
    document.getElementById('anMsgWeek').textContent = overview.messages.thisWeek;
    document.getElementById('anMsgMonth').textContent = overview.messages.thisMonth;

    document.getElementById('growthWeek').textContent = overview.members.weeklyGrowth == null ? 'not enough data' : `${overview.members.weeklyGrowth >= 0 ? '+' : ''}${overview.members.weeklyGrowth}`;
    document.getElementById('growthMonth').textContent = overview.members.monthlyGrowth == null ? 'not enough data' : `${overview.members.monthlyGrowth >= 0 ? '+' : ''}${overview.members.monthlyGrowth}`;
    document.getElementById('growthJoins').textContent = overview.members.totalJoins;
    document.getElementById('growthLeaves').textContent = overview.members.totalLeaves;

    if (overview.topCommands.length === 0) {
        document.getElementById('topCommandsList').innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('wand',22)}</div><p>No command usage recorded yet.</p></div>`;
    } else {
        const max = Math.max(...overview.topCommands.map(c => c.totalExecutions), 1);
        document.getElementById('topCommandsList').innerHTML = overview.topCommands.map((c, i) => `
            <div class="top-cmd-row">
                <div class="top-cmd-rank">${i+1}</div>
                <div class="top-cmd-name">/${c.commandName}</div>
                <div class="top-cmd-count">${c.totalExecutions} uses</div>
            </div>
        `).join('');
    }

    loadMessageSparkline();
}

async function loadMessageSparkline(){
    try {
        const { graph } = await api('/api/analytics/messages/daily?days=14');
        const el = document.getElementById('msgSparkline');
        if (graph.length === 0) {
            el.innerHTML = `<p class="no-params">No message data recorded yet.</p>`;
            return;
        }
        const max = Math.max(...graph.map(g => g.count), 1);
        el.innerHTML = graph.map(g => {
            const h = Math.max(3, Math.round((g.count / max) * 56));
            const d = new Date(g.date).toLocaleDateString(undefined, { month:'short', day:'numeric' });
            return `<div class="spark-bar ${g.count===0?'empty':''}" style="height:${h}px;" title="${d}: ${g.count} messages"></div>`;
        }).join('');
    } catch {}
}

function renderHouseCup(houses) {
    const maxPts = Math.max(...houses.map(h => h.points), 1);
    document.getElementById('houseCupList').innerHTML = houses.map((h,i) => {
        const meta = HOUSE_META[h.house] || { name: cap(h.house), icon:'shield', color:'#daa520', bg:'rgba(218,165,32,.15)' };
        return `
        <div class="house-row">
            <div class="house-rank">${i+1}</div>
            <div class="house-emoji" style="background:${meta.bg};">${svg(meta.icon, 16)}</div>
            <div class="house-info">
                <div class="hname">${meta.name}</div>
                <div class="house-bar-track"><div class="house-bar-fill" style="width:${(h.points/maxPts*100)}%; background:${meta.color};"></div></div>
            </div>
            <div class="house-pts">${h.points} pts</div>
        </div>`;
    }).join('');
}

function renderLeaderboard(list) {
    if (list.length === 0) {
        document.getElementById('leaderboardList').innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('trophy',22)}</div><p>No one has earned XP yet.</p></div>`;
        return;
    }
    document.getElementById('leaderboardList').innerHTML = list.map((u,i) => `
        <div class="lb-row">
            <div class="lb-rank ${i===0?'top1':i===1?'top2':i===2?'top3':''}">${i+1}</div>
            <img class="lb-avatar" src="${u.avatarUrl}" style="object-fit:cover;" alt="">
            <div class="lb-info">
                <div class="lname">${escapeHtml(u.username)}${u.left ? ' <span style="color:var(--parchment-faint);font-size:10px;">(left)</span>' : ''}</div>
                <div class="lmeta">Level ${u.level} · ${u.messages} messages</div>
            </div>
            <div class="lb-xp">${u.xp} XP</div>
        </div>
    `).join('');
}

function renderAzkaban(data) {
    const { active } = data;
    if (active.length === 0) {
        document.getElementById('azkabanList').innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('key',22)}</div><p>Azkaban is empty. All is calm in the castle.</p></div>`;
    } else {
        document.getElementById('azkabanList').innerHTML = active.map(p => `
            <div class="feed-item">
                <div class="feed-icon">${svg('azkaban',14)}</div>
                <div class="feed-body">
                    <div class="ftitle"><b>${escapeHtml(p.user.username)}</b> — ${escapeHtml(p.reason)}</div>
                    <div class="ftime">Sentenced by ${escapeHtml(p.moderator.username)} · ${timeAgo(p.jailedAt)}</div>
                </div>
            </div>
            <div class="prisoner-actions" style="margin-left:42px;">
                <button class="btn btn-ghost btn-sm" onclick="pardonPrisoner(${p.id})" ${CURRENT_USER?.canManageRoles ? '' : 'disabled'}>${svg('scroll', 13)} Pardon</button>
            </div>
        `).join('');
    }
}

function renderActivity(events) {
    if (events.length === 0) {
        document.getElementById('activityFeed').innerHTML = `<div class="empty-state"><div class="eicon-wrap">${svg('moon',22)}</div><p>No recent activity yet.</p></div>`;
        return;
    }
    document.getElementById('activityFeed').innerHTML = events.map(a => `
        <div class="feed-item">
            <div class="feed-icon">${svg(a.icon, 14)}</div>
            <div class="feed-body">
                <div class="ftitle">${a.text}</div>
                <div class="ftime">${timeAgo(a.time)}</div>
            </div>
        </div>
    `).join('');
}

async function pardonPrisoner(id) {
    try {
        await api(`/api/azkaban/${id}/pardon`, { method:'POST' });
        showToast('Prisoner pardoned', 'success');
        renderHome();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

/* ============================================================
   SENTENCE FORM (Azkaban)
   ============================================================ */
let searchDebounce;
function searchMembers(q) {
    clearTimeout(searchDebounce);
    if (!q.trim()) {
        document.getElementById('memberSearchResults').innerHTML = '';
        return;
    }
    searchDebounce = setTimeout(async () => {
        try {
            const { results } = await api(`/api/members/search?q=${encodeURIComponent(q)}`);
            document.getElementById('memberSearchResults').innerHTML = results.map(m => `
                <div class="member-result" onclick='selectSentenceMember(${JSON.stringify(m).replace(/'/g,"&apos;")})'>
                    <img src="${m.avatarUrl}" alt="">
                    <span>${escapeHtml(m.username)}</span>
                </div>
            `).join('') || `<p class="no-params">No members found.</p>`;
        } catch {}
    }, 250);
}

function selectSentenceMember(m) {
    selectedSentenceMember = m;
    document.getElementById('selectedMemberBox').innerHTML = `
        <div class="selected-member">
            <img src="${m.avatarUrl}" alt="">
            <span>${escapeHtml(m.username)}</span>
            <button onclick="clearSentenceMember()">${svg('close',13)}</button>
        </div>`;
    document.getElementById('memberSearchWrap').style.display = 'none';
    document.getElementById('memberSearchResults').innerHTML = '';
    document.getElementById('reasonGroup').style.display = 'block';
    document.getElementById('submitSentenceBtn').style.display = 'block';
}

function clearSentenceMember() {
    selectedSentenceMember = null;
    document.getElementById('selectedMemberBox').innerHTML = '';
    document.getElementById('memberSearchWrap').style.display = 'block';
    document.getElementById('memberSearchInput').value = '';
    document.getElementById('reasonGroup').style.display = 'none';
    document.getElementById('submitSentenceBtn').style.display = 'none';
}

async function submitSentence() {
    const reason = document.getElementById('sentenceReasonInput').value.trim();
    if (!selectedSentenceMember || !reason) {
        showToast('Pick a member and enter a reason', 'warn');
        return;
    }
    try {
        await api('/api/azkaban/sentence', {
            method: 'POST',
            body: JSON.stringify({ userId: selectedSentenceMember.id, reason }),
        });
        showToast(`${selectedSentenceMember.username} sent to Azkaban`, 'success');
        clearSentenceMember();
        document.getElementById('sentenceReasonInput').value = '';
        renderHome();
    } catch (err) {
        showToast(friendlyError(err.message), 'error');
    }
}

