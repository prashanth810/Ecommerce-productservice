import express from "express";
import cors from "cors";
import morgen from "morgan";
import ConnectionDB from "./config/ConnectionDB.js";
import Categoryroute from "./routes/Categoryroutes.js";
import Productroute from "./routes/Productroutes.js";
import Envs from "./utils/Envs.js";
import startGrpcServer from "./grpc/grpcServer.js";

const PORT = Envs.PORT;

const app = express();

app.use(express.json());
app.use(morgen("dev"));

app.use(cors());

app.get("/product", (req, res) => {
    return res.status(200).json({ success: true, message: "Product backend started !!!" });
});

// connections routes for product and category
app.use("/api/auth/v2", Categoryroute);
app.use('/api/auth/v2', Productroute);

ConnectionDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Product service started !!! at ${PORT}`);
    });
    startGrpcServer();
}).catch((error) => {
    console.log("Failed to connect Product service !!!")
});