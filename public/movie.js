const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const posterWrapEl = document.getElementById('movie-poster-wrap');
const posterEl = document.getElementById('movie-poster');
const titleEl = document.getElementById('movie-title');
const yearEl = document.getElementById('movie-year');
const ratingSummaryEl = document.getElementById('movie-rating-summary');
const overviewEl = document.getElementById('movie-overview');
const reviewsEl = document.getElementById('reviews');
const reviewFormSection = document.getElementById('review-form-section');
const reviewForm = document.getElementById('review-form');
const ratingError = document.getElementById('rating-error');
const reviewSubmitButton = document.getElementById('review-submit');
const bodyInput = document.getElementById('review-body');

// filled in once the movie loads; needed to lazily create the local
// movies row when a review is submitted
let currentMovie = null;

function starsHtml(rating) {
  const pct = Math.max(0, Math.min(5, rating)) / 5 * 100;
  return `<span class="stars" aria-label="${rating} out of 5 stars"><span class="stars-fill" style="width:${pct}%"></span></span>`;
}

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
    posterWrapEl.classList.add('poster-placeholder');
    posterWrapEl.textContent = '🎬';
  }
}

function showRatingSummary(reviews) {
  if (reviews.length === 0) {
    ratingSummaryEl.hidden = true;
    return;
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const reviewWord = reviews.length === 1 ? 'review' : 'reviews';
  ratingSummaryEl.innerHTML = `${starsHtml(avg)} ${avg.toFixed(1)} · ${reviews.length} ${reviewWord}`;
  ratingSummaryEl.hidden = false;
}

async function loadReviews() {
  if (!id) return;

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}/reviews`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const reviews = await res.json();
    showReviews(reviews);
    showRatingSummary(reviews);
  } catch (err) {
    reviewsEl.innerHTML = '<p class="state-message">Could not load reviews.</p>';
    console.error(err);
  }
}

function showReviews(reviews) {
  if (reviews.length === 0) {
    reviewsEl.innerHTML = '<p class="state-message">No reviews yet. Be the first!</p>';
    return;
  }

  reviewsEl.innerHTML = reviews.map((review) => {
    const username = escapeHtml(review.username);
    const initial = escapeHtml(review.username.charAt(0).toUpperCase());
    const date = new Date(review.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    return `
      <div class="review">
        <div class="review-header">
          <div class="review-avatar">${initial}</div>
          <div class="review-meta">
            <span class="review-username">${username}</span>
            ${starsHtml(review.rating)}
            <span class="review-date">${date}</span>
          </div>
        </div>
        <p class="review-body">${escapeHtml(review.body || '')}</p>
      </div>
    `;
  }).join('');
}

reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentMovie) return;

  const checkedRating = reviewForm.querySelector('input[name="rating"]:checked');
  if (!checkedRating) {
    ratingError.hidden = false;
    return;
  }
  ratingError.hidden = true;

  const rating = Number(checkedRating.value);
  const body = bodyInput.value.trim();

  reviewSubmitButton.disabled = true;
  reviewSubmitButton.textContent = 'Submitting...';

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: currentMovie.tmdbId,
        title: currentMovie.title,
        posterPath: currentMovie.posterPath,
        rating,
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
  } finally {
    reviewSubmitButton.disabled = false;
    reviewSubmitButton.textContent = 'Submit review';
  }
});

loadMovie();
loadReviews();
loadReviewForm();
