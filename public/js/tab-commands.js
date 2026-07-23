/* ============================================================
   COMMANDS TAB
   ============================================================ */
async function loadCommands() {
    try {
        const { commands } = await api('/api/commands');
        COMMANDS = commands;
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadCommands failed', err);
    }
}

async function loadCommandUsage(){
    try {
        const { top, today } = await api('/api/analytics/commands/top?limit=22');
        const map = {};
        top.forEach(c => { map[c.commandName] = { total: c.totalExecutions, today: 0 }; });
        Object.keys(today).forEach(name => {
            if (!map[name]) map[name] = { total: 0, today: 0 };
            map[name].today = today[name];
        });
        CMD_USAGE = map;
    } catch (err) {
        if (!['not_authenticated','no_active_guild'].includes(err.message)) console.error('loadCommandUsage failed', err);
    }
}

const CATEGORIES = ['All', 'Community', 'Moderation', 'Server Config', 'Bot Identity', 'Messaging'];
let activeCategory = 'All';
let openCmd = null;

function renderCategoryChips(){
    document.getElementById('categoryChips').innerHTML = CATEGORIES.map(c => `
        <div class="chip ${c===activeCategory?'active':''}" onclick="setCategory('${c}')">${c}</div>
    `).join('');
}
function setCategory(c){ activeCategory = c; renderCategoryChips(); renderCommands(); }

function renderCommands(){
    const q = (document.getElementById('cmdSearch').value || '').trim().toLowerCase();
    let list = COMMANDS.filter(c => {
        const matchesCategory = activeCategory === 'All' || c.category === activeCategory;
        const matchesSearch = !q || c.name.includes(q) || c.desc.toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
    });

    document.getElementById('cmdCount').textContent = `${list.length} command${list.length===1?'':'s'}`;

    document.getElementById('cmdList').innerHTML = list.map(c => {
        const pm = PERM_META[c.perm];
        const isOpen = openCmd === c.name;
        const paramsHtml = c.params.length === 0
            ? `<p class="no-params">This command takes no parameters.</p>`
            : c.params.map(p => `
                <div class="param-item">
                    <div class="param-top">
                        <span class="param-name">${p.name}</span>
                        <span class="param-type">${p.type}</span>
                        <span class="${p.required?'param-req':'param-opt'}">${p.required?'REQUIRED':'OPTIONAL'}</span>
                    </div>
                    <span class="param-desc">${p.desc}</span>
                </div>
            `).join('');

        return `
        <div class="cmd-card ${isOpen?'open':''}">
            <div class="cmd-head" onclick="toggleCmd('${c.name}')">
                <span class="cmd-slash">/</span>
                <div class="cmd-head-text">
                    <div class="cname">${c.name}</div>
                    <div class="cdesc">${c.desc}</div>
                </div>
                <span class="perm-badge ${pm.cls}">${svg(pm.icon, 12)} ${pm.label}</span>
                <span class="cmd-chevron">▾</span>
            </div>
            <div class="cmd-body">
                <div class="cmd-body-inner">
                    <p class="cmd-full-desc">${c.full}</p>
                    <div class="cmd-meta-row">
                        <span class="meta-pill">${svg('folder',11)} ${c.category}</span>
                        <span class="meta-pill">${svg(pm.icon, 11)} ${pm.label}</span>
                        ${CMD_USAGE[c.name] ? `<span class="meta-pill">${svg('barChart',11)} ${CMD_USAGE[c.name].total} uses${CMD_USAGE[c.name].today ? ' · ' + CMD_USAGE[c.name].today + ' today' : ''}</span>` : `<span class="meta-pill">${svg('barChart',11)} no usage yet</span>`}
                    </div>
                    <div class="params-label">Parameters</div>
                    ${paramsHtml}
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleCmd(name){
    openCmd = openCmd === name ? null : name;
    renderCommands();
}

