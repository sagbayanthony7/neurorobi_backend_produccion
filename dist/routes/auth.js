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
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env['JWT_SECRET'] || 'neurorobi-secret-key-2026';
// ──────────────────────────────────────────
// POST /api/auth/register  → Register new specialist
// ──────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role, specialtyId, profileImageBase64 } = req.body;
        if (!email || !password || !name) {
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
        const userRole = role || 'THERAPIST';
        if (specialtyId) {
            const specialty = await db_1.prisma.specialty.findUnique({ where: { id: specialtyId } });
            if (!specialty) {
                res.status(400).json({ error: 'Especialidad inválida' });
                return;
            }
        }
        // Hash password
        const hashedPassword = bcryptjs_1.default.hashSync(password, 10);
        const newSpecialist = await db_1.prisma.specialist.create({
            data: {
                email: cleanEmail,
                password: hashedPassword,
                name: name.trim(),
                role: userRole,
                specialtyId: specialtyId || null,
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
            where: { email: cleanEmail },
            include: { specialty: { select: { id: true, name: true, color: true, icon: true } } }
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
                specialtyId: specialist.specialtyId,
                specialty: specialist.specialty,
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
                role: true,
                specialtyId: true,
                profileImageUrl: true,
                specialty: {
                    select: { id: true, name: true, color: true, icon: true }
                }
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
router.get('/specialists/by-email/:email', auth_1.authenticate, async (req, res) => {
    try {
        const email = String(req.params['email']).toLowerCase().trim();
        const specialist = await db_1.prisma.specialist.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                specialtyId: true,
                specialty: {
                    select: { id: true, name: true, color: true, icon: true }
                }
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
                specialtyId: true,
                profileImageUrl: true,
                createdAt: true,
                specialty: {
                    select: { id: true, name: true, color: true, icon: true }
                }
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
// PUT /api/auth/specialists/:id  → Admin: update specialist
// ──────────────────────────────────────────
router.put('/specialists/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const { name, email, role, specialtyId, password } = req.body;
        const existing = await db_1.prisma.specialist.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        const dataToUpdate = {};
        if (name && name.trim() !== '')
            dataToUpdate.name = name.trim();
        if (email) {
            const cleanEmail = email.toLowerCase().trim();
            if (cleanEmail !== existing.email) {
                const emailTaken = await db_1.prisma.specialist.findUnique({ where: { email: cleanEmail } });
                if (emailTaken) {
                    res.status(400).json({ error: 'El correo electrónico ya está en uso' });
                    return;
                }
                dataToUpdate.email = cleanEmail;
            }
        }
        if (role !== undefined)
            dataToUpdate.role = role;
        if (specialtyId !== undefined) {
            if (specialtyId) {
                const specialty = await db_1.prisma.specialty.findUnique({ where: { id: specialtyId } });
                if (!specialty) {
                    res.status(400).json({ error: 'Especialidad inválida' });
                    return;
                }
            }
            dataToUpdate.specialtyId = specialtyId || null;
        }
        if (password && password.trim() !== '') {
            dataToUpdate.password = bcryptjs_1.default.hashSync(password, 10);
        }
        const updated = await db_1.prisma.specialist.update({
            where: { id },
            data: dataToUpdate,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                specialtyId: true,
                profileImageUrl: true,
                createdAt: true,
                specialty: {
                    select: { id: true, name: true, color: true, icon: true }
                }
            }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('[PUT /auth/specialists/:id]', error);
        res.status(500).json({ error: 'Error al actualizar especialista' });
    }
});
// ──────────────────────────────────────────
// DELETE /api/auth/specialists/:id  → Admin: delete specialist
// ──────────────────────────────────────────
router.delete('/specialists/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const existing = await db_1.prisma.specialist.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        if (existing.role === 'ADMIN') {
            const adminCount = await db_1.prisma.specialist.count({ where: { role: 'ADMIN' } });
            if (adminCount <= 1) {
                res.status(400).json({ error: 'No se puede eliminar el último administrador' });
                return;
            }
        }
        await db_1.prisma.patientAssignment.deleteMany({ where: { specialistId: id } });
        await db_1.prisma.specialist.delete({ where: { id } });
        res.json({ message: 'Especialista eliminado correctamente', id });
    }
    catch (error) {
        console.error('[DELETE /auth/specialists/:id]', error);
        res.status(500).json({ error: 'Error al eliminar especialista' });
    }
});
// ──────────────────────────────────────────
// GET /api/auth/specialists/:id/stats  → Admin: get specialist stats
// ──────────────────────────────────────────
router.get('/specialists/:id/stats', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const specialist = await db_1.prisma.specialist.findUnique({ where: { id } });
        if (!specialist) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        const assignmentCount = await db_1.prisma.patientAssignment.count({ where: { specialistId: id } });
        const sessionCount = await db_1.prisma.clinicalSession.count({ where: { specialistId: id } });
        res.json({
            specialistId: id,
            name: specialist.name,
            email: specialist.email,
            role: specialist.role,
            assignedPatients: assignmentCount,
            totalSessions: sessionCount
        });
    }
    catch (error) {
        console.error('[GET /auth/specialists/:id/stats]', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});
// ──────────────────────────────────────────
// GET /api/auth/specialties  → List all specialties
// ──────────────────────────────────────────
router.get('/specialties', async (_req, res) => {
    try {
        const specialties = await db_1.prisma.specialty.findMany({
            include: { _count: { select: { specialists: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(specialties);
    }
    catch (error) {
        console.error('[GET /auth/specialties]', error);
        res.status(500).json({ error: 'Error al obtener especialidades' });
    }
});
// ──────────────────────────────────────────
// POST /api/auth/specialties  → Admin: create specialty
// ──────────────────────────────────────────
router.post('/specialties', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const { name, color, icon } = req.body;
        if (!name || name.trim() === '') {
            res.status(400).json({ error: 'El nombre es requerido' });
            return;
        }
        const existing = await db_1.prisma.specialty.findUnique({ where: { name: name.trim() } });
        if (existing) {
            res.status(400).json({ error: 'Ya existe una especialidad con ese nombre' });
            return;
        }
        const specialty = await db_1.prisma.specialty.create({
            data: { name: name.trim(), color: color || 'teal', icon: icon || 'Heart' }
        });
        res.status(201).json(specialty);
    }
    catch (error) {
        console.error('[POST /auth/specialties]', error);
        res.status(500).json({ error: 'Error al crear especialidad' });
    }
});
// ──────────────────────────────────────────
// PUT /api/auth/specialties/:id  → Admin: update specialty
// ──────────────────────────────────────────
router.put('/specialties/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const { name, color, icon } = req.body;
        const existing = await db_1.prisma.specialty.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Especialidad no encontrada' });
            return;
        }
        const dataToUpdate = {};
        if (name && name.trim() !== '')
            dataToUpdate.name = name.trim();
        if (color)
            dataToUpdate.color = color;
        if (icon)
            dataToUpdate.icon = icon;
        const updated = await db_1.prisma.specialty.update({ where: { id }, data: dataToUpdate });
        res.json(updated);
    }
    catch (error) {
        console.error('[PUT /auth/specialties/:id]', error);
        res.status(500).json({ error: 'Error al actualizar especialidad' });
    }
});
// ──────────────────────────────────────────
// DELETE /api/auth/specialties/:id  → Admin: delete specialty
// ──────────────────────────────────────────
router.delete('/specialties/:id', auth_1.authenticate, auth_1.requireAdmin, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const existing = await db_1.prisma.specialty.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Especialidad no encontrada' });
            return;
        }
        const usageCount = await db_1.prisma.specialist.count({ where: { specialtyId: id } });
        if (usageCount > 0) {
            res.status(400).json({ error: `No se puede eliminar: ${usageCount} especialista(s) usan esta especialidad` });
            return;
        }
        await db_1.prisma.specialty.delete({ where: { id } });
        res.json({ message: 'Especialidad eliminada correctamente' });
    }
    catch (error) {
        console.error('[DELETE /auth/specialties/:id]', error);
        res.status(500).json({ error: 'Error al eliminar especialidad' });
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
        // Fix admin role if wiped by schema migration
        const admin = await db_1.prisma.specialist.findUnique({ where: { email: 'accionsocial@gmail.com' } });
        if (admin && admin.role !== 'ADMIN') {
            await db_1.prisma.specialist.update({ where: { email: 'accionsocial@gmail.com' }, data: { role: 'ADMIN' } });
        }
        // Seed default specialties
        const defaultSpecialties = [
            { name: 'Psicología Clínica', color: 'rose', icon: 'Heart' },
            { name: 'Educación Especial', color: 'indigo', icon: 'Brain' },
            { name: 'Fisioterapia', color: 'emerald', icon: 'Sparkles' }
        ];
        for (const spec of defaultSpecialties) {
            await db_1.prisma.specialty.upsert({
                where: { name: spec.name },
                update: {},
                create: spec
            });
        }
        const usersToSeed = [
            { email: 'accionsocial@gmail.com', password: 'accionsocialcuenca', name: 'Acción Social Admin', role: 'ADMIN' }
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