/**
 * Creates the first administrator account.
 *
 * Credentials are read from environment variables (server/.env) — they are
 * never stored in source control and the password is never printed.
 *
 *   ADMIN_NAME      optional, defaults to "Fixora Admin"
 *   ADMIN_EMAIL     required
 *   ADMIN_PASSWORD  required, min 12 chars, upper + lower + number + symbol
 *
 * Run:  npm run seed
 * After the admin is created you can delete ADMIN_PASSWORD from .env.
 */



require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");

const fail = (msg) => { console.error(`Seed failed: ${msg}`); process.exit(1); };

const seedAdmin = async () => {
    const name = (process.env.ADMIN_NAME || "Fixora Admin").trim();
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");

    if (!process.env.MONGO_URI) fail("MONGO_URI is not set.");
    if (!email || !password) fail("ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("ADMIN_EMAIL is not a valid email address.");
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        fail("ADMIN_PASSWORD must be at least 12 characters with upper-case, lower-case, a number and a symbol.");
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);

        if (await User.findOne({ role: "admin" })) {
            console.log("An admin account already exists. Nothing to do.");
            return process.exit(0);
        }

        const hashed = await bcrypt.hash(password, 12);
        const admin = await User.create({ name, email, password: hashed, role: "admin", status: "active" });

        console.log(`Admin created: ${admin.email}`);
        console.log("You can now remove ADMIN_PASSWORD from server/.env.");
        process.exit(0);
    } catch (error) {
        fail(error.message);
    }
};

seedAdmin();
