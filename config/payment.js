const PlatformSetting = require("../models/PlatformSetting");

const DEFAULT_PLATFORM_COMMISSION_PERCENT = Number(process.env.PLATFORM_COMMISSION_PERCENT || 10);

const getPlatformCommissionPercent = async () => {
  try {
    const setting = await PlatformSetting.findOne({ key: "platformCommissionPercent" }).lean();
    const value = Number(setting?.value);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : DEFAULT_PLATFORM_COMMISSION_PERCENT;
  } catch {
    return DEFAULT_PLATFORM_COMMISSION_PERCENT;
  }
};

const calculateCommission = (amount, percent = DEFAULT_PLATFORM_COMMISSION_PERCENT) =>
  Number((Number(amount || 0) * Number(percent || 0) / 100).toFixed(2));

const calculateProviderAmount = (amount, percent = DEFAULT_PLATFORM_COMMISSION_PERCENT) =>
  Number((Number(amount || 0) - calculateCommission(amount, percent)).toFixed(2));

module.exports = { DEFAULT_PLATFORM_COMMISSION_PERCENT, getPlatformCommissionPercent, calculateCommission, calculateProviderAmount };
