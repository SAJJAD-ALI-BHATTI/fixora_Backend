const PlatformSetting = require("../models/PlatformSetting");
const { getPlatformCommissionPercent } = require("../config/payment");

const getAdminSettings = async (req, res, next) => {
  try {
    res.json({ success: true, data: { commissionPercent: await getPlatformCommissionPercent() } });
  } catch (e) { next(e); }
};

const updateAdminSettings = async (req, res, next) => {
  try {
    const commissionPercent = Number(req.body.commissionPercent);
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0 || commissionPercent > 100) {
      return res.status(400).json({ success: false, message: "Commission percentage must be between 0 and 100." });
    }
    const setting = await PlatformSetting.findOneAndUpdate(
      { key: "platformCommissionPercent" },
      { value: Number(commissionPercent.toFixed(2)), updatedBy: req.user._id },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: "Commission settings updated successfully.", data: { commissionPercent: Number(setting.value) } });
  } catch (e) { next(e); }
};

module.exports = { getAdminSettings, updateAdminSettings };
