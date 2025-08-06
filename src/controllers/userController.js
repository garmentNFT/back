import { supabase } from '../config/supabase.js';

export const signupUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;

        // Supabase 인증 성공 후 user_profiles 테이블에 데이터 삽입
        if (data.user) {
            const { user } = data;
            const public_username = email.split('@')[0]; // 이메일에서 @ 이전 부분을 사용자 이름으로 사용
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert([
                    {
                        user_id: user.id,
                        public_username: public_username,
                        bio: '',
                        profile_image_url: '',
                        status: 'ACTIVE',
                        role: 'ADMIN'
                    }
                ]);
            if (profileError) throw profileError;
        }
        res.status(201).json({ message: 'User created successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });
    }
};

export const loginUser = async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        res.status(200).json({ message: 'User logged in successfully', data });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error });
    }
};

export const logoutUser = async (req, res) => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        res.status(200).json({ message: 'User logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error logging out', error });
    }
};
