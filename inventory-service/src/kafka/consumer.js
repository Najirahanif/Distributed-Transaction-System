const { consumer } = require("../config/kafka");

const { reserveInventory } = require("../services/inventory.service");

const startConsumer = async () => {

    await consumer.subscribe({
        topic: "order-created",
        fromBeginning: true,
    });

    await consumer.run({

        eachMessage: async ({ message }) => {

            const order = JSON.parse(
                message.value.toString()
            );

            console.log("📦 Order Received");

            console.log(order);

            await reserveInventory(order);

        },

    });

};

module.exports = {
    startConsumer,
};