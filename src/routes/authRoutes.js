import { Router } from 'express';
import { 
    handleSocialLoginCallback, 
    setupProfile, // 최초 프로필 설정용
    checkNickname,
    getMyProfile,
    updateMyProfile,
    syncUserProfile
} from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// 소셜 로그인 후 제공업체에서 리디렉션되는 콜백 경로 
router.get('/auth/callback/:provider', handleSocialLoginCallback);

// 최초 프로필 정보(닉네임) 입력 
router.post('/users/me/profile', verifyToken, setupProfile);

// 닉네임 중복 확인 
router.get('/users/check-nickname', checkNickname);

// 내 정보 조회
router.get('/users/me', verifyToken, getMyProfile);

// 프로필 텍스트 정보(닉네임, 자기소개) 수정
router.put('/users/me/profile', verifyToken, updateMyProfile);

// 로그인 직후 프로필 동기화
router.post('/users/sync-profile', verifyToken, syncUserProfile);

export default router;