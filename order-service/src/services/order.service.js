const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderAudit = require("../models/OrderAudit");
const { publishEvent } = require("../kafka/producer");

// ================= CREATE ORDER =================
const createOrder = async (orderData) => {
    const session = await mongoose.startSession();
    let order = null;
    let committed = false;

    try {
        session.startTransaction();

        const [orderDoc] = await Order.create(
            [
                {
                    productId: orderData.productId,
                    quantity: orderData.quantity,
                    amount: orderData.amount,
                    status: "PENDING",
                },
            ],
            { session }
        );

        await OrderAudit.create(
            [
                {
                    orderId: orderDoc._id,
                    action: "ORDER_CREATED",
                    message: "Order created successfully",
                    metadata: {
                        productId: orderData.productId,
                        quantity: orderData.quantity,
                        amount: orderData.amount,
                    },
                },
            ],
            { session }
        );

        order = orderDoc;

        await session.commitTransaction();
        committed = true;

        try {
            await publishEvent("order-created", {
                orderId: order._id.toString(),
                productId: order.productId,
                quantity: order.quantity,
                amount: order.amount,
                status: order.status,
            });
        } catch (err) {
            console.error("Kafka publish failed:", err.message);
        }

        return order;
    } catch (err) {
        if (!committed) {
            await session.abortTransaction();
        }
        throw err;
    } finally {
        session.endSession();
    }
};

// ================= INVENTORY RESERVED =================
const handleInventoryReserved = async (data) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "INVENTORY_RESERVED",
                updated_at: new Date(),
            },
            {
                new: true,
                session,
            }
        );

        if (!order) {
            throw new Error("Order not found");
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "INVENTORY_RESERVED",
                    message: "Inventory reserved successfully",
                    metadata: data,
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// ================= PAYMENT SUCCESS =================
const handlePaymentSuccess = async (data) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "PAID",
                updated_at: new Date(),
            },
            {
                new: true,
                session,
            }
        );

        if (!order) {
            throw new Error("Order not found");
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "PAYMENT_SUCCESS",
                    message: "Payment completed",
                    metadata: data,
                },
            ],
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// ================= GETTERS =================
const getOrder = (id) => Order.findById(id);

const getAllOrders = () =>
    Order.find().sort({ created_at: -1 });

const getOrdersByStatus = (status) =>
    Order.find({ status }).sort({ created_at: -1 });

const getOrderAuditLogs = (orderId) =>
    OrderAudit.find({ orderId }).sort({ created_at: -1 });

module.exports = {
    createOrder,
    handleInventoryReserved,
    handlePaymentSuccess,
    getOrder,
    getAllOrders,
    getOrdersByStatus,
    getOrderAuditLogs,
};