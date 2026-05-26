
import express from 'express';
import { aiServiceManager, AIProvider } from '../services/aiManager/index.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

function parseCsvSet(value?: string): Set<string> {
    if (!value) return new Set();
    return new Set(
        value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
    );
}

const adminEmails = new Set(
    Array.from(parseCsvSet(process.env.SCRIPT_WRITER_ADMIN_EMAILS)).map((email) => email.toLowerCase())
);
const adminUserIds = parseCsvSet(process.env.SCRIPT_WRITER_ADMIN_USER_IDS);

function isProviderSwitchAdmin(req: express.Request): boolean {
    // In development mode, allow anyone to switch providers for testing
    if (process.env.NODE_ENV === 'development') return true;

    const email = (req.user?.email || '').toLowerCase();
    const userId = req.userId || '';

    if (email && adminEmails.has(email)) return true;
    if (userId && adminUserIds.has(userId)) return true;
    return false;
}

// GET /api/ai/provider
// Get current active provider
router.get('/provider', (req, res) => {
    res.json({
        success: true,
        data: {
            provider: aiServiceManager.getProvider()
        }
    });
});

// POST /api/ai/provider
// Switch provider
router.post('/provider', (req, res) => {
    if (!isProviderSwitchAdmin(req)) {
        return res.status(403).json({
            success: false,
            error: 'Provider switching is restricted to script-writer admins.'
        });
    }

    const { provider } = req.body;

    if (!provider || !['gemini', 'ollama', 'mistral'].includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider. Use "gemini", "ollama", or "mistral".' });
    }

    aiServiceManager.setProvider(provider as AIProvider);

    res.json({
        success: true,
        data: {
            provider: aiServiceManager.getProvider(),
            message: `Switched AI Service to ${provider.toUpperCase()}`
        }
    });
});

export const aiRoutes = router;
