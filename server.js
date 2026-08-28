require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// parse JSON bodies on incoming requests
app.use(express.json());

// cookie session, holds session.userId once logged in
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }, // 1 week
  }),
);

// serve everything in /public as static files
app.use(express.static(path.join(__dirname, "public")));

// example API route
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from the server" });
});

function mapTmdbMovie(movie) {
  return {
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path,
    year: movie.release_date ? movie.release_date.slice(0, 4) : null,
  };
}

app.get("/api/movies/search", async (req, res) => {
  const q = req.query.q;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: "q query parameter is required" });
  }

  const tmdbUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach TMDB" });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: "TMDB request failed" });
  }

  const data = await tmdbRes.json();

  res.json(data.results.map(mapTmdbMovie));
});

// Passthrough to TMDB's currently-popular list, used to fill the homepage
// before the user has searched for anything. Same shape as /search, no DB
// writes — movies rows are only ever created lazily when reviewed.
app.get("/api/movies/popular", async (req, res) => {
  const tmdbUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach TMDB" });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: "TMDB request failed" });
  }

  const data = await tmdbRes.json();

  res.json(data.results.map(mapTmdbMovie));
});

app.get("/api/movies/:id", async (req, res) => {
  const id = req.params.id;

  const tmdbUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}?api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach TMDB" });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: "TMDB request failed" });
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

app.get("/api/movies/:id/similar", async (req, res) => {
  const id = req.params.id;

  const tmdbUrl = `https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}/similar?api_key=${process.env.TMDB_KEY}`;

  let tmdbRes;
  try {
    tmdbRes = await fetch(tmdbUrl);
  } catch (err) {
    return res.status(502).json({ error: "Failed to reach TMDB" });
  }

  if (!tmdbRes.ok) {
    return res.status(502).json({ error: "TMDB request failed" });
  }

  const data = await tmdbRes.json();

  res.json(data.results.map(mapTmdbMovie));
});

app.get("/api/movies/:id/reviews", async (req, res) => {
  const tmdbId = req.params.id;
  const userId = req.session.userId || null;

  const result = await pool.query(
    `SELECT reviews.id, reviews.rating, reviews.body, reviews.created_at, users.username
     FROM reviews
     JOIN movies ON reviews.movie_id = movies.id
     JOIN users  ON reviews.user_id  = users.id
     WHERE movies.tmdb_id = $1
     ORDER BY reviews.created_at DESC`,
    [tmdbId],
  );

  const reviewIds = result.rows.map((row) => row.id);
  const votesByReview = new Map();

  if (reviewIds.length > 0) {
    const votesResult = await pool.query(
      "SELECT review_id, user_id, value FROM review_votes WHERE review_id = ANY($1::int[])",
      [reviewIds],
    );

    for (const vote of votesResult.rows) {
      if (!votesByReview.has(vote.review_id)) {
        votesByReview.set(vote.review_id, { likes: 0, dislikes: 0, myVote: 0 });
      }
      const tally = votesByReview.get(vote.review_id);
      if (vote.value === 1) tally.likes++;
      else tally.dislikes++;
      if (vote.user_id === userId) tally.myVote = vote.value;
    }
  }

  const commentsByReview = new Map();

  if (reviewIds.length > 0) {
    const commentsResult = await pool.query(
      `SELECT comments.id, comments.review_id, comments.body, comments.created_at, users.username
       FROM comments
       JOIN users ON comments.user_id = users.id
       WHERE comments.review_id = ANY($1::int[])
       ORDER BY comments.created_at ASC`,
      [reviewIds],
    );

    for (const row of commentsResult.rows) {
      if (!commentsByReview.has(row.review_id)) {
        commentsByReview.set(row.review_id, []);
      }
      commentsByReview.get(row.review_id).push({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        username: row.username,
      });
    }
  }

  const reviews = result.rows.map((row) => {
    const tally = votesByReview.get(row.id) || {
      likes: 0,
      dislikes: 0,
      myVote: 0,
    };
    return {
      id: row.id,
      rating: row.rating,
      body: row.body,
      createdAt: row.created_at,
      username: row.username,
      likes: tally.likes,
      dislikes: tally.dislikes,
      myVote: tally.myVote,
      comments: commentsByReview.get(row.id) || [],
    };
  });

  res.json(reviews);
});

app.post("/api/reviews/:id/comments", async (req, res) => {
  const reviewId = req.params.id;
  const { body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ error: "Comment body is required" });
  }

  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in to comment" });
  }

  const reviewCheck = await pool.query("SELECT id FROM reviews WHERE id = $1", [
    reviewId,
  ]);
  if (reviewCheck.rows.length === 0) {
    return res.status(404).json({ error: "Review not found" });
  }

  const result = await pool.query(
    `INSERT INTO comments (review_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at`,
    [reviewId, userId, body.trim()],
  );
  const comment = result.rows[0];

  const userResult = await pool.query(
    "SELECT username FROM users WHERE id = $1",
    [userId],
  );

  res.status(201).json({
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    username: userResult.rows[0].username,
  });
});

app.post("/api/reviews/:id/vote", async (req, res) => {
  const reviewId = req.params.id;
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({ error: "You must be logged in to vote" });
  }

  const value = Number(req.body.value);
  if (value !== 1 && value !== -1) {
    return res
      .status(400)
      .json({ error: "value must be 1 (like) or -1 (dislike)" });
  }

  const existing = await pool.query(
    "SELECT value FROM review_votes WHERE review_id = $1 AND user_id = $2",
    [reviewId, userId],
  );

  try {
    if (existing.rows[0] && existing.rows[0].value === value) {
      // voting the same way again clears the vote
      await pool.query(
        "DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2",
        [reviewId, userId],
      );
    } else {
      await pool.query(
        `INSERT INTO review_votes (review_id, user_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (review_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
        [reviewId, userId, value],
      );
    }
  } catch (err) {
    if (err.code === "23503") {
      return res.status(404).json({ error: "Review not found" });
    }
    throw err;
  }

  const counts = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE value = 1)  AS likes,
            COUNT(*) FILTER (WHERE value = -1) AS dislikes
     FROM review_votes
     WHERE review_id = $1`,
    [reviewId],
  );
  const myVoteResult = await pool.query(
    "SELECT value FROM review_votes WHERE review_id = $1 AND user_id = $2",
    [reviewId, userId],
  );

  res.json({
    likes: Number(counts.rows[0].likes),
    dislikes: Number(counts.rows[0].dislikes),
    myVote: myVoteResult.rows[0] ? myVoteResult.rows[0].value : 0,
  });
});

app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim() || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: "password must be at least 8 characters" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let result;
  try {
    result = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
      [username.trim(), passwordHash],
    );
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "That username is already taken" });
    }
    throw err;
  }

  const user = result.rows[0];
  req.session.userId = user.id;
  res.status(201).json({ id: user.id, username: user.username });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }

  const result = await pool.query(
    "SELECT id, username, password_hash FROM users WHERE username = $1",
    [username.trim()],
  );
  const user = result.rows[0];

  const match = user
    ? await bcrypt.compare(password, user.password_hash)
    : false;
  if (!match) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).end();
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const result = await pool.query(
    "SELECT id, username FROM users WHERE id = $1",
    [req.session.userId],
  );
  const user = result.rows[0];

  if (!user) {
    return req.session.destroy(() =>
      res.status(401).json({ error: "Not logged in" }),
    );
  }

  res.json({ id: user.id, username: user.username });
});

app.post("/api/reviews", async (req, res) => {
  const { tmdbId, title, posterPath, rating, body } = req.body;

  if (!tmdbId || !title) {
    return res.status(400).json({ error: "tmdbId and title are required" });
  }

  const ratingNum = Number(rating);
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res
      .status(400)
      .json({ error: "rating must be an integer between 1 and 5" });
  }

  const userId = req.session.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ error: "You must be logged in to write a review" });
  }

  const movieResult = await pool.query(
    `INSERT INTO movies (tmdb_id, title, poster_path)
     VALUES ($1, $2, $3)
     ON CONFLICT (tmdb_id) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [tmdbId, title, posterPath || null],
  );
  const movieId = movieResult.rows[0].id;

  const reviewResult = await pool.query(
    `INSERT INTO reviews (user_id, movie_id, rating, body)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, movie_id) DO UPDATE
       SET rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = NOW()
     RETURNING id, rating, body, created_at`,
    [userId, movieId, ratingNum, body || null],
  );
  const review = reviewResult.rows[0];

  const userResult = await pool.query(
    "SELECT username FROM users WHERE id = $1",
    [userId],
  );

  res.status(201).json({
    id: review.id,
    rating: review.rating,
    body: review.body,
    createdAt: review.created_at,
    username: userResult.rows[0].username,
  });
});

// Registered before /api/users/:username so the literal path "search"
// isn't swallowed as a :username value.
app.get("/api/users/search", async (req, res) => {
  const q = req.query.q;

  if (!q || !q.trim()) {
    return res.status(400).json({ error: "q query parameter is required" });
  }

  const result = await pool.query(
    `SELECT username, created_at FROM users
     WHERE username ILIKE '%' || $1 || '%'
     ORDER BY username
     LIMIT 20`,
    [q.trim()],
  );

  res.json(
    result.rows.map((row) => ({
      username: row.username,
      createdAt: row.created_at,
    })),
  );
});

app.get("/api/users/:username", async (req, res) => {
  const username = req.params.username;

  const result = await pool.query(
    "SELECT id, username, created_at FROM users WHERE username = $1",
    [username],
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({
    id: user.id,
    username: user.username,
    createdAt: user.created_at,
  });
});

app.get("/api/users/:username/reviews", async (req, res) => {
  const username = req.params.username;

  const result = await pool.query(
    `SELECT reviews.id, reviews.rating, reviews.body, reviews.created_at,
            movies.tmdb_id, movies.title, movies.poster_path
     FROM reviews
     JOIN movies ON reviews.movie_id = movies.id
     JOIN users  ON reviews.user_id  = users.id
     WHERE users.username = $1
     ORDER BY reviews.created_at DESC`,
    [username],
  );

  const reviews = result.rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    tmdbId: row.tmdb_id,
    title: row.title,
    posterPath: row.poster_path,
  }));

  res.json(reviews);
});

app.get("/api/users/:username/friends", async (req, res) => {
  const userResult = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [req.params.username],
  );
  const user = userResult.rows[0];

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // friendship is symmetric but stored as one directional row, so pick
  // whichever id on the row isn't this user
  const result = await pool.query(
    `SELECT users.username
     FROM friendships
     JOIN users ON users.id = CASE WHEN friendships.requester_id = $1
                                    THEN friendships.addressee_id
                                    ELSE friendships.requester_id END
     WHERE (friendships.requester_id = $1 OR friendships.addressee_id = $1)
       AND friendships.status = 'accepted'
     ORDER BY users.username`,
    [user.id],
  );

  res.json(result.rows.map((row) => ({ username: row.username })));
});

app.get("/api/friends/requests/incoming", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  const result = await pool.query(
    `SELECT users.username
     FROM friendships
     JOIN users ON users.id = friendships.requester_id
     WHERE friendships.addressee_id = $1 AND friendships.status = 'pending'
     ORDER BY friendships.created_at`,
    [userId],
  );

  res.json(result.rows.map((row) => ({ username: row.username })));
});

app.get("/api/friends/:username/status", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  const otherResult = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [req.params.username],
  );
  const other = otherResult.rows[0];
  if (!other) {
    return res.status(404).json({ error: "User not found" });
  }
  if (other.id === userId) {
    return res.json({ status: "self" });
  }

  const result = await pool.query(
    `SELECT requester_id, status FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, other.id],
  );
  const row = result.rows[0];

  if (!row) return res.json({ status: "none" });
  if (row.status === "accepted") return res.json({ status: "friends" });
  res.json({ status: row.requester_id === userId ? "outgoing" : "incoming" });
});

app.post("/api/friends", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res
      .status(401)
      .json({ error: "You must be logged in to add friends" });
  }

  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "username is required" });
  }

  const targetResult = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [username.trim()],
  );
  const target = targetResult.rows[0];
  if (!target) {
    return res.status(404).json({ error: "User not found" });
  }
  if (target.id === userId) {
    return res.status(400).json({ error: "You cannot friend yourself" });
  }

  const existing = await pool.query(
    `SELECT id FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, target.id],
  );
  if (existing.rows[0]) {
    return res
      .status(409)
      .json({ error: "A friend request already exists between you two" });
  }

  await pool.query(
    "INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)",
    [userId, target.id],
  );

  res.status(201).json({ status: "outgoing" });
});

app.post("/api/friends/:username/accept", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  const requesterResult = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [req.params.username],
  );
  const requester = requesterResult.rows[0];
  if (!requester) {
    return res.status(404).json({ error: "User not found" });
  }

  const result = await pool.query(
    `UPDATE friendships SET status = 'accepted'
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
     RETURNING id`,
    [requester.id, userId],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "No pending request from that user" });
  }

  res.json({ status: "friends" });
});

// Covers three cases with one route: canceling a request you sent,
// declining a request you received, and unfriending an accepted friend.
app.delete("/api/friends/:username", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "You must be logged in" });
  }

  const otherResult = await pool.query(
    "SELECT id FROM users WHERE username = $1",
    [req.params.username],
  );
  const other = otherResult.rows[0];
  if (!other) {
    return res.status(404).json({ error: "User not found" });
  }

  await pool.query(
    `DELETE FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, other.id],
  );

  res.json({ status: "none" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
