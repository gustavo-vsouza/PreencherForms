import { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { AdminView } from './components/AdminView';
import { TeacherView } from './components/TeacherView';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import './index.css';

type ViewState = 'login' | 'teacher' | 'admin';

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [schoolCode, setSchoolCode] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [isReady, setIsReady] = useState(false);
  
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
    setIsReady(true);
  }, []);

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

  if (view === 'login') return <LoginView onLogin={handleLogin} />;
  if (view === 'admin') return <AdminView onLogout={handleLogout} />;
  
  return <TeacherView schoolCode={schoolCode} schoolName={schoolName} onLogout={handleLogout} />;
}

export default App;
