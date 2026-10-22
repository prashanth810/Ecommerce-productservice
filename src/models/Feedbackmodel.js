import mongoose from "mongoose";

// one feedback (rating + comment) of one user on one product
const FeedbackSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    userName: {
        type: String,
        default: "",
        trim: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 500,
    },
}, { timestamps: true });

// a user can give only one feedback per product (he can edit it)
FeedbackSchema.index({ product: 1, user: 1 }, { unique: true });
FeedbackSchema.index({ product: 1, createdAt: -1 });

const FeedbackModel = mongoose.model("Feedback", FeedbackSchema);

export default FeedbackModel;