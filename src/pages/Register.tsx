import { useState } from 'react';
import { LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { auth } from '../services/api';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onBackToLogin: () => void;
}

export default function Register({ onRegisterSuccess, onBackToLogin }: RegisterProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);

    try {
      await auth.register(username, password);
      setSuccess('Account created successfully! Logging in...');
      setTimeout(() => {
        auth.login(username, password).then(() => {
          onRegisterSuccess();
        });
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-gradient-card rounded-2xl shadow-neo border border-accent-700 p-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-xl bg-gradient-yellow flex items-center justify-center shadow-neo">
              <LogIn className="w-10 h-10 text-accent-900 font-bold" />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-bold text-center text-white mb-2">Create Account</h1>
          <p className="text-center text-accent-400 mb-8">Warebot Warehouse Management</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-accent-200 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-lg bg-accent-800/50 border border-accent-700 text-white placeholder-accent-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                placeholder="Choose a username (3+ characters)"
                required
                minLength={3}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-accent-200 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-lg bg-accent-800/50 border border-accent-700 text-white placeholder-accent-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                placeholder="Enter password (6+ characters)"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-accent-200 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3 rounded-lg bg-accent-800/50 border border-accent-700 text-white placeholder-accent-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition"
                placeholder="Confirm your password"
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 text-sm flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-yellow text-accent-900 font-bold shadow-neo hover:shadow-neo-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-accent-900/30 border-t-accent-900 rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Link back to login */}
          <p className="text-center text-accent-500 text-sm mt-8">
            Already have an account?{' '}
            <button
              onClick={onBackToLogin}
              className="text-primary-400 hover:text-primary-300 font-semibold transition"
            >
              Sign in
            </button>
          </p>

          {/* Footer */}
          <p className="text-center text-accent-500 text-xs mt-6">
            Powered by Neobotix MP 400
          </p>
        </div>
      </div>
    </div>
  );
}
