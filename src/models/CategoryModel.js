import mongoose from "mongoose";


const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    imageurl: {
        type: String,
        required: true,
    },
    createbyId: {
        type: String,
        reqired: true,
    },

}, { timestamps: true, minimize: false });

const CategoryModel = mongoose.model("Category", CategorySchema);

export default CategoryModel;