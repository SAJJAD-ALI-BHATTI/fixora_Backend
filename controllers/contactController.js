const ContactInquiry = require("../models/ContactInquiry");
const { sendSmtpEmail } = require("../utils/smtp");

const createContactInquiry = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!name?.trim() || !normalizedEmail || !message?.trim()) return res.status(400).json({ success:false, message:"Name, email and message are required." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(normalizedEmail)) return res.status(400).json({ success:false, message:"Please enter a valid email address." });
    if (String(message).trim().length < 10) return res.status(400).json({ success:false, message:"Please provide a little more detail so our team can help." });
    const inquiry = await ContactInquiry.create({ name, email, subject: subject || "Fixora enquiry", message });
    const recipient = process.env.CONTACT_RECEIVER_EMAIL || process.env.SMTP_USER;
    let emailSent = false;
    if (recipient && process.env.SMTP_HOST) {
      try { await sendSmtpEmail({ to: recipient, subject: `[Fixora Contact] ${subject || "New enquiry"}`, replyTo: email, text: `Name: ${name}\nEmail: ${email}\n\n${message}` }); emailSent = true; } catch (mailError) { console.error("Contact email delivery failed:", mailError.message); }
    }
    res.status(201).json({ success:true, message: emailSent ? "Your message has been sent to the Fixora team." : "Your message has been received. The Fixora team can review it from the server inbox.", data:{ inquiryId: inquiry._id, emailSent } });
  } catch (error) { next(error); }
};
module.exports = { createContactInquiry };
