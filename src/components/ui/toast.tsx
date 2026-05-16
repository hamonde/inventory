import * as React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg px-4 py-3 text-sm font-medium',
              toast.type === 'success' && 'bg-green-100 text-green-800 border border-green-200',
              toast.type === 'error' && 'bg-red-100 text-red-800 border border-red-200',
              toast.type === 'info' && 'bg-cafe-cream text-cafe-dark border border-cafe-border'
            )}
          >
            {toast.type === 'success' && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            {toast.type === 'info' && <Info className="h-4 w-4 mt-0.5 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="shrink-0 hover:opacity-70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
