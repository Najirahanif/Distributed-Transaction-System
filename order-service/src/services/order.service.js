const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderAudit = require("../models/OrderAudit");
const { publishEvent } = require("../kafka/producer");

class OrderService {
    // ============ CREATE ORDER ============
    async createOrder(orderData) {
        const session = await mongoose.startSession();
        let order = null;
        let committed = false;

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

            order = orderDoc;

            // ✅ Commit transaction before Kafka
            await session.commitTransaction();
            committed = true;
            console.log("✅ MongoDB Transaction Committed");

            // Publish Event to Kafka (after commit)
            try {
                await publishEvent("order-created", {
                    orderId: order._id.toString(),
                    productId: order.productId,
                    quantity: order.quantity,
                    amount: order.amount,
                    status: order.status,
                });
                console.log("✅ Kafka Event Published");
            } catch (kafkaError) {
                console.error("❌ Kafka publish failed:", kafkaError.message);
                // Order is already saved - implement retry or outbox pattern
            }

            return order;

        } catch (error) {
            // ❌ Only abort if transaction is still active and not committed
            if (session.transaction && session.transaction.isActive && !committed) {
                await session.abortTransaction();
                console.error("❌ Transaction Aborted");
            }
            
            console.error("❌ Error creating order:", error);
            throw error;

        } finally {
            session.endSession();
        }
    }

    // ============ HANDLE INVENTORY RESERVED ============
    async handleInventoryReserved(data) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Update order status
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

            // Create audit log
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
            console.log(`📊 Order ${data.orderId} status updated to: INVENTORY_RESERVED`);

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
    async handleInventoryFailed(data) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Update order status to FAILED with reason
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

            // Create audit log
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
            console.log(`   Reason: ${data.reason}`);
            console.log(`📊 Order ${data.orderId} marked as FAILED`);

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
    async handlePaymentSuccess(data) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Update order status to PAID
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

            // Create audit log
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
            console.log(`✅ Order ${data.orderId} is now PAID!`);

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
    async handlePaymentFailed(data) {
        const session = await mongoose.startSession();
        
        try {
            session.startTransaction();

            // Update order status to FAILED with reason
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

            // Create audit log
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
            console.log(`   Reason: ${data.error}`);
            
            // Publish order failed event for compensation
            await publishEvent("order-failed", {
                orderId: data.orderId,
                reason: data.error || "Payment failed"
            });

            console.log(`🔄 Order ${data.orderId} marked as FAILED due to payment failure`);

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
    async getOrder(orderId) {
        return await Order.findById(orderId);
    }

    // ============ GET ORDER BY ORDER ID (String) ============
    async getOrderByOrderId(orderIdStr) {
        return await Order.findOne({ _id: orderIdStr });
    }

    // ============ GET ALL ORDERS ============
    async getAllOrders() {
        return await Order.find().sort({ created_at: -1 });
    }

    // ============ GET ORDERS BY STATUS ============
    async getOrdersByStatus(status) {
        return await Order.find({ status }).sort({ created_at: -1 });
    }

    // ============ GET ORDER AUDIT LOGS ============
    async getOrderAuditLogs(orderId) {
        return await OrderAudit.find({ orderId }).sort({ created_at: -1 });
    }
}

module.exports = new OrderService();