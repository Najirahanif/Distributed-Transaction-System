const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        index: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['PENDING', 'INVENTORY_RESERVED', 'PAID', 'FAILED'],
        default: 'PENDING'
    },
    failure_reason: {
        type: String,
        default: null
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
});

// Indexes
orderSchema.index({ productId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ created_at: -1 });

module.exports = mongoose.model('Order', orderSchema);