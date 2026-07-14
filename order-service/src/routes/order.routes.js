const express = require("express");

const { createOrderController } = require("../controllers/order.controller");

const router = express.Router();

// Create Order
router.post("/", createOrderController);

module.exports = router;