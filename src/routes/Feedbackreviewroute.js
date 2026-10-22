import express from "express";
import Authmiddleware from "../middlewares/Authmiddleware.js";
import Ratelimit from "../middlewares/Ratelimit.js";
import {
    AddFeedback, GetProductFeedback, GetMyProductFeedback,
    GetSingleFeedback, UpdateFeedback, DeleteFeedback,
} from "../controllers/Feedbackcontroller.js";

const Feedbackroute = express.Router();

// 1 minute window, max requests, 5 minute cooldown
const limit = (max) => Ratelimit(60 * 1000, max, 5 * 60 * 1000);

// ---- feedback of ONE product ----
// add my feedback on the product            (login needed)
Feedbackroute.post("/product/:productId/feedback", limit(10), Authmiddleware, AddFeedback);

// my own feedback on the product            (login needed)  keep above the list route
Feedbackroute.get("/product/:productId/feedback/me", limit(30), Authmiddleware, GetMyProductFeedback);

// all feedback of the product + rating summary  (public)  ?page=1&limit=10&sort=latest|oldest|highest|lowest&rating=1-5
Feedbackroute.get("/product/:productId/feedback", limit(40), GetProductFeedback);

// ---- one feedback ----
Feedbackroute.get("/feedback/:id", limit(40), GetSingleFeedback);
Feedbackroute.put("/feedback/:id", limit(10), Authmiddleware, UpdateFeedback);
Feedbackroute.delete("/feedback/:id", limit(10), Authmiddleware, DeleteFeedback);

export default Feedbackroute;