/* ============ SHARED DISCORD-STYLE TRANSCRIPT RENDERER ============
 * Used by tab-interviews.js to render an interview transcript, both when
 * opened from the Settings → Interviews list inside the dashboard, and
 * when opened via a direct /interviews/:publicId link (the bot's "Read
 * Transcript" embed button in Discord) — both paths land in this same
 * SPA and share this one renderer. */

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatTranscriptTimestamp(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
    });
}

function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

function attachmentFileName(url) {
    try {
        const clean = url.split('?')[0];
        return decodeURIComponent(clean.split('/').pop() || 'attachment');
    } catch {
        return 'attachment';
    }
}

/** Renders the "N interviewer / interviewee / mods involved" summary card
 *  shown above the transcript itself. */
function renderTranscriptMeta(data) {
    const opened = formatTranscriptTimestamp(data.openedAt);
    const closed = formatTranscriptTimestamp(data.closedAt);
    const duration = formatDuration(data.durationSeconds);

    const modChips = (data.modsInvolved || []).map((mod) => `
        <span class="chip-static" style="border-color:${escapeHtml(mod.color)}55;">
            <span class="mod-chip-dot" style="background:${escapeHtml(mod.color)};"></span>${escapeHtml(mod.tag)}
        </span>
    `).join('');

    return `
        <div class="card interview-meta-card">
            <div class="role-id-row"><span class="rname">Channel</span><span class="rid">#${escapeHtml(data.channelName)}</span></div>
            <div class="role-id-row"><span class="rname">Opened by</span><span class="rid">${escapeHtml(data.creator.tag)}</span></div>
            <div class="role-id-row"><span class="rname">Interviewee</span><span class="rid">${escapeHtml(data.target.tag)}</span></div>
            <div class="role-id-row"><span class="rname">Closed by</span><span class="rid">${escapeHtml(data.closedBy.tag)}</span></div>
            <div class="role-id-row"><span class="rname">Opened</span><span class="rid">${escapeHtml(opened)}</span></div>
            <div class="role-id-row" style="border-bottom:none;"><span class="rname">Closed</span><span class="rid">${escapeHtml(closed)} · ${escapeHtml(duration)}</span></div>
            ${modChips ? `<div class="mod-chip-row">${modChips}</div>` : ''}
        </div>
    `;
}

function renderReplyRef(replyTo) {
    if (!replyTo) return '';

    if (replyTo.isUnknown) {
        return `
            <div class="discord-reply-ref reply-unknown">
                <span class="icon" data-icon="reply" data-size="12"></span>
                <span class="reply-snippet">Replying to a message that's no longer available</span>
            </div>
        `;
    }

    return `
        <div class="discord-reply-ref">
            <span class="icon" data-icon="reply" data-size="12"></span>
            <span class="reply-author">${escapeHtml(replyTo.displayName)}</span>
            <span class="reply-snippet">${escapeHtml(replyTo.snippet || '(no text)')}</span>
        </div>
    `;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'apng', 'avif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];
const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a'];

function attachmentExtension(url) {
    const clean = url.split('?')[0];
    const match = clean.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : '';
}

function renderAttachments(urls) {
    if (!urls || !urls.length) return '';

    return `
        <div class="discord-attachment">
            ${urls.map((url) => {
                const ext = attachmentExtension(url);
                const safeUrl = escapeHtml(url);

                if (IMAGE_EXTENSIONS.includes(ext)) {
                    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="discord-media-link"><img class="discord-media-img" src="${safeUrl}" alt="" loading="lazy" /></a>`;
                }
                if (VIDEO_EXTENSIONS.includes(ext)) {
                    return `<video class="discord-media-video" src="${safeUrl}" controls preload="metadata"></video>`;
                }
                if (AUDIO_EXTENSIONS.includes(ext)) {
                    return `<audio class="discord-media-audio" src="${safeUrl}" controls preload="metadata"></audio>`;
                }
                return `
                    <a class="discord-media-file" href="${safeUrl}" target="_blank" rel="noopener noreferrer">
                        <span data-icon="paperclip" data-size="12"></span>${escapeHtml(attachmentFileName(url))}
                    </a>
                `;
            }).join('')}
        </div>
    `;
}

function renderTranscriptMessage(message) {
    const speakerColor = message.speaker?.color || 'var(--gold-light)';

    return `
        <div class="discord-msg">
            <img class="discord-avatar" src="${escapeHtml(message.avatarUrl)}" alt="" loading="lazy" />
            <div class="discord-msg-main">
                ${renderReplyRef(message.replyTo)}
                <div class="discord-msg-header">
                    <span class="discord-author" style="color:${escapeHtml(speakerColor)};">${escapeHtml(message.displayName)}</span>
                    <span class="discord-author-tag">${escapeHtml(message.authorTag)}</span>
                    <span class="discord-timestamp">${escapeHtml(formatTranscriptTimestamp(message.createdAt))}</span>
                </div>
                ${message.content ? `<div class="discord-body">${escapeHtml(message.content)}</div>` : ''}
                ${renderAttachments(message.attachmentUrls)}
            </div>
        </div>
    `;
}

/** Renders the full "meta card + Discord-style conversation" for an
 *  interview. `data` is the InterviewTranscriptData JSON from the bot
 *  (see transcriptService.ts). Returns an HTML string; caller is
 *  responsible for injecting it and calling renderIcons() on the result. */
function renderInterviewTranscript(data) {
    const messages = data.messages && data.messages.length
        ? data.messages.map(renderTranscriptMessage).join('')
        : '<div class="discord-empty">No messages were sent in this interview.</div>';

    return `
        <div class="interview-transcript-wrap">
            ${renderTranscriptMeta(data)}
            <div class="discord-transcript">${messages}</div>
        </div>
    `;
}
