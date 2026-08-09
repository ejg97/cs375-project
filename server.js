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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});