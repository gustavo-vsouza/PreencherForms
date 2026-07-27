import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { AdminView } from './components/AdminView';
import { TeacherView } from './components/TeacherView';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationProvider } from './contexts/NotificationContext';
import './index.css';

type ViewState = 'login' | 'teacher' | 'admin';

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default dark to match reference

  // Try restore session
  useEffect(() => {
    const savedCode = localStorage.getItem('schoolCode');
    const savedName = localStorage.getItem('schoolName');
    const savedView = localStorage.getItem('view') as ViewState;
    if (savedCode && savedView) {
      setSchoolCode(savedCode);
      setSchoolName(savedName || '');
      setView(savedView);
    }

    // Check saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    setIsReady(true);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

  const handleLogin = async (code: string): Promise<boolean | void> => {
    // btoa('COORDENACAO1') = 'Q09PUkRFTkFDQU8x'
    if (btoa(code) === 'Q09PUkRFTkFDQU8x') {
      setView('admin');
      localStorage.setItem('view', 'admin');
      return true;
    }

    if (code === 'PRATICI001') {
      setSchoolCode(code);
      setSchoolName('Antônio Prátici');
      setView('teacher');
      localStorage.setItem('schoolCode', code);
      localStorage.setItem('schoolName', 'Antônio Prátici');
      localStorage.setItem('view', 'teacher');
      return true;
    }

    try {
      const q = query(collection(db, 'schools'), where('code', '==', code));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setSchoolCode(code);
        setSchoolName(data.name || 'Escola');
        setView('teacher');
        localStorage.setItem('schoolCode', code);
        localStorage.setItem('schoolName', data.name || 'Escola');
        localStorage.setItem('view', 'teacher');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const handleLogout = () => {
    setView('login');
    setSchoolCode('');
    setSchoolName('');
    localStorage.removeItem('schoolCode');
    localStorage.removeItem('schoolName');
    localStorage.removeItem('view');
  };

  if (!isReady) return null; // Avoid flicker

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 font-sans relative">
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 z-50 p-2 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-sm hover:scale-105 transition-transform"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? (
            <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>

        {view === 'login' && <LoginView onLogin={handleLogin} />}
        {view === 'admin' && <AdminView onLogout={handleLogout} />}
        {view === 'teacher' && <TeacherView schoolCode={schoolCode} schoolName={schoolName} onLogout={handleLogout} />}
      </div>
    </NotificationProvider>
  );
}

export default App;

// Created by - Prof Wesley and Prof Gustavo