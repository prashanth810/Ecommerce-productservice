import { uploadToCloudinary } from "../config/Cloudinary.js";
import CategoryModel from "../models/CategoryModel.js";

// create category only admin 
const createcategory = async (req, res) => {
    const { name, createbyId } = req.body;
    try {
        const role = req?.user?.role;

        if (role !== "admin") {
            return res.status(400).json({ success: false, message: "Only admin can create Categories !!!" });
        }

        if (!name || name.trim() === "") {
            return res.status(400).json({ success: false, message: "Name is required !!!" });
        }

        const existcategory = await CategoryModel.findOne({ name });

        if (existcategory) {
            return res.status(400).json({ success: false, message: "Category allredy existed this name !!!" });
        }

        if (!createbyId || createbyId.trim() === "") {
            return res.status(400).json({ success: false, message: "Create By ID is required !!!" });
        }

        if (!req.file) {
            return res.status(40).json({ success: false, message: "Category Image is required !!!" });
        }

        const allowedTypes = ["image/jpg", "image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, message: "Only image are allowed !!!" });
        }

        const maxsize = 5 * 1024 * 1024;
        if (req.file.size > maxsize) {
            return res.status(400).json({ success: false, message: "Image size must be less then 5MB !!!" })
        }

        const result = await uploadToCloudinary(req.file.buffer, "Categories");

        const category = await CategoryModel.create({
            name,
            createbyId,
            imageurl: result.url,
        })

        return res.status(201).json({
            success: true,
            message: "Category created successfully !!!",
            data: category,
        })

    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// update category 
const Updatecategory = async (req, res) => {
    const { categoryid } = req.params;
    const { name, createbyId } = req.body;
    try {
        const role = req?.user?.role;

        if (role !== "admin") {
            return res.status(400).json({ success: false, message: "Only admin can update categories !!!" });
        }

        if (!createbyId) {
            return res.status(400).json({ success: false, message: "createby ID is required!!!" })
        }

        if (!categoryid) {
            return res.status(404).json({ success: false, message: "Category ID required !!!" });
        }

        const category = await CategoryModel.findById(categoryid);

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found !!!" });
        }

        const updatecategory = {};

        if (name && name.trim() !== "") {
            updatecategory.name = name;
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Category image required !!!" });
        }

        if (req.file) {
            const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
            const maxsize = 5 * 1024 * 1024;

            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({ success: false, message: "Only jpg, jpeg, png, webp, gif formats are allowed!" })
            }

            if (req.file.size > maxsize) {
                return res.status(400).json({ success: false, message: "Image size must less hen 5mb !" })
            }

            if (category.imageurl) {
                try {
                    const urlParts = category.imageurl.split("/");
                    const filenameWithExt = urlParts[urlParts.length - 1];           // abc123.jpg
                    const folder = urlParts[urlParts.length - 2];                    // categories
                    const public_id = `${folder}/${filenameWithExt.split(".")[0]}`; // categories/abc123

                    await cloudinary.uploader.destroy(public_id);
                } catch (deleteErr) {
                    console.warn("Old image deletion failed:", deleteErr.message);
                }
            }

            const result = await uploadToCloudinary(req.file.buffer, "categories");
            updatecategory.imageurl = result.url;
        }

        const updatedcategorydata = await CategoryModel.findByIdAndUpdate(
            categoryid,
            { $set: updatecategory },
            { new: true, runValidators: true },
        )

        return res.status(200).json({
            success: true,
            message: "Cateegory updated successfully !!!",
            data: updatedcategorydata
        });

    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// get all categories
const Getallcategories = async (req, res) => {
    try {
        const categories = await CategoryModel.find({});

        if (!categories) {
            return res.status(404).json({ success: false, message: "No categories found !!!" });
        }

        return res.status(200).json({ success: true, data: categories, total: categories.length });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// get single category
const Singlecategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await CategoryModel.findById(id)

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found !!!" });
        }

        return res.status(200).json({ success: true, data: category });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// delete category by admin
const Deletecategory = async (req, res) => {

    const { id } = req.params;

    try {

        const role = req?.user?.role;

        if (role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can delete the category !!!"
            });
        }


        // Find category first
        const category = await CategoryModel.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found !!!"
            });
        }


        // Delete image from Cloudinary
        if (category.imageurl) {

            try {

                const urlParts = category.imageurl.split("/");

                const uploadIndex = urlParts.indexOf("upload");

                // Remove "upload" and version
                const pathAfterVersion =
                    urlParts.slice(uploadIndex + 2);

                const fullPath =
                    pathAfterVersion.join("/");

                // Remove extension
                const public_id =
                    fullPath.substring(
                        0,
                        fullPath.lastIndexOf(".")
                    );

                console.log(
                    "Deleting Cloudinary image:",
                    public_id
                );

                await cloudinary.uploader.destroy(
                    public_id
                );

            } catch (deleteError) {

                console.warn(
                    "Cloudinary image deletion failed:",
                    deleteError.message
                );

            }

        }


        // Delete category from MongoDB
        await CategoryModel.findByIdAndDelete(id);


        return res.status(200).json({
            success: true,
            message: "Category and image deleted successfully !!!"
        });

    }
    catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

export { createcategory, Getallcategories, Updatecategory, Singlecategory, Deletecategory };