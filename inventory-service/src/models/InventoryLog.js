const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
    {
        orderId: {
            type: String,
            required: true,
        },

        productId: {
            type: String,
            required: true,
        },

        quantity: {
            type: Number,
            required: true,
        },

        action: {
            type: String,
            enum: [
                "STOCK_RESERVED",
                "STOCK_RELEASED"
            ],
            required: true,
        },

        message: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);