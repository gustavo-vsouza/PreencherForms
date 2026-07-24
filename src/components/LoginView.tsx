import { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface LoginViewProps {
  onLogin: (code: string) => Promise<boolean | void>;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    const tl = gsap.timeline();
    
    tl.fromTo('.hero-text', 
      { opacity: 0, y: 50 }, 
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.2, ease: 'power3.out' }
    )
    .fromTo('.login-box',
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'back.out(1.5)' },
      "-=0.4"
    )
    .fromTo('.gradient-orb',
      { opacity: 0, scale: 0.5 },
      { opacity: 0.6, scale: 1, duration: 1.5, stagger: 0.3, ease: 'power2.out' },
      0
    );
  }, { scope: containerRef });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setIsLoading(true);
    const success = await onLogin(code.trim().toUpperCase());
    setIsLoading(false);
    
    if (success === false) {
      setErrorMsg('Código inválido ou escola não encontrada.');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-h-screen overflow-hidden flex flex-col items-center justify-center pt-16 pb-12 bg-slate-50 dark:bg-[#0f0e17] transition-colors duration-500">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="gradient-orb absolute -top-1/4 -right-1/4 w-3/4 h-3/4 bg-blue-200 dark:bg-blue-600 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen opacity-0" />
        <div className="gradient-orb absolute -bottom-1/4 -left-1/4 w-2/3 h-2/3 bg-indigo-200 dark:bg-indigo-700 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen opacity-0" />
      </div>
      
      {/* Navbar (Mocked to match reference) */}
      <nav className="absolute top-0 w-full flex justify-between items-center px-8 py-6 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-white text-white dark:text-blue-600 flex items-center justify-center font-bold font-display">P</div>
          <span className="font-bold tracking-wider uppercase text-sm text-slate-800 dark:text-white">PreencherForms</span>
        </div>
      </nav>

      <div className="relative z-10 w-full max-w-5xl px-6 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Hero Section */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="hero-text font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-blue-600 dark:from-white dark:to-blue-200" style={{ fontFamily: 'var(--font-display)' }}>
            Connect. <br/> Create. <br/> Contribute.
          </h1>
          <p className="hero-text text-lg md:text-xl text-slate-600 dark:text-blue-100/70 font-medium tracking-wide uppercase">
            Acesso ao sistema de gestão escolar
          </p>
        </div>

        {/* Login Box */}
        <div className="login-box w-full max-w-md bg-white/80 dark:bg-[#1e1b2e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-2xl font-semibold mb-2 text-slate-800 dark:text-white">Bem-vindo de volta</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">Digite o código da sua escola para continuar.</p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="schoolCode" className="text-sm font-semibold tracking-wide uppercase text-slate-700 dark:text-slate-300">
                Código da Escola
              </label>
              <input
                type="text"
                id="schoolCode"
                placeholder="Ex: PRATICI001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
                className="bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-slate-800 dark:text-white placeholder:text-slate-400"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading}
              className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/30 flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : 'Entrar na plataforma'}
            </button>
          </form>
        </div>
      </div>

      {/* Error Modal */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/40 backdrop-blur-md">
          <div className="bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-3 text-slate-800 dark:text-white">Atenção</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{errorMsg}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setErrorMsg('')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
