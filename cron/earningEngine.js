// cron/earningEngine.js
// Runs every day at midnight — resets claimedToday flag on all active plans
const cron = require('node-cron');
const UserPlan = require('../models/UserPlan');

const startEarningEngine = () => {
    // Every day at 00:01 AM
    cron.schedule('1 0 * * *', async () => {
        try {
            console.log('⏰  Earning engine: resetting daily claim flags...');

            const now = new Date();

            // Reset claimedToday for all active plans
            await UserPlan.updateMany(
                { status: 'active', claimedToday: true },
                { $set: { claimedToday: false } }
            );

            // Expire plans past endDate
            const expired = await UserPlan.updateMany(
                { status: 'active', endDate: { $lt: now } },
                { $set: { status: 'expired' } }
            );

            console.log(`✅  Daily reset done. Expired ${expired.modifiedCount} plans.`);
        } catch (err) {
            console.error('❌  Earning engine error:', err.message);
        }
    });

    console.log('⏰  Earning engine cron started.');
};

module.exports = { startEarningEngine };