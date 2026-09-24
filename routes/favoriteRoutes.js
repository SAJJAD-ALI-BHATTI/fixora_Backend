const express = require("express");

const {
    addServiceFavorite,
    removeServiceFavorite,
    addTaskFavorite,
    removeTaskFavorite,
    getMyFavorites,
    checkServiceFavorite,
    checkTaskFavorite
} = require(
    "../controllers/favoriteController"
);

const {
    authenticateUser
} = require(
    "../middleware/authMiddleware"
);

const router = express.Router();

router.use(authenticateUser);


// ==========================================
// MY FAVORITES
// ==========================================

router.get(
    "/",
    getMyFavorites
);


// ==========================================
// SERVICES
// ==========================================

router.post(
    "/services/:serviceId",
    addServiceFavorite
);

router.delete(
    "/services/:serviceId",
    removeServiceFavorite
);

router.get(
    "/services/:serviceId/check",
    checkServiceFavorite
);


// ==========================================
// TASKS
// ==========================================

router.post(
    "/tasks/:taskId",
    addTaskFavorite
);

router.delete(
    "/tasks/:taskId",
    removeTaskFavorite
);

router.get(
    "/tasks/:taskId/check",
    checkTaskFavorite
);


module.exports = router;