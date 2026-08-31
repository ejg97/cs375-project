const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const posterWrapEl = document.getElementById("movie-poster-wrap");
const posterEl = document.getElementById("movie-poster");
const titleEl = document.getElementById("movie-title");
const yearEl = document.getElementById("movie-year");
const ratingSummaryEl = document.getElementById("movie-rating-summary");
const overviewEl = document.getElementById("movie-overview");
const reviewsEl = document.getElementById("reviews");
const similarSection = document.getElementById("similar-section");
const similarMoviesEl = document.getElementById("similar-movies");
const reviewFormSection = document.getElementById("review-form-section");
const reviewForm = document.getElementById("review-form");
const ratingError = document.getElementById("rating-error");
const reviewSubmitButton = document.getElementById("review-submit");
const bodyInput = document.getElementById("review-body");

// filled in once the movie loads, so a submitted review can create the local movies row
let currentMovie = null;

function starsHtml(rating) {
  const pct = (Math.max(0, Math.min(5, rating)) / 5) * 100;
  return `<span class="stars" aria-label="${rating} out of 5 stars"><span class="stars-fill" style="width:${pct}%"></span></span>`;
}

async function loadReviewForm() {
  const res = await fetch("/api/me");
  if (res.ok) return;

  reviewFormSection.innerHTML =
    '<h2>Write a review</h2><p>You must <a href="login.html">log in</a> to write a review.</p>';
}

async function loadMovie() {
  if (!id) {
    titleEl.textContent = "No movie id in the URL.";
    return;
  }

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movie = await res.json();
    currentMovie = movie;
    showMovie(movie);
  } catch (err) {
    titleEl.textContent = "Could not load this movie.";
    console.error(err);
  }
}

function showMovie(movie) {
  titleEl.textContent = movie.title;
  yearEl.textContent = movie.year ? `Released: ${movie.year}` : "";
  overviewEl.textContent = movie.overview || "";

  if (movie.posterPath) {
    posterEl.src = `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
    posterEl.alt = `${movie.title} poster`;
  } else {
    posterEl.remove();
    posterWrapEl.classList.add("poster-placeholder");
    posterWrapEl.textContent = "🎬";
  }
}

function showRatingSummary(reviews) {
  if (reviews.length === 0) {
    ratingSummaryEl.hidden = true;
    return;
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const reviewWord = reviews.length === 1 ? "review" : "reviews";
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
    reviewsEl.innerHTML =
      '<p class="state-message">Could not load reviews.</p>';
    console.error(err);
  }
}

function showReviews(reviews) {
  if (reviews.length === 0) {
    reviewsEl.innerHTML =
      '<p class="state-message">No reviews yet. Be the first!</p>';
    return;
  }

  reviewsEl.innerHTML = reviews
    .map((review) => {
      const username = escapeHtml(review.username);
      const initial = escapeHtml(review.username.charAt(0).toUpperCase());
      const date = new Date(review.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return `
      <div class="review" data-review-id="${review.id}">
        <div class="review-header">
          <div class="review-avatar">${initial}</div>
          <div class="review-meta">
            <span class="review-username">${username}</span>
            ${starsHtml(review.rating)}
            <span class="review-date">${date}</span>
          </div>
        </div>
        <p class="review-body">${escapeHtml(review.body || "")}</p>
                <div class="review-votes">
          <button type="button" class="vote-btn vote-like${review.myVote === 1 ? " active" : ""}" data-value="1">
            👍 <span class="vote-count">${review.likes}</span>
          </button>
          <button type="button" class="vote-btn vote-dislike${review.myVote === -1 ? " active" : ""}" data-value="-1">
            👎 <span class="vote-count">${review.dislikes}</span>
          </button>
        </div>
        <div class="comments">
          ${commentsHtml(review.comments)}
          <form class="comment-form">
            <input type="text" class="comment-input" placeholder="Reply to this review..." maxlength="500" required>
            <button type="submit" class="link-button">Reply</button>
          </form>
        </div>
      </div>
    `;
    })
    .join("");
}

function movieCardHtml(movie) {
  const title = escapeHtml(movie.title);
  const posterInner = movie.posterPath
    ? `<img class="movie-card-img" src="https://image.tmdb.org/t/p/w342${movie.posterPath}" alt="${title} poster">`
    : "🎬";
  const posterClass = movie.posterPath
    ? "movie-card-poster"
    : "movie-card-poster poster-placeholder";

  return `
    <a class="movie-card" href="movie.html?id=${movie.tmdbId}">
      <div class="${posterClass}">${posterInner}</div>
      <div class="movie-card-body">
        <h3 class="movie-card-title">${title}</h3>
        <p class="movie-card-year">${movie.year || ""}</p>
      </div>
    </a>
  `;
}

async function loadSimilar() {
  if (!id) return;

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}/similar`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movies = await res.json();

    if (movies.length === 0) {
      similarSection.hidden = true;
      return;
    }

    similarMoviesEl.innerHTML = movies.slice(0, 12).map(movieCardHtml).join("");
    similarSection.hidden = false;
  } catch (err) {
    similarSection.hidden = true;
    console.error(err);
  }
}

function commentsHtml(comments) {
  if (!comments || comments.length === 0) return "";

  return comments
    .map((comment) => {
      const date = new Date(comment.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return `
      <div class="comment">
        <span class="comment-username">${escapeHtml(comment.username)}</span>
        <span class="comment-date">${date}</span>
        <p class="comment-body">${escapeHtml(comment.body)}</p>
      </div>
    `;
    })
    .join("");
}

reviewsEl.addEventListener("click", async (e) => {
  const btn = e.target.closest(".vote-btn");
  if (!btn) return;

  const reviewEl = btn.closest(".review");
  const reviewId = reviewEl.dataset.reviewId;
  const value = Number(btn.dataset.value);

  btn.disabled = true;
  try {
    const res = await fetch(
      `/api/reviews/${encodeURIComponent(reviewId)}/vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      },
    );

    if (res.status === 401) {
      alert("You must be logged in to vote on reviews.");
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const { likes, dislikes, myVote } = await res.json();
    const likeBtn = reviewEl.querySelector(".vote-like");
    const dislikeBtn = reviewEl.querySelector(".vote-dislike");
    likeBtn.querySelector(".vote-count").textContent = likes;
    dislikeBtn.querySelector(".vote-count").textContent = dislikes;
    likeBtn.classList.toggle("active", myVote === 1);
    dislikeBtn.classList.toggle("active", myVote === -1);
  } catch (err) {
    alert("Could not record your vote. Try again.");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

reviewsEl.addEventListener('submit', async (e) => {
  const form = e.target.closest('.comment-form');
  if (!form) return;
  e.preventDefault();

  const reviewEl = form.closest('.review');
  const reviewId = reviewEl.dataset.reviewId;
  const input = form.querySelector('.comment-input');
  const body = input.value.trim();
  if (!body) return;

  const button = form.querySelector('button');
  button.disabled = true;

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });

    if (res.status === 401) {
      alert('You must be logged in to reply.');
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Could not post reply. Try again.');
      return;
    }

    await loadReviews();
  } catch (err) {
    alert('Could not post reply. Try again.');
    console.error(err);
  } finally {
    button.disabled = false;
  }
});

reviewForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentMovie) return;

  const checkedRating = reviewForm.querySelector(
    'input[name="rating"]:checked',
  );
  if (!checkedRating) {
    ratingError.hidden = false;
    return;
  }
  ratingError.hidden = true;

  const rating = Number(checkedRating.value);
  const body = bodyInput.value.trim();

  reviewSubmitButton.disabled = true;
  reviewSubmitButton.textContent = "Submitting...";

  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
        alert("You must be logged in to write a review.");
      } else {
        alert(data.error || "Could not submit review. Try again.");
      }
      return;
    }

    reviewForm.reset();
    await loadReviews();
  } catch (err) {
    alert("Could not submit review. Try again.");
    console.error(err);
  } finally {
    reviewSubmitButton.disabled = false;
    reviewSubmitButton.textContent = "Submit review";
  }
});

loadMovie();
loadReviews();
loadReviewForm();
loadSimilar();
