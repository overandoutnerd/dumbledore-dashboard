/* ============================================================
   FETCH HELPER
   ============================================================ */
async function api(path, opts = {}) {
    const res = await fetch(path, {
        credentials: 'include',
        headers: opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
        ...opts,
    });

    if (res.status === 401) {
        showLoginGate();
        throw new Error('not_authenticated');
    }

    if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'no_active_guild') {
            showServerPicker();
            throw new Error('no_active_guild');
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `request_failed_${res.status}`);
    }

    if (res.status === 204) return null;
    return res.json();
}

