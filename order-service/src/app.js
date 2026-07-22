const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const orderRoutes = require("./routes/order.routes");

const app = express();

// Middleware
app.use(express.json());

// Readiness Probe
app.get("/health/ready", (req, res) => {
    res.status(200).json({
        status: "ready"
    });
});

// Liveness Probe
app.get("/health/live", (req, res) => {
    res.status(200).json({
        status: "alive"
    });
});

// Health Check
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Order Service is running..."
    });
});
// In order to check the Horizontal Pod Autoscaling and its usecase(HPA)
app.get("/load", (req, res) => {
    const end = Date.now() + 1000;

    while (Date.now() < end) {
        Math.sqrt(Math.random() * 1000000);
    }

    res.json({
        message: "CPU load generated"
    });
});

// Routes
app.use("/orders", orderRoutes);

module.exports = app;