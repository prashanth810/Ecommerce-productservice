import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import ProductModel from "../models/ProductModel.js";
import Envs from "../utils/Envs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const productProto = grpc.loadPackageDefinition(
    protoLoader.loadSync(path.join(__dirname, "./product.proto"), {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
    })
).product;

const isAllowed = (call) => {
    const key = call?.metadata?.get("x-internal-key")?.[0];
    return Boolean(key && key === Envs.INTERNAL_GRPC_KEY);
};

const GetProductById = async (call, callback) => {
    if (!isAllowed(call)) {
        return callback({ code: grpc.status.UNAUTHENTICATED, message: "Not allowed" });
    }

    try {
        const { productId } = call.request;

        if (!mongoose.isValidObjectId(productId)) {
            return callback(null, { success: false, message: "Product not found", data: null });
        }

        const product = await ProductModel.findById(productId).lean();

        if (!product) {
            return callback(null, { success: false, message: "Product not found", data: null });
        }

        const variants = (product.variants || []).map((v) => ({
            weight: v.weight || "",
            original_price: String(v.original_price ?? ""),
            selling_price: String(v.selling_price ?? ""),
            discount_price: String(v.discount_price ?? ""),
            stock: Number(v.stock ?? v.stock_quantity ?? 0),
            stock_quantity: Number(v.stock_quantity ?? v.stock ?? 0),
        }));

        const data = {
            id: String(product._id),
            name: product.name || "",
            description: product.description || "",
            thumbnail: product.thumbnail || "",
            images: Array.isArray(product.images) ? product.images : [],
            variants,
            is_active: product.is_active !== false,
        };

        return callback(null, {
            success: true,
            message: "Product found",
            data,
        });
    } catch (error) {
        return callback({ code: grpc.status.INTERNAL, message: error.message });
    }
};

const startGrpcServer = () => {
    const server = new grpc.Server();
    server.addService(productProto.ProductService.service, { GetProductById });

    server.bindAsync(`0.0.0.0:${Envs.GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (error) => {
        if (error) {
            console.error("Product gRPC failed to start:", error.message);
            return;
        }
        console.log(`Product gRPC server running on ${Envs.GRPC_PORT}`);
    });
};

export default startGrpcServer;
