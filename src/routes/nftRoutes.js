// back/src/routes/nftRoutes.js

import { Router } from 'express';
import { getAllNfts, getNftDetails, getDummyDataSummary, searchNfts  } from '../controllers/nftController.js';

const router = Router();


// NFT 검색 경로 
router.get('/search', searchNfts);

// 전체 NFT 목록 조회
router.get('/', getAllNfts);

// 특정 NFT 상세 정보 조회
router.get('/:tokenId', getNftDetails);

// 모든 더미 데이터를 조회하는 경로 
router.get('/debug/all-data', getDummyDataSummary);



export default router;