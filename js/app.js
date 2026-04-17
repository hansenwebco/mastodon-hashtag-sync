const REDIRECT_URI = window.location.origin + window.location.pathname;
const SCOPES = 'read:follows write:follows read:accounts';

// Elements
const sections = {
    auth: document.getElementById('auth-section'),
    sync: document.getElementById('sync-section'),
    success: document.getElementById('success-section')
};

const UI = {
    source: {
        card: document.getElementById('source-auth-card'),
        body: document.getElementById('source-auth-body'),
        input: document.getElementById('source-server-input'),
        btn: document.getElementById('source-login-btn')
    },
    dest: {
        card: document.getElementById('dest-auth-card'),
        body: document.getElementById('dest-auth-body'),
        input: document.getElementById('dest-server-input'),
        btn: document.getElementById('dest-login-btn')
    },
    auth: {
        continueBtnWrapper: document.getElementById('continue-sync-container'),
        continueBtn: document.getElementById('continue-to-sync-btn')
    },
    sync: {
        wrapper: document.getElementById('tags-wrapper'),
        tagsList: document.getElementById('tags-list'),
        loading: document.getElementById('tags-loading'),
        selectAllBtn: document.getElementById('select-all-btn'),
        deselectAllBtn: document.getElementById('deselect-all-btn'),
        startBtn: document.getElementById('start-sync-btn'),
        sourceBadge: document.getElementById('source-info-badge'),
        destBadge: document.getElementById('dest-info-badge')
    },
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toast-message'),
    restartBtn: document.getElementById('restart-btn')
};

// State
let state = {
    sourceTags: [],
    destTags: [],
    selectedTags: new Set()
};

function showToast(msg) {
    UI.toastMsg.textContent = msg;
    UI.toast.classList.remove('hidden');
    UI.toast.classList.add('show');
    setTimeout(() => {
        UI.toast.classList.remove('show');
        setTimeout(() => UI.toast.classList.add('hidden'), 300);
    }, 4000);
}

function cleanServer(serverInput) {
    if (!serverInput) return null;
    let s = serverInput.trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return s || null;
}

// OAuth Flow
async function registerApp(server) {
    let clientId = localStorage.getItem(`client_id_${server}`);
    let clientSecret = localStorage.getItem(`client_secret_${server}`);

    if (clientId && clientSecret) {
        return { clientId, clientSecret };
    }

    try {
        const res = await fetch(`https://${server}/api/v1/apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: 'Hashtag Sync Web UI',
                redirect_uris: REDIRECT_URI,
                scopes: SCOPES,
                website: window.location.origin
            })
        });

        if (!res.ok) throw new Error('Failed to register app on ' + server);

        const data = await res.json();
        localStorage.setItem(`client_id_${server}`, data.client_id);
        localStorage.setItem(`client_secret_${server}`, data.client_secret);

        return { clientId: data.client_id, clientSecret: data.client_secret };
    } catch (e) {
        showToast(e.message);
        throw e;
    }
}

async function loginUser(type, server) {
    const { clientId } = await registerApp(server);
    localStorage.setItem('auth_intent', JSON.stringify({ type, server }));

    const authUrl = `https://${server}/oauth/authorize?client_id=${clientId}&scope=${encodeURIComponent(SCOPES)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
    window.location.href = authUrl;
}

async function processOAuthCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const intentStr = localStorage.getItem('auth_intent');

    // Clear URL
    if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (code && intentStr) {
        const intent = JSON.parse(intentStr);
        const server = intent.server;
        const clientId = localStorage.getItem(`client_id_${server}`);
        const clientSecret = localStorage.getItem(`client_secret_${server}`);

        try {
            const tokenRes = await fetch(`https://${server}/oauth/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: REDIRECT_URI,
                    grant_type: 'authorization_code',
                    code
                })
            });

            if (!tokenRes.ok) throw new Error('Failed to obtain token');

            const tokenData = await tokenRes.json();
            const token = tokenData.access_token;

            const profileRes = await fetch(`https://${server}/api/v1/accounts/verify_credentials`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!profileRes.ok) throw new Error('Failed to verify credentials');
            const profileData = await profileRes.json();

            localStorage.setItem(`${intent.type}_account`, JSON.stringify({
                server,
                token,
                username: profileData.username,
                acct: profileData.acct,
                avatar: profileData.avatar
            }));

            localStorage.removeItem('auth_intent');
        } catch (e) {
            showToast('OAuth Error: ' + e.message);
            localStorage.removeItem('auth_intent');
        }
    }
}

function renderProfile(type, account) {
    const card = UI[type].card;
    const body = UI[type].body;

    card.classList.add('logged-in');
    body.innerHTML = `
        <div class="profile-info">
            <div class="avatar-wrapper">
                <div class="avatar-placeholder"><i class="fa-solid fa-user"></i></div>
                <img src="${account.avatar}" alt="" class="profile-avatar hidden" onload="this.classList.remove('hidden'); this.previousElementSibling.style.display='none';">
            </div>
            <div class="profile-details">
                <span class="profile-name">${account.username}</span>
                <span class="profile-handle">@${account.acct}@${account.server}</span>
            </div>
        </div>
        <button class="logout-btn" onclick="logout('${type}')"><i class="fa-solid fa-link-slash"></i> Disconnect ${type === 'dest' ? 'Destination' : 'Source'}</button>
    `;
}

window.logout = function (type) {
    localStorage.removeItem(`${type}_account`);
    location.reload();
}

async function fetchAllTags(server, token) {
    let tags = [];
    let url = `https://${server}/api/v1/followed_tags?limit=200`;

    // Just fetch first 200 for MVP to simplify pagination
    try {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to fetch tags from ' + server);
        tags = await res.json();
        return tags.map(t => t.name.toLowerCase());
    } catch (e) {
        showToast('Error fetching tags: ' + e.message);
        throw e;
    }
}

function renderTags() {
    UI.sync.loading.classList.add('hidden');
    UI.sync.wrapper.classList.remove('hidden');

    UI.sync.tagsList.innerHTML = '';

    const destSet = new Set(state.destTags);
    const sourceSet = new Set(state.sourceTags);

    const allTags = new Set([...state.sourceTags, ...state.destTags]);
    const sortedTags = Array.from(allTags).sort();

    state.selectedTags.clear();

    if (sortedTags.length === 0) {
        UI.sync.tagsList.innerHTML = `<li style="padding: 2rem; text-align: center; color: var(--text-secondary);">No followed tags found.</li>`;
        return;
    }

    sortedTags.forEach(tag => {
        const inSource = sourceSet.has(tag);
        const inDest = destSet.has(tag);

        const el = document.createElement('li');
        el.className = 'tag-row';

        if (inSource && !inDest) {
            // Actionable: missing on dest
            el.innerHTML = `
                <div class="tag-checkbox"></div>
                <div class="tag-name-wrapper">
                    <span class="tag-name">${tag}</span>
                </div>
                <span class="tag-status-pill status-missing">Missing on Destination</span>
            `;
            el.onclick = () => toggleTag(tag, el);
        } else if (!inSource && inDest) {
            // Info only: missing on source
            el.classList.add('disabled-row', 'is-checked');
            el.innerHTML = `
                <div class="tag-checkbox"></div>
                <div class="tag-name-wrapper">
                    <span class="tag-name">${tag}</span>
                </div>
                <span class="tag-status-pill status-dest">Already on Destination</span>
            `;
        } else {
            // In sync
            el.classList.add('disabled-row', 'is-checked');
            el.innerHTML = `
                <div class="tag-checkbox"></div>
                <div class="tag-name-wrapper">
                    <span class="tag-name">${tag}</span>
                </div>
                <span class="tag-status-pill status-sync">In Sync</span>
            `;
        }

        UI.sync.tagsList.appendChild(el);
    });

    updateStartBtn();
}

function toggleTag(tag, element) {
    if (element.classList.contains('disabled-row')) return;

    if (state.selectedTags.has(tag)) {
        state.selectedTags.delete(tag);
        element.classList.remove('selected');
    } else {
        state.selectedTags.add(tag);
        element.classList.add('selected');
    }
    updateStartBtn();
}

function updateStartBtn() {
    UI.sync.startBtn.disabled = state.selectedTags.size === 0;
    UI.sync.startBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Sync ${state.selectedTags.size} Tags`;
}

async function loadTagsData() {
    const sourceAcc = JSON.parse(localStorage.getItem('source_account'));
    const destAcc = JSON.parse(localStorage.getItem('dest_account'));

    UI.sync.sourceBadge.innerHTML = `@${sourceAcc.acct}@${sourceAcc.server}`;
    UI.sync.destBadge.innerHTML = `@${destAcc.acct}@${destAcc.server}`;

    try {
        const [sourceTags, destTags] = await Promise.all([
            fetchAllTags(sourceAcc.server, sourceAcc.token),
            fetchAllTags(destAcc.server, destAcc.token)
        ]);

        state.sourceTags = sourceTags;
        state.destTags = destTags;
        renderTags();
    } catch (e) {
        // Error already toasted
    }
}

async function startSync() {
    const destAcc = JSON.parse(localStorage.getItem('dest_account'));
    UI.sync.startBtn.disabled = true;
    UI.sync.startBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...`;

    const tagsToSync = Array.from(state.selectedTags);
    let successCount = 0;

    for (const tag of tagsToSync) {
        try {
            const res = await fetch(`https://${destAcc.server}/api/v1/tags/${encodeURIComponent(tag)}/follow`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${destAcc.token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (res.ok) successCount++;
        } catch (e) {
            console.error('Failed to sync tag', tag, e);
        }
    }

    if (successCount < tagsToSync.length) {
        showToast(`Synced ${successCount}/${tagsToSync.length} tags. Some failed.`);
    }

    sections.sync.classList.remove('active');
    setTimeout(() => {
        sections.sync.classList.add('hidden');
        sections.success.classList.remove('hidden');

        document.getElementById('success-message').textContent = `Successfully synced ${successCount} hashtags to ${destAcc.server}!`;
        
        requestAnimationFrame(() => {
            sections.success.classList.add('active');
        });
    }, 300);
}

// Interactivity
UI.source.btn.addEventListener('click', () => {
    const server = cleanServer(UI.source.input.value);
    if (!server) return showToast('Please enter a valid source server');
    loginUser('source', server);
});

UI.dest.btn.addEventListener('click', () => {
    const server = cleanServer(UI.dest.input.value);
    if (!server) return showToast('Please enter a valid destination server');
    loginUser('dest', server);
});

UI.sync.selectAllBtn.addEventListener('click', () => {
    const items = UI.sync.tagsList.querySelectorAll('.tag-row:not(.disabled-row)');
    items.forEach(el => {
        const nameNode = el.querySelector('.tag-name');
        if (!nameNode) return;
        const tag = nameNode.textContent;
        state.selectedTags.add(tag);
        el.classList.add('selected');
    });
    updateStartBtn();
});

UI.sync.deselectAllBtn.addEventListener('click', () => {
    state.selectedTags.clear();
    const items = UI.sync.tagsList.querySelectorAll('.tag-row.selected');
    items.forEach(el => el.classList.remove('selected'));
    updateStartBtn();
});

UI.sync.startBtn.addEventListener('click', startSync);

UI.sync.sourceBadge.addEventListener('click', backToAuth);
UI.sync.destBadge.addEventListener('click', backToAuth);

function backToAuth() {
    sections.sync.classList.remove('active');
    sections.success.classList.remove('active');
    setTimeout(() => {
        sections.sync.classList.add('hidden');
        sections.success.classList.add('hidden');
        initApp(); // Use initApp to reset the view state cleanly
    }, 300);
}

UI.auth.continueBtn.addEventListener('click', () => {
    sections.auth.classList.remove('active');
    setTimeout(() => {
        sections.auth.classList.add('hidden');
        sections.sync.classList.remove('hidden');
        requestAnimationFrame(() => {
            sections.sync.classList.add('active');
            loadTagsData();
        });
    }, 300);
});

UI.restartBtn.addEventListener('click', backToAuth);

// Initialization
async function initApp() {
    await processOAuthCode();

    const sourceAcc = JSON.parse(localStorage.getItem('source_account'));
    const destAcc = JSON.parse(localStorage.getItem('dest_account'));

    sections.sync.classList.remove('active');
    sections.success.classList.remove('active');

    sections.auth.classList.remove('hidden');
    sections.sync.classList.add('hidden');
    sections.success.classList.add('hidden');

    UI.auth.continueBtnWrapper.classList.add('hidden');

    if (sourceAcc) {
        renderProfile('source', sourceAcc);
        UI.dest.input.disabled = false;
        UI.dest.btn.disabled = false;
    } else {
        UI.dest.input.disabled = true;
        UI.dest.btn.disabled = true;
    }

    if (destAcc) {
        renderProfile('dest', destAcc);
    }

    if (sourceAcc && destAcc) {
        UI.auth.continueBtnWrapper.classList.remove('hidden');
    }

    requestAnimationFrame(() => {
        sections.auth.classList.add('active');
    });
}

// Handle Enter keys
UI.source.input.addEventListener('keypress', e => e.key === 'Enter' && UI.source.btn.click());
UI.dest.input.addEventListener('keypress', e => e.key === 'Enter' && UI.dest.btn.click());

initApp();
