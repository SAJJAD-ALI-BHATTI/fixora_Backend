const mongoose = require("mongoose");

const contactInquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, default: "Fixora enquiry", trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ["new", "read", "resolved"], default: "new" }
}, { timestamps: true });

module.exports = mongoose.model("ContactInquiry", contactInquirySchema);
