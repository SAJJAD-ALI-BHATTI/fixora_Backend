const imagekit = require("../config/imagekit");

const KYC_FOLDER = "/fixora/kyc";
const AVATAR_FOLDER = "/fixora/avatars";

function endpoint() {
    return String(process.env.IMAGEKIT_URL_ENDPOINT || "").replace(/\/+$/, "");
}

// Accepts only files that live under our own ImageKit account and the expected folder.
function isOwnFile(url, folder) {
    const base = endpoint();
    if (!base || typeof url !== "string") return false;
    return url.startsWith(`${base}${folder}/`) && !url.includes("..");
}

function sniffImage(buffer) {
    if (!buffer || buffer.length < 12) return false;
    const jpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const png = buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp = buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP";
    return jpg || png || webp;
}

// Short-lived signed URL so admins can view private CNIC files.
function signedUrl(url, seconds = 600) {
    if (!url) return "";
    try {
        return imagekit.url({ src: url, signed: true, expireSeconds: seconds });
    } catch {
        return "";
    }
}

function publicVerification(user) {
    const v = user.verification || {};
    return {
        state: v.state || "not_required",
        submittedAt: v.submittedAt || null,
        reviewedAt: v.reviewedAt || null,
        reviewNote: v.reviewNote || "",
        infoRequest: v.infoRequest || { message: "", requestedAt: null }
    };
}

function validateDocuments(docs) {
    const errors = [];
    const d = docs || {};
    if (!d.profileImage?.url || !isOwnFile(d.profileImage.url, AVATAR_FOLDER)) errors.push("A valid profile image is required");
    if (!d.cnicFront?.url || !isOwnFile(d.cnicFront.url, KYC_FOLDER)) errors.push("CNIC front image is required");
    if (!d.cnicBack?.url || !isOwnFile(d.cnicBack.url, KYC_FOLDER)) errors.push("CNIC back image is required");
    return errors;
}

function cleanDocuments(d) {
    const pick = (x) => ({ url: String(x.url), fileId: String(x.fileId || "") });
    return { profileImage: pick(d.profileImage), cnicFront: pick(d.cnicFront), cnicBack: pick(d.cnicBack) };
}

module.exports = { KYC_FOLDER, AVATAR_FOLDER, isOwnFile, sniffImage, signedUrl, publicVerification, validateDocuments, cleanDocuments };
