const kafka = require('../config/kafka');

let producer;

async function connectProducer() {
    if (!producer) {
        producer = kafka.producer({
            allowAutoTopicCreation: true,
            idempotent: true,
            maxInFlightRequests: 1,
        });
        await producer.connect();
        console.log('✅ Kafka Producer Connected');
    }
    return producer;
}

async function publishEvent(topic, message) {
    try {
        await connectProducer();
        
        await producer.send({
            topic: topic,
            messages: [
                {
                    key: message.orderId || Date.now().toString(),
                    value: JSON.stringify(message),
                    headers: {
                        source: 'order-service',
                        timestamp: Date.now().toString()
                    }
                }
            ]
        });
        
        console.log(`📤 Event published to ${topic}:`, message);
        return { success: true };
        
    } catch (error) {
        console.error('❌ Failed to publish event to ${topic}:', error.message);
        throw error;
    }
}

async function disconnectProducer() {
    if (producer) {
        await producer.disconnect();
        console.log('✅ Producer disconnected');
    }
}

module.exports = { 
    connectProducer, 
    publishEvent, 
    disconnectProducer 
};