import { LogOut } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const username = user?.email?.split('@')[0] ?? '';

  return (
    <div className="min-h-screen bg-cafe-bg">
      <header className="bg-cafe-cream border-b border-cafe-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div
            className="cursor-pointer"
            onClick={() => navigate('/home')}
          >
            <span className="font-semibold text-cafe-dark text-base tracking-wide">
              HAMONDE CAFE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-cafe-muted hidden sm:block">{username}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">登出</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
