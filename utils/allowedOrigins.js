/**
 * Single source of truth for which browser origins may call the API.
 * Set on the server (Vercel env):
 *   CLIENT_URL / FRONTEND_URL   one frontend URL each
 *   ALLOWED_ORIGINS             comma-separated extra URLs (e.g. preview deployments)
 * Trailing slashes and surrounding spaces are ignored.
 */
const clean = (v) => String(v || "").trim().replace(/\/+$/, "");

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    ...String(process.env.ALLOWED_ORIGINS || "").split(","),
].map(clean).filter(Boolean);

const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(clean(origin));

module.exports = { allowedOrigins, isAllowedOrigin };
