const orderService = require('../services/order.service');

exports.createOrderController = async (req, res) => {
    try {
        const { productId, quantity, amount } = req.body;
        
        // Validate input
        if (!productId || !quantity || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: productId, quantity, amount'
            });
        }

        console.log(`📝 Creating order for product: ${productId}`);

        const order = await orderService.createOrder({
            productId,
            quantity,
            amount
        });

        res.status(201).json({
            success: true,
            message: 'Order created successfully. Awaiting inventory confirmation.',
            data: {
                orderId: order.order_id,
                productId: order.product_id,
                quantity: order.quantity,
                amount: order.amount,
                status: order.status
            }
        });

    } catch (error) {
        console.error('❌ Error in create order route:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getOrderController = async (req, res) => {
    try {
        const order = await orderService.getOrder(req.params.orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Order not found'
            });
        }

        res.json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error('❌ Error getting order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.healthCheck = (req, res) => {
    const mongoose = require('mongoose');
    res.json({
        status: 'OK',
        service: 'order-service',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
};