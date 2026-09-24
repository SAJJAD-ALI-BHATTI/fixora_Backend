const imagekit = require("../config/imagekit");

const uploadImages = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please upload at least one image"
            });
        }

        const uploadedImages = [];

        for (const file of req.files) {
            const result = await imagekit.upload({
                file: file.buffer,
                fileName: `${Date.now()}-${file.originalname}`,
                folder: "/fixora"
            });

            uploadedImages.push({
                url: result.url,
                fileId: result.fileId,
                name: result.name,
                thumbnailUrl: result.thumbnailUrl
            });
        }

        res.status(201).json({
            success: true,
            message: "Images uploaded successfully",
            data: {
                images: uploadedImages
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadImages
};