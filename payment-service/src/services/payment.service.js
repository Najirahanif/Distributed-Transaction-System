const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const PaymentAudit = require("../models/PaymentAudit");

const { publishEvent } = require("../kafka/producer");

const processPayment = async (data) => {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        // Simulate payment failure
        const paymentSuccess = Math.random() > 0.3;

        const [payment] = await Payment.create(
            [
                {
                    orderId: data.orderId,
                    amount: data.amount,
                    status: paymentSuccess ? "SUCCESS" : "FAILED",
                },
            ],
            { session }
        );

        await PaymentAudit.create(
            [
                {
                    paymentId: payment._id,
                    action: paymentSuccess
                        ? "PAYMENT_SUCCESS"
                        : "PAYMENT_FAILED",
                    message: paymentSuccess
                        ? "Payment completed."
                        : "Payment failed.",
                },
            ],
            { session }
        );

        await session.commitTransaction();

        console.log("✅ Payment Transaction Committed");

        if (paymentSuccess) {

            await publishEvent("payment-success", {
                orderId: data.orderId,
            });

        } else {

            await publishEvent("payment-failed", {
                orderId: data.orderId,
                productId: data.productId,
                quantity: data.quantity,
            });

        }

    } catch (error) {

        await session.abortTransaction();

        console.error(error);

    } finally {

        session.endSession();

    }

};

module.exports = {
    processPayment,
};