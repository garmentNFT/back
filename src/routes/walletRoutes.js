import { Router } from 'express';
import { linkWallet, generateLinkNonce, getLinkedWallets } from '../controllers/walletController.js';import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// 두 API 모두 로그인이 된 사용자만 접근 가능해야 하므로, verifyToken 미들웨어를 사용합니다.
// 지갑 연동을 위한 서명 메시지(nonce) 요청
router.get('/me/wallets/nonce', verifyToken, generateLinkNonce);

// 서명 검증 후 최종 지갑 연동
router.post('/me/wallets', verifyToken, linkWallet);

// 연동된 지갑 목록 조회 
router.get('/me/wallets', verifyToken, getLinkedWallets);

export default router;