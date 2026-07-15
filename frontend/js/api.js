// Central place for API base URL + fetch helper + token storage.
// Change this if your backend runs somewhere other than localhost:5000.
const API_BASE = "http://192.168.1.7:5000/api";

const TOKEN_KEY = "slotbooking_token";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function requireLogin() {
    if (!getToken()) {
        window.location.href = "login.html";
    }
}

function logout() {
    clearToken();
    window.location.href = "login.html";
}

/**
 * Small fetch wrapper: adds JSON headers + auth header, and always returns
 * { ok, status, data } instead of throwing, so callers can handle
 * 400/401/403/409 etc. as normal data rather than exceptions.
 */
async function apiFetch(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (networkErr) {
        return {
            ok: false,
            status: 0,
            data: { error: "Network error - is the backend running?" },
        };
    }

    let data = null;
    try {
        data = await res.json();
    } catch (_) {
        // no body
    }

    if (res.status === 401) {
        // Token missing/expired/invalid - send the user back to login.
        clearToken();
        window.location.href = "login.html";
    }

    return { ok: res.ok, status: res.status, data };
}
