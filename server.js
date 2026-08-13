require('dotenv').config();

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
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

// cookie session, holds session.userId once logged in
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 1 week
}));

// serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the server' });
});

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

  const results = data.results.map((movie) => {
    const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
    return {
      tmdbId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      year: year || null,
    };
  });

  res.json(results);
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

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim() || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let result;
  try {
    result = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
      [username.trim(), passwordHash]
    );
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That username is already taken' });
    }
    throw err;
  }

  const user = result.rows[0];
  req.session.userId = user.id;
  res.status(201).json({ id: user.id, username: user.username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const result = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username.trim()]
  );
  const user = result.rows[0];

  const match = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [req.session.userId]);
  const user = result.rows[0];

  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: 'Not logged in' }));
  }

  res.json({ id: user.id, username: user.username });
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

  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: 'You must be logged in to write a review' });
  }

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