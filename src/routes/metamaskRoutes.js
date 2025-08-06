
import express from 'express';
import { generateNonce, verifySignature } from '../controllers/metamaskController.js';

const router = express.Router();

router.post('/nonce', generateNonce);
router.post('/verify', verifySignature);

export default router;
