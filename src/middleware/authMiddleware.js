// middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
// supabase 클라이언트를 import 합니다.
import { supabase } from '../config/supabase.js';

dotenv.config();

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ message: 'A token is required for authentication' });
    }

    try {
        // --- 이 부분이 핵심 변경 사항입니다 ---
        // 받은 토큰을 Supabase에 보내 사용자 정보를 가져옵니다.
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        // 에러가 발생하거나 유저 정보가 없으면, 유효하지 않은 토큰입니다.
        if (error || !user) {
            return res.status(401).json({ message: 'Invalid Token' });
        }

        // 유저 정보가 성공적으로 확인되면, 요청 객체에 유저 정보를 추가합니다.
        // 이제 다른 컨트롤러에서 req.user.id 로 사용자 ID에 접근할 수 있습니다.
        req.user = user; 
        
        // 다음 미들웨어 또는 컨트롤러로 이동합니다.
        return next();

    } catch (err) {
        return res.status(401).json({ message: 'Invalid Token' });
    }
};