const dns = require("dns").promises;

// Throw-away / placeholder domains that can never receive our codes reliably.
const BLOCKED = new Set([
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com", "10minutemail.com", "10minutemail.net",
    "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "throwawaymail.com", "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com",
    "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "fakeinbox.com", "mailnesia.com", "mintemail.com", "mytemp.email", "emailondeck.com",
    "spamgourmet.com", "mohmal.com", "tmpmail.org", "tmpmail.net", "burnermail.io", "moakt.com", "discard.email", "mail.tm", "inboxkitten.com",
    "example.com", "example.org", "example.net", "test.com", "test.test", "email.com", "mail.com.test", "abc.com", "asdf.com", "fake.com", "nomail.com", "noemail.com", "invalid.com", "domain.com"
]);

const FORMAT = /^[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})$/i;

/**
 * Returns { ok: true } or { ok: false, message }.
 * Checks syntax, blocks disposable/placeholder domains and confirms the domain can receive mail (MX or A record).
 */
async function checkEmailDeliverable(email) {
    const value = String(email || "").trim().toLowerCase();
    const m = FORMAT.exec(value);
    if (!m || value.length > 254 || value.includes("..")) return { ok: false, message: "Please enter a valid email address." };
    const domain = m[1];
    if (BLOCKED.has(domain)) return { ok: false, message: "Temporary or placeholder email addresses aren't allowed. Please use your real email." };
    try {
        const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 4000))]);
        if (mx?.length) return { ok: true };
    } catch (e) {
        if (e.message === "timeout" || e.code === "ETIMEOUT" || e.code === "ESERVFAIL" || e.code === "ECONNREFUSED") return { ok: true }; // can't tell: let the verification code decide
        if (!["ENODATA", "ENOTFOUND"].includes(e.code)) return { ok: true };
    }
    try {
        const a = await dns.resolve4(domain);
        if (a?.length) return { ok: true };
    } catch { /* fall through */ }
    // If DNS itself is unreachable from this server, don't blame the user's address.
    try { await dns.resolveMx("gmail.com"); } catch { return { ok: true }; }
    return { ok: false, message: `We couldn't find a mail server for "${domain}". Check the spelling of your email address.` };
}

module.exports = { checkEmailDeliverable };
