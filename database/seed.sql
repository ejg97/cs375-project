-- CS375 Movie Review Site — development seed data
--
-- Run AFTER schema.sql:  psql -d moviereview -f database/seed.sql
--
-- Assumes schema.sql was just run, so the tables are empty and the serial
-- sequences start at 1.

INSERT INTO users (username, password_hash) VALUES
  ('testuser', 'placeholder-not-a-real-hash'),
  ('bulat',    'placeholder-not-a-real-hash'),
  ('ethan',    'placeholder-not-a-real-hash');

-- NOTE: these password hashes are junk strings, not bcrypt output, so these
-- accounts cannot log in until the hashes are replaced with real ones.


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

-- A couple of replies so the comment thread under a review has something to
-- render while we are building it.
INSERT INTO comments (review_id, user_id, body) VALUES
  (1, 2, 'Test comment. Agreed, the practical effects hold up especially well.'),
  (1, 3, 'Test comment. Which ending do you think it actually is?'),
  (2, 1, 'Test comment. Fair, the top never really settling either way is the point though.');

-- A short back-and-forth so the messages page has a conversation to render.
-- (testuser and bulat are not friended by this seed data — friending them
-- first via the UI, or adding a row to friendships, is needed to reply.)
INSERT INTO messages (sender_id, recipient_id, body) VALUES
  (1, 2, 'Test message. Have you seen Inception?'),
  (2, 1, 'Test message. Yeah, just rewatched it actually.');