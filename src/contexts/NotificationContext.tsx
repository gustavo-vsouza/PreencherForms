import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface NotificationContextData {
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const NotificationContext = createContext<NotificationContextData>({} as NotificationContextData);

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }, []);

  const handleConfirm = () => {
    confirmState.onConfirm();
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleCancel = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}
      
      {/* Toasts Container */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => {
          let icon = null;
          let colorClasses = '';

          switch (toast.type) {
            case 'success':
              colorClasses = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
              icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>;
              break;
            case 'error':
              colorClasses = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20';
              icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>;
              break;
            case 'warning':
              colorClasses = 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
              icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>;
              break;
            case 'info':
            default:
              colorClasses = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
              icon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>;
              break;
          }

          return (
            <div 
              key={toast.id} 
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md font-medium text-sm transition-all duration-300 transform scale-100 opacity-100 ${colorClasses}`}
            >
              <span className="shrink-0">{icon}</span>
              <span>{toast.message}</span>
            </div>
          );
        })}
      </div>

      {/* Confirm Modal */}
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-[#1e1b2e] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-white/10 transform scale-100 opacity-100 transition-all duration-300">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{confirmState.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                {confirmState.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 pointer-events-auto">
              <button 
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirm}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30 transition-colors text-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
