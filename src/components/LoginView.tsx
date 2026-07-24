import { useState } from 'react';

interface LoginViewProps {
  onLogin: (code: string) => Promise<boolean | void>;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="login-container">
      <div className="login-card">
        <h2>Acesso ao Sistema</h2>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Digite o código da sua escola para continuar.
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label htmlFor="schoolCode">Código da Escola</label>
            <input
              type="text"
              id="schoolCode"
              placeholder="Ex: PRATICI001"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }} disabled={isLoading}>
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Atenção</h3>
            <div className="modal-message">{errorMsg}</div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setErrorMsg('')}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
