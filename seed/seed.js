require("dotenv").config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // Forces Google and Cloudflare DNS
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const User = require("../models/User");

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected");

        const existingAdmin = await User.findOne({
            role: "admin"
        });

        if (existingAdmin) {
            console.log("Admin already exists");
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(
            "Admin@123456",
            10
        );

        const admin = await User.create({
            name: "Fixora Admin",
            email: "admin@fixora.com",
            password: hashedPassword,
            role: "admin",
            status: "active"
        });

        console.log("Admin created successfully");
        console.log("Email:", admin.email);
        console.log("Password: Admin@123456");

        process.exit(0);
    } catch (error) {
        console.error("Seed failed:", error.message);
        process.exit(1);
    }
};

seedAdmin();