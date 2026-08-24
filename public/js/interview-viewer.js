/* ============================================================
   INTERVIEW TRANSCRIPT VIEWER (public/interview.html)

   Standalone page — not part of the main SPA's partial/tab system.
   Reached by clicking "Read Transcript" on the embed the bot posts to
   the interview-logs channel: /interviews/<publicId>. Fetches the
   transcript from GET /api/interviews/:publicId and renders it as a
   Discord-style conversation (see transcript-render.js), or shows a
   login/permission/not-found state. Falls back to the legacy
   pre-rendered HTML (in a sandboxed iframe) for interviews closed
   before structured transcripts existed.
   ============================================================ */
(function () {
    const publicId = window.location.pathname.split("/").filter(Boolean).pop();

    const stateScreen = document.getElementById("stateScreen");
    const stateTitle = document.getElementById("stateTitle");
    const stateMessage = document.getElementById("stateMessage");
    const stateAction = document.getElementById("stateAction");
    const container = document.getElementById("transcriptContainer");

    function showState({ icon, title, message, actionLabel, actionHref }) {
        stateScreen.querySelector(".eicon").textContent = icon;
        stateTitle.textContent = title;
        stateMessage.textContent = message;

        if (actionLabel && actionHref) {
            stateAction.textContent = actionLabel;
            stateAction.href = actionHref;
            stateAction.style.display = "inline-block";
        } else {
            stateAction.style.display = "none";
        }

        stateScreen.style.display = "block";
        container.style.display = "none";
    }

    function showTranscript(payload) {
        stateScreen.style.display = "none";
        container.style.display = "block";

        if (payload.data) {
            container.innerHTML = renderInterviewTranscript(payload.data);
            hydrateStaticIcons(container);
            return;
        }

        // Legacy fallback: interview closed before transcript_data existed,
        // only has the old pre-rendered HTML. Render it in a sandboxed
        // iframe rather than injecting it into the page directly.
        const frame = document.createElement("iframe");
        frame.sandbox = "allow-same-origin";
        frame.referrerPolicy = "no-referrer";
        frame.style.cssText = "flex:1;width:100%;min-height:80vh;border:none;background:#14151a;";
        container.innerHTML = "";
        container.appendChild(frame);
        frame.srcdoc = payload.legacyHtml;
    }

    async function load() {
        if (!publicId) {
            showState({
                icon: "🔍",
                title: "No transcript specified",
                message: "This link is missing an interview ID.",
            });
            return;
        }

        let res;
        try {
            res = await fetch(`/api/interviews/${encodeURIComponent(publicId)}`, {
                credentials: "include",
            });
        } catch {
            showState({
                icon: "⚠️",
                title: "Couldn't reach the dashboard",
                message: "Check your connection and try refreshing the page.",
            });
            return;
        }

        if (res.status === 401) {
            const returnTo = encodeURIComponent(window.location.pathname);
            showState({
                icon: "🔒",
                title: "Sign in required",
                message: "Taking you to Discord sign-in…",
            });
            window.location.href = `/auth/login?returnTo=${returnTo}`;
            return;
        }

        if (res.status === 403) {
            showState({
                icon: "🚫",
                title: "You don't have access",
                message:
                    "Viewing this transcript requires the server's interview-viewer role or Bot Manager access.",
            });
            return;
        }

        if (res.status === 404) {
            showState({
                icon: "❓",
                title: "Transcript not found",
                message: "This interview doesn't exist, or hasn't been closed yet.",
            });
            return;
        }

        if (!res.ok) {
            showState({
                icon: "⚠️",
                title: "Something went wrong",
                message: "Please try again in a moment.",
            });
            return;
        }

        const payload = await res.json();
        showTranscript(payload);
    }

    load();
})();
