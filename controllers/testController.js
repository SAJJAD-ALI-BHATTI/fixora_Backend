const mongoose = require("mongoose");

const getApiTest = (req, res) => {
    const databaseState = mongoose.connection.readyState;

    const states = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting"
    };

    res.status(200).json({
        success: true,
        message: "Fixora API is running",
        data: {
            api: "ok",
            database: states[databaseState] || "unknown",
            timestamp: new Date().toISOString()
        }
    });
};

module.exports = {
    getApiTest
};