import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * @route   GET /api/auth/callback/:provider
 * @desc    소셜 로그인 콜백 처리 및 JWT 발급
 */
export const handleSocialLoginCallback = async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).json({ message: 'Authorization code is missing.' });
    }

    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(String(code));
        if (sessionError) throw new Error(`Supabase session exchange error: ${sessionError.message}`);

        const user = sessionData.user;
        let isNewUser = false;

        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            throw new Error(`Failed to check user profile: ${profileError.message}`);
        }
        
        if (!profile) {
            isNewUser = true;
            const tempUsername = `user_${Date.now()}`; 
            const { error: createProfileError } = await supabase
                .from('user_profiles')
                .insert({
                    user_id: user.id,
                    public_username: tempUsername,
                    profile_image_url: user.user_metadata.avatar_url || null
                });
            if (createProfileError) throw createProfileError;
        }
        
        const serviceToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            message: "Authentication successful",
            accessToken: serviceToken,
            isNewUser: isNewUser
        });

    } catch (error) {
        console.error('Social login callback error:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });
    }
};

/**
 * @route   POST /api/users/me/profile
 * @desc    최초 가입 시 프로필(닉네임) 정보 입력
 */
export const setupProfile = async (req, res) => {
    const { id: userId } = req.user;
    const { nickname } = req.body;

    if (!nickname) {
        return res.status(400).json({ message: 'Nickname is required.' });
    }

    try {
        const { data: existingUser, error: checkError } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('public_username', nickname)
            .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;
        if (existingUser) return res.status(409).json({ message: 'Nickname is already taken.' });

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ public_username: nickname, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select();

        if (error) throw error;

        res.status(200).json({
            message: "Profile updated successfully.",
            user: data[0]
        });
    } catch (error) {
        console.error('Profile setup error:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });
    }
};


/**
 * @route   GET /api/users/check-nickname
 * @desc    닉네임 중복 실시간 확인
 */
export const checkNickname = async (req, res) => {
    const { nickname } = req.query;

    if (!nickname) {
        return res.status(400).json({ message: 'Nickname query parameter is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('public_username', nickname);

        if (error) throw error;
        
        res.status(200).json({ isAvailable: data.length === 0 });
    } catch (error) {
        console.error('Check nickname error:', error);
        res.status(500).json({ message: `Internal server error: ${error.message}` });
    }
};

/**
 * @route   GET /api/users/me
 * @desc    내 프로필 정보 조회
 */
export const getMyProfile = async (req, res) => {
    const { id: userId } = req.user;

    try {
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('public_username, bio')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        if (!profile) return res.status(404).json({ message: "Profile not found." });

        res.status(200).json(profile);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile', error: error.message });
    }
};

/**
 * @route   PUT /api/users/me/profile
 * @desc    프로필 정보(닉네임, 자기소개) 수정
 */
export const updateMyProfile = async (req, res) => {
    const { id: userId } = req.user;
    const { nickname, bio } = req.body;

    const updates = {};
    if (nickname) updates.public_username = nickname;
    if (bio !== undefined) updates.bio = bio;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No update fields provided." });
    }
    
    updates.updated_at = new Date().toISOString();

    try {
        // 닉네임 변경 시 중복 확인
        if (nickname) {
            const { data: existingUser, error: checkError } = await supabase
                .from('user_profiles')
                .select('user_id')
                .eq('public_username', nickname)
                .not('user_id', 'eq', userId) // 자기 자신은 중복 검사에서 제외
                .single();

            if (checkError && checkError.code !== 'PGRST116') throw checkError;
            if (existingUser) return res.status(409).json({ message: 'Nickname is already taken.' });
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('user_id', userId)
            .select('public_username, bio');

        if (error) throw error;

        res.status(200).json({ message: "Profile updated successfully", profile: data[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error updating profile', error: error.message });
    }
};