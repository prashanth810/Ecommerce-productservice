import jwt from "jsonwebtoken";
import Envs from "../utils/Envs.js";


const Authmiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ success: false, message: "Invalid token un authorized !!!" });
        }

        const token = authHeader.split(" ")[1];

        const decode = jwt.verify(token, Envs.JWT_SECRET);
        const user = decode;
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, message: error.message })
    }
}

export default Authmiddleware;