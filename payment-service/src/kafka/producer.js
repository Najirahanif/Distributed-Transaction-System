const { producer } = require("../config/kafka");

const publishEvent = async (topic, message) => {

    try {

        await producer.send({

            topic,

            messages: [
                {
                    value: JSON.stringify(message),
                },
            ],
        });

        console.log(`✅ Published to ${topic}`);

    } catch (error) {

        console.error(error);

        throw error;
    }
};

module.exports = {
    publishEvent,
};