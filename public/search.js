const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;

  results.innerHTML = '<p>Searching...</p>';

  try {
    const res = await fetch(`/api/movies/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movies = await res.json();
    renderResults(movies);
  } catch (err) {
    results.innerHTML = `<p>Error: ${escapeHtml(err.message)}</p>`;
  }
});

function renderResults(movies) {
  if (movies.length === 0) {
    results.innerHTML = '<p>No results found.</p>';
    return;
  }

  results.innerHTML = movies.map((movie) => {
    const posterUrl = movie.posterPath
      ? `https://image.tmdb.org/t/p/w342${movie.posterPath}`
      : '';
    const year = movie.year ? ` (${movie.year})` : '';

    return `
      <a class="result" href="movie.html?id=${movie.tmdbId}">
        ${posterUrl ? `<img src="${posterUrl}" alt="${escapeHtml(movie.title)} poster">` : ''}
        <span class="result-title">${escapeHtml(movie.title)}${year}</span>
      </a>
    `;
  }).join('');
}
