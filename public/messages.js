const withUsername = new URLSearchParams(window.location.search).get('with');

const loginRequiredEl = document.getElementById('messages-login-required');
const layoutEl = document.getElementById('messages-layout');
const listEl = document.getElementById('conversation-list');
const threadEl = document.getElementById('message-thread');

let meUsername = null;

async function init() {
  const meRes = await fetch('/api/me');
  if (!meRes.ok) {
    loginRequiredEl.hidden = false;
    return;
  }

  meUsername = (await meRes.json()).username;
  layoutEl.hidden = false;

  await loadConversations();

  if (withUsername === meUsername) {
    threadEl.innerHTML = '<p class="state-message">You cannot message yourself.</p>';
  } else if (withUsername) {
    loadThread(withUsername);
  }
}

async function loadConversations() {
  try {
    const [convRes, friendsRes] = await Promise.all([
      fetch('/api/messages/conversations'),
      fetch(`/api/users/${encodeURIComponent(meUsername)}/friends`),
    ]);
    if (!convRes.ok || !friendsRes.ok) throw new Error('Server returned an error');

    const conversations = await convRes.json();
    const friends = await friendsRes.json();

    const known = new Set(conversations.map((c) => c.username));
    const combined = conversations.concat(
      friends
        .filter((f) => !known.has(f.username))
        .map((f) => ({ username: f.username, lastMessage: null, lastMessageAt: null })),
    );

    showConversationList(combined);
  } catch (err) {
    listEl.innerHTML = '<p class="state-message">Could not load conversations.</p>';
    console.error(err);
  }
}

function showConversationList(items) {
  if (items.length === 0) {
    listEl.innerHTML = '<p class="state-message">No friends yet. <a href="users.html">Find people</a> to message.</p>';
    return;
  }

  listEl.innerHTML = items.map((item) => `
    <a class="conversation-item${item.username === withUsername ? ' active' : ''}" href="messages.html?with=${encodeURIComponent(item.username)}">
      <span class="conversation-username">${escapeHtml(item.username)}</span>
      <span class="conversation-preview">${item.lastMessage ? escapeHtml(item.lastMessage) : 'Say hi \u{1F44B}'}</span>
    </a>
  `).join('');
}

async function loadThread(username) {
  threadEl.innerHTML = '<p class="state-message"><span class="spinner"></span>Loading...</p>';

  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(username)}`);

    if (res.status === 404) {
      threadEl.innerHTML = '<p class="state-message">User not found.</p>';
      return;
    }
    if (res.status === 403) {
      threadEl.innerHTML = `<p class="state-message">You can only message friends. <a href="profile.html?username=${encodeURIComponent(username)}">View profile</a></p>`;
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    showThread(await res.json());
  } catch (err) {
    threadEl.innerHTML = '<p class="state-message">Could not load this conversation.</p>';
    console.error(err);
  }
}

function showThread(data) {
  const messagesHtml = data.messages.length === 0
    ? '<p class="state-message">No messages yet. Say hi!</p>'
    : data.messages.map(renderBubble).join('');

  const formHtml = data.isFriend
    ? `<form id="message-form" class="message-form">
         <textarea id="message-input" placeholder="Message ${escapeHtml(data.username)}..." required></textarea>
         <button type="submit" class="btn">Send</button>
       </form>`
    : `<p class="state-message">You're no longer friends with ${escapeHtml(data.username)}, so new messages are off. <a href="profile.html?username=${encodeURIComponent(data.username)}">View profile</a></p>`;

  threadEl.innerHTML = `
    <div class="message-thread-header">
      <a href="profile.html?username=${encodeURIComponent(data.username)}">${escapeHtml(data.username)}</a>
    </div>
    <div id="message-list" class="message-list">${messagesHtml}</div>
    ${formHtml}
  `;

  const messageListEl = document.getElementById('message-list');
  messageListEl.scrollTop = messageListEl.scrollHeight;

  const form = document.getElementById('message-form');
  if (form) {
    form.addEventListener('submit', (e) => sendMessage(e, data.username, messageListEl));
  }
}

function renderBubble(m) {
  return `
    <div class="message-bubble ${m.fromMe ? 'from-me' : 'from-them'}">
      <p class="message-body">${escapeHtml(m.body)}</p>
      <span class="message-date">${new Date(m.createdAt).toLocaleString()}</span>
    </div>
  `;
}

async function sendMessage(e, username, messageListEl) {
  e.preventDefault();

  const input = document.getElementById('message-input');
  const body = input.value.trim();
  if (!body) return;

  const btn = e.target.querySelector('button');
  btn.disabled = true;

  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const message = await res.json();
    const emptyState = messageListEl.querySelector('.state-message');
    if (emptyState) emptyState.remove();
    messageListEl.insertAdjacentHTML('beforeend', renderBubble(message));
    messageListEl.scrollTop = messageListEl.scrollHeight;
    input.value = '';
    loadConversations();
  } catch (err) {
    alert('Something went wrong. Try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

init();
