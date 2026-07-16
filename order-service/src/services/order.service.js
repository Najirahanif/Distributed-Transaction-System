const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderAudit = require("../models/OrderAudit");
const { publishEvent } = require("../kafka/producer");

// Store pending transactions
const pendingTransactions = new Map();

// ============ CREATE ORDER ============
async function createOrder(orderData) {
    const session = await mongoose.startSession();
    
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
            orderDoc,
            status: 'PENDING',
            inventoryStatus: null,
            paymentStatus: null,
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
        console.log('inventoryResult: ', inventoryResult);

        if (inventoryResult === 'FAILED') {
            console.error(`❌ Inventory reservation failed for order: ${orderIdStr}`);
            pendingTransactions.delete(orderIdStr);
            await session.abortTransaction();
            throw new Error(`Inventory reservation failed`);
        }

        // Update order status to INVENTORY_RESERVED (within the same transaction)
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

        // Add inventory audit log
        const transactionData = pendingTransactions.get(orderIdStr);
        if (transactionData && transactionData.inventoryData) {
            await OrderAudit.create(
                [
                    {
                        orderId: orderDoc._id,
                        action: "INVENTORY_RESERVED",
                        message: `Inventory reserved for order ${orderIdStr}`,
                        metadata: transactionData.inventoryData
                    }
                ],
                { session }
            );
        }

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
        const paymentData = pendingTransactions.get(orderIdStr)?.paymentData;
        await OrderAudit.create(
            [
                {
                    orderId: orderDoc._id,
                    action: "PAYMENT_SUCCESS",
                    message: `Payment completed for order ${orderIdStr}`,
                    metadata: paymentData || { amount: orderData.amount }
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
            
            if (transaction) {
                if (transaction.inventoryStatus === 'SUCCESS') {
                    clearInterval(checkInterval);
                    resolve('SUCCESS');
                    return;
                }
                
                if (transaction.inventoryStatus === 'FAILED') {
                    clearInterval(checkInterval);
                    resolve('FAILED');
                    return;
                }
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
            
            if (transaction) {
                if (transaction.paymentStatus === 'SUCCESS') {
                    clearInterval(checkInterval);
                    resolve('SUCCESS');
                    return;
                }
                
                if (transaction.paymentStatus === 'FAILED') {
                    clearInterval(checkInterval);
                    resolve('FAILED');
                    return;
                }
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
    console.log(`📦 Inventory RESERVED for order: ${data.orderId}`);
    
    // Update the pending transaction status with data
    const transaction = pendingTransactions.get(data.orderId);
    if (transaction) {
        transaction.inventoryStatus = 'SUCCESS';
        transaction.inventoryData = {
            productId: data.productId,
            quantity: data.quantity,
            reservationId: data.reservationId || 'N/A'
        };
        console.log(`✅ Inventory SUCCESS for order: ${data.orderId}`);
    } else {
        // If transaction not found, the order might already be committed or failed
        console.log(`⚠️ No pending transaction found for order: ${data.orderId}`);
    }
}

// ============ HANDLE INVENTORY FAILED ============
async function handleInventoryFailed(data) {
    console.log(`❌ Inventory FAILED for order: ${data.orderId}`);
    
    // Update the pending transaction status
    const transaction = pendingTransactions.get(data.orderId);
    if (transaction) {
        transaction.inventoryStatus = 'FAILED';
        transaction.inventoryData = {
            productId: data.productId,
            quantity: data.quantity,
            reason: data.reason || data.message || 'Unknown error',
            availableStock: data.availableStock,
            requestedQuantity: data.requestedQuantity
        };
        console.log(`🔄 Marked inventory as FAILED for order: ${data.orderId}`);
    } else {
        console.log(`⚠️ No pending transaction found for order: ${data.orderId}`);
    }
}

// ============ HANDLE PAYMENT SUCCESS ============
async function handlePaymentSuccess(data) {
    console.log(`💳 Payment SUCCESS for order: ${data.orderId}`);
    
    // Update the pending transaction status with data
    const transaction = pendingTransactions.get(data.orderId);
    if (transaction) {
        transaction.paymentStatus = 'SUCCESS';
        transaction.paymentData = {
            paymentId: data.paymentId || 'N/A',
            amount: data.amount
        };
        console.log(`✅ Payment SUCCESS for order: ${data.orderId}`);
    } else {
        console.log(`⚠️ No pending transaction found for order: ${data.orderId}`);
    }
}

// ============ HANDLE PAYMENT FAILED ============
async function handlePaymentFailed(data) {
    console.log(`❌ Payment FAILED for order: ${data.orderId}`);
    
    // Update the pending transaction status
    const transaction = pendingTransactions.get(data.orderId);
    if (transaction) {
        transaction.paymentStatus = 'FAILED';
        transaction.paymentData = {
            paymentId: data.paymentId || 'N/A',
            amount: data.amount,
            error: data.error || 'Unknown error'
        };
        console.log(`🔄 Marked payment as FAILED for order: ${data.orderId}`);
    } else {
        console.log(`⚠️ No pending transaction found for order: ${data.orderId}`);
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