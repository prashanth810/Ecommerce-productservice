import mongoose from "mongoose";
import Envs from "../utils/Envs.js";

const mongo_url = Envs.MONGO_URL;

const ConnectionDB = async () => {
    try {
        await mongoose.connect(mongo_url);
        console.log("Product db connected Successfully !!!");
    }
    catch (error) {
        console.log("Product db failed to connect !!!");

    }
}

export default ConnectionDB;