const params = new URLSearchParams(window.location.search);
const username = params.get('username');

const nameEl = document.getElementById('profile-username');
const joinedEl = document.getElementById('profile-joined');
const reviewsEl = document.getElementById('profile-reviews');
const friendActionEl = document.getElementById('friend-action');
const friendRequestsSection = document.getElementById('friend-requests-section');
const friendRequestsEl = document.getElementById('friend-requests');
const friendsListEl = document.getElementById('friends-list');

let viewerUsername = null;

async function loadProfile() {
  if (!username) {
    nameEl.textContent = 'No username in the URL.';
    return;
  }

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}`);

    if (res.status === 404) {
      nameEl.textContent = 'User not found.';
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const user = await res.json();
    showProfile(user);
  } catch (err) {
    nameEl.textContent = 'Could not load this profile.';
    console.error(err);
  }
}

function showProfile(user) {
  nameEl.textContent = user.username;
  const joined = new Date(user.createdAt);
  joinedEl.textContent = `Joined ${joined.toLocaleDateString()}`;
}

async function loadReviews() {
  if (!username) return;

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/reviews`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const reviews = await res.json();
    showReviews(reviews);
  } catch (err) {
    reviewsEl.innerHTML = '<p>Could not load reviews.</p>';
    console.error(err);
  }
}

function showReviews(reviews) {
  if (reviews.length === 0) {
    reviewsEl.innerHTML = '<p>No reviews yet.</p>';
    return;
  }

  reviewsEl.innerHTML = reviews.map((review) => `
    <div class="review">
      <p class="review-meta">
        <a href="movie.html?id=${review.tmdbId}">${escapeHtml(review.title)}</a>
        - ${review.rating} / 5
      </p>
      <p class="review-body">${escapeHtml(review.body || '')}</p>
    </div>
  `).join('');
}

async function loadViewer() {
  const res = await fetch('/api/me');
  if (res.ok) {
    viewerUsername = (await res.json()).username;
  }
}

async function loadFriendSection() {
  if (!username || !viewerUsername) return;

  if (viewerUsername === username) {
    await loadIncomingRequests();
  } else {
    await loadFriendStatus();
  }
}

async function loadIncomingRequests() {
  try {
    const res = await fetch('/api/friends/requests/incoming');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const requests = await res.json();
    showIncomingRequests(requests);
  } catch (err) {
    console.error(err);
  }
}

function showIncomingRequests(requests) {
  if (requests.length === 0) {
    friendRequestsSection.hidden = true;
    return;
  }

  friendRequestsSection.hidden = false;
  friendRequestsEl.innerHTML = requests.map((r) => `
    <div class="friend-request" data-username="${escapeHtml(r.username)}">
      <a href="profile.html?username=${encodeURIComponent(r.username)}">${escapeHtml(r.username)}</a>
      <button type="button" class="btn btn-small friend-accept-btn">Accept</button>
      <button type="button" class="btn btn-small btn-secondary friend-decline-btn">Decline</button>
    </div>
  `).join('');
}

async function loadFriendStatus() {
  try {
    const res = await fetch(`/api/friends/${encodeURIComponent(username)}/status`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const { status } = await res.json();
    showFriendAction(status);
  } catch (err) {
    console.error(err);
  }
}

function showFriendAction(status) {
  if (status === 'none') {
    friendActionEl.innerHTML = '<button type="button" id="friend-btn" class="btn" data-action="request">Add friend</button>';
  } else if (status === 'outgoing') {
    friendActionEl.innerHTML = '<button type="button" id="friend-btn" class="btn btn-secondary" data-action="cancel">Cancel request</button>';
  } else if (status === 'incoming') {
    friendActionEl.innerHTML = '<button type="button" id="friend-btn" class="btn" data-action="accept">Accept friend request</button>';
  } else if (status === 'friends') {
    friendActionEl.innerHTML = '<button type="button" id="friend-btn" class="btn btn-secondary" data-action="unfriend">Unfriend</button>';
  } else {
    friendActionEl.innerHTML = '';
  }
}

friendActionEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('#friend-btn');
  if (!btn) return;

  const action = btn.dataset.action;
  btn.disabled = true;

  try {
    if (action === 'request') {
      await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      showFriendAction('outgoing');
    } else if (action === 'cancel' || action === 'unfriend') {
      await fetch(`/api/friends/${encodeURIComponent(username)}`, { method: 'DELETE' });
      showFriendAction('none');
      loadFriends();
    } else if (action === 'accept') {
      await fetch(`/api/friends/${encodeURIComponent(username)}/accept`, { method: 'POST' });
      showFriendAction('friends');
      loadFriends();
    }
  } catch (err) {
    alert('Something went wrong. Try again.');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

friendRequestsEl.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('.friend-accept-btn');
  const declineBtn = e.target.closest('.friend-decline-btn');
  if (!acceptBtn && !declineBtn) return;

  const requestEl = e.target.closest('.friend-request');
  const requesterUsername = requestEl.dataset.username;

  try {
    if (acceptBtn) {
      await fetch(`/api/friends/${encodeURIComponent(requesterUsername)}/accept`, { method: 'POST' });
    } else {
      await fetch(`/api/friends/${encodeURIComponent(requesterUsername)}`, { method: 'DELETE' });
    }
    requestEl.remove();
    if (!friendRequestsEl.children.length) friendRequestsSection.hidden = true;
    loadFriends();
  } catch (err) {
    alert('Something went wrong. Try again.');
    console.error(err);
  }
});

async function loadFriends() {
  if (!username) return;

  try {
    const res = await fetch(`/api/users/${encodeURIComponent(username)}/friends`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const friends = await res.json();
    showFriends(friends);
  } catch (err) {
    friendsListEl.innerHTML = '<p>Could not load friends.</p>';
    console.error(err);
  }
}

function showFriends(friends) {
  if (friends.length === 0) {
    friendsListEl.innerHTML = '<p>No friends yet.</p>';
    return;
  }

  friendsListEl.innerHTML = friends.map((f) => `
    <a class="friend-chip" href="profile.html?username=${encodeURIComponent(f.username)}">${escapeHtml(f.username)}</a>
  `).join('');
}

loadProfile();
loadReviews();
loadFriends();
loadViewer().then(loadFriendSection);