# Where Was I?

A personal game tracking app for story-driven games. Keep track of where you left off, how many times you've played through a game, and discover new ones to add to your library.

Built out of frustration with losing track of progress across multiple games and playthroughs.

---

## Features

-  **Game Discovery**:search 500,000+ games powered by the RAWG API, filtered to story-driven and linear titles
-  **Personal Library**: add games and track them as Playing, Completed, or Dropped
-  **Playthrough Counter**: automatically increments every time you mark a game as completed
-  **Profile Avatar**: upload a custom picture or pull it automatically from your Google/Discord account
-  **Authentication**: email/password registration and Google OAuth via Auth0
-  **Forgot Password**: full reset flow via email using Resend

---

## Tech Stack

### Client

| Technology | Purpose |
|---|---|
| React (no JSX) | UI: built entirely with `React.createElement` |
| Vite | Build tool and dev server |
| React Router | Client-side routing |
| Auth0 | Authentication and Google OAuth |
| Tabler Icons | Icon library |

### Server

| Technology | Purpose |
|---|---|
| Node.js + Express | REST API |
| MongoDB + Mongoose | Database and ODM |
| JSON Web Tokens | Session management |
| bcryptjs | Password hashing |
| Resend | Transactional email |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A MongoDB database (local or Atlas)
- A RAWG API key:[rawg.io](https://rawg.io/apidocs)
- An Auth0 account:[auth0.com](https://auth0.com)
- A Resend account:[resend.com](https://resend.com)

### Installation

**1. Clone the repo**

    git clone https://github.com/TheGeekedNerd/where-was-i.git
    cd where-was-i

**2. Install dependencies**

    # Client
    cd client
    npm install

    # Server
    cd ../server
    npm install

**3. Set up environment variables**

See the [Environment Variables](#environment-variables) section below.

**4. Run locally**

    # In /server
    npm run dev

    # In /client
    npm run dev

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

---

## Environment Variables

### /client/.env

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL for the server, e.g. `http://localhost:5000` |
| `VITE_RAWG_API_KEY` | Your RAWG API key |
| `VITE_AUTH0_DOMAIN` | Your Auth0 domain |
| `VITE_AUTH0_CLIENT_ID` | Your Auth0 client ID |

### /server/.env

| Variable | Description |
|---|---|
| `MONGO_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A long random string used to sign tokens |
| `RESEND_API_KEY` | Your Resend API key |
| `CLIENT_URL` | Frontend URL, e.g. `http://localhost:5173` |
### Motivation behind creating this website
During the 2025 June exams I was playing Red Dead Redemption 2, The Last of Us and The Last of Us Part 2. I know it was wrong for me to be focusing on games while it's exam season, but I needed to calm my nerves down so I decided to play those games. When I was playing Red Dead Redemption and going through the story I couldn't help but feel like I wasn't reaching the climax or the end of the story — don't get me wrong I did love the experience of playing the game but it just felt too long for me. Whenever I would log off I would go to IGN walkthroughs and search for the chapter title so that I could gauge where I was in the story, but I found that doing that every time was exhausting because what if I'm playing 2 games in one day I would have to search their playthroughs and remember where I was in each game. So I was like, why not create a website that'll help make my gaming experience much less of a drag. For now this app focuses more on linear or story-based games, so games like Elden Ring are not yet catered to. Maybe one day if I make some progress in Elden Ring I'll add those kinds of games.

---

---

## License

MIT
