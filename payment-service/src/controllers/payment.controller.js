const Payment = require("../models/Payment");

const getPayments = async (req, res) => {

    try {

        const payments = await Payment.find();

        return res.status(200).json({
            success: true,
            data: payments,
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message,
        });

    }

};

module.exports = {
    getPayments,
};