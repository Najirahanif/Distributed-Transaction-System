const crypto = require('crypto');
global.crypto = crypto;

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');
const { connectProducer } = require('./kafka/producer');
const { connectConsumer, startConsumer } = require('./kafka/consumer');

const PORT = process.env.PORT || 3001;

const startServer = async () => {
    try {
        console.log('🚀 Starting Order Service...');
        
        // 1. Connect to MongoDB
        await connectDB();
        console.log('✅ Database connected');

        // 2. Connect to Kafka Producer
        await connectProducer();
        console.log('✅ Kafka Producer connected');

        // 3. Connect to Kafka Consumer
        await connectConsumer();
        console.log('✅ Kafka Consumer connected');

        // 4. Start the Consumer
        await startConsumer();
        console.log('✅ Kafka Consumer started and listening for events');

        // 5. Start Express Server
        app.listen(PORT, () => {
            console.log(`🚀 Order Service running on port ${PORT}`);
            console.log(`📡 Health: http://localhost:${PORT}/api/health`);
            console.log(`📡 API: http://localhost:${PORT}/api/orders`);
        });

    } catch (error) {
        console.error('❌ Failed to start Order Service');
        console.error(error);
        process.exit(1);
    }
};

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

startServer();