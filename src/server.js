import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

// 에러 감지를 위한 try...catch 블록 시작
try {
    console.log("[SERVER START] 1. server.js 파일 실행 시작");

    dotenv.config();
    const app = express();

    console.log("[SERVER START] 2. 미들웨어 및 라우트 설정 시작");
    
    app.use(cors());
    app.use(express.json());

    app.get('/', (req, res) => {
      res.send('GarmentNFT API is running');
    });

    // 라우트 사용 전 로그 추가
    app.use((req, res, next) => {
        console.log(`[REQUEST RECEIVED] ${req.method} ${req.path}`);
        next();
    });

    app.use('/api', authRoutes);
    app.use('/api/users', walletRoutes);

    console.log("[SERVER START] 3. 라우트 설정 완료");

    const PORT = process.env.PORT || 5050;

    app.listen(PORT, () => console.log(`[SERVER READY] Server running on port ${PORT}`));

} catch (error) {
    // ---- 어떤 에러든 여기서 잡아냅니다 ----
    console.error("!!!!!!!!!!!!!!!!! SERVER FAILED TO START !!!!!!!!!!!!!!!!!!");
    console.error(error);
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}