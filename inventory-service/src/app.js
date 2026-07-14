const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const inventoryRoutes = require("./routes/inventory.routes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Inventory Service is running..."
    });
});

app.use("/inventory", inventoryRoutes);

module.exports = app;