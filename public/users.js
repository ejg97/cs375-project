const form = document.getElementById('user-search-form');
const input = document.getElementById('user-search-input');
const resultsEl = document.getElementById('user-results');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  await runSearch(q);
});

async function runSearch(q) {
  resultsEl.innerHTML = '<p class="state-message"><span class="spinner"></span>Searching...</p>';

  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const users = await res.json();
    showResults(users, q);
  } catch (err) {
    resultsEl.innerHTML = '<p class="state-message">Something went wrong. Try again.</p>';
    console.error(err);
  }
}

function showResults(users, q) {
  if (users.length === 0) {
    resultsEl.innerHTML = `<p class="state-message">No users found for "${escapeHtml(q)}".</p>`;
    return;
  }

  resultsEl.innerHTML = users.map((user) => `
    <a class="friend-chip" href="profile.html?username=${encodeURIComponent(user.username)}">${escapeHtml(user.username)}</a>
  `).join('');
}
