# CS375 Project — Movie Review Site

Two-person course project (Ethan Grotell, Bulat Gareev), 5 weeks, ~2-4 hrs/week each.
A movie review site with social features. Users search movies via TMDB, write reviews
and 1-5 star ratings, and have profiles.

## Hard constraints

- **Plain HTML / CSS / JavaScript on the frontend. No React, no Vue, no frontend
  framework, no build step, no bundler.** This is a course requirement — writing
  vanilla DOM code is the point of the class. Do not suggest or scaffold a framework.
- **No client-side router.** Multi-page app: separate `.html` files, navigation by
  ordinary links.
- **Do not build a mini-framework.** No generic `renderComponent()`, no state store,
  no diffing helper. Rendering is: fetch data, map to template literals, assign to
  `innerHTML`. Repetitive is fine and expected.

## Stack

- Node.js + Express, serving static files from `public/`
- PostgreSQL (used in class; `pg` library)
- TMDB API for all movie metadata
- Node 18+ built-in `fetch` — no axios

## Architecture

The browser only ever talks to our Express server. The server is the only thing that
talks to TMDB or Postgres.

```
browser (public/*.js)
  -> fetch('/api/...')        our server
                               -> fetch TMDB (holds the API key)
                               -> query Postgres
```

The TMDB API key lives in `.env` and is read server-side only. Everything in
`public/` is publicly downloadable, so no credentials, keys, or secrets there ever.

## File layout

```
server.js            Express app, all API routes
.env                 TMDB_KEY, DATABASE_URL  (gitignored)
.env.example         same keys, no values    (committed)
database/
  schema.sql
  seed.sql
public/
  index.html         search bar + results rendered into a div
  search.js
  movie.html         movie detail, read id from ?id= query param
  movie.js
```

Search results render into a container on `index.html` — there is no separate
results page. `movie.html?id=<tmdb_id>` is the only page that takes a param.

## Data model

Three tables for now: `users`, `movies`, `reviews`. Do not create tables for
friendships, likes, comments, favorites, or messages until we build those features.

`movies` is a small local stub, not a cache of TMDB:

- It exists so reviews have something to foreign-key to, and so listing pages
  (profile, feed) can JOIN for title and poster instead of making N TMDB calls.
- Columns: `id` (serial PK), `tmdb_id` (unique), `title`, `poster_path`.
- Rows are created **lazily, when a movie is first reviewed** — never at search time.
  Use `INSERT ... ON CONFLICT (tmdb_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id`.
- Search and movie-detail pages read straight from TMDB and pass through. They do
  not write to the database.

Everything else about a movie (overview, genres, runtime) stays in TMDB and is
fetched on the detail page only.

## Naming conventions

Two different movie ids exist and confusing them is the most likely bug in this
codebase:

- `tmdbId` / `tmdb_id` — TMDB's id. Used in URLs and in TMDB API calls.
- `movieId` / `movie_id` — our local `movies.id`. Only ever used in the
  `reviews` foreign key.

API responses are camelCase (`tmdbId`, `posterPath`). Database columns are
snake_case. The server maps between them — routes never return raw TMDB JSON,
they pick the needed fields and rename them.

`poster_path` is stored as the fragment TMDB returns (`/abc.jpg`). The full URL is
built at render time by prefixing `https://image.tmdb.org/t/p/w342`.

## Non-negotiable practices

- **Escape all user-submitted text before putting it in a template literal.**
  Review bodies, comments, usernames. Use a shared `escapeHtml()` helper. This is
  an XSS hole otherwise and the professor will look for it.
- Register `express.json()` before any POST routes or `req.body` is undefined.
- `encodeURIComponent()` on any user text going into a query string.
- Parameterized queries only (`$1`, `$2`) — never string-concatenate SQL.
- Never commit `.env` or `node_modules/`. Do commit `package.json`,
  `package-lock.json`, `schema.sql`, `.env.example`.

## Current scope (week 1)

Working on, in this order:

1. Express skeleton serving `public/`
2. `GET /api/movies/search?q=` — proven by hitting it directly in the browser
3. `GET /api/movies/:id` — movie detail passthrough
4. Search page rendering titles and posters
5. Movie detail page
6. Three-table schema
7. Review form + `POST /api/reviews`, against a **hardcoded `userId = 1`** with a
   `// TODO: replace with req.session.userId` comment

Real authentication comes in week 2. Do not block review work on it.

Styling is deliberately minimal right now — unstyled inputs and a bare list are
fine. Polish is week 4.

## Later milestones (do not build yet)

Auth and sessions (bcrypt, express-session) → profiles → likes/dislikes →
comments → friendships → messaging → recommendations.

Recommendations can be satisfied cheaply with TMDB's `/movie/{id}/similar`
endpoint — no algorithm needed. Direct messaging is the most expensive feature and
the first thing to cut if we run short on time.

Friendships, when we get there: one row with `requester_id`, `addressee_id`, and a
`status`. The request is directional but the friendship is symmetric, so "my
friends" queries must check both columns.
