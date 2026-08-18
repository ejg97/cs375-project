require('dotenv').config();

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const username = process.env.DATABASE_USERNAME;
const password = process.env.DATABASE_PASSWORD;

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  user: username,
  host: 'localhost',
  database: 'moviereview',
  password: password,
  port: 5432,
});

// parse JSON bodies on incoming requests
app.use(express.json());

// serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the server' });
});

function mapTmdbMovie(movie) {
  return {
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
  };
}

app.get('/api/movies/search', async (req, res) => {
  const q = req.query.q;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'q query parameter is required' });
  }

  const tmdbUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach TMDB' });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: 'TMDB request failed' });
  }

  const data = await tmdbRes.json();

  res.json(data.results.map(mapTmdbMovie));
});

// Passthrough to TMDB's currently-popular list, used to fill the homepage
// before the user has searched for anything. Same shape as /search, no DB
// writes — movies rows are only ever created lazily when reviewed.
app.get('/api/movies/popular', async (req, res) => {
  const tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach TMDB' });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: 'TMDB request failed' });
  }

  const data = await tmdbRes.json();

  res.json(data.results.map(mapTmdbMovie));
});

app.get('/api/movies/:id', async (req, res) => {
  const id = req.params.id;

  const tmdbUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}?api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach TMDB' });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: 'TMDB request failed' });
  }

  const movie = await tmdbRes.json();

  res.json({
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
    overview: movie.overview,
  });
});

app.get('/api/movies/:id/reviews', async (req, res) => {
  const tmdbId = req.params.id;

  const result = await pool.query(
    `SELECT reviews.id, reviews.rating, reviews.body, reviews.created_at, users.username
     FROM reviews
     JOIN movies ON reviews.movie_id = movies.id
     JOIN users  ON reviews.user_id  = users.id
     WHERE movies.tmdb_id = $1
     ORDER BY reviews.created_at DESC`,
    [tmdbId]
  );

  const reviews = result.rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    username: row.username,
  }));

  res.json(reviews);
});

app.post('/api/reviews', async (req, res) => {
  const { tmdbId, title, posterPath, rating, body } = req.body;

  if (!tmdbId || !title) {
    return res.status(400).json({ error: 'tmdbId and title are required' });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }

  const userId = 1; // TODO: replace with req.session.userId

  const movieResult = await pool.query(
    `INSERT INTO movies (tmdb_id, title, poster_path)
     VALUES ($1, $2, $3)
     ON CONFLICT (tmdb_id) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [tmdbId, title, posterPath || null]
  );
  const movieId = movieResult.rows[0].id;

  const reviewResult = await pool.query(
    `INSERT INTO reviews (user_id, movie_id, rating, body)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, movie_id) DO UPDATE
       SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = NOW()
     RETURNING id, rating, body, created_at`,
    [userId, movieId, ratingNum, body || null]
  );
  const review = reviewResult.rows[0];

  const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);

  res.status(201).json({
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.created_at,
    username: userResult.rows[0].username,
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});