const Task = require("../models/Task");
const User = require("../models/User");

const createTask = async (req, res, next) => {
    try {
        const {
            title,
            category,
            description,
            budget,
            location,
            preferredDate,
            preferredTime,
            images
        } = req.body;

        if (
            !title ||
            !category ||
            !description ||
            budget === undefined ||
            !location ||
            !preferredDate ||
            !preferredTime
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Title, category, description, budget, location, preferred date and preferred time are required"
            });
        }

        const task = await Task.create({
            customer: req.user._id,
            title,
            category,
            description,
            budget,
            location,
            preferredDate,
            preferredTime,
            images: images || []
        });

        const populatedTask = await Task.findById(
            task._id
        ).populate(
            "customer",
            "name email phone profileImage location"
        );

        res.status(201).json({
            success: true,
            message: "Task created successfully",
            data: {
                task: populatedTask
            }
        });
    } catch (error) {
        next(error);
    }
};

const getTasks = async (req, res, next) => {
    try {
        const {
            search,
            category,
            minBudget,
            maxBudget,
            location,
            status
        } = req.query;

        const filter = {
            status: status || "open"
        };

        if (search) {
            filter.$or = [
                {
                    title: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    description: {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }

        if (category) {
            filter.category = {
                $regex: category,
                $options: "i"
            };
        }

        if (location) {
            filter.location = {
                $regex: location,
                $options: "i"
            };
        }

        if (
            minBudget !== undefined ||
            maxBudget !== undefined
        ) {
            filter.budget = {};

            if (minBudget !== undefined) {
                filter.budget.$gte = Number(minBudget);
            }

            if (maxBudget !== undefined) {
                filter.budget.$lte = Number(maxBudget);
            }
        }

        const tasks = await Task.find(filter)
            .populate(
                "customer",
                "name email phone profileImage location"
            )
            .populate(
                "assignedRunner",
                "name email phone profileImage location"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Tasks retrieved successfully",
            data: {
                count: tasks.length,
                tasks
            }
        });
    } catch (error) {
        next(error);
    }
};

const getTaskById = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate(
                "customer",
                "name email phone profileImage location"
            )
            .populate(
                "assignedRunner",
                "name email phone profileImage location"
            );

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Task retrieved successfully",
            data: {
                task
            }
        });
    } catch (error) {
        next(error);
    }
};

const getMyTasks = async (req, res, next) => {
    try {
        const tasks = await Task.find({
            customer: req.user._id
        })
            .populate(
                "assignedRunner",
                "name email phone profileImage location"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Your tasks retrieved successfully",
            data: {
                tasks
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateTask = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own tasks"
            });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message: "Only open tasks can be updated"
            });
        }

        const allowedFields = [
            "title",
            "category",
            "description",
            "budget",
            "location",
            "preferredDate",
            "preferredTime",
            "images"
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                task[field] = req.body[field];
            }
        });

        await task.save();

        res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: {
                task
            }
        });
    } catch (error) {
        next(error);
    }
};

const cancelTask = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only cancel your own tasks"
            });
        }

        if (
            !["open", "assigned"].includes(task.status)
        ) {
            return res.status(400).json({
                success: false,
                message: "This task can no longer be cancelled"
            });
        }

        task.status = "cancelled";

        await task.save();

        res.status(200).json({
            success: true,
            message: "Task cancelled successfully"
        });
    } catch (error) {
        next(error);
    }
};

const assignTask = async (req, res, next) => {
    try {
        const { runnerId } = req.body;

        if (!runnerId) {
            return res.status(400).json({
                success: false,
                message: "Runner ID is required"
            });
        }

        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            task.customer.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only the task owner can assign a runner"
            });
        }

        if (task.status !== "open") {
            return res.status(400).json({
                success: false,
                message: "Only open tasks can be assigned"
            });
        }

        const runner = await User.findOne({
            _id: runnerId,
            role: "taskRunner",
            status: "approved"
        });

        if (!runner) {
            return res.status(404).json({
                success: false,
                message: "Approved task runner not found"
            });
        }

        task.assignedRunner = runner._id;
        task.agreedAmount = Number(task.budget);
        task.paymentStatus = "pending";
        task.status = "assigned";

        await task.save();

        const updatedTask = await Task.findById(task._id)
            .populate(
                "customer",
                "name email phone profileImage"
            )
            .populate(
                "assignedRunner",
                "name email phone profileImage location"
            );

        res.status(200).json({
            success: true,
            message: "Task assigned successfully",
            data: {
                task: updatedTask
            }
        });
    } catch (error) {
        next(error);
    }
};

const getRunnerTasks = async (req, res, next) => {
    try {
        const tasks = await Task.find({
            $or: [
                {
                    status: "open"
                },
                {
                    assignedRunner: req.user._id
                }
            ]
        })
            .populate(
                "customer",
                "name email phone profileImage location"
            )
            .populate(
                "assignedRunner",
                "name email phone profileImage location"
            )
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Runner tasks retrieved successfully",
            data: {
                tasks
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateRunnerTaskStatus = async (
    req,
    res,
    next
) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "inProgress",
            "completed"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task status"
            });
        }

        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (
            !task.assignedRunner ||
            task.assignedRunner.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "You are not assigned to this task"
            });
        }

        if (status === "inProgress") {
            if (task.status !== "assigned") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Only assigned tasks can be started"
                });
            }
        }

        if (status === "completed") {
            if (task.status !== "inProgress") {
                return res.status(400).json({
                    success: false,
                    message:
                        "Only in-progress tasks can be completed"
                });
            }
        }

        task.status = status;

        await task.save();

        const updatedTask = await Task.findById(task._id)
            .populate(
                "customer",
                "name email phone profileImage"
            )
            .populate(
                "assignedRunner",
                "name email phone profileImage"
            );

        res.status(200).json({
            success: true,
            message: "Task status updated successfully",
            data: {
                task: updatedTask
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasks,
    getTaskById,
    getMyTasks,
    updateTask,
    cancelTask,
    assignTask,
    getRunnerTasks,
    updateRunnerTaskStatus
};