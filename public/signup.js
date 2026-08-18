const signupForm = document.getElementById('signup-form');
const signupError = document.getElementById('signup-error');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupError.textContent = '';

  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm-password').value;

  if (password !== confirmPassword) {
    signupError.textContent = 'Passwords do not match.';
    return;
  }

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      signupError.textContent = data.error || 'Could not create account.';
      return;
    }

    window.location.href = 'index.html';
  } catch (err) {
    signupError.textContent = 'Something went wrong. Try again.';
    console.error(err);
  }
});
