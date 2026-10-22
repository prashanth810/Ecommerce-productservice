import mongoose from "mongoose";
import FeedbackModel from "../models/FeedbackModel.js";
import ProductModel from "../models/ProductModel.js";

const badId = (id) => !mongoose.isValidObjectId(id);
const getUserId = (req) => String(req?.user?.id || req?.user?._id || "");
const getUserName = (req) => req?.user?.name || req?.user?.fullName || req?.user?.username || "";

const SORTS = {
    latest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    highest: { rating: -1, createdAt: -1 },
    lowest: { rating: 1, createdAt: -1 },
};

// ---------- validation helpers (return the clean value, or null when invalid) ----------
// rating: 1 to 5, decimals allowed with one digit after the point (4, 4.5, 3.7)
const cleanRating = (value) => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && value.trim() === "") return null;

    const number = Number(value);
    if (!Number.isFinite(number) || number < 1 || number > 5) return null;
    if (Math.round(number * 10) / 10 !== number) return null; // max 1 decimal place
    return number;
};

// rating filter in the list API (?rating=4) is a whole star: 4 means 3.5 to 4.4
const cleanStarFilter = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null;
};

const cleanComment = (value) => {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text.length >= 3 && text.length <= 500 ? text : null;
};

// ---------- rating summary of one product: average, total and 1-5 star counts ----------
const buildSummary = async (productId) => {
    const rows = await FeedbackModel.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
        { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    for (const row of rows) {
        // 4.5 counts in the 5 star bucket, 4.4 in the 4 star bucket
        breakdown[Math.round(row._id)] += row.count;
        total += row.count;
        sum += row._id * row.count;
    }

    return {
        averageRating: total ? Math.round((sum / total) * 10) / 10 : 0,
        totalReviews: total,
        breakdown,
    };
};

// keep rating + total_reviews on the product in sync (never breaks the API call)
const syncProductRating = async (productId) => {
    try {
        const { averageRating, totalReviews } = await buildSummary(productId);
        await ProductModel.updateOne(
            { _id: productId },
            { $set: { rating: String(averageRating), total_reviews: String(totalReviews) } }
        );
        return { averageRating, totalReviews };
    } catch (error) {
        console.error("Product rating sync error:", error.message);
        return null;
    }
};

// ---------- CREATE: add feedback on a product ----------
const AddFeedback = async (req, res) => {
    const { productId } = req.params;
    try {
        const userId = getUserId(req);

        if (!userId || badId(userId)) {
            return res.status(401).json({ success: false, message: "Invalid user, please login again !!!" });
        }
        if (badId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product id !!!" });
        }

        const rating = cleanRating(req.body?.rating);
        if (rating === null) {
            return res.status(400).json({ success: false, message: "Rating must be a number from 1 to 5 (one decimal allowed, like 4.5) !!!" });
        }
        const comment = cleanComment(req.body?.comment);
        if (comment === null) {
            return res.status(400).json({ success: false, message: "Comment is required (3 to 500 characters) !!!" });
        }

        const product = await ProductModel.findById(productId).select("_id createdby is_active");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found !!!" });
        }
        if (product.createdby?.toString() === userId) {
            return res.status(403).json({ success: false, message: "You cannot give feedback on your own product !!!" });
        }

        const feedback = await FeedbackModel.create({
            product: productId,
            user: userId,
            userName: getUserName(req),
            rating,
            comment,
        });

        const summary = await syncProductRating(productId);

        return res.status(201).json({ success: true, message: "Feedback added successfully !!!", data: feedback, summary });
    }
    catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "You already gave feedback on this product, please update it !!!" });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- READ: all feedback of ONE product (public, with pagination + summary) ----------
// query: page, limit (max 50), sort = latest | oldest | highest | lowest, rating = 1..5
const GetProductFeedback = async (req, res) => {
    const { productId } = req.params;
    try {
        if (badId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product id !!!" });
        }

        const productExists = await ProductModel.exists({ _id: productId });
        if (!productExists) {
            return res.status(404).json({ success: false, message: "Product not found !!!" });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const sort = SORTS[req.query.sort] || SORTS.latest;

        const filter = { product: productId };
        if (req.query.rating !== undefined && req.query.rating !== "") {
            const stars = cleanStarFilter(req.query.rating);
            if (stars === null) {
                return res.status(400).json({ success: false, message: "Rating filter must be a whole number from 1 to 5 !!!" });
            }
            filter.rating = { $gte: stars - 0.5, $lt: stars + 0.5 };
        }

        const [list, total, summary] = await Promise.all([
            FeedbackModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            FeedbackModel.countDocuments(filter),
            buildSummary(productId),
        ]);

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            success: true,
            message: "Feedback fetched successfully !!!",
            summary,
            pagination: { page, limit, total, totalPages, hasNext: page < totalPages },
            data: list,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- READ: my own feedback on a product (null when I have not given one) ----------
const GetMyProductFeedback = async (req, res) => {
    const { productId } = req.params;
    try {
        const userId = getUserId(req);

        if (badId(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product id !!!" });
        }
        if (!userId || badId(userId)) {
            return res.status(401).json({ success: false, message: "Invalid user, please login again !!!" });
        }

        const feedback = await FeedbackModel.findOne({ product: productId, user: userId });

        return res.status(200).json({ success: true, data: feedback || null });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- READ: one feedback ----------
const GetSingleFeedback = async (req, res) => {
    const { id } = req.params;
    try {
        if (badId(id)) {
            return res.status(400).json({ success: false, message: "Invalid feedback id !!!" });
        }

        const feedback = await FeedbackModel.findById(id);
        if (!feedback) {
            return res.status(404).json({ success: false, message: "Feedback not found !!!" });
        }

        return res.status(200).json({ success: true, message: "Feedback found successfully !!!", data: feedback });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- UPDATE: only the owner can edit his feedback ----------
const UpdateFeedback = async (req, res) => {
    const { id } = req.params;
    try {
        const userId = getUserId(req);

        if (badId(id)) {
            return res.status(400).json({ success: false, message: "Invalid feedback id !!!" });
        }

        const hasRating = req.body?.rating !== undefined;
        const hasComment = req.body?.comment !== undefined;
        if (!hasRating && !hasComment) {
            return res.status(400).json({ success: false, message: "Send rating or comment to update !!!" });
        }

        const changes = {};
        if (hasRating) {
            const rating = cleanRating(req.body.rating);
            if (rating === null) {
                return res.status(400).json({ success: false, message: "Rating must be a number from 1 to 5 (one decimal allowed, like 4.5) !!!" });
            }
            changes.rating = rating;
        }
        if (hasComment) {
            const comment = cleanComment(req.body.comment);
            if (comment === null) {
                return res.status(400).json({ success: false, message: "Comment is required (3 to 500 characters) !!!" });
            }
            changes.comment = comment;
        }

        const feedback = await FeedbackModel.findById(id);
        if (!feedback) {
            return res.status(404).json({ success: false, message: "Feedback not found !!!" });
        }
        if (feedback.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "You can edit only your own feedback !!!" });
        }

        feedback.set(changes);
        await feedback.save();

        const summary = await syncProductRating(feedback.product);

        return res.status(200).json({ success: true, message: "Feedback updated successfully !!!", data: feedback, summary });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ---------- DELETE: owner or admin ----------
const DeleteFeedback = async (req, res) => {
    const { id } = req.params;
    try {
        const userId = getUserId(req);
        const role = req?.user?.role;

        if (badId(id)) {
            return res.status(400).json({ success: false, message: "Invalid feedback id !!!" });
        }

        const feedback = await FeedbackModel.findById(id);
        if (!feedback) {
            return res.status(404).json({ success: false, message: "Feedback not found !!!" });
        }
        if (role !== "admin" && feedback.user.toString() !== userId) {
            return res.status(403).json({ success: false, message: "You can delete only your own feedback !!!" });
        }

        await feedback.deleteOne();

        const summary = await syncProductRating(feedback.product);

        return res.status(200).json({ success: true, message: "Feedback deleted successfully !!!", summary });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export { AddFeedback, GetProductFeedback, GetMyProductFeedback, GetSingleFeedback, UpdateFeedback, DeleteFeedback };