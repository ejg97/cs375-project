const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || 'Could not log in.';
      return;
    }

    window.location.href = 'index.html';
  } catch (err) {
    loginError.textContent = 'Something went wrong. Try again.';
    console.error(err);
  }
});
