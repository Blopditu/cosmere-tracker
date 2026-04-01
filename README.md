# Cosmere Tracker

Local-first GM console for tabletop sessions, with an Angular frontend, an Express backend, JSON persistence, local uploads, and a navy-and-gold Cosmere-inspired UI.

## Stack

- Frontend: Angular 21
- Backend: Node.js + Express + TypeScript
- Persistence: JSON files in `backend/data/`
- Uploads: local files in `backend/uploads/`
- Shared types: `shared/domain/`

## Features

- Session management with party members and enemy templates
- Session dashboard with recent rolls and combats
- Global roll tracker with analytics
- Combat setup, turn grouping, action logging, focus and damage tracking
- Post-combat scoreboard
- Stage manager with spoiler-safe publish flow
- Player display route that only shows the live background image

## Local Development

Install dependencies:

```bash
npm install
```

Run frontend and backend together:

```bash
npm start
```

Default ports:

- Frontend: `http://localhost:4200`
- Backend: `http://localhost:3000`

If port `3000` is already in use on your machine, override it:

```bash
PORT=3100 npm run start:backend
```

The Angular dev server proxies `/api` and `/uploads` to the backend through `proxy.conf.json`.

If you are running the frontend against a different backend base, for example
`http://localhost:3000/api/v1`, set it once in the browser console:

```js
localStorage.setItem('cosmere.apiBase', 'http://localhost:3000/api/v1');
location.reload();
```

To clear that override and go back to the local Angular proxy:

```js
localStorage.removeItem('cosmere.apiBase');
location.reload();
```

You can also set it temporarily with a query parameter:

```text
http://localhost:4200/gm/import/review?apiBase=http://localhost:3000/api/v1
```

## Scripts

```bash
npm start
npm run start:frontend
npm run start:backend
npm run build
npm run build:backend
npm test
```

## Storage and Git

Runtime data is intentionally not tracked in Git:

- `backend/data/`
- `backend/uploads/`

These paths are ignored in `.gitignore` so local session data and uploaded scene images stay out of source control.

## Main Routes

- `/sessions`
- `/sessions/:sessionId`
- `/sessions/:sessionId/rolls`
- `/sessions/:sessionId/combats/new`
- `/sessions/:sessionId/combats/:combatId`
- `/sessions/:sessionId/combats/:combatId/summary`
- `/gm/stage-manager/:sessionId`
- `/display/:sessionId`

## Build Verification

The current implementation is verified with:

```bash
npm run build
npm run build:backend
```
