const mongoose = require("mongoose");
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // Forces Google and Cloudflare DNS
const connectDB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGO_URI);

        console.log(
            `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`
        );
    } catch (error) {
        console.error(`MongoDB connection failed: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;