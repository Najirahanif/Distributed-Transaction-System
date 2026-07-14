const mongoose = require("mongoose");

const paymentAuditSchema = new mongoose.Schema(
    {
        paymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            required: true,
        },

        action: {
            type: String,
            enum: [
                "PAYMENT_CREATED",
                "PAYMENT_SUCCESS",
                "PAYMENT_FAILED"
            ],
            required: true,
        },

        message: {
            type: String,
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "PaymentAudit",
    paymentAuditSchema
);