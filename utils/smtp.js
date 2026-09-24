const net = require("net");
const tls = require("tls");

function readResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const onData = (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (/^\d{3} /.test(last)) { cleanup(); resolve(last); }
    };
    const onError = (err) => { cleanup(); reject(err); };
    const cleanup = () => { socket.off("data", onData); socket.off("error", onError); };
    socket.on("data", onData); socket.on("error", onError);
  });
}

async function sendCommand(socket, command, expected) {
  socket.write(`${command}\r\n`);
  const response = await readResponse(socket);
  if (expected && !String(response).startsWith(String(expected))) throw new Error(`SMTP error: ${response}`);
  return response;
}

async function sendSmtpEmail({ to, subject, text, replyTo }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "false") === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.");

  let socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("secureConnect", resolve); socket.once("error", reject); });
  await readResponse(socket);
  await sendCommand(socket, "EHLO fixora.local", 250);
  if (!secure) {
    await sendCommand(socket, "STARTTLS", 220);
    socket = await new Promise((resolve, reject) => {
      const upgraded = tls.connect({ socket, host, servername: host }, () => resolve(upgraded));
      upgraded.once("error", reject);
    });
    await sendCommand(socket, "EHLO fixora.local", 250);
  }
  await sendCommand(socket, "AUTH LOGIN", 334);
  await sendCommand(socket, Buffer.from(user).toString("base64"), 334);
  await sendCommand(socket, Buffer.from(pass).toString("base64"), 235);
  await sendCommand(socket, `MAIL FROM:<${from}>`, 250);
  await sendCommand(socket, `RCPT TO:<${to}>`, 250);
  await sendCommand(socket, "DATA", 354);
  const safeSubject = String(subject || "Fixora enquiry").replace(/[\r\n]/g, " ");
  const safeReply = String(replyTo || "").replace(/[\r\n]/g, "");
  const headers = [`From: ${from}`, `To: ${to}`, `Subject: ${safeSubject}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8"];
  if (safeReply) headers.push(`Reply-To: ${safeReply}`);
  const body = `${headers.join("\r\n")}\r\n\r\n${String(text || "").replace(/^\./gm, "..")}\r\n.`;
  await sendCommand(socket, body, 250);
  await sendCommand(socket, "QUIT", 221).catch(() => {});
  socket.end();
}

module.exports = { sendSmtpEmail };
