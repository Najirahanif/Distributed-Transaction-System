const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Use localhost if not specified in .env
        const MONGO_URL = process.env.MONGO_URI || 'mongodb://mongodb:27017/order-db?replicaSet=rs0';

        console.log(`📡 Connecting to MongoDB at: ${MONGO_URL}`);

        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            // Remove deprecated options
        });


        console.log('✅ MongoDB connected successfully');

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

    } catch (error) {
        console.error('❌ MongoDB Connection Failed');
        console.error(error.message);
        throw error;
    }
};

module.exports = connectDB;