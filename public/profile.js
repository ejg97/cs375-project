const params = new URLSearchParams(window.location.search);
const username = params.get('username');

const nameEl = document.getElementById('profile-username');
const joinedEl = document.getElementById('profile-joined');
const reviewsEl = document.getElementById('profile-reviews');

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

loadProfile();
loadReviews();