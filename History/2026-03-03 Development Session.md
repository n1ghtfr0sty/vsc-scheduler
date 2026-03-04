# Development Session: March 3, 2026

## Focus
Security and Architecture Modernization

## Key Changes
1. **Database Modernization**: Migrated from WebAssembly `sql.js` (with its custom synchronous disk-writing proxy) to the native synchronous `better-sqlite3` driver. This dramatically reduces memory footprint, eliminates the risk of an Out-Of-Memory DoS from loading the whole DB into RAM, and improves performance via WAL mode.
2. **Authentication Modernization**: Replaced `bcryptjs` (a pure-JS implementation that blocks the event loop on heavy hashing) with native `bcrypt` using asynchronous promises. Added `express-rate-limit` to the `/login` endpoint to prevent brute-force and volumetric attacks.
3. **Session Stability**: Replaced default memory session store (which inherently leaks and scales poorly) with `connect-sqlite3` to store sessions in `data/vsc.db.sessions`.
4. **Documentation**: Updated `GEMINI.md` to reflect the new architecture stack and commands.

## Files Modified
- `src/db.js`: Rewritten wrapper.
- `src/index.js`: Reconfigured `express-session`.
- `src/routes/auth.js`: Implemented `bcrypt` async and `express-rate-limit`.
- `src/seed.js`: Updated to handle the new `db` wrapper and native `bcrypt`.
- `package.json`: Updated dependencies.
- `GEMINI.md`: Updated architecture documentation.
