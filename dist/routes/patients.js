"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../shared/db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ──────────────────────────────────────────
// GET /api/patients  → List patients (filtered by role)
// ──────────────────────────────────────────
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        let patients;
        if (userRole === 'ADMIN') {
            patients = await db_1.prisma.patient.findMany({
                orderBy: { registeredAt: 'desc' },
                include: {
                    _count: { select: { sessions: true } },
                    assignments: {
                        select: {
                            specialistId: true,
                            assignedAt: true
                        }
                    }
                }
            });
        }
        else {
            const assignedPatientIds = await db_1.prisma.patientAssignment.findMany({
                where: { specialistId: userId },
                select: { patientId: true }
            });
            const patientIds = assignedPatientIds.map(a => a.patientId);
            patients = await db_1.prisma.patient.findMany({
                where: { id: { in: patientIds } },
                orderBy: { registeredAt: 'desc' },
                include: {
                    _count: { select: { sessions: true } },
                    assignments: {
                        select: {
                            specialistId: true,
                            assignedAt: true
                        }
                    }
                }
            });
        }
        res.json(patients);
    }
    catch (error) {
        console.error('[GET /patients]', error);
        res.status(500).json({ error: 'Error al obtener pacientes' });
    }
});
// ──────────────────────────────────────────
// GET /api/patients/search  → Search patients by name/diagnosis
// ──────────────────────────────────────────
router.get('/search', auth_1.authenticate, async (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        if (!q || q.trim().length < 2) {
            res.status(400).json({ error: 'La búsqueda requiere al menos 2 caracteres' });
            return;
        }
        const searchTerm = q.trim().toLowerCase();
        const patients = await db_1.prisma.patient.findMany({
            where: {
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { diagnosis: { contains: searchTerm, mode: 'insensitive' } }
                ]
            },
            include: {
                _count: { select: { sessions: true } },
                assignments: {
                    select: { specialistId: true }
                }
            },
            orderBy: { registeredAt: 'desc' }
        });
        res.json(patients);
    }
    catch (error) {
        console.error('[GET /patients/search]', error);
        res.status(500).json({ error: 'Error al buscar pacientes' });
    }
});
// ──────────────────────────────────────────
// GET /api/patients/:id  → Single patient + sessions
// ──────────────────────────────────────────
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const patient = await db_1.prisma.patient.findUnique({
            where: { id },
            include: {
                sessions: {
                    select: {
                        id: true,
                        date: true,
                        durationSeconds: true,
                        specialistRole: true,
                        notes: true
                    },
                    orderBy: { date: 'desc' }
                },
                assignments: {
                    select: {
                        id: true,
                        specialistId: true,
                        assignedAt: true,
                        specialist: {
                            select: { id: true, name: true, role: true }
                        }
                    }
                }
            }
        });
        if (!patient) {
            res.status(404).json({ error: 'Paciente no encontrado' });
            return;
        }
        if (userRole !== 'ADMIN' && userId) {
            const isAssigned = patient.assignments.some(a => a.specialistId === userId);
            if (!isAssigned) {
                res.status(403).json({ error: 'No tienes acceso a este paciente' });
                return;
            }
        }
        res.json(patient);
    }
    catch (error) {
        console.error('[GET /patients/:id]', error);
        res.status(500).json({ error: 'Error al obtener paciente' });
    }
});
// ──────────────────────────────────────────
// POST /api/patients  → Register new patient
// ──────────────────────────────────────────
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { name, age, diagnosis, initialObservation, profileImageBase64, specialistId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId) {
            res.status(401).json({ error: 'Usuario no autenticado' });
            return;
        }
        if (!name || typeof name !== 'string' || name.trim() === '') {
            res.status(400).json({ error: 'El nombre del paciente es requerido' });
            return;
        }
        if (!age || isNaN(Number(age)) || Number(age) <= 0 || Number(age) > 120) {
            res.status(400).json({ error: 'La edad debe ser un número válido entre 1 y 120' });
            return;
        }
        if (!diagnosis || typeof diagnosis !== 'string' || diagnosis.trim() === '') {
            res.status(400).json({ error: 'El diagnóstico es requerido' });
            return;
        }
        // Determine which specialist gets the patient
        let assignToSpecialistId;
        if (userRole === 'ADMIN') {
            // Admin must specify a specialistId
            if (!specialistId || typeof specialistId !== 'string') {
                res.status(400).json({ error: 'Debes asignar el paciente a un especialista' });
                return;
            }
            const specialist = await db_1.prisma.specialist.findUnique({ where: { id: specialistId } });
            if (!specialist) {
                res.status(404).json({ error: 'Especialista no encontrado' });
                return;
            }
            assignToSpecialistId = specialistId;
        }
        else {
            // Specialist auto-assigns to themselves
            assignToSpecialistId = userId;
        }
        const newPatient = await db_1.prisma.patient.create({
            data: {
                name: name.trim(),
                age: Number(age),
                diagnosis: diagnosis.trim(),
                initialObservation: initialObservation?.trim() ?? '',
                status: 'Listo para Consulta',
                profileImageUrl: profileImageBase64 || null,
                assignments: {
                    create: {
                        specialistId: assignToSpecialistId,
                        assignedBy: userId
                    }
                }
            },
            include: {
                assignments: {
                    select: { specialistId: true, assignedAt: true }
                }
            }
        });
        res.status(201).json(newPatient);
    }
    catch (error) {
        console.error('[POST /patients]', error);
        res.status(500).json({ error: 'Error al registrar paciente' });
    }
});
// ──────────────────────────────────────────
// PUT /api/patients/:id  → Update full patient data
// ──────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const id = String(req.params['id']);
        const { name, age, diagnosis, initialObservation, profileImageBase64 } = req.body;
        const existing = await db_1.prisma.patient.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Paciente no encontrado' });
            return;
        }
        const updatedPatient = await db_1.prisma.patient.update({
            where: { id },
            data: {
                ...(name ? { name: name.trim() } : {}),
                ...(age ? { age: Number(age) } : {}),
                ...(diagnosis ? { diagnosis: diagnosis.trim() } : {}),
                ...(initialObservation !== undefined ? { initialObservation: initialObservation.trim() } : {}),
                ...(profileImageBase64 !== undefined ? { profileImageUrl: profileImageBase64 } : {})
            }
        });
        res.json(updatedPatient);
    }
    catch (error) {
        console.error('[PUT /patients/:id]', error);
        res.status(500).json({ error: 'Error al actualizar paciente' });
    }
});
// ──────────────────────────────────────────
// PUT /api/patients/:id/status  → Update status only
// ──────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
    const VALID_STATUSES = ['Listo para Consulta', 'En Sesión', 'Sesión Completada'];
    try {
        const id = String(req.params['id']);
        const { status } = req.body;
        if (!status || !VALID_STATUSES.includes(status)) {
            res.status(400).json({
                error: `Estado inválido. Debe ser uno de: ${VALID_STATUSES.join(', ')}`
            });
            return;
        }
        const existing = await db_1.prisma.patient.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Paciente no encontrado' });
            return;
        }
        const updatedPatient = await db_1.prisma.patient.update({
            where: { id },
            data: { status }
        });
        res.json(updatedPatient);
    }
    catch (error) {
        console.error('[PUT /patients/:id/status]', error);
        res.status(500).json({ error: 'Error al actualizar estado del paciente' });
    }
});
// ──────────────────────────────────────────
// DELETE /api/patients/:id  → Delete patient + all sessions + assignments
// ──────────────────────────────────────────
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const id = String(req.params['id']);
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const existing = await db_1.prisma.patient.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Paciente no encontrado' });
            return;
        }
        if (userRole !== 'ADMIN' && userId) {
            const isAssigned = await db_1.prisma.patientAssignment.findUnique({
                where: { patientId_specialistId: { patientId: id, specialistId: userId } }
            });
            if (!isAssigned) {
                res.status(403).json({ error: 'No tienes permiso para eliminar este paciente' });
                return;
            }
        }
        await db_1.prisma.patientAssignment.deleteMany({ where: { patientId: id } });
        await db_1.prisma.clinicalSession.deleteMany({ where: { patientId: id } });
        await db_1.prisma.patient.delete({ where: { id } });
        res.json({ message: 'Paciente y todas sus sesiones eliminados correctamente', id });
    }
    catch (error) {
        console.error('[DELETE /patients/:id]', error);
        res.status(500).json({ error: 'Error al eliminar paciente' });
    }
});
// ──────────────────────────────────────────
// POST /api/patients/:id/assign  → Assign patient to specialist
// ──────────────────────────────────────────
router.post('/:id/assign', auth_1.authenticate, async (req, res) => {
    try {
        const patientId = String(req.params['id']);
        const { specialistId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!specialistId) {
            res.status(400).json({ error: 'specialistId es requerido' });
            return;
        }
        if (userRole !== 'ADMIN' && userId !== specialistId) {
            res.status(403).json({ error: 'Solo puedes asignarte pacientes a ti mismo' });
            return;
        }
        const patient = await db_1.prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            res.status(404).json({ error: 'Paciente no encontrado' });
            return;
        }
        const specialist = await db_1.prisma.specialist.findUnique({ where: { id: specialistId } });
        if (!specialist) {
            res.status(404).json({ error: 'Especialista no encontrado' });
            return;
        }
        const existingAssignment = await db_1.prisma.patientAssignment.findUnique({
            where: { patientId_specialistId: { patientId, specialistId } }
        });
        if (existingAssignment) {
            res.status(400).json({ error: 'El paciente ya está asignado a este especialista' });
            return;
        }
        const assignment = await db_1.prisma.patientAssignment.create({
            data: {
                patientId,
                specialistId,
                assignedBy: userId
            }
        });
        res.status(201).json({ message: 'Paciente asignado correctamente', assignment });
    }
    catch (error) {
        console.error('[POST /patients/:id/assign]', error);
        res.status(500).json({ error: 'Error al asignar paciente' });
    }
});
// ──────────────────────────────────────────
// DELETE /api/patients/:id/assign/:specialistId  → Unassign patient from specialist
// ──────────────────────────────────────────
router.delete('/:id/assign/:specialistId', auth_1.authenticate, async (req, res) => {
    try {
        const patientId = String(req.params['id']);
        const specialistId = String(req.params['specialistId']);
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (userRole !== 'ADMIN' && userId !== specialistId) {
            res.status(403).json({ error: 'Solo puedes desasignarte pacientes a ti mismo' });
            return;
        }
        const assignment = await db_1.prisma.patientAssignment.findUnique({
            where: { patientId_specialistId: { patientId, specialistId } }
        });
        if (!assignment) {
            res.status(404).json({ error: 'Asignación no encontrada' });
            return;
        }
        await db_1.prisma.patientAssignment.delete({
            where: { patientId_specialistId: { patientId, specialistId } }
        });
        res.json({ message: 'Paciente desasignado correctamente' });
    }
    catch (error) {
        console.error('[DELETE /patients/:id/assign/:specialistId]', error);
        res.status(500).json({ error: 'Error al desasignar paciente' });
    }
});
exports.default = router;
//# sourceMappingURL=patients.js.map