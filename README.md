## Movie Recommender Website

### Architecture:

```mermaid 
flowchart TD
    subgraph browser["Browser client"]
        direction LR
        pages["<b>Pages</b><br/>Movie, profile, feed"]
        clientjs["<b>Client JS</b><br/>fetch(), DOM updates"]
        cookie["<b>Session cookie</b><br/>Sent on each request"]
    end

    subgraph express["Express server (Node.js)"]
        direction TB
        mw["Middleware: sessions, bcrypt, input validation"]
        auth["<b>/api/auth</b><br/>login, signup"]
        movies["<b>/api/movies</b><br/>search, lookup"]
        reviews["<b>/api/reviews</b><br/>create, edit"]
        social["<b>/api/social</b><br/>friends, likes"]

        mw --> auth
        mw --> movies
        mw --> reviews
        mw --> social
    end

    subgraph db["PostgreSQL"]
        tables["users &nbsp;&nbsp; likes<br/>movies &nbsp;&nbsp; friendships<br/>reviews &nbsp;&nbsp; favorites<br/>comments &nbsp;&nbsp; messages"]
    end

    tmdb["<b>TMDB API</b><br/>External movie data"]

    browser <--> mw
    auth <--> tables
    movies <--> tables
    reviews <--> tables
    social <--> tables
    movies <--> tmdb

    classDef clientBox fill:#f8f8fb,stroke:#c7c9e0,color:#1a1a1a
    classDef serverBox fill:#f6fbf9,stroke:#b8ddd0,color:#1a1a1a
    classDef dataBox fill:#fdf7f5,stroke:#e3bfb3,color:#1a1a1a

    class pages,clientjs,cookie clientBox
    class mw,auth,movies,reviews,social serverBox
    class tables dataBox
    class tmdb dataBox

    style browser fill:#eeeefc,stroke:#a9abe8,color:#3b3ba8
    style express fill:#e4f5ef,stroke:#8fcbb5,color:#166b52
    style db fill:#fbe9e3,stroke:#e0a894,color:#9c3d1e
    style tmdb stroke-dasharray: 6 4,stroke:#c96a4a
