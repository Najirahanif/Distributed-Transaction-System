const express = require("express");

const {
    getPayments,
} = require("../controllers/payment.controller");

const router = express.Router();

router.get("/", getPayments);

module.exports = router;