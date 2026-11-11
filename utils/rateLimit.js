// Tiny in-memory fixed-window limiter (no extra dependency).
// Good enough as a first line of defence; use a shared store behind multiple instances.
const buckets = new Map();

function rateLimit({ windowMs, max, keyPrefix = "rl", message = "Too many requests. Please try again later." }) {
    return (req, res, next) => {
        const key = `${keyPrefix}:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
        const now = Date.now();
        let b = buckets.get(key);
        if (!b || b.resetAt <= now) b = { count: 0, resetAt: now + windowMs };
        b.count += 1;
        buckets.set(key, b);
        if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
        if (b.count > max) {
            const retryAfter = Math.ceil((b.resetAt - now) / 1000);
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({ success: false, message, data: { retryAfter } });
        }
        next();
    };
}

module.exports = { rateLimit };
