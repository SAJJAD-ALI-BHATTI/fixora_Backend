const Favorite = require("../models/Favorite");
const Service = require("../models/Service");
const Task = require("../models/Task");


// ==========================================
// ADD SERVICE TO FAVORITES
// ==========================================

const addServiceFavorite = async (
    req,
    res,
    next
) => {
    try {
        const { serviceId } = req.params;

        const service =
            await Service.findById(serviceId);

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        const existing =
            await Favorite.findOne({
                user: req.user._id,
                service: serviceId
            });

        if (existing) {
            return res.status(409).json({
                success: false,
                message:
                    "Service is already in favorites"
            });
        }

        const favorite =
            await Favorite.create({
                user: req.user._id,
                service: serviceId
            });

        res.status(201).json({
            success: true,
            message:
                "Service added to favorites",
            data: {
                favorite
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// REMOVE SERVICE FROM FAVORITES
// ==========================================

const removeServiceFavorite = async (
    req,
    res,
    next
) => {
    try {
        const { serviceId } = req.params;

        const favorite =
            await Favorite.findOneAndDelete({
                user: req.user._id,
                service: serviceId
            });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message:
                    "Service is not in favorites"
            });
        }

        res.status(200).json({
            success: true,
            message:
                "Service removed from favorites"
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// ADD TASK TO FAVORITES
// ==========================================

const addTaskFavorite = async (
    req,
    res,
    next
) => {
    try {
        const { taskId } = req.params;

        const task =
            await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        const existing =
            await Favorite.findOne({
                user: req.user._id,
                task: taskId
            });

        if (existing) {
            return res.status(409).json({
                success: false,
                message:
                    "Task is already in favorites"
            });
        }

        const favorite =
            await Favorite.create({
                user: req.user._id,
                task: taskId
            });

        res.status(201).json({
            success: true,
            message:
                "Task added to favorites",
            data: {
                favorite
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// REMOVE TASK FROM FAVORITES
// ==========================================

const removeTaskFavorite = async (
    req,
    res,
    next
) => {
    try {
        const { taskId } = req.params;

        const favorite =
            await Favorite.findOneAndDelete({
                user: req.user._id,
                task: taskId
            });

        if (!favorite) {
            return res.status(404).json({
                success: false,
                message:
                    "Task is not in favorites"
            });
        }

        res.status(200).json({
            success: true,
            message:
                "Task removed from favorites"
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// GET MY FAVORITES
// ==========================================

const getMyFavorites = async (
    req,
    res,
    next
) => {
    try {
        const favorites =
            await Favorite.find({
                user: req.user._id
            })
                .populate({
                    path: "service",
                    populate: {
                        path: "vendor",
                        select:
                            "name profileImage"
                    }
                })
                .populate({
                    path: "task",
                    populate: {
                        path: "customer",
                        select:
                            "name profileImage"
                    }
                })
                .sort({
                    createdAt: -1
                });

        const services = favorites
            .filter(
                (item) => item.service
            )
            .map(
                (item) => item.service
            );

        const tasks = favorites
            .filter(
                (item) => item.task
            )
            .map(
                (item) => item.task
            );

        res.status(200).json({
            success: true,

            data: {
                favorites,
                services,
                tasks,
                total:
                    favorites.length
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// CHECK SERVICE FAVORITE
// ==========================================

const checkServiceFavorite = async (
    req,
    res,
    next
) => {
    try {
        const favorite =
            await Favorite.exists({
                user: req.user._id,
                service: req.params.serviceId
            });

        res.status(200).json({
            success: true,
            data: {
                isFavorite:
                    Boolean(favorite)
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// CHECK TASK FAVORITE
// ==========================================

const checkTaskFavorite = async (
    req,
    res,
    next
) => {
    try {
        const favorite =
            await Favorite.exists({
                user: req.user._id,
                task: req.params.taskId
            });

        res.status(200).json({
            success: true,
            data: {
                isFavorite:
                    Boolean(favorite)
            }
        });

    } catch (error) {
        next(error);
    }
};


module.exports = {
    addServiceFavorite,
    removeServiceFavorite,
    addTaskFavorite,
    removeTaskFavorite,
    getMyFavorites,
    checkServiceFavorite,
    checkTaskFavorite
};