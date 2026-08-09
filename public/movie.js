const params = new URLSearchParams(window.location.search);
const id = params.get('id');

const posterEl = document.getElementById('movie-poster');
const titleEl = document.getElementById('movie-title');
const yearEl = document.getElementById('movie-year');
const overviewEl = document.getElementById('movie-overview');

async function loadMovie() {
  if (!id) {
    titleEl.textContent = 'No movie id in the URL.';
    return;
  }

  try {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const movie = await res.json();
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

loadMovie();