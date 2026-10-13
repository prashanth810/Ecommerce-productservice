import express from "express";
import Authmiddleware from "../middlewares/Authmiddleware.js";
import { upload } from "../config/Cloudinary.js";
import { createcategory, Deletecategory, Getallcategories, Singlecategory, Updatecategory } from "../controllers/Categorycontrol.js";
import Ratelimit from "../middlewares/Ratelimit.js";

const Categoryroute = express.Router();

// creating category post 
Categoryroute.post("/createcategory", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, upload.single("image"), createcategory);

// update the categories
Categoryroute.put("/update/:categoryid", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, upload.single("image"), Updatecategory);

// get all categories
Categoryroute.get("/allcategories", Ratelimit(
    60 * 1000,      // 1 minute window
    20,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Getallcategories);

// get single category 
Categoryroute.get("/categories/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    10,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, Singlecategory);

//delete category by admins only
Categoryroute.delete("/remove/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, Deletecategory);

export default Categoryroute;