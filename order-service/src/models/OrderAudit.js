const mongoose = require('mongoose');

const orderAuditSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: ['ORDER_CREATED', 'INVENTORY_RESERVED', 'INVENTORY_FAILED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'ORDER_FAILED']
    },
    message: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: {
        createdAt: 'created_at'
    }
});

orderAuditSchema.index({ orderId: 1 });
orderAuditSchema.index({ created_at: -1 });

module.exports = mongoose.model('OrderAudit', orderAuditSchema);