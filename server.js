require("dotenv").config();

const http = require("http");

const app = require("./app");

const connectDB = require("./config/db");

const {
    initializeSocket
} = require("./socket/socket");

const PORT =
    process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();

        const httpServer =
            http.createServer(app);

        initializeSocket(httpServer);

        httpServer.listen(PORT, () => {
            console.log(
                `Server running on port ${PORT}`
            );
        });
    } catch (error) {
        console.error(
            "Server startup failed:",
            error.message
        );

        process.exit(1);
    }
};

startServer();