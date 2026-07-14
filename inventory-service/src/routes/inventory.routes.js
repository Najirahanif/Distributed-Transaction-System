const express = require("express");

const {
    createProduct,
    getProducts,
} = require("../controllers/inventory.controller");

const router = express.Router();

// Create Product
router.post("/products", createProduct);

// Get All Products
router.get("/products", getProducts);

module.exports = router;