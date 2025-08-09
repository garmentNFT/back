import { ethers } from 'ethers';
import { supabase } from '../config/supabase.js';

// nonce 생성 로직은 거의 동일합니다.
export const generateLinkNonce = async (req, res) => {
    // 이미 로그인된 사용자의 ID를 사용합니다.
    const { id: userId } = req.user; 

    try {
        const nonce = `Sign this message to link your wallet to your account: ${Date.now()}`;
        // user_id를 기준으로 nonce를 저장하여, 누가 요청했는지 명확히 합니다.
        const { error } = await supabase.from('nonces').upsert({ user_id: userId, nonce }, { onConflict: 'user_id' });

        if (error) throw error;

        res.status(200).json({ nonce });
    } catch (error) {
        res.status(500).json({ message: 'Error generating nonce', error: error.message });
    }
};

// 지갑 연동 로직
export const linkWallet = async (req, res) => {
    const { id: userId } = req.user; // 미들웨어를 통해 얻은 로그인된 사용자의 ID
    const { signature, address } = req.body;

    if (!signature || !address) {
        return res.status(400).json({ message: 'Signature and address are required.' });
    }

    try {
        // 1. 해당 유저가 요청한 nonce가 맞는지 확인
        const { data: nonceData, error: nonceError } = await supabase
            .from('nonces')
            .select('nonce')
            .eq('user_id', userId)
            .single();

        if (nonceError || !nonceData) {
            return res.status(400).json({ message: 'Nonce not found. Please request a new one.' });
        }

        // 2. 서명 검증
        const recoveredAddress = ethers.verifyMessage(nonceData.nonce, signature);

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ message: 'Invalid signature. Wallet ownership verification failed.' });
        }

        // 3. (중요) 해당 지갑이 다른 사람에 의해 이미 연동되었는지 확인
        const { data: existingWallet, error: existingWalletError } = await supabase
            .from('wallets')
            .select('user_id')
            .eq('address', address.toLowerCase())
            .single();

        if (existingWalletError && existingWalletError.code !== 'PGRST116') throw existingWalletError;

        if (existingWallet) {
            return res.status(409).json({ message: 'This wallet is already linked to another account.' });
        }

        // 4. 모든 검증 통과 후, Wallets 테이블에 정보 삽입
        const { data: newWallet, error: insertError } = await supabase
            .from('wallets')
            .insert({
                user_id: userId,
                address: address.toLowerCase(),
                blockchain_type: 'Polygon', // ERD 기반 [cite: 4]
                is_primary: true // 첫 연동 지갑을 주 지갑으로 설정
            })
            .select();

        if (insertError) throw insertError;
        
        // 사용한 nonce 삭제
        await supabase.from('nonces').delete().eq('user_id', userId);

        res.status(200).json({ message: 'Wallet linked successfully!', wallet: newWallet[0] });

    } catch (error) {
        res.status(500).json({ message: 'Failed to link wallet', error: error.message });
    }
};

// 연동된 지갑 목록 조회
export const getLinkedWallets = async (req, res) => {
    // verifyToken 미들웨어를 통해 얻은 로그인된 사용자의 ID
    const { id: userId } = req.user;

    try {
        // Wallets 테이블에서 현재 사용자의 user_id와 일치하는 모든 지갑 정보를 조회합니다.
        const { data, error } = await supabase
            .from('wallets')
            .select('address, blockchain_type, is_primary, linked_at')
            .eq('user_id', userId);

        if (error) throw error;

        // API 명세서 형식에 맞춰 응답을 반환합니다.
        res.status(200).json({ wallets: data });

    } catch (error) {
        res.status(500).json({ message: 'Error fetching linked wallets', error: error.message });
    }
};