import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coffee, User, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.trim() || !password) return;
    setError('');
    setSubmitting(true);
    const { error: err } = await signIn(account.trim(), password);
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      navigate('/home', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-cafe-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-cafe-cream rounded-xl overflow-hidden">
          {/* Top accent line */}
          <div className="h-1 bg-cafe-primary" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="w-16 h-16 rounded-full bg-cafe-primary flex items-center justify-center">
                <Coffee className="h-8 w-8 text-cafe-cream" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-cafe-dark tracking-widest">HAMONDE CAFE</div>
                <div className="text-sm text-cafe-muted mt-0.5">咖啡豆庫存管理系統</div>
              </div>
            </div>

            <h2 className="text-base font-semibold text-cafe-dark mb-5">員工登入</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Account */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted">
                  <User className="h-4 w-4" />
                </div>
                <Input
                  placeholder="帳號"
                  value={account}
                  onChange={e => setAccount(e.target.value)}
                  className="pl-9 pr-28"
                  autoComplete="username"
                  autoFocus
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cafe-muted select-none">
                  @hamonde.local
                </div>
              </div>

              {/* Password */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密碼"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-9 pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cafe-muted hover:text-cafe-dark"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full mt-1"
                disabled={submitting || !account.trim() || !password}
              >
                {submitting ? '登入中...' : '登入'}
              </Button>
            </form>
          </div>

          {/* Bottom accent dots */}
          <div className="flex justify-center gap-2 pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-cafe-accent" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
