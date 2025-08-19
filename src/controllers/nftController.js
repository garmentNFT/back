// back/src/controllers/nftController.js

import { supabase } from '../config/supabase.js';
import axios from 'axios';
import FormData from 'form-data';
import { ethers } from 'ethers';
import { config } from '../config/contract.js';

/**
 * @route   GET /api/nfts
 * @desc    모든 NFT 목록 조회
 */
export const getAllNfts = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('nfts')
            .select(`
                *,
                creator:creator_id ( public_username )
            `);

        if (error) throw error;

        const formattedNfts = data.map(nft => ({
            tokenId: nft.token_id, 
            name: nft.name,
            imageUrl: nft.image_url,
            price: nft.price,
            creator: {
                nickname: nft.creator ? nft.creator.public_username : 'Unknown'
            }
        }));

        res.status(200).json({
            nfts: formattedNfts,
            pagination: {}
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching NFTs from database", error: error.message });
    }
};

/**
 * @route   GET /api/nfts/:tokenId
 * @desc    특정 NFT 상세 정보 조회
 */
export const getNftDetails = async (req, res) => {
    const { tokenId } = req.params;
    try {
        const { data, error } = await supabase
            .from('nfts')
            .select(`
                *,
                creator:creator_id ( public_username ),
                owner:owner_id ( public_username )
            `)
            .eq('token_id', tokenId)
            .single();

        if (error) throw error;
        
        if (data) {
            // ⭐️ 프론트엔드가 사용하기 편한 형태로 데이터를 가공합니다.
            const formattedNft = {
                id: data.id,
                creator: {
                    nickname: data.creator ? data.creator.public_username : 'Unknown'
                },
                owner: {
                    nickname: data.owner ? data.owner.public_username : 'Unknown'
                },
                name: data.name,
                description: data.description,
                imageUrl: data.image_url,
                p_hash: data.p_hash,
                has_warning: data.has_warning,
                tokenId: data.token_id,
                metadata_url: data.metadata_url,
                on_chain_status: data.on_chain_status,
                created_at: data.created_at,
                price: data.price
            };
            res.status(200).json(formattedNft);
        } else {
            res.status(404).json({ message: `NFT with tokenId ${tokenId} not found.` });
        }
    } catch (error) {
        console.error("!!! GET NFT DETAILS ERROR:", error);
        res.status(500).json({ message: "Error fetching NFT details", error: error.message });
    }
};

/**
 * @route   GET /api/nfts/search
 * @desc    NFT 이름 또는 설명으로 검색
 */
export const searchNfts = async (req, res) => {
    // 쿼리 파라미터에서 검색어(q)를 가져옵니다.
    const { q } = req.query;

    // 검색어가 없으면 빈 목록을 반환합니다.
    if (!q) {
        return res.status(200).json({ nfts: [], pagination: {} });
    }

    try {
        // Supabase의 textSearch 또는 or/ilike를 사용하여 검색 쿼리를 만듭니다.
        const { data, error } = await supabase
            .from('nfts')
            .select(`
                *,
                creator:creator_id ( public_username )
            `)
            // name 또는 description 컬럼에서 검색어(q)를 포함하는 데이터를 찾습니다.
            // (ilike는 대소문자를 구분하지 않는 검색입니다.)
            .or(`name.ilike.%${q}%,description.ilike.%${q}%`);

        if (error) throw error;

        // 프론트엔드가 사용하기 편한 형태로 데이터를 가공합니다.
        const formattedNfts = data.map(nft => ({
            tokenId: nft.token_id,
            name: nft.name,
            imageUrl: nft.image_url,
            price: nft.price,
            creator: {
                nickname: nft.creator ? nft.creator.public_username : 'Unknown'
            }
        }));

        res.status(200).json({
            nfts: formattedNfts,
            pagination: {}
        });

    } catch (error) {
        console.error("!!! SEARCH NFTS ERROR:", error);
        res.status(500).json({ message: "Error searching NFTs", error: error.message });
    }
};

/**
 * @route   POST /api/nfts/mint
 * @desc    IPFS 업로드, 민팅, DB 저장을 모두 처리
 */
export const mintNft = async (req, res) => {
    const { name, description, price, ownerAddress } = req.body;
    const imageFile = req.file;

    if (!imageFile || !name || !description || !price || !ownerAddress) {
        return res.status(400).json({ message: '모든 데이터가 필요합니다.' });
    }

    try {

        // --- (새로운 단계) 지갑 주소로 사용자 ID(UUID) 찾기 ---
        const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .select('user_id')
            .eq('address', ownerAddress.toLowerCase())
            .single();

        if (walletError || !walletData) {
            return res.status(404).json({ message: "해당 지갑 주소와 연결된 사용자를 찾을 수 없습니다." });
        }
        const userId = walletData.user_id; // ⭐️ 실제 사용자 ID (UUID)

        // --- 1 & 2. IPFS 업로드 (기존과 동일) ---
    
        const imgFormData = new FormData();
        imgFormData.append('file', imageFile.buffer, imageFile.originalname);
        const imgUploadRes = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', imgFormData, {
            headers: { ...imgFormData.getHeaders(), 'Authorization': `Bearer ${process.env.PINATA_JWT}` }
        });
        const imageUrl = `https://gateway.pinata.cloud/ipfs/${imgUploadRes.data.IpfsHash}`;
        
        const metadata = { name, description, image: imageUrl, attributes: [{ "trait_type": "Price", "value": price }] };
        const metaUploadRes = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', metadata, {
            headers: { 'Authorization': `Bearer ${process.env.PINATA_JWT}` }
        });
        const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metaUploadRes.data.IpfsHash}`;

        // --- 3. 스마트 컨트랙트 호출 (기존과 동일) ---
        const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contract = new ethers.Contract(config.contractAddress, config.contractABI, wallet);
        const priceInWei = ethers.parseEther(price);
        const tx = await contract.safeMint(ownerAddress, metadataUrl, priceInWei);
        const receipt = await tx.wait();

        // --- 4. Token ID 추출 (기존과 동일) ---
        const transferEvent = receipt.logs.find(log => {
            try { return contract.interface.parseLog(log)?.name === 'Transfer' } catch { return false }
        });
        if (!transferEvent) throw new Error('Token ID를 트랜잭션에서 찾을 수 없습니다.');
        const tokenId = transferEvent.args.tokenId;

        // --- ⭐️ 5. (추가) 민팅된 NFT 정보를 Supabase DB에 저장 ---
        const { data: savedNft, error: dbError } = await supabase
            .from('nfts')
            .insert({
                // collection_id는 사용하지 않기로 했으므로 제외
                creator_id: userId,
                owner_id: userId,
                name: name,
                description: description,
                image_url: imageUrl,
                metadata_url: metadataUrl,
                token_id: tokenId.toString(),
                price: price,
                on_chain_status: 'MINTED'
            })
            .select()
            .single(); // 한 개의 데이터만 추가되므로 single() 사용

        if (dbError) {
            // 블록체인에는 민팅되었지만 DB 저장에 실패한 경우, 별도 로그를 남겨 수동 처리할 수 있도록 함
            console.error("!!! CRITICAL: DB SAVE FAILED AFTER MINTING:", { tokenId: tokenId.toString(), txHash: tx.hash });
            throw dbError;
        }

        // --- 6. 최종 결과 반환 ---
        res.status(201).json({ 
            message: 'NFT가 성공적으로 발행되고 DB에 저장되었습니다!', 
            nft: savedNft // 저장된 NFT 전체 정보를 반환
        });

    } catch (error) {
        console.error("!!! MINT NFT ERROR:", error);
        res.status(500).json({ message: "NFT 발행 중 오류 발생", error: error.message });
    }
};