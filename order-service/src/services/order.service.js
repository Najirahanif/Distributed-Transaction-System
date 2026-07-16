const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderAudit = require("../models/OrderAudit");
const { publishEvent } = require("../kafka/producer");

const pendingTransactions = new Map();
// ============ CREATE ORDER ============
async function createOrder(orderData) {
    const session = await mongoose.startSession();
    const orderId = null;

    try {
        session.startTransaction();

        // Create Order
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

        // Create Audit Log
        await OrderAudit.create(
            [
                {
                    orderId: orderDoc._id,
                    action: "ORDER_CREATED",
                    message: "Order created successfully",
                    metadata: {
                        productId: orderData.productId,
                        quantity: orderData.quantity,
                        amount: orderData.amount
                    }
                },
            ],
            { session }
        );

        // Store session and orderId for later commit/abort
        const orderIdStr = orderDoc._id.toString();
        pendingTransactions.set(orderIdStr, {
            session,
            orderId: orderIdStr,
            status: 'PENDING',
            resolved: false
        });

        // Publish Event to Kafka
        try {
            await publishEvent("order-created", {
                orderId: orderIdStr,
                productId: orderDoc.productId,
                quantity: orderDoc.quantity,
                amount: orderDoc.amount,
                status: orderDoc.status,
            });
            console.log("✅ Kafka Event Published for order:", orderIdStr);
        } catch (kafkaError) {
            console.error("❌ Kafka publish failed:", kafkaError.message);
            pendingTransactions.delete(orderIdStr);
            await session.abortTransaction();
            throw new Error(`Failed to publish order event: ${kafkaError.message}`);
        }

        // Wait for inventory response (with timeout)
        const inventoryResult = await waitForInventoryResponse(orderIdStr);

        if (inventoryResult === 'FAILED') {
            console.error(`❌ Inventory reservation failed for order: ${orderIdStr}`);
            pendingTransactions.delete(orderIdStr);
            await session.abortTransaction();
            throw new Error(`Inventory reservation failed`);
        }

        // Update order status to INVENTORY_RESERVED
        await Order.findByIdAndUpdate(
            orderDoc._id,
            {
                status: "INVENTORY_RESERVED",
                updated_at: new Date()
            },
            {
                session
            }
        );

        // Wait for payment response (with timeout)
        const paymentResult = await waitForPaymentResponse(orderIdStr);

        if (paymentResult === 'FAILED') {
            console.error(`❌ Payment failed for order: ${orderIdStr}`);
            pendingTransactions.delete(orderIdStr);
            await session.abortTransaction();
            throw new Error(`Payment failed`);
        }

        // Update order status to PAID
        await Order.findByIdAndUpdate(
            orderDoc._id,
            {
                status: "PAID",
                updated_at: new Date()
            },
            {
                session
            }
        );

        // Add payment success audit log
        await OrderAudit.create(
            [
                {
                    orderId: orderDoc._id,
                    action: "PAYMENT_SUCCESS",
                    message: `Payment completed for order ${orderDoc._id}`,
                    metadata: {
                        amount: orderData.amount
                    }
                }
            ],
            { session }
        );

        // ✅ Commit transaction only after all steps succeed
        await session.commitTransaction();
        console.log(`✅ Order ${orderIdStr} created successfully with payment completed`);

        // Clean up
        pendingTransactions.delete(orderIdStr);

        return orderDoc;

    } catch (error) {
        if (session.transaction && session.transaction.isActive) {
            await session.abortTransaction();
            console.error("❌ Transaction Aborted");
        }
        console.error("❌ Error creating order:", error);
        throw error;
    } finally {
        session.endSession();
    }
}

// Helper function to wait for inventory response
async function waitForInventoryResponse(orderId, timeout = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const transaction = pendingTransactions.get(orderId);

            if (transaction && transaction.inventoryStatus === 'SUCCESS') {
                clearInterval(checkInterval);
                resolve('SUCCESS');
                return;
            }

            if (transaction && transaction.inventoryStatus === 'FAILED') {
                clearInterval(checkInterval);
                resolve('FAILED');
                return;
            }

            // Check timeout
            if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error(`⏰ Inventory response timeout for order: ${orderId}`);
                resolve('FAILED');
                return;
            }
        }, 500);
    });
}

// Helper function to wait for payment response
async function waitForPaymentResponse(orderId, timeout = 30000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const transaction = pendingTransactions.get(orderId);

            if (transaction && transaction.paymentStatus === 'SUCCESS') {
                clearInterval(checkInterval);
                resolve('SUCCESS');
                return;
            }

            if (transaction && transaction.paymentStatus === 'FAILED') {
                clearInterval(checkInterval);
                resolve('FAILED');
                return;
            }

            // Check timeout
            if (Date.now() - startTime > timeout) {
                clearInterval(checkInterval);
                console.error(`⏰ Payment response timeout for order: ${orderId}`);
                resolve('FAILED');
                return;
            }
        }, 500);
    });
}

// ============ HANDLE INVENTORY RESERVED ============
async function handleInventoryReserved(data) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "INVENTORY_RESERVED",
                updated_at: new Date()
            },
            {
                new: true,
                session
            }
        );

        if (!order) {
            throw new Error(`Order ${data.orderId} not found`);
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "INVENTORY_RESERVED",
                    message: `Inventory reserved for order ${data.orderId}`,
                    metadata: {
                        productId: data.productId,
                        quantity: data.quantity,
                        reservationId: data.reservationId
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();
        console.log(`📦 Inventory reserved for order: ${data.orderId}`);

    } catch (error) {
        if (session.transaction && session.transaction.isActive) {
            await session.abortTransaction();
        }
        console.error('❌ Error handling inventory reserved:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ============ HANDLE INVENTORY FAILED ============
async function handleInventoryFailed(data) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "FAILED",
                failure_reason: data.reason || data.message || "Inventory reservation failed",
                updated_at: new Date()
            },
            {
                new: true,
                session
            }
        );

        if (!order) {
            throw new Error(`Order ${data.orderId} not found`);
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "INVENTORY_FAILED",
                    message: `Inventory reservation failed: ${data.reason || data.message}`,
                    metadata: {
                        productId: data.productId,
                        quantity: data.quantity,
                        reason: data.reason,
                        availableStock: data.availableStock,
                        requestedQuantity: data.requestedQuantity
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();
        console.log(`❌ Inventory failed for order: ${data.orderId}`);

    } catch (error) {
        if (session.transaction && session.transaction.isActive) {
            await session.abortTransaction();
        }
        console.error('❌ Error handling inventory failed:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ============ HANDLE PAYMENT SUCCESS ============
async function handlePaymentSuccess(data) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "PAID",
                updated_at: new Date()
            },
            {
                new: true,
                session
            }
        );

        if (!order) {
            throw new Error(`Order ${data.orderId} not found`);
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "PAYMENT_SUCCESS",
                    message: `Payment completed for order ${data.orderId}`,
                    metadata: {
                        paymentId: data.paymentId,
                        amount: data.amount
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();
        console.log(`💳 Payment completed for order: ${data.orderId}`);

    } catch (error) {
        if (session.transaction && session.transaction.isActive) {
            await session.abortTransaction();
        }
        console.error('❌ Error handling payment success:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ============ HANDLE PAYMENT FAILED ============
async function handlePaymentFailed(data) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const order = await Order.findByIdAndUpdate(
            data.orderId,
            {
                status: "FAILED",
                failure_reason: data.error || "Payment failed",
                updated_at: new Date()
            },
            {
                new: true,
                session
            }
        );

        if (!order) {
            throw new Error(`Order ${data.orderId} not found`);
        }

        await OrderAudit.create(
            [
                {
                    orderId: order._id,
                    action: "PAYMENT_FAILED",
                    message: `Payment failed: ${data.error || "Unknown error"}`,
                    metadata: {
                        paymentId: data.paymentId,
                        amount: data.amount,
                        error: data.error
                    }
                }
            ],
            { session }
        );

        await session.commitTransaction();
        console.log(`❌ Payment failed for order: ${data.orderId}`);

        try {
            await publishEvent("order-failed", {
                orderId: data.orderId,
                reason: data.error || "Payment failed"
            });
            console.log(`🔄 Compensation event published for order: ${data.orderId}`);
        } catch (kafkaError) {
            console.error(`⚠️ Failed to publish compensation event: ${kafkaError.message}`);
        }

    } catch (error) {
        if (session.transaction && session.transaction.isActive) {
            await session.abortTransaction();
        }
        console.error('❌ Error handling payment failed:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ============ GET ORDER BY ID ============
async function getOrder(orderId) {
    return await Order.findById(orderId);
}

// ============ GET ORDER BY ORDER ID (String) ============
async function getOrderByOrderId(orderIdStr) {
    return await Order.findOne({ _id: orderIdStr });
}

// ============ GET ALL ORDERS ============
async function getAllOrders() {
    return await Order.find().sort({ created_at: -1 });
}

// ============ GET ORDERS BY STATUS ============
async function getOrdersByStatus(status) {
    return await Order.find({ status }).sort({ created_at: -1 });
}

// ============ GET ORDER AUDIT LOGS ============
async function getOrderAuditLogs(orderId) {
    return await OrderAudit.find({ orderId }).sort({ created_at: -1 });
}

module.exports = {
    createOrder,
    handleInventoryReserved,
    handleInventoryFailed,
    handlePaymentSuccess,
    handlePaymentFailed,
    getOrder,
    getOrderByOrderId,
    getAllOrders,
    getOrdersByStatus,
    getOrderAuditLogs
};