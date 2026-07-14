const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        amount: {
            type: Number,
            required: true,
        },

        status: {
            type: String,
            enum: [
                "PENDING",
                "SUCCESS",
                "FAILED"
            ],
            default: "PENDING",
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Payment", paymentSchema);