const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const posterEl = document.getElementById('movie-poster');
const titleEl = document.getElementById('movie-title');
const yearEl = document.getElementById('movie-year');
const overviewEl = document.getElementById('movie-overview');
const reviewsEl = document.getElementById('reviews');
const reviewFormSection = document.getElementById('review-form-section');
const reviewForm = document.getElementById('review-form');
const ratingInput = document.getElementById('review-rating');
const bodyInput = document.getElementById('review-body');

// filled in once the movie loads; needed to lazily create the local
// movies row when a review is submitted
let currentMovie = null;

async function loadReviewForm() {
  const res = await fetch('/api/me');
  if (res.ok) return;

  reviewFormSection.innerHTML = '<h2>Write a review</h2><p>You must <a href="login.html">log in</a> to write a review.</p>';
}

async function loadMovie() {
  if (!id) {
    titleEl.textContent = 'No movie id in the URL.';
    return;
  }

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movie = await res.json();
    currentMovie = movie;
    showMovie(movie);
  } catch (err) {
    titleEl.textContent = 'Could not load this movie.';
    console.error(err);
  }
}

function showMovie(movie) {
  titleEl.textContent = movie.title;
  yearEl.textContent = movie.year ? `Released: ${movie.year}` : '';
  overviewEl.textContent = movie.overview || '';

  if (movie.posterPath) {
    posterEl.src = `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
    posterEl.alt = `${movie.title} poster`;
  } else {
    posterEl.remove();
  }
}

async function loadReviews() {
  if (!id) return;

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}/reviews`);
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
    reviewsEl.innerHTML = '<p>No reviews yet. Be the first!</p>';
    return;
  }

  reviewsEl.innerHTML = reviews.map((review) => `
    <div class="review">
      <p class="review-meta"><a href="profile.html?username=${encodeURIComponent(review.username)}">${escapeHtml(review.username)}</a> - ${review.rating} / 5</p>
      <p class="review-body">${escapeHtml(review.body || '')}</p>
    </div>
  `).join('');
}

reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentMovie) return;

  const rating = ratingInput.value;
  const body = bodyInput.value.trim();

  if (!rating) return;

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: currentMovie.tmdbId,
        title: currentMovie.title,
        posterPath: currentMovie.posterPath,
        rating: Number(rating),
        body,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        alert('You must be logged in to write a review.');
      } else {
        alert(data.error || 'Could not submit review. Try again.');
      }
      return;
    }

    reviewForm.reset();
    await loadReviews();
  } catch (err) {
    alert('Could not submit review. Try again.');
    console.error(err);
  }
});

loadMovie();
loadReviews();
loadReviewForm();