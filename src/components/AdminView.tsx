import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminSettings } from './AdminSettings';

export function AdminView({ onLogout }: { onLogout: () => void }) {
  const [schools, setSchools] = useState<{ id: string; code: string; name: string }[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Drill-down state
  const [selectedSchoolCode, setSelectedSchoolCode] = useState<string | null>(null);
  const [selectedClassRoom, setSelectedClassRoom] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch schools
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      const schoolsData = schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setSchools(schoolsData);

      // Fetch reports
      const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const reportsSnap = await getDocs(reportsQuery);
      const reportsData = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setReports(reportsData);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando dados...</div>;
  }

  // --- NÍVEL 1: Escolas ---
  if (!selectedSchoolCode) {
    return (
      <div className="container">
        <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Coordenação: Escolas</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setIsSettingsOpen(true)}>
              ⚙️ Configurações
            </button>
            <button className="btn btn-outline" onClick={onLogout}>Sair</button>
          </div>
        </header>

        <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {schools.length === 0 && <p style={{ gridColumn: '1 / -1' }}>Nenhuma escola cadastrada.</p>}
          
          {Array.from(new Set([...schools.map(s => s.code), ...reports.map(r => r.schoolCode)])).map(code => {
            const schoolInfo = schools.find(s => s.code === code);
            const schoolName = schoolInfo ? schoolInfo.name : 'Escola ' + code;
            const reportsForSchool = reports.filter(r => r.schoolCode === code);
            
            return (
              <div 
                key={code} 
                className="drill-card" 
                onClick={() => setSelectedSchoolCode(code)}
              >
                <div style={{ flex: 1 }}>
                  <h3>{schoolName}</h3>
                  <p style={{ fontSize: '0.9rem' }}>Código: {code}</p>
                </div>
                <div className="drill-badge">
                  {reportsForSchool.length} Relatórios
                </div>
              </div>
            );
          })}
        </div>

        {isSettingsOpen && (
          <AdminSettings 
            schools={schools} 
            onClose={() => setIsSettingsOpen(false)} 
            refreshData={fetchData} 
          />
        )}
      </div>
    );
  }

  // --- NÍVEL 2: Turmas (Relatórios Drill-down) ---
  if (selectedSchoolCode && !selectedClassRoom) {
    const schoolReports = reports.filter(r => r.schoolCode === selectedSchoolCode);
    const classes = Array.from(new Set(schoolReports.map(r => r.classRoom)));
    
    return (
      <div className="container">
        <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button className="btn btn-outline" onClick={() => setSelectedSchoolCode(null)} style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem' }}>
              ← Voltar para Escolas
            </button>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Selecione a Turma</h1>
          </div>
        </header>
        
        <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
          {classes.length === 0 ? <p style={{ gridColumn: '1 / -1' }}>Nenhum relatório gerado para esta escola ainda.</p> : null}
          
          {classes.map(cls => {
            const reportsForClass = schoolReports.filter(r => r.classRoom === cls);
            return (
              <div 
                key={cls} 
                className="drill-card" 
                onClick={() => setSelectedClassRoom(cls)}
              >
                <div style={{ flex: 1 }}>
                  <h3>{cls}</h3>
                  <p style={{ fontSize: '0.9rem' }}>{reportsForClass.length} relatórios</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- NÍVEL 3: Matérias ---
  if (selectedSchoolCode && selectedClassRoom && !selectedReport) {
    const classReports = reports.filter(r => r.schoolCode === selectedSchoolCode && r.classRoom === selectedClassRoom);

    return (
      <div className="container">
        <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button className="btn btn-outline" onClick={() => setSelectedClassRoom(null)} style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem' }}>
              ← Voltar para Turmas
            </button>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Turma {selectedClassRoom}: Selecione a Matéria</h1>
          </div>
        </header>

        <div className="section-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {classReports.map(report => (
            <div 
              key={report.id} 
              className="drill-card" 
              onClick={() => setSelectedReport(report)}
            >
              <div style={{ flex: 1 }}>
                <h3>{report.subject}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Prof: {report.teacherName}</p>
                <p style={{ fontSize: '0.8rem' }}>Enviado: {new Date(report.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="drill-badge">
                {report.students?.length || 0} Alunos
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- NÍVEL 4: Tabela do Relatório ---
  if (selectedReport) {
    return (
      <div className="container" style={{ maxWidth: '1200px' }}>
        <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <button className="btn btn-outline" onClick={() => setSelectedReport(null)} style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem' }}>
              ← Voltar para Matérias
            </button>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>Turma: {selectedReport.classRoom}</h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ margin: 0, color: 'var(--accent-primary)' }}>{selectedReport.subject}</h2>
            <p>Prof(a): {selectedReport.teacherName}</p>
          </div>
        </header>

        <div className="section-panel" style={{ overflowX: 'auto', padding: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Nome do Aluno</th>
                <th style={{ width: '40%' }}>Habilidade não alcançada</th>
                <th style={{ width: '40%' }}>Plano de Ação</th>
              </tr>
            </thead>
            <tbody>
              {selectedReport.students?.map((student: any, idx: number) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{student.name}</td>
                  <td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{student.unreachedSkill}</td>
                  <td style={{ verticalAlign: 'top', whiteSpace: 'pre-wrap' }}>{student.actionPlan}</td>
                </tr>
              ))}
              {(!selectedReport.students || selectedReport.students.length === 0) && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center' }}>Nenhum aluno cadastrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
}
