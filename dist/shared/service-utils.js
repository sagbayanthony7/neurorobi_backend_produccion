"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerService = registerService;
const axios_1 = __importDefault(require("axios"));
function registerService(name, port) {
    const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:4000/register';
    const HOSTNAME = process.env.HOSTNAME || 'localhost';
    const register = () => {
        axios_1.default.post(REGISTRY_URL, {
            name,
            host: HOSTNAME,
            port
        }).catch(() => {
            console.log(`[${name}] Could not reach Registry at ${REGISTRY_URL}. Retrying...`);
        });
    };
    // Register immediately and then every 10 seconds
    register();
    setInterval(register, 10000);
}
//# sourceMappingURL=service-utils.js.map