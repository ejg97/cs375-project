-- CS375 Movie Review Site — development seed data
--
-- Run AFTER schema.sql:  psql -d moviereview -f database/seed.sql
--
-- Assumes schema.sql was just run, so the tables are empty and the serial
-- sequences start at 1. This gives us a user with id = 1, which is what the
-- review routes are hardcoded to until real authentication lands in week 2.

INSERT INTO users (username, password_hash) VALUES
  ('testuser', 'placeholder-not-a-real-hash'),
  ('bulat',    'placeholder-not-a-real-hash'),
  ('ethan',    'placeholder-not-a-real-hash');

-- NOTE: these password hashes are junk strings, not bcrypt output. Once auth
-- exists these accounts will not be able to log in until the hashes are
-- replaced with real ones.


-- A couple of movies and reviews so the movie detail and profile pages have
-- something to render while we are building them. An empty page is hard to
-- debug — you cannot tell whether it is broken or just empty.
--
-- Real movie rows are created by the review route via ON CONFLICT. These are
-- inserted directly only because there is no UI to create them yet.

-- poster_path is left NULL here. The real values are opaque TMDB hashes — if
-- you want posters in the seed data, hit /api/movies/search?q=inception and
-- paste in whatever posterPath comes back. Leaving them null is also a useful
-- test, since TMDB returns null posters often enough that the UI has to
-- handle it.
INSERT INTO movies (tmdb_id, title, release_year) VALUES
  (27205, 'Inception',       2010),
  (155,   'The Dark Knight', 2008);

INSERT INTO reviews (user_id, movie_id, rating, body) VALUES
  (1, 1, 5, 'Test review. Holds up on rewatch.'),
  (2, 1, 4, 'Test review. The ending still bothers me.'),
  (1, 2, 5, 'Test review. Ledger carries the whole thing.');
