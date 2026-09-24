const express = require("express");

const {
    searchServices,
    getServiceCategories,
    searchTasks,
    getTaskCategories,
    getNearbyServices,
    getNearbyTasks
} = require(
    "../controllers/discoveryController"
);

const router = express.Router();


// ==========================================
// SERVICES
// ==========================================

router.get(
    "/services",
    searchServices
);

router.get(
    "/services/categories",
    getServiceCategories
);


// ==========================================
// TASKS
// ==========================================

router.get(
    "/tasks",
    searchTasks
);

router.get(
    "/tasks/categories",
    getTaskCategories
);
router.get(
    "/services/nearby",
    getNearbyServices
);

router.get(
    "/tasks/nearby",
    getNearbyTasks
);

module.exports = router;