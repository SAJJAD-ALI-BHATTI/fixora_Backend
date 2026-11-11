/**
 * Single source of truth for which browser origins may call the API.
 * Set on the server (Vercel env):
 *   CLIENT_URL / FRONTEND_URL   one frontend URL each
 *   ALLOWED_ORIGINS             comma-separated extra URLs (e.g. preview deployments)
 *   ALLOWED_ORIGIN_PATTERNS     comma-separated wildcard patterns, e.g. *.vercel.app
 *                               Supports a single leading wildcard (*).
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

// Wildcard patterns — supports a single leading "*", e.g. "*.vercel.app"
// Set ALLOWED_ORIGIN_PATTERNS=*.vercel.app on Vercel to allow all preview deployments.
const allowedPatterns = String(process.env.ALLOWED_ORIGIN_PATTERNS || "")
    .split(",")
    .map(clean)
    .filter(Boolean)
    .map((p) => {
        if (p.startsWith("*")) {
            const suffix = p.slice(1); // e.g. ".vercel.app"
            return (origin) => origin.endsWith(suffix);
        }
        return (origin) => origin === p;
    });

const isAllowedOrigin = (origin) =>
    !origin ||
    allowedOrigins.includes(clean(origin)) ||
    allowedPatterns.some((match) => match(clean(origin)));

module.exports = { allowedOrigins, isAllowedOrigin };
