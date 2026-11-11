# AGENTS.md

## Must-follow constraints
- Do not introduce frontend build steps (Webpack/Vite) or NPM frontend dependencies. The `www/` directory is purely vanilla HTML/JS/CSS.
- Firestore interactions must use the REST API (`fetch`) directly to avoid SDK bloat. Do not install the Firebase Web SDK.
- Do not use `window.confirm` or `window.alert` without defensive checks, as they cause crashes in some Tauri webview contexts.

## Repo-specific conventions
- UI changes must follow the established Neo-Brutalist design DNA (thick borders, hard shadows, `var(--ink)`, Outfit font).
- Follow "ponytail" coding rules: prefer standard platform features, fewest files possible, and minimal abstractions.

## Important locations
- `www/index.html`: Contains all frontend layout, inline styles, and game logic.
- `www/words.js`: The game dictionary. Stored as a compressed `.split(" ")` string.
- `firestore.rules`: Defines the database schema, validations, and the authoritative profanity filter.

## Change safety rules
- The database schema is strictly enforced. Any change to the leaderboard data structure (`name`, `score`, `createdAt`) requires updating both `www/index.html` and `firestore.rules`.
- If you modify the profanity regex in `firestore.rules`, you MUST mirror the exact change in the `nameOk` regex in `www/index.html`.
