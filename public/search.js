const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const template = document.getElementById('result-template');
const resultsHeading = document.getElementById('results-heading');
const resultsNote = document.getElementById('results-note');
const clearButton = document.getElementById('clear-search');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  await runSearch(q);
});

clearButton.addEventListener('click', () => {
  input.value = '';
  clearButton.hidden = true;
  loadDefault();
});

async function runSearch(q) {
  resultsHeading.textContent = `Results for "${q}"`;
  clearButton.hidden = false;
  showLoading();

  try {
    const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movies = await res.json();
    renderResults(movies, `No results for "${q}".`);
  } catch (err) {
    showError();
    console.error(err);
  }
}

async function loadDefault() {
  const meRes = await fetch('/api/me');
  if (meRes.ok) {
    await loadRecommendations();
  } else {
    await loadPopular();
  }
}

async function loadRecommendations() {
  resultsHeading.textContent = 'Recommended for you';
  hideNote();
  showLoading();

  try {
    const res = await fetch('/api/recommendations');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const { personalized, movies } = await res.json();

    if (!personalized) {
      resultsHeading.textContent = 'Popular Movies';
      showNote('Rate a few movies to get personalized picks — here’s what’s popular for now.');
    }

    renderResults(movies, 'Nothing to show right now.');
  } catch (err) {
    showError();
    console.error(err);
  }
}

async function loadPopular() {
  resultsHeading.textContent = 'Popular Movies';
  hideNote();
  showLoading();

  try {
    const res = await fetch('/api/movies/popular');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movies = await res.json();
    renderResults(movies, 'Nothing to show right now.');
  } catch (err) {
    showError();
    console.error(err);
  }
}

function showNote(text) {
  resultsNote.textContent = text;
  resultsNote.hidden = false;
}

function hideNote() {
  resultsNote.hidden = true;
}

function showLoading() {
  results.innerHTML = '<p class="state-message"><span class="spinner"></span>Loading movies...</p>';
}

function showError() {
  results.innerHTML = '<p class="state-message">Something went wrong. Try again.</p>';
}

function renderResults(movies, emptyMessage) {
  results.innerHTML = '';

  if (movies.length === 0) {
    results.innerHTML = `<p class="state-message">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  for (const movie of movies) {
    results.appendChild(makeResult(movie));
  }
}

function makeResult(movie) {
  const node = template.content.cloneNode(true);

  const link = node.querySelector('.movie-card');
  link.href = `movie.html?id=${movie.tmdbId}`;

  node.querySelector('.movie-card-title').textContent = movie.title;
  node.querySelector('.movie-card-year').textContent = movie.year || '';

  const posterWrap = node.querySelector('.movie-card-poster');
  const img = node.querySelector('.movie-card-img');
  if (movie.posterPath) {
    img.src = `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
    img.alt = `${movie.title} poster`;
  } else {
    img.remove();
    posterWrap.classList.add('poster-placeholder');
    posterWrap.textContent = '🎬';
  }

  return node;
}

loadDefault();
