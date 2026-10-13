import express from "express";
import Authmiddleware from "../middlewares/Authmiddleware.js";
import { Createproduct, Deleteproduct, Getallproducts, Getproductsoncategory, handlesearchproducts, Singleproduct, Updateproduct } from "../controllers/Productcontroller.js";
import { upload } from "../config/Cloudinary.js";
import Ratelimit from "../middlewares/Ratelimit.js";


const Productroute = express.Router();

// create product
Productroute.post("/createproduct", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, upload.any("product"), Createproduct)

// update product
Productroute.put("/updateproduct/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, upload.any("product"), Updateproduct);

// delete produscts 
Productroute.delete("/deleteproduct/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    5,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Authmiddleware, Deleteproduct);

// all products 
Productroute.get("/allproducts", Ratelimit(
    60 * 1000,      // 1 minute window
    40,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Getallproducts);

// get single product 
Productroute.get("/product/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    40,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Singleproduct);

// get products based on ghe category 
Productroute.get("/category/:id", Ratelimit(
    60 * 1000,      // 1 minute window
    20,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), Getproductsoncategory);

// search products by keyword 
Productroute.get("/products", Ratelimit(
    60 * 1000,      // 1 minute window
    20,              // 5 attempts
    5 * 60 * 1000   // 5 minute cooldown
), handlesearchproducts);

export default Productroute;