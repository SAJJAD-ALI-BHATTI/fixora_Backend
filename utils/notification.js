const Notification = require("../models/Notification");

const {
    emitToUser
} = require("../socket/socket");

const createNotification = async ({
    recipient,
    sender = null,
    type,
    title,
    message,
    data = {}
}) => {
    const notification =
        await Notification.create({
            recipient,
            sender,
            type,
            title,
            message,
            data
        });

    const populatedNotification =
        await Notification.findById(
            notification._id
        ).populate(
            "sender",
            "name profileImage"
        );

    emitToUser(
        recipient,
        "notification",
        populatedNotification
    );

    return populatedNotification;
};

module.exports = {
    createNotification
};