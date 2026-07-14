const crypto = require('crypto');
global.crypto = crypto;
require("dotenv").config();

const app = require("./app");

const connectDB = require("./config/database");
const { connectConsumer, connectProducer } = require("./config/kafka");
const { startConsumer } = require("./kafka/consumer");

const PORT = process.env.PORT || 3002;

const startServer = async () => {
    try {

        await connectDB();

        await connectProducer();

        await connectConsumer();

        await startConsumer();

        app.listen(PORT, () => {
            console.log(`🚀 Inventory Service running on port ${PORT}`);
        });

    } catch (error) {

        console.error(error);

        process.exit(1);

    }
};

startServer();