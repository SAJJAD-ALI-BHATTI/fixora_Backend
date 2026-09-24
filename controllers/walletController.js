const {
    getOrCreateWallet
} = require("../utils/wallet");

const getMyWallet = async (
    req,
    res,
    next
) => {
    try {
        const wallet =
            await getOrCreateWallet(
                req.user._id
            );

        res.status(200).json({
            success: true,
            data: {
                wallet
            }
        });
    } catch (error) {
        next(error);
    }
};


module.exports = {
    getMyWallet
};