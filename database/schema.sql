DROP TABLE IF EXISTS review_votes CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS movies  CASCADE;
DROP TABLE IF EXISTS users   CASCADE;


CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Local stub for a film, NOT a cache of TMDB.
-- Exists so reviews have something to foreign-key to, and so listing pages can
-- JOIN for title/poster instead of making one TMDB call per row.
-- Rows are created lazily, the first time a movie is reviewed — never at search
-- time. Everything else (overview, genres, runtime) stays in TMDB.
CREATE TABLE movies (
  id           SERIAL PRIMARY KEY,
  tmdb_id      INTEGER NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  poster_path  TEXT,          -- TMDB fragment e.g. '/abc.jpg', often null
  release_year INTEGER
);


CREATE TABLE reviews (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One review per user per movie. Makes "edit my review" the natural
  -- behaviour via ON CONFLICT rather than piling up duplicates.
  UNIQUE (user_id, movie_id)
);


-- reviews.movie_id points at movies.id (our local serial), NOT tmdb_id.

-- All reviews for a movie — the movie detail page.
CREATE INDEX idx_reviews_movie ON reviews (movie_id);

-- All reviews by a user — the profile page.
-- The UNIQUE constraint above already indexes (user_id, movie_id), but this
-- makes the user-only lookup cheaper.
CREATE INDEX idx_reviews_user ON reviews (user_id);


-- One row per (review, user): a user's current like/dislike on that review.
-- value is +1 for like, -1 for dislike. Voting again with the same value
-- removes the vote (handled by the route, not here); voting with the other
-- value flips it via the UNIQUE constraint's ON CONFLICT.
CREATE TABLE review_votes (
  id         SERIAL PRIMARY KEY,
  review_id  INTEGER NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  value      SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (review_id, user_id)
);

-- Tallying likes/dislikes for all reviews on a movie page.
CREATE INDEX idx_review_votes_review ON review_votes (review_id);
