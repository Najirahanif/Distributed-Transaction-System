const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const paymentRoutes = require("./routes/payment.routes");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Payment Service is running..."
    });
});

app.use("/payments", paymentRoutes);

module.exports = app;