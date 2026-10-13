import mongoose from "mongoose";
import { uploadToCloudinary, cloudinary } from "../config/Cloudinary.js";
import CategoryModel from "../models/CategoryModel.js";
import ProductModel from "../models/ProductModel.js";

// Helper to safely parse JSON or return original value
const parseJsonSafely = (value, fallback) => {
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return fallback !== undefined ? fallback : value;
        }
    }
    return value !== undefined ? value : fallback;
};

// Helper to normalize about_product (string, JSON string, or array)
const parseAboutProduct = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
        } catch {
            // Not a JSON string - handle newline or comma separated or single string
            if (value.includes("\n")) {
                return value.split("\n").map(s => s.trim()).filter(Boolean);
            }
            return [value.trim()].filter(Boolean);
        }
    }
    return [String(value).trim()].filter(Boolean);
};

// Helper to normalize nutrition_facts
const parseNutritionFacts = (value) => {
    if (!value) return {};
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }
    if (typeof value === "object") return value;
    return {};
};

// create new product 
const Createproduct = async (req, res) => {
    const {
        name,
        description,
        category,
        variants,
        coupons,
        about_product,
        about_this_product,
        storage_instructions,
        nutrition_facts
    } = req.body;

    try {
        const role = req?.user?.role;
        const createdby = req?.user?.id || req?.user?._id;

        const productname = await ProductModel.findOne({ name });

        if (productname) {
            return res.status(400).json({ success: false, message: "Product already exists with this name!!!" });
        }

        if (role !== "admin" && role !== "vendor") {
            return res.status(400).json({ success: false, message: "Only admin or vendor can create products !!!" });
        }

        if (!category) {
            return res.status(400).json({ success: false, message: "Category is required !!!" });
        }

        const categoryId = await CategoryModel.findById(category);

        if (!categoryId) {
            return res.status(400).json({ success: false, message: "Category not found !!!" });
        }

        if (!name || name.trim() === "") {
            return res.status(400).json({ success: false, message: "Name is required !!!" });
        }

        if (!description || description.trim() === "") {
            return res.status(400).json({ success: false, message: "Description is required !!!" });
        }

        if (!variants || variants.length === 0) {
            return res.status(400).json({ success: false, message: "Variants are required !!!" });
        }

        // ─── Parse variants + coupons + new fields (sent as JSON string from form-data) ───
        let parsedVariants = parseJsonSafely(variants, []);
        let parsedCoupons = parseJsonSafely(coupons, []);
        const parsedAboutProduct = parseAboutProduct(about_product || about_this_product);
        const parsedStorageInstructions = storage_instructions ? String(storage_instructions).trim() : "";
        const parsedNutritionFacts = parseNutritionFacts(nutrition_facts);

        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
            return res.status(400).json({ success: false, message: "Variants must be a non-empty array!" });
        }

        // ─── Validate each variant ────────────────────────────────────────────
        for (const v of parsedVariants) {
            if (!v.weight || v.original_price === undefined || v.selling_price === undefined) {
                return res.status(400).json({
                    success: false,
                    message: "Each variant must have weight, original_price and selling_price!",
                });
            }
            if (Number(v.selling_price) > Number(v.original_price)) {
                return res.status(400).json({
                    success: false,
                    message: `Selling price cannot be greater than original price for weight ${v.weight}!`,
                });
            }
            // Ensure stock & stock_quantity are populated properly
            const stockVal = v.stock !== undefined ? Number(v.stock) : (v.stock_quantity !== undefined ? Number(v.stock_quantity) : 0);
            v.stock = isNaN(stockVal) ? 0 : stockVal;
            v.stock_quantity = v.stock;
        }

        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        const maxSize = 5 * 1024 * 1024; // 5MB

        let thumbnailUrl = "";
        let thumbnailPublicId = "";

        const thumbnailFile = req.files?.find(f => f.fieldname === "thumbnail");
        if (!thumbnailFile) {
            return res.status(400).json({ success: false, message: "Thumbnail image is required!" });
        }

        // ✅ format check
        if (!allowedTypes.includes(thumbnailFile.mimetype)) {
            return res.status(400).json({ success: false, message: "Thumbnail: only jpg, jpeg, png, webp, gif allowed!" });
        }
        // ✅ size check
        if (thumbnailFile.size > maxSize) {
            return res.status(400).json({ success: false, message: "Thumbnail size must be less than 5MB!" });
        }

        const result = await uploadToCloudinary(thumbnailFile.buffer, "products");
        thumbnailUrl = result.url;
        thumbnailPublicId = result.public_id;

        // Multiple images upload
        let imageUrls = [];
        let imagePublicIds = [];

        const imageFiles = req.files?.filter(
            f => f.fieldname === "images"
        );

        if (imageFiles && imageFiles.length > 0) {
            // Validate each image
            for (const file of imageFiles) {
                if (!allowedTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        success: false,
                        message: "Images: only jpg, jpeg, png, webp, gif allowed!"
                    });
                }

                if (file.size > maxSize) {
                    return res.status(400).json({
                        success: false,
                        message: "Each image size must be less than 5MB!"
                    });
                }
            }

            // Upload all images
            const results = await Promise.all(
                imageFiles.map(file =>
                    uploadToCloudinary(
                        file.buffer,
                        "products/images"
                    )
                )
            );

            imageUrls = results.map(r => r.url);
            imagePublicIds = results.map(r => r.public_id);
        }

        // create product 
        const product = await ProductModel.create({
            name,
            description,
            about_product: parsedAboutProduct,
            storage_instructions: parsedStorageInstructions,
            nutrition_facts: parsedNutritionFacts,
            category,
            thumbnail: thumbnailUrl,
            thumbnail_id: thumbnailPublicId,
            images: imageUrls,
            image_ids: imagePublicIds,
            variants: parsedVariants,
            coupons: parsedCoupons,
            createdby,
        });

        return res.status(201).json({ success: true, message: "Product created successfully !!!", data: product });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// update product
const Updateproduct = async (req, res) => {
    const { id } = req.params;
    const {
        name,
        description,
        about_product,
        about_this_product,
        storage_instructions,
        nutrition_facts,
        variants,
        coupons,
        category,
        is_active
    } = req.body;

    try {
        const userId = req?.user?.id || req?.user?._id;
        const userRole = req?.user?.role;

        const productown = await ProductModel.findById(id);

        if (!productown) {
            return res.status(404).json({ success: false, message: "Product not found !!!" });
        }

        if (userRole !== "admin" && productown.createdby.toString() !== userId?.toString()) {
            return res.status(403).json({
                success: false,
                message: "Only the owner of the product or admin can update it!"
            });
        }

        const updatedata = {};

        if (name && name.trim() !== "") updatedata.name = name;

        // ✅ update description if provided
        if (description && description.trim() !== "") updatedata.description = description;

        // ✅ update about_product if provided
        if (about_product !== undefined || about_this_product !== undefined) {
            updatedata.about_product = parseAboutProduct(about_product || about_this_product);
        }

        // ✅ update storage_instructions if provided
        if (storage_instructions !== undefined) {
            updatedata.storage_instructions = String(storage_instructions).trim();
        }

        // ✅ update nutrition_facts if provided
        if (nutrition_facts !== undefined) {
            updatedata.nutrition_facts = parseNutritionFacts(nutrition_facts);
        }

        // ✅ update is_active if provided
        if (is_active !== undefined) {
            updatedata.is_active = is_active === "true" || is_active === true;
        }

        // ✅ update category if provided
        if (category) {
            const categoryExists = await CategoryModel.findById(category);
            if (!categoryExists) {
                return res.status(404).json({ success: false, message: "Category not found!" });
            }
            updatedata.category = category;
        }

        // ✅ update variants if provided
        if (variants !== undefined) {
            const parsedVariants = parseJsonSafely(variants, []);

            if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
                return res.status(400).json({ success: false, message: "Variants must be a non-empty array!" });
            }

            for (const v of parsedVariants) {
                if (!v.weight || v.original_price === undefined || v.selling_price === undefined) {
                    return res.status(400).json({
                        success: false,
                        message: "Each variant must have weight, original_price and selling_price!",
                    });
                }
                if (Number(v.selling_price) > Number(v.original_price)) {
                    return res.status(400).json({
                        success: false,
                        message: `Selling price cannot be greater than original price for ${v.weight}!`,
                    });
                }
                const stockVal = v.stock !== undefined ? Number(v.stock) : (v.stock_quantity !== undefined ? Number(v.stock_quantity) : 0);
                v.stock = isNaN(stockVal) ? 0 : stockVal;
                v.stock_quantity = v.stock;
            }
            updatedata.variants = parsedVariants;
        }

        // ✅ update coupons if provided
        if (coupons !== undefined) {
            updatedata.coupons = parseJsonSafely(coupons, []);
        }

        // ✅ allowed formats + size
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        const maxSize = 5 * 1024 * 1024; // 5MB

        // ✅ update thumbnail if provided
        const thumbnailFile = req.files?.find(f => f.fieldname === "thumbnail");
        if (thumbnailFile) {
            if (!allowedTypes.includes(thumbnailFile.mimetype)) {
                return res.status(400).json({ success: false, message: "Thumbnail: only jpg, jpeg, png, webp, gif allowed!" });
            }
            if (thumbnailFile.size > maxSize) {
                return res.status(400).json({ success: false, message: "Thumbnail size must be less than 5MB!" });
            }

            // delete old thumbnail from cloudinary
            if (productown.thumbnail_id) {
                try {
                    await cloudinary.uploader.destroy(productown.thumbnail_id);
                } catch (err) {
                    console.warn("Old thumbnail deletion failed:", err.message);
                }
            } else if (productown.thumbnail) {
                try {
                    const urlParts = productown.thumbnail.split("/");
                    const filenameWithExt = urlParts[urlParts.length - 1];
                    const folder = urlParts[urlParts.length - 2];
                    const public_id = `${folder}/${filenameWithExt.split(".")[0]}`;
                    await cloudinary.uploader.destroy(public_id);
                } catch (err) {
                    console.warn("Old thumbnail deletion failed:", err.message);
                }
            }

            const result = await uploadToCloudinary(thumbnailFile.buffer, "products/thumbnails");
            updatedata.thumbnail = result.url;
            updatedata.thumbnail_id = result.public_id;
        }

        // ✅ update images if provided
        const imageFiles = req.files?.filter(f => f.fieldname === "images");
        if (imageFiles && imageFiles.length > 0) {
            for (const file of imageFiles) {
                if (!allowedTypes.includes(file.mimetype)) {
                    return res.status(400).json({ success: false, message: "Images: only jpg, jpeg, png, webp, gif allowed!" });
                }
                if (file.size > maxSize) {
                    return res.status(400).json({ success: false, message: "Each image must be less than 5MB!" });
                }
            }

            // delete old images from cloudinary
            if (productown.image_ids && productown.image_ids.length > 0) {
                for (const publicId of productown.image_ids) {
                    try {
                        await cloudinary.uploader.destroy(publicId);
                    } catch (err) {
                        console.warn("Old image deletion failed:", err.message);
                    }
                }
            } else if (productown.images && productown.images.length > 0) {
                for (const imgUrl of productown.images) {
                    try {
                        const urlParts = imgUrl.split("/");
                        const filenameWithExt = urlParts[urlParts.length - 1];
                        const folder = urlParts[urlParts.length - 2];
                        const public_id = `${folder}/${filenameWithExt.split(".")[0]}`;
                        await cloudinary.uploader.destroy(public_id);
                    } catch (err) {
                        console.warn("Old image deletion failed:", err.message);
                    }
                }
            }

            const results = await Promise.all(
                imageFiles.map(f => uploadToCloudinary(f.buffer, "products/images"))
            );
            updatedata.images = results.map(r => r.url);
            updatedata.image_ids = results.map(r => r.public_id);
        }

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            id,
            { $set: updatedata },
            { new: true, runValidators: true }
        ).populate("category");

        return res.status(200).json({
            success: true,
            message: "Product updated successfully!",
            data: updatedProduct,
        });

    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// delete product
const Deleteproduct = async (req, res) => {
    const { id } = req.params;
    try {
        const role = req?.user?.role;
        const userId = req?.user?.id || req?.user?._id;

        const product = await ProductModel.findById(id);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found !!!" });
        }

        if (role !== 'admin' && product.createdby.toString() !== userId?.toString()) {
            return res.status(403).json({ success: false, message: "Only admin or product owner can delete products !!!" });
        }

        await ProductModel.findByIdAndDelete(id);

        return res.status(200).json({ success: true, message: "Product deleted successfully !!!" });

    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// get all products with pagination
const Getallproducts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.category) {
            filter.category = req.query.category;
        }
        if (req.query.is_active !== undefined) {
            filter.is_active = req.query.is_active === "true" || req.query.is_active === true;
        }
        if (req.query.search) {
            filter.name = { $regex: req.query.search, $options: "i" };
        }

        const totalProducts = await ProductModel.countDocuments(filter);
        const totalPages = Math.ceil(totalProducts / limit) || 1;

        const products = await ProductModel.find(filter)
            .populate("category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully !!!",
            data: products,
            count: products.length,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// single product 
const Singleproduct = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await ProductModel.findById(id).populate("category");

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found !!!" });
        }

        return res.status(200).json({ success: true, message: "Product found successfully !!!", data: product });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// get all products based on category with pagination
const Getproductsoncategory = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Check if category exists first
        const category = await CategoryModel.findById(id);

        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found !!!" });
        }

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const totalProducts = await ProductModel.countDocuments({ category: id });
        const totalPages = Math.ceil(totalProducts / limit) || 1;

        // 2. Find products for this category with pagination
        const products = await ProductModel.find({ category: id })
            .populate("category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            data: products,
            count: products.length,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}

// search products by keyword 
const handlesearchproducts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const filter = {};

        if (req.query.category) {
            filter.category = req.query.category;
        }

        if (req.query.is_active !== undefined) {
            filter.is_active = req.query.is_active === "true";
        }

        if (req.query.search) {
            const search = req.query.search.trim();

            const keywords = search
                .split(/\s+/)
                .filter(Boolean)
                .map(word =>
                    word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                );

            filter.$or = keywords.map(word => ({
                $or: [
                    { name: { $regex: word, $options: "i" } },
                    { description: { $regex: word, $options: "i" } },
                    { about_product: { $regex: word, $options: "i" } }
                ]
            }));
        }

        const totalProducts =
            await ProductModel.countDocuments(filter);

        const totalPages =
            Math.ceil(totalProducts / limit) || 1;

        const products = await ProductModel.find(filter)
            .populate("Category")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully!",
            data: products,
            count: products.length,
            pagination: {
                totalProducts,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export { Createproduct, Updateproduct, Deleteproduct, Getallproducts, Singleproduct, Getproductsoncategory, handlesearchproducts };
