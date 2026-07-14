const mongoose = require("mongoose");

const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");

const { publishEvent } = require("../kafka/producer");

const reserveInventory = async (order) => {

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        const product = await Product.findOne(
            {
                productId: order.productId,
            },
            null,
            {
                session,
            }
        );

        if (!product) {
            throw new Error("Product not found");
        }

        if (product.stock < order.quantity) {
            console.log(`❌ Insufficient stock. Available: ${product.stock}, Requested: ${order.quantity}`);
            await session.abortTransaction();
            session.endSession();

            // ✅ Publish detailed failure event
            await publishEvent("inventory-failed", {
                orderId: order.orderId,
                productId: order.productId,
                reason: "OUT_OF_STOCK",
                message: `Insufficient stock. Available: ${product.stock}, Requested: ${order.quantity}`,
                availableStock: product.stock,
                requestedQuantity: order.quantity,
                status: "FAILED"
            });

            return; // Exit the function
        }

        product.stock -= order.quantity;

        await product.save({
            session,
        });

        await InventoryLog.create(
            [
                {
                    orderId: order.orderId,
                    productId: order.productId,
                    quantity: order.quantity,
                    action: "STOCK_RESERVED",
                    message: "Inventory Reserved",
                },
            ],
            {
                session,
            }
        );

        await session.commitTransaction();

        console.log("✅ Inventory Transaction Committed");

        await publishEvent("inventory-reserved", order);

    } catch (error) {

        await session.abortTransaction();

        console.error(error);

    } finally {

        session.endSession();

    }
};

module.exports = {
    reserveInventory,
};