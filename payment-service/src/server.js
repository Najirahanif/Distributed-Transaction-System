const crypto = require('crypto');
global.crypto = crypto;
require("dotenv").config();

const app = require("./app");

const connectDB = require("./config/database");
const { connectProducer, connectConsumer } = require("./config/kafka");
const { startConsumer } = require("./kafka/consumer");

const PORT = process.env.PORT || 3003;

const startServer = async () => {
    try {

        await connectDB();
        await connectProducer();
        await connectConsumer();
        await startConsumer();
        app.listen(PORT, () => {
            console.log(`🚀 Payment Service running on port ${PORT}`);
        });

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();