const Service = require("../models/Service");

const createService = async (req, res, next) => {
    try {
        const {
            title,
            category,
            description,
            price,
            duration,
            images,
            location,
            availability
        } = req.body;

        if (
            !title ||
            !category ||
            !description ||
            price === undefined ||
            !duration ||
            !location
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Title, category, description, price, duration and location are required"
            });
        }

        if (
            req.user.role !== "vendor" ||
            req.user.status !== "approved"
        ) {
            return res.status(403).json({
                success: false,
                message: "Only approved vendors can create services"
            });
        }

        const service = await Service.create({
            vendor: req.user._id,
            title,
            category,
            description,
            price,
            duration,
            images: images || [],
            location,
            availability:
                availability === undefined ? true : availability
        });

        res.status(201).json({
            success: true,
            message: "Service created successfully",
            data: {
                service
            }
        });
    } catch (error) {
        next(error);
    }
};

const getServices = async (req, res, next) => {
    try {
        const {
            search,
            category,
            minPrice,
            maxPrice,
            rating,
            location
        } = req.query;

        const filter = {
            status: "active",
            availability: true
        };

        if (search) {
            filter.title = {
                $regex: search,
                $options: "i"
            };
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

        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.price = {};

            if (minPrice !== undefined) {
                filter.price.$gte = Number(minPrice);
            }

            if (maxPrice !== undefined) {
                filter.price.$lte = Number(maxPrice);
            }
        }

        if (rating !== undefined) {
            filter.rating = {
                $gte: Number(rating)
            };
        }

        const services = await Service.find(filter)
            .populate("vendor", "name email profileImage location")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Services retrieved successfully",
            data: {
                count: services.length,
                services
            }
        });
    } catch (error) {
        next(error);
    }
};

const getServiceById = async (req, res, next) => {
    try {
        const service = await Service.findById(
            req.params.id
        ).populate(
            "vendor",
            "name email phone profileImage location role status"
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Service retrieved successfully",
            data: {
                service
            }
        });
    } catch (error) {
        next(error);
    }
};

const getMyServices = async (req, res, next) => {
    try {
        const services = await Service.find({
            vendor: req.user._id
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Your services retrieved successfully",
            data: {
                services
            }
        });
    } catch (error) {
        next(error);
    }
};

const updateService = async (req, res, next) => {
    try {
        const service = await Service.findById(
            req.params.id
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        if (
            service.vendor.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own services"
            });
        }

        const allowedFields = [
            "title",
            "category",
            "description",
            "price",
            "duration",
            "images",
            "location",
            "availability",
            "status"
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                service[field] = req.body[field];
            }
        });

        await service.save();

        res.status(200).json({
            success: true,
            message: "Service updated successfully",
            data: {
                service
            }
        });
    } catch (error) {
        next(error);
    }
};

const deleteService = async (req, res, next) => {
    try {
        const service = await Service.findById(
            req.params.id
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found"
            });
        }

        if (
            service.vendor.toString() !==
            req.user._id.toString()
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only delete your own services"
            });
        }

        service.status = "inactive";
        service.availability = false;

        await service.save();

        res.status(200).json({
            success: true,
            message: "Service deactivated successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createService,
    getServices,
    getServiceById,
    getMyServices,
    updateService,
    deleteService
};