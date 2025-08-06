
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'; // .env 파일에서 시크릿 키를 설정하세요.

// Nonce 생성 및 저장
export const generateNonce = async (req, res) => {
    const { address } = req.body;
    if (!address) {
        return res.status(400).json({ message: 'Wallet address is required.' });
    }

    try {
        // 기존 nonce가 있다면 삭제 (선택 사항: 만료 시간 설정 가능)
        await supabase.from('nonces').delete().eq('address', address);

        const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const { error } = await supabase.from('nonces').insert([{ address, nonce }]);

        if (error) throw error;

        res.status(200).json({ nonce });
    } catch (error) {
        console.error('Error generating nonce:', error);
        res.status(500).json({ message: 'Error generating nonce', error: error.message });
    }
};

// 서명 검증 및 JWT 발급
export const verifySignature = async (req, res) => {
    const { address, signature } = req.body;
    if (!address || !signature) {
        return res.status(400).json({ message: 'Wallet address and signature are required.' });
    }

    try {
        // 저장된 nonce 가져오기
        const { data, error } = await supabase.from('nonces').select('nonce').eq('address', address).single();

        if (error || !data) {
            return res.status(400).json({ message: 'Nonce not found or expired. Please request a new one.' });
        }

        const { nonce } = data;
        const message = `Sign this message to log in: ${nonce}`;

        // 서명 검증
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ message: 'Invalid signature.' });
        }

        // Nonce 삭제 (재사용 방지)
        await supabase.from('nonces').delete().eq('address', address);

        let userId;

        // 1. wallets 테이블에서 지갑 주소로 사용자 조회
        const { data: walletData, error: walletError } = await supabase
            .from('wallets')
            .select('user_id')
            .eq('address', address.toLowerCase())
            .single();

        if (walletError && walletError.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생
            throw walletError;
        }

        if (walletData) {
            // 2. 지갑 주소가 이미 연결되어 있는 경우
            userId = walletData.user_id;
        } else {
            // 3. 지갑 주소가 연결되어 있지 않은 경우: 새로운 사용자 생성 및 지갑 연결
            // 임시 이메일과 비밀번호로 Supabase 인증 사용자 생성
            const tempEmail = `${address.toLowerCase()}@wallet.temp`;
            const tempPassword = Math.random().toString(36).substring(2); // 임시 비밀번호

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: tempEmail,
                password: tempPassword,
            });

            if (authError) {
                // 이미 존재하는 이메일일 경우 (예: 이전에 지갑으로 로그인 시도했으나 wallets 테이블에 기록 안된 경우)
                if (authError.message.includes('already registered')) {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email: tempEmail,
                        password: tempPassword,
                    });
                    if (signInError) throw signInError;
                    userId = signInData.user.id;
                } else {
                    throw authError;
                }
            } else {
                userId = authData.user.id;
            }

            // wallets 테이블에 새 지갑 정보 삽입
            const { error: insertWalletError } = await supabase
                .from('wallets')
                .insert([
                    {
                        user_id: userId,
                        address: address.toLowerCase(),
                        blockchain_type: 'ethereum', // 또는 'evm' 등
                        is_primary: true,
                        linked_at: new Date().toISOString()
                    }
                ]);
            if (insertWalletError) throw insertWalletError;
        }

        // JWT 토큰 발급 (user_id를 포함)
        const token = jwt.sign({ userId, address: address.toLowerCase() }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error('Error verifying signature:', error);
        res.status(500).json({ message: 'Error verifying signature', error: error.message });
    }
};
