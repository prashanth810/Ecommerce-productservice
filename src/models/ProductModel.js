import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    about_product: {
        type: [String],
        default: [],
    },
    storage_instructions: {
        type: String,
        default: "",
    },
    nutrition_facts: {
        serving_size: { type: String, default: "" },
        calories: { type: String, default: "" },
        total_fat: { type: String, default: "" },
        saturated_fat: { type: String, default: "" },
        trans_fat: { type: String, default: "" },
        cholesterol: { type: String, default: "" },
        sodium: { type: String, default: "" },
        total_carbohydrates: { type: String, default: "" },
        dietary_fiber: { type: String, default: "" },
        sugars: { type: String, default: "" },
        protein: { type: String, default: "" },
    },
    thumbnail: {
        type: String,
        required: true,
    },
    thumbnail_id: {
        type: String,
        default: "",
    },
    images: {
        type: [String],
        default: [],
    },
    image_ids: {
        type: [String],
        default: [],
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    createdby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    variants: [
        {
            weight: {
                type: String,
                required: true,
            },
            original_price: {
                type: String,
                required: true,
            },
            selling_price: {
                type: String,
                required: true,
            },
            discount_price: {
                type: String,
                default: "",
            },
            stock: {
                type: Number,
                default: 0,
            },
            stock_quantity: {
                type: Number,
                default: 0,
            },
        }
    ],

    coupons: [
        {
            code: {
                type: String,
                required: true,
                trim: true,
            },
            discount_type: {
                type: String,
                enum: ["PERCENTAGE", "FIXED", "UPTO"],
                required: true,
            },
            discount_value: {
                type: Number,
                required: true,
            },
            applicable_weights: {
                type: [String],
                default: [],
            },
            min_order: {
                type: String,
                default: "0",
            },
            is_active: {
                type: Boolean,
                default: true,
            }
        }
    ],
    rating: {
        type: String,
        default: "0",
    },
    total_reviews: {
        type: String,
        default: "0",
    },
    reviews: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },
            rating: {
                type: String,
                required: true,
            },
            comment: {
                type: String,
                required: true,
            },
            review_date: {
                type: Date,
                default: Date.now,
            },
        }
    ],
    is_active: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true, minimize: false });

const ProductModel = mongoose.model("Product", ProductSchema);

export default ProductModel;
