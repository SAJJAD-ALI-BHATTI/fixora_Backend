const Service = require("../models/Service");
const Task = require("../models/Task");
const User = require("../models/User");

const {
    buildPagination,
    buildSort
} = require("../utils/query");

const escapeRegex = (value = "") =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const textSearch = (term) => {
    const pattern = escapeRegex(String(term).trim());
    if (!pattern) return null;
    return [
        { title: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { category: { $regex: pattern, $options: "i" } },
        { "location.address": { $regex: pattern, $options: "i" } }
    ];
};


// ==========================================
// SEARCH SERVICES
// ==========================================

const searchServices = async (
    req,
    res,
    next
) => {
    try {
        const {
            search,
            q,
            category,
            location,
            minPrice,
            maxPrice,
            vendor,
            status,
            city
        } = req.query;

        const {
            page,
            limit,
            skip
        } = buildPagination(req);

        const sort =
            buildSort(
                req.query.sort,
                "-createdAt"
            );

        const query = {};
        const searchTerm = String(search || q || "").trim();
        const locationTerm = String(location || "").trim();


        // --------------------------------------
        // TEXT SEARCH  (search or q)
        // --------------------------------------

        const searchOr = textSearch(searchTerm);
        if (searchOr) {
            query.$or = searchOr;
        }


        // --------------------------------------
        // CATEGORY
        // --------------------------------------

        if (category) {
            query.category = {
                $regex: escapeRegex(category),
                $options: "i"
            };
        }

        if (locationTerm) {
            query["location.address"] = {
                $regex: escapeRegex(locationTerm),
                $options: "i"
            };
        }

        query.status = "active";
        query.availability = true;
        if (city) query.$and = [
            { $or: [
                { city: { $regex: `^${escapeRegex(city.trim())}$`, $options: "i" } },
                { "location.address": { $regex: escapeRegex(city.trim()), $options: "i" } }
            ] }
        ];
        const approvedProviders = await User.find({ role: { $in: ["vendor", "taskRunner"] }, status: "approved" }).distinct("_id");
        query.vendor = vendor ? (approvedProviders.some(id => id.toString() === String(vendor)) ? vendor : null) : { $in: approvedProviders };


        // --------------------------------------
        // VENDOR
        // --------------------------------------



        // --------------------------------------
        // PRICE
        // --------------------------------------

        if (
            minPrice !== undefined ||
            maxPrice !== undefined
        ) {
            query.price = {};

            if (minPrice !== undefined) {
                query.price.$gte =
                    Number(minPrice);
            }

            if (maxPrice !== undefined) {
                query.price.$lte =
                    Number(maxPrice);
            }
        }


        const [
            services,
            total
        ] = await Promise.all([
            Service.find(query)
                .populate(
                    "vendor",
                    "name profileImage location"
                )
                .sort(sort)
                .skip(skip)
                .limit(limit),

            Service.countDocuments(query)
        ]);


        res.status(200).json({
            success: true,

            data: {
                services,

                pagination: {
                    page,
                    limit,
                    total,
                    pages:
                        Math.ceil(
                            total / limit
                        ),

                    hasNextPage:
                        page <
                        Math.ceil(
                            total / limit
                        ),

                    hasPreviousPage:
                        page > 1
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// SERVICE CATEGORIES
// ==========================================

const getServiceCategories = async (
    req,
    res,
    next
) => {
    try {
        const categories =
            await Service.distinct(
                "category",
                { status: "active", availability: true }
            );

        res.status(200).json({
            success: true,

            data: {
                categories:
                    categories.filter(
                        Boolean
                    ).sort()
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// SEARCH TASKS
// ==========================================

const searchTasks = async (
    req,
    res,
    next
) => {
    try {
        const {
            search,
            q,
            category,
            location,
            minBudget,
            maxBudget,
            status
        } = req.query;

        const {
            page,
            limit,
            skip
        } = buildPagination(req);

        const sort =
            buildSort(
                req.query.sort,
                "-createdAt"
            );

        const query = {};
        const searchTerm = String(search || q || "").trim();
        const locationTerm = String(location || "").trim();


        // --------------------------------------
        // SEARCH  (search or q)
        // --------------------------------------

        const searchOr = textSearch(searchTerm);
        if (searchOr) {
            query.$or = searchOr;
        }


        // --------------------------------------
        // CATEGORY
        // --------------------------------------

        if (category) {
            query.category = {
                $regex: escapeRegex(category),
                $options: "i"
            };
        }

        if (locationTerm) {
            query["location.address"] = {
                $regex: escapeRegex(locationTerm),
                $options: "i"
            };
        }


        // --------------------------------------
        // STATUS
        // --------------------------------------

        if (status) {
            query.status = status;
        }


        // --------------------------------------
        // BUDGET
        // --------------------------------------

        if (
            minBudget !== undefined ||
            maxBudget !== undefined
        ) {
            query.budget = {};

            if (
                minBudget !== undefined
            ) {
                query.budget.$gte =
                    Number(minBudget);
            }

            if (
                maxBudget !== undefined
            ) {
                query.budget.$lte =
                    Number(maxBudget);
            }
        }


        const [
            tasks,
            total
        ] = await Promise.all([
            Task.find(query)
                .populate(
                    "customer",
                    "name profileImage location"
                )
                .populate(
                    "assignedRunner",
                    "name profileImage location"
                )
                .sort(sort)
                .skip(skip)
                .limit(limit),

            Task.countDocuments(query)
        ]);


        res.status(200).json({
            success: true,

            data: {
                tasks,

                pagination: {
                    page,
                    limit,
                    total,
                    pages:
                        Math.ceil(
                            total / limit
                        ),

                    hasNextPage:
                        page <
                        Math.ceil(
                            total / limit
                        ),

                    hasPreviousPage:
                        page > 1
                }
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// TASK CATEGORIES
// ==========================================

const getTaskCategories = async (
    req,
    res,
    next
) => {
    try {
        const categories =
            await Task.distinct(
                "category"
            );

        res.status(200).json({
            success: true,

            data: {
                categories:
                    categories.filter(
                        Boolean
                    ).sort()
            }
        });

    } catch (error) {
        next(error);
    }
};


// ==========================================
// NEARBY SERVICES
// ==========================================

const getNearbyServices = async (
    req,
    res,
    next
) => {
    try {
        const {
            longitude,
            latitude,
            radius = 10000,
            category,
            minPrice,
            maxPrice
        } = req.query;

        if (longitude === undefined || latitude === undefined) {
            return res.status(400).json({
                success: false,
                message: "Longitude and latitude are required"
            });
        }

        const lng = Number(longitude);
        const lat = Number(latitude);
        const maxDistance = Number(radius);

        if (
            !Number.isFinite(lng) ||
            !Number.isFinite(lat) ||
            !Number.isFinite(maxDistance) ||
            lng < -180 || lng > 180 ||
            lat < -90 || lat > 90 ||
            maxDistance <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid location values"
            });
        }

        // $geoWithin avoids requiring the query planner to use $near.
        // This is more tolerant of existing databases whose geospatial
        // index may not have been created yet. The Service model still
        // declares its 2dsphere index for normal production operation.
        const approvedProviders = await User.find({ role: { $in: ["vendor", "taskRunner"] }, status: "approved" }).distinct("_id");
        const query = {
            vendor: { $in: approvedProviders },
            status: "active",
            availability: true,
            location: {
                $geoWithin: {
                    $centerSphere: [
                        [lng, lat],
                        maxDistance / 6378100
                    ]
                }
            }
        };

        if (category) {
            query.category = {
                $regex: category,
                $options: "i"
            };
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};

            if (minPrice !== undefined) {
                const value = Number(minPrice);
                if (!Number.isFinite(value)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid minimum price"
                    });
                }
                query.price.$gte = value;
            }

            if (maxPrice !== undefined) {
                const value = Number(maxPrice);
                if (!Number.isFinite(value)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid maximum price"
                    });
                }
                query.price.$lte = value;
            }
        }

        const services = await Service.find(query)
            .populate("vendor", "name profileImage location")
            .sort({ createdAt: -1 })
            .limit(100);

        res.status(200).json({
            success: true,
            message: "Nearby services retrieved successfully",
            data: {
                services,
                count: services.length
            }
        });
    } catch (error) {
        next(error);
    }
};


// ==========================================
// NEARBY TASKS
// ==========================================

const getNearbyTasks = async (
    req,
    res,
    next
) => {
    try {
        const {
            longitude,
            latitude,
            radius = 10000,
            category,
            minBudget,
            maxBudget
        } = req.query;

        if (
            longitude === undefined ||
            latitude === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Longitude and latitude are required"
            });
        }

        const lng = Number(longitude);
        const lat = Number(latitude);
        const maxDistance = Number(radius);

        if (
            Number.isNaN(lng) ||
            Number.isNaN(lat) ||
            Number.isNaN(maxDistance)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid location values"
            });
        }

        const query = {
            location: {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [lng, lat]
                    },
                    $maxDistance: maxDistance
                }
            }
        };

        if (category) {
            query.category = {
                $regex: category,
                $options: "i"
            };
        }

        if (
            minBudget !== undefined ||
            maxBudget !== undefined
        ) {
            query.budget = {};

            if (minBudget !== undefined) {
                query.budget.$gte =
                    Number(minBudget);
            }

            if (maxBudget !== undefined) {
                query.budget.$lte =
                    Number(maxBudget);
            }
        }

        const tasks =
            await Task.find(query)
                .populate(
                    "customer",
                    "name profileImage location"
                )
                .populate(
                    "assignedRunner",
                    "name profileImage location"
                )
                .limit(100);

        res.status(200).json({
            success: true,
            data: {
                tasks,
                count: tasks.length
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    searchServices,
    getServiceCategories,
    searchTasks,
    getTaskCategories,
    getNearbyServices,
    getNearbyTasks
};