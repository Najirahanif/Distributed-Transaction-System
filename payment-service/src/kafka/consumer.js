const { consumer } = require("../config/kafka");

const { processPayment } = require("../services/payment.service");

const startConsumer = async () => {

    await consumer.subscribe({
        topic: "inventory-reserved",
        fromBeginning: false,
    });

    await consumer.run({

        eachMessage: async ({ message }) => {

            const data = JSON.parse(
                message.value.toString()
            );

            console.log("Received:", data);

            await processPayment(data);

        },

    });

};

module.exports = {
    startConsumer,
};