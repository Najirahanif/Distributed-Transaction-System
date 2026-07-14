const { Kafka } = require("kafkajs");

const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const CLIENT_ID = process.env.CLIENT_ID || 'order-service';

console.log(`📡 Kafka Broker: ${KAFKA_BROKER}`);

const kafka = new Kafka({
    clientId: CLIENT_ID,
    brokers: [KAFKA_BROKER],
    retry: {
        initialRetryTime: 300,
        retries: 10,
        maxRetryTime: 30000,
    },
    connectionTimeout: 5000,
    requestTimeout: 25000,
});

module.exports = kafka;