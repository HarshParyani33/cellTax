import { Router } from 'express';
import { processBatch } from '../controllers/transaction.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

// Secure all transaction routes with JWT authentication
router.use(verifyJWT);

// Endpoint to ingest a batch of transactions (JSON array)
router.route("/batch/:clientId").post(processBatch);

export default router;
