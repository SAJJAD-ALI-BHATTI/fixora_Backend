const express = require("express");

const {
    createTask,
    getTasks,
    getTaskById,
    getMyTasks,
    updateTask,
    cancelTask,
    assignTask,
    getRunnerTasks,
    updateRunnerTaskStatus
} = require("../controllers/taskController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", getTasks);

router.get(
    "/customer/my-tasks",
    authenticateUser,
    requireRole("customer"),
    getMyTasks
);

router.get(
    "/runner/available",
    authenticateUser,
    requireRole("taskRunner"),
    getRunnerTasks
);

router.get("/:id", getTaskById);

router.post(
    "/",
    authenticateUser,
    requireRole("customer"),
    createTask
);

router.patch(
    "/:id",
    authenticateUser,
    requireRole("customer"),
    updateTask
);

router.patch(
    "/:id/cancel",
    authenticateUser,
    requireRole("customer"),
    cancelTask
);

router.patch(
    "/:id/assign",
    authenticateUser,
    requireRole("customer"),
    assignTask
);

router.patch(
    "/:id/status",
    authenticateUser,
    requireRole("taskRunner"),
    updateRunnerTaskStatus
);

module.exports = router;