const Product = require("../models/Product");

// Create Product
const createProduct = async (req, res) => {
    try {
        const { productId, productName, stock } = req.body;

        const product = await Product.create({
            productId,
            productName,
            stock,
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully.",
            data: product,
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message,
        });

    }
};

// Get All Products
const getProducts = async (req, res) => {
    try {

        const products = await Product.find();

        return res.status(200).json({
            success: true,
            data: products,
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message,
        });

    }
};

module.exports = {
    createProduct,
    getProducts,
};