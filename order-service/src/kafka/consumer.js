const kafka = require('../config/kafka');
const orderService = require('../services/order.service');

let consumer;

async function connectConsumer() {
    if (!consumer) {
        consumer = kafka.consumer({
            groupId: 'order-service-group',
            sessionTimeout: 30000,
            heartbeatInterval: 3000,
            maxPollInterval: 300000,
        });
        
        await consumer.connect();
        console.log('✅ Order Service Kafka Consumer Connected');
    }
    return consumer;
}

async function startConsumer() {
    try {
        if (!consumer) {
            await connectConsumer();
        }
        
        // Subscribe to all relevant topics
        await consumer.subscribe({ 
            topics: ['inventory-reserved', 'inventory-failed', 'payment-success', 'payment-failed'],
            fromBeginning: true
        });
        
        console.log('✅ Subscribed to topics: inventory-reserved, inventory-failed, payment-success, payment-failed');
        
        // Process messages
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const data = JSON.parse(message.value.toString());
                    console.log(`📥 Order Service received: ${topic}`, data);
                    
                    switch(topic) {
                        case 'inventory-reserved':
                            await orderService.handleInventoryReserved(data);
                            break;
                        case 'inventory-failed':
                            await orderService.handleInventoryFailed(data);
                            break;
                        case 'payment-success':
                            await orderService.handlePaymentSuccess(data);
                            break;
                        case 'payment-failed':
                            await orderService.handlePaymentFailed(data);
                            break;
                        default:
                            console.log(`⚠️ Unknown topic: ${topic}`);
                    }
                    
                } catch (error) {
                    console.error('❌ Error processing message:', error);
                }
            }
        });
        
        console.log('✅ Order Service Consumer started and running');
        
    } catch (error) {
        console.error('❌ Failed to start consumer:', error);
        throw error;
    }
}

async function disconnectConsumer() {
    if (consumer) {
        await consumer.disconnect();
        console.log('✅ Consumer disconnected');
    }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    await disconnectConsumer();
});

module.exports = { 
    connectConsumer, 
    startConsumer, 
    disconnectConsumer 
};