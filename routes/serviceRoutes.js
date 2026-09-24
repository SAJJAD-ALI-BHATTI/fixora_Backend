const express = require("express");

const {
    createService,
    getServices,
    getServiceById,
    getMyServices,
    updateService,
    deleteService
} = require("../controllers/serviceController");

const {
    authenticateUser
} = require("../middleware/authMiddleware");

const {
    requireRole
} = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", getServices);

// IMPORTANT: keep this specific route before /:id, otherwise Express
// treats the literal "vendor" as a service id and triggers a CastError.
router.get(
    "/vendor/my-services",
    authenticateUser,
    requireRole("vendor"),
    getMyServices
);

router.get("/:id", getServiceById);

router.post(
    "/",
    authenticateUser,
    requireRole("vendor"),
    createService
);

router.patch(
    "/:id",
    authenticateUser,
    requireRole("vendor"),
    updateService
);

router.delete(
    "/:id",
    authenticateUser,
    requireRole("vendor"),
    deleteService
);

module.exports = router;