"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedInitialUser = seedInitialUser;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../shared/db");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env['JWT_SECRET'] || 'neurorobi-secret-key-2026';
// ──────────────────────────────────────────
// POST /api/auth/register  → Register new specialist
// ──────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role, profileImageBase64 } = req.body;
        if (!email || !password || !name || !role) {
            res.status(400).json({ error: 'Todos los campos son obligatorios' });
            return;
        }
        const cleanEmail = email.toLowerCase().trim();
        // Check if user already exists
        const existing = await db_1.prisma.specialist.findUnique({
            where: { email: cleanEmail }
        });
        if (existing) {
            res.status(400).json({ error: 'El correo electrónico ya está registrado' });
            return;
        }
        // Validate role
        const validRoles = ['PSICOLOGIA_CLINICA', 'EDUCACION_ESPECIAL', 'FISIOTERAPIA', 'ADMIN'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ error: 'Rol inválido especificado' });
            return;
        }
        // Hash password
        const hashedPassword = bcryptjs_1.default.hashSync(password, 10);
        const newSpecialist = await db_1.prisma.specialist.create({
            data: {
                email: cleanEmail,
                password: hashedPassword,
                name: name.trim(),
                role: role,
                profileImageUrl: profileImageBase64 || null
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                profileImageUrl: true,
                createdAt: true
            }
        });
        res.status(201).json(newSpecialist);
    }
    catch (error) {
        console.error('[POST /auth/register]', error);
        res.status(500).json({ error: 'Error al registrar especialista' });
    }
});
// ──────────────────────────────────────────
// POST /api/auth/login  → Authenticate & issue token
// ──────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Correo y contraseña son requeridos' });
            return;
        }
        const cleanEmail = email.toLowerCase().trim();
        // Find specialist
        const specialist = await db_1.prisma.specialist.findUnique({
            where: { email: cleanEmail }
        });
        if (!specialist) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        // Compare passwords
        const isPasswordValid = bcryptjs_1.default.compareSync(password, specialist.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        // Generate JWT
        const token = jsonwebtoken_1.default.sign({
            id: specialist.id,
            email: specialist.email,
            name: specialist.name,
            role: specialist.role
        }, JWT_SECRET, { expiresIn: '30d' });
        res.json({
            token,
            user: {
                id: specialist.id,
                email: specialist.email,
                name: specialist.name,
                role: specialist.role,
                profileImageUrl: specialist.profileImageUrl
            }
        });
    }
    catch (error) {
        console.error('[POST /auth/login]', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});
// ──────────────────────────────────────────
// PUT /api/auth/profile/:id  → Update specialist profile
// ──────────────────────────────────────────
router.put('/profile/:id', async (req, res) => {
    try {
        const id = String(req.params['id']);
        const { name, password, profileImageBase64 } = req.body;
        const existing = await db_1.prisma.specialist.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        const dataToUpdate = {};
        if (name && name.trim() !== '')
            dataToUpdate.name = name.trim();
        if (password && password.trim() !== '') {
            dataToUpdate.password = bcryptjs_1.default.hashSync(password, 10);
        }
        if (profileImageBase64) {
            dataToUpdate.profileImageUrl = profileImageBase64;
        }
        const updated = await db_1.prisma.specialist.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                profileImageUrl: true
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('[PUT /auth/profile]', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
});
// ──────────────────────────────────────────
// GET /api/auth/specialists  → List all specialists
// ──────────────────────────────────────────
router.get('/specialists', async (_req, res) => {
    try {
        const specialists = await db_1.prisma.specialist.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        res.json(specialists);
    }
    catch (error) {
        console.error('[GET /auth/specialists]', error);
        res.status(500).json({ error: 'Error al obtener especialistas' });
    }
});
// ──────────────────────────────────────────
// GET /api/auth/specialists/by-email/:email
// ──────────────────────────────────────────
router.get('/specialists/by-email/:email', async (req, res) => {
    try {
        const email = String(req.params['email']).toLowerCase().trim();
        const specialist = await db_1.prisma.specialist.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true
            }
        });
        if (!specialist) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        res.json(specialist);
    }
    catch (error) {
        console.error('[GET /auth/specialists/by-email]', error);
        res.status(500).json({ error: 'Error al obtener especialista' });
    }
});
// ──────────────────────────────────────────
// GET /api/auth/specialists/:id
// ──────────────────────────────────────────
router.get('/specialists/:id', async (req, res) => {
    try {
        const id = String(req.params['id']);
        const specialist = await db_1.prisma.specialist.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                profileImageUrl: true,
                createdAt: true
            }
        });
        if (!specialist) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        res.json(specialist);
    }
    catch (error) {
        console.error('[GET /auth/specialists/:id]', error);
        res.status(500).json({ error: 'Error al obtener especialista' });
    }
});
// ──────────────────────────────────────────
// Database Seeder
// ──────────────────────────────────────────
async function seedInitialUser() {
    try {
        await db_1.prisma.specialist.updateMany({
            where: { profileImageUrl: { startsWith: '/uploads/' } },
            data: { profileImageUrl: null }
        });
        await db_1.prisma.patient.updateMany({
            where: { profileImageUrl: { startsWith: '/uploads/' } },
            data: { profileImageUrl: null }
        });
        const usersToSeed = [
            { email: 'accionsocial@gmail.com', password: 'accionsocialcuenca', name: 'Acción Social Admin', role: 'ADMIN' },
            { email: 'psicologia@neurorobi.com', password: 'psicologia2026', name: 'Dra. María López', role: 'PSICOLOGIA_CLINICA' },
            { email: 'educacion@neurorobi.com', password: 'educacion2026', name: 'Lic. Carlos Méndez', role: 'EDUCACION_ESPECIAL' },
            { email: 'fisioterapia@neurorobi.com', password: 'fisioterapia2026', name: 'Ftr. Ana Salazar', role: 'FISIOTERAPIA' }
        ];
        for (const user of usersToSeed) {
            const existing = await db_1.prisma.specialist.findUnique({
                where: { email: user.email }
            });
            const hashedPassword = bcryptjs_1.default.hashSync(user.password, 10);
            if (!existing) {
                await db_1.prisma.specialist.create({
                    data: {
                        email: user.email,
                        password: hashedPassword,
                        name: user.name,
                        role: user.role
                    }
                });
                console.log(`✅ Seeded user: ${user.name} (${user.role})`);
            }
            else {
                if (existing.password !== hashedPassword) {
                    await db_1.prisma.specialist.update({
                        where: { email: user.email },
                        data: { password: hashedPassword }
                    });
                    console.log(`🔄 Updated password for: ${user.email}`);
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Error during user seeding:', error);
    }
}
exports.default = router;
//# sourceMappingURL=auth.js.map