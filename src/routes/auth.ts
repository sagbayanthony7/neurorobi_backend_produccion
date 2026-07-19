import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../shared/db';

const router = Router();
const JWT_SECRET = process.env['JWT_SECRET'] || 'neurorobi-secret-key-2026';

// ──────────────────────────────────────────
// POST /api/auth/register  → Register new specialist
// ──────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    };

    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.specialist.findUnique({
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
    const hashedPassword = bcrypt.hashSync(password, 10);

    const newSpecialist = await prisma.specialist.create({
      data: {
        email: cleanEmail,
        password: hashedPassword,
        name: name.trim(),
        role: role as any
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json(newSpecialist);
  } catch (error) {
    console.error('[POST /auth/register]', error);
    res.status(500).json({ error: 'Error al registrar especialista' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/login  → Authenticate & issue token
// ──────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: 'Correo y contraseña son requeridos' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Find specialist
    const specialist = await prisma.specialist.findUnique({
      where: { email: cleanEmail }
    });

    if (!specialist) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Compare passwords
    const isPasswordValid = bcrypt.compareSync(password, specialist.password);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: specialist.id,
        email: specialist.email,
        name: specialist.name,
        role: specialist.role
      },
      JWT_SECRET,
      { expiresIn: '30d' } // Long-lasting session for the clinical workstation
    );

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
  } catch (error) {
    console.error('[POST /auth/login]', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

import { handleUpload } from '../middleware/upload';

// ──────────────────────────────────────────
// PUT /api/auth/profile/:id  → Update specialist profile
// ──────────────────────────────────────────
router.put('/profile/:id', async (req: Request, res: Response) => {
  try {
    await handleUpload('profileImage')(req, res);

    const id = String(req.params['id']);
    const name = req.body?.name as string | undefined;
    const password = req.body?.password as string | undefined;

    const existing = await prisma.specialist.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Especialista no encontrado' });
      return;
    }

    const dataToUpdate: any = {};
    if (name && name.trim() !== '') dataToUpdate.name = name.trim();
    if (password && password.trim() !== '') {
      dataToUpdate.password = bcrypt.hashSync(password, 10);
    }
    if (req.file) {
      dataToUpdate.profileImageUrl = `/uploads/${req.file.filename}`;
    }

    const updated = await prisma.specialist.update({
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
  } catch (error) {
    console.error('[PUT /auth/profile]', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists  → List all specialists (for inter-service communication)
// ──────────────────────────────────────────
router.get('/specialists', async (_req: Request, res: Response) => {
  try {
    const specialists = await prisma.specialist.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    res.json(specialists);
  } catch (error) {
    console.error('[GET /auth/specialists]', error);
    res.status(500).json({ error: 'Error al obtener especialistas' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists/by-email/:email  → Find specialist by email
// ──────────────────────────────────────────
router.get('/specialists/by-email/:email', async (req: Request, res: Response) => {
  try {
    const email = String(req.params['email']).toLowerCase().trim();
    const specialist = await prisma.specialist.findUnique({
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
  } catch (error) {
    console.error('[GET /auth/specialists/by-email]', error);
    res.status(500).json({ error: 'Error al obtener especialista' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/specialists/:id  → Find specialist by ID
// ──────────────────────────────────────────
router.get('/specialists/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params['id']);
    const specialist = await prisma.specialist.findUnique({
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
  } catch (error) {
    console.error('[GET /auth/specialists/:id]', error);
    res.status(500).json({ error: 'Error al obtener especialista' });
  }
});

// ──────────────────────────────────────────
// Database Seeder for Default User
// ──────────────────────────────────────────
export async function seedInitialUser() {
  try {
    const usersToSeed = [
      { email: 'accionsocial@gmail.com', password: 'accionsocialcuenca', name: 'Acción Social Admin', role: 'ADMIN' as const },
      { email: 'psicologia@neurorobi.com', password: 'psicologia2026', name: 'Dra. María López', role: 'PSICOLOGIA_CLINICA' as const },
      { email: 'educacion@neurorobi.com', password: 'educacion2026', name: 'Lic. Carlos Méndez', role: 'EDUCACION_ESPECIAL' as const },
      { email: 'fisioterapia@neurorobi.com', password: 'fisioterapia2026', name: 'Ftr. Ana Salazar', role: 'FISIOTERAPIA' as const }
    ];

    for (const user of usersToSeed) {
      const existing = await prisma.specialist.findUnique({
        where: { email: user.email }
      });

      if (!existing) {
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        await prisma.specialist.create({
          data: {
            email: user.email,
            password: hashedPassword,
            name: user.name,
            role: user.role
          }
        });
        console.log(`✅ Seeded user: ${user.name} (${user.role})`);
      } else {
        console.log(`ℹ️  ${user.email} already exists.`);
      }
    }
  } catch (error) {
    console.error('❌ Error during user seeding:', error);
  }
}

export default router;
