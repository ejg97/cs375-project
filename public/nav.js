async function loadNav() {
  const el = document.getElementById('nav-user');
  if (!el) return;

  const peopleLink = '<a href="users.html">Find people</a>';

  try {
    const res = await fetch('/api/me');

    if (!res.ok) {
      el.innerHTML = `${peopleLink} &middot; <a href="login.html">Log in</a> / <a href="signup.html">Sign up</a>`;
      return;
    }

    const user = await res.json();
    el.innerHTML = `${peopleLink} &middot; <a href="messages.html">Messages</a> &middot; <a href="profile.html?username=${encodeURIComponent(user.username)}">${escapeHtml(user.username)}</a> &middot; <button id="logout-btn" type="button" class="link-button">Log out</button>`;

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = 'index.html';
    });
  } catch (err) {
    console.error(err);
  }
}

loadNav();
