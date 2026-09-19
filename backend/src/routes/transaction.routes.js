import { Router } from 'express';
import { processBatch, saveOverride } from '../controllers/transaction.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Secure all transaction routes with JWT authentication
// router.use(verifyJWT); // Temporarily disabled for testing

// Endpoint to ingest a batch of transactions (JSON array)
router.route("/batch/:clientId").post(processBatch);

// Endpoint to save a CA's manual correction for adaptive learning
router.route("/override").post(saveOverride);

export default router;
