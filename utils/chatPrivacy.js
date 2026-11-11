// Helpers that keep per-user chat privacy rules in one place.
const idOf = (v) => String((v && (v._id || v.id)) || v || "");

/** Replace lastMessage with a privacy-safe preview for the viewing user. */
function previewFor(conversation, userId) {
  const plain = conversation && conversation.toObject ? conversation.toObject() : { ...conversation };
  const last = plain.lastMessage;
  if (!last || typeof last !== "object") return plain;
  const hidden = Array.isArray(last.deletedFor) && last.deletedFor.some((u) => idOf(u) === String(userId));
  if (hidden || last.deleted) {
    plain.lastMessage = null;
  } else if (last.unsent) {
    plain.lastMessage = { ...last, text: "", attachments: [], unsent: true };
  }
  return plain;
}

module.exports = { previewFor, idOf };
