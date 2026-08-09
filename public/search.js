const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const results = document.getElementById('results');
const template = document.getElementById('result-template');

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
    results.innerHTML = '<p>Something went wrong. Try again.</p>';
    console.error(err);
  }
});

function renderResults(movies) {
  results.innerHTML = '';

  if (movies.length === 0) {
    results.innerHTML = '<p>No results found.</p>';
    return;
  }

  for (const movie of movies) {
    results.appendChild(makeResult(movie));
  }
}

function makeResult(movie) {
  const node = template.content.cloneNode(true);

  const link = node.querySelector('.result');
  link.href = `movie.html?id=${movie.tmdbId}`;

  const title = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  node.querySelector('.result-title').textContent = title;

  const poster = node.querySelector('.result-poster');
  if (movie.posterPath) {
    poster.src = `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
    poster.alt = `${movie.title} poster`;
  } else {
    poster.remove(); 
  }

  return node;
}