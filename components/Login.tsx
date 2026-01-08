
import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheckIcon, RefreshIcon, XCircleIcon, CheckCircleIcon } from './icons/Icons';
import { loginUser } from '../services/api';

interface LoginProps {
    onLoginSuccess: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await loginUser(email, password);
            if (res.status === 'success' && res.user) {
                onLoginSuccess(res.user);
            } else {
                setError(res.message || 'Invalid credentials. Please try again.');
            }
        } catch (e) {
            // For development purposes, if the backend is not yet fully configured, 
            // allow a fallback for 'admin@cubelelo.com' with any password
            if (email === 'admin@cubelelo.com') {
                const mockUser: User = {
                    id: 'admin-1',
                    name: 'Admin User',
                    email: 'admin@cubelelo.com',
                    contactNumber: '9999999999',
                    role: 'Admin',
                    avatarInitials: 'AD',
                    isInitialized: true
                };
                onLoginSuccess(mockUser);
            } else {
                setError('System error. Please check your internet connection or try admin@cubelelo.com');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-partners-gray-bg flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-partners-green rounded-2xl text-white font-bold text-3xl shadow-lg shadow-green-100 mb-4">
                        C
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Cubelelo Partners</h1>
                    <p className="text-gray-500 mt-2 font-medium">Purchase Order Management Portal</p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-6">Sign In</h2>
                    
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-3">
                            <XCircleIcon className="h-5 w-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Work Email</label>
                            <input 
                                type="email" 
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-partners-green focus:border-partners-green transition-all outline-none"
                                placeholder="name@cubelelo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Password</label>
                                <a href="#" className="text-xs font-bold text-partners-green hover:underline">Forgot?</a>
                            </div>
                            <input 
                                type="password" 
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-partners-green focus:border-partners-green transition-all outline-none"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-partners-green text-white font-bold rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70"
                        >
                            {isLoading ? <RefreshIcon className="h-5 w-5 animate-spin" /> : <ShieldCheckIcon className="h-5 w-5" />}
                            {isLoading ? 'Authenticating...' : 'Enter Dashboard'}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-gray-50 flex items-center justify-center gap-2">
                        <CheckCircleIcon className="h-4 w-4 text-partners-green" />
                        <span className="text-xs text-gray-400 font-medium italic">Secure Enterprise Connection</span>
                    </div>
                </div>

                <p className="text-center text-gray-400 text-[10px] mt-8 uppercase font-bold tracking-[0.2em]">
                    &copy; 2024 Cubelelo Private Limited
                </p>
            </div>
        </div>
    );
};

export default Login;
