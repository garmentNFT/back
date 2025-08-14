// back/src/controllers/nftController.js

import { supabase } from '../config/supabase.js';

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
                collections ( name ),
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
                collection: {
                    name: data.collections ? data.collections.name : 'N/A'
                },
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
 * @route   GET /api/debug/all-data
 * @desc    모든 더미 데이터를 한번에 조회 (테스트용)
 */
export const getDummyDataSummary = async (req, res) => {
    try {
        // 각 테이블의 데이터를 비동기적으로 동시에 조회합니다.
        const [
            { data: users, error: usersError },
            { data: collections, error: collectionsError },
            { data: nfts, error: nftsError },
            { data: wallets, error: walletsError }
        ] = await Promise.all([
            supabase.from('user_profiles').select('*'),
            supabase.from('collections').select('*'),
            supabase.from('nfts').select('*'),
            supabase.from('wallets').select('*')
        ]);

        // 어느 한 테이블이라도 조회 중 에러가 발생하면 즉시 중단
        if (usersError) throw usersError;
        if (collectionsError) throw collectionsError;
        if (nftsError) throw nftsError;
        if (walletsError) throw walletsError;

        // 조회된 모든 데이터를 하나의 JSON 객체로 묶어서 반환
        res.status(200).json({
            user_profiles: users,
            collections: collections,
            nfts: nfts,
            wallets: wallets
        });

    } catch (error) {
        res.status(500).json({ message: "Error fetching all data", error: error.message });
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

