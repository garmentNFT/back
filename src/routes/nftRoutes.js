// back/src/routes/nftRoutes.js

import { Router } from 'express';
import multer from 'multer';
import { getAllNfts, getNftDetails, searchNfts, mintNft  } from '../controllers/nftController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });


// NFT 검색 경로 
router.get('/search', searchNfts);

// 전체 NFT 목록 조회
router.get('/', getAllNfts);

// 특정 NFT 상세 정보 조회
router.get('/:tokenId', getNftDetails);

// NFT 민팅 경로
router.post('/mint', upload.single('image'), mintNft);


export default router;