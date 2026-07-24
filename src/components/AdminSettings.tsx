import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';

export function AdminSettings({ onClose, schools, refreshData }: { onClose: () => void, schools: any[], refreshData: () => void }) {
  const [activeTab, setActiveTab] = useState<'escolas' | 'turmas' | 'habilidades'>('escolas');
  
  // Escolas State
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  
  // Turmas State
  const [selectedSchoolTurmas, setSelectedSchoolTurmas] = useState<string>('');
  const [uploadClassName, setUploadClassName] = useState('');
  const [uploadGrade, setUploadGrade] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedClasses, setUploadedClasses] = useState<any[]>([]);

  // Habilidades State
  const [selectedSchoolSkills, setSelectedSchoolSkills] = useState<string>('');
  const [uploadSkillsFile, setUploadSkillsFile] = useState<File | null>(null);
  const [isUploadingSkills, setIsUploadingSkills] = useState(false);
  const [skillsData, setSkillsData] = useState<any[]>([]);

  // Carregar turmas quando a escola selecionada mudar
  useEffect(() => {
    if (activeTab === 'turmas' && selectedSchoolTurmas) {
      fetchClasses();
    }
  }, [activeTab, selectedSchoolTurmas]);

  // Carregar habilidades quando a escola selecionada mudar
  useEffect(() => {
    if (activeTab === 'habilidades' && selectedSchoolSkills) {
      fetchSkills();
    }
  }, [activeTab, selectedSchoolSkills]);

  const fetchClasses = async () => {
    try {
      const q = query(collection(db, 'uploaded_classes'), where('schoolCode', '==', selectedSchoolTurmas));
      const snap = await getDocs(q);
      setUploadedClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSkills = async () => {
    try {
      const q = query(collection(db, 'skills_data'), where('schoolCode', '==', selectedSchoolSkills));
      const snap = await getDocs(q);
      setSkillsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  // ====================== ESCOLAS ======================
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolCode.trim() || !newSchoolName.trim()) return;

    try {
      await addDoc(collection(db, 'schools'), {
        code: newSchoolCode.trim().toUpperCase(),
        name: newSchoolName.trim()
      });
      setNewSchoolCode('');
      setNewSchoolName('');
      refreshData();
    } catch (error) {
      console.error("Erro ao adicionar escola:", error);
      alert("Erro ao adicionar escola.");
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolCode: string) => {
    if (!window.confirm(`Atenção! Excluir a escola removerá TODAS as turmas e relatórios dela (habilidades serão mantidas). Deseja excluir a escola ${schoolCode}?`)) return;
    try {
      await deleteDoc(doc(db, 'schools', schoolId));
      
      // Cascade delete classes
      const qClasses = query(collection(db, 'uploaded_classes'), where('schoolCode', '==', schoolCode));
      const snapClasses = await getDocs(qClasses);
      for (const d of snapClasses.docs) {
        await deleteDoc(doc(db, 'uploaded_classes', d.id));
      }

      // Cascade delete reports
      const qReports = query(collection(db, 'reports'), where('schoolCode', '==', schoolCode));
      const snapReports = await getDocs(qReports);
      for (const d of snapReports.docs) {
        await deleteDoc(doc(db, 'reports', d.id));
      }
      
      refreshData();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir escola.");
    }
  };

  // ====================== TURMAS ======================
  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadClassName.trim() || !uploadGrade || !selectedSchoolTurmas) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let headerRowIdx = -1;
        let nameColIdx = -1;
        
        for (let i = 0; i < Math.min(10, json.length); i++) {
          const row = json[i];
          if (!row) continue;
          const idx = row.findIndex(cell => typeof cell === 'string' && cell.toLowerCase().trim() === 'nome');
          if (idx !== -1) {
            headerRowIdx = i;
            nameColIdx = idx;
            break;
          }
        }
        
        if (headerRowIdx === -1) {
          alert("Erro: Não foi possível encontrar a coluna 'Nome' exata na planilha.");
          setIsUploading(false);
          return;
        }
        
        const headerRow = json[headerRowIdx];
        const subjectCols: { index: number, name: string }[] = [];
        
        for (let j = nameColIdx + 1; j < headerRow.length; j++) {
          const colName = String(headerRow[j] || '').trim();
          if (colName && colName.length > 2) {
            subjectCols.push({ index: j, name: colName });
          }
        }
        
        const students: any[] = [];
        for (let i = headerRowIdx + 1; i < json.length; i++) {
          const row = json[i];
          if (!row || !row[nameColIdx]) continue;
          
          const studentName = String(row[nameColIdx]).trim();
          if (!studentName) continue;
          
          const scores: Record<string, number> = {};
          
          for (const subjectCol of subjectCols) {
            const rawValue = row[subjectCol.index];
            let numVal: number | undefined = undefined;
            if (typeof rawValue === 'number') {
              numVal = rawValue > 1 ? rawValue / 100 : rawValue;
            } else if (typeof rawValue === 'string') {
              const strVal = rawValue.trim();
              if (strVal) {
                const parsed = parseFloat(strVal.replace(',', '.').replace('%', ''));
                if (!isNaN(parsed)) {
                  numVal = parsed > 1 ? parsed / 100 : parsed;
                }
              }
            }
            if (numVal !== undefined) {
              scores[subjectCol.name] = numVal;
            }
          }
          
          students.push({ name: studentName, scores });
        }
        
        await addDoc(collection(db, 'uploaded_classes'), {
          schoolCode: selectedSchoolTurmas,
          classRoom: uploadClassName.trim(),
          grade: uploadGrade,
          subjects: subjectCols.map(s => s.name),
          students,
          uploadedAt: new Date().toISOString()
        });
        
        alert(`Sucesso! Turma ${uploadClassName} carregada com ${students.length} alunos.`);
        setUploadClassName('');
        setUploadGrade('');
        setUploadFile(null);
        fetchClasses();
      } catch (err) {
        console.error(err);
        alert("Erro ao processar a planilha.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(uploadFile);
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!window.confirm(`Deseja excluir a turma ${name}? Os relatórios já gerados não serão apagados.`)) return;
    try {
      await deleteDoc(doc(db, 'uploaded_classes', id));
      fetchClasses();
    } catch (e) {
      console.error(e);
      alert("Erro ao deletar.");
    }
  };

  // ====================== HABILIDADES ======================
  const handleUploadSkills = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadSkillsFile || !selectedSchoolSkills) return;
    
    setIsUploadingSkills(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, json.length); i++) {
          const row = json[i];
          if (!row) continue;
          if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().trim().includes('descritor'))) {
            headerRowIdx = i;
            break;
          }
        }
        
        if (headerRowIdx === -1) {
          alert("Erro: Não foi possível encontrar a coluna 'Descritor' na planilha.");
          setIsUploadingSkills(false);
          return;
        }

        const headers = json[headerRowIdx].map((h: any) => String(h || '').toLowerCase().trim());
        const serieIdx = headers.findIndex((h: string) => h.includes('série') || h.includes('serie'));
        const acertosIdx = headers.findIndex((h: string) => h.includes('acerto'));
        const descritorIdx = headers.findIndex((h: string) => h.includes('descritor'));
        const disciplinaIdx = headers.findIndex((h: string) => h.includes('disciplina'));

        if (serieIdx === -1 || acertosIdx === -1 || descritorIdx === -1 || disciplinaIdx === -1) {
          alert("Erro: A planilha deve conter as colunas: Série, Acertos, Descritor e Disciplina.");
          setIsUploadingSkills(false);
          return;
        }

        const skillsToSave: any[] = [];
        for (let i = headerRowIdx + 1; i < json.length; i++) {
          const row = json[i];
          if (!row || !row[serieIdx]) continue;
          
          const serie = String(row[serieIdx]).trim();
          const descritor = String(row[descritorIdx]).trim();
          const disciplina = String(row[disciplinaIdx]).trim();
          let acertosStr = String(row[acertosIdx]).trim();
          
          if (!descritor) continue;

          let numVal: number | undefined = undefined;
          if (typeof row[acertosIdx] === 'number') {
            numVal = row[acertosIdx] > 1 ? row[acertosIdx] / 100 : row[acertosIdx];
          } else {
             const parsed = parseFloat(acertosStr.replace(',', '.').replace('%', ''));
             if (!isNaN(parsed)) {
               numVal = parsed > 1 ? parsed / 100 : parsed;
             }
          }

          if (numVal !== undefined && numVal < 0.5) {
            skillsToSave.push({ serie, disciplina, descritor });
          }
        }

        const grouped: Record<string, Record<string, string[]>> = {};
        skillsToSave.forEach(s => {
          if (!grouped[s.serie]) grouped[s.serie] = {};
          if (!grouped[s.serie][s.disciplina]) grouped[s.serie][s.disciplina] = [];
          if (!grouped[s.serie][s.disciplina].includes(s.descritor)) {
            grouped[s.serie][s.disciplina].push(s.descritor);
          }
        });

        for (const [serie, disciplinas] of Object.entries(grouped)) {
          for (const [disciplina, descritores] of Object.entries(disciplinas)) {
             await addDoc(collection(db, 'skills_data'), {
               schoolCode: selectedSchoolSkills,
               grade: serie,
               subject: disciplina,
               skills: descritores,
               uploadedAt: new Date().toISOString()
             });
          }
        }
        
        alert(`Sucesso! Habilidades abaixo de 50% importadas.`);
        setUploadSkillsFile(null);
        fetchSkills();
      } catch (err) {
        console.error(err);
        alert("Erro ao processar a planilha de habilidades.");
      } finally {
        setIsUploadingSkills(false);
      }
    };
    reader.readAsArrayBuffer(uploadSkillsFile);
  };

  const handleDeleteSkillSet = async (id: string, grade: string, subject: string) => {
    if (!window.confirm(`Deletar a base de habilidades para ${grade} - ${subject}?`)) return;
    try {
      await deleteDoc(doc(db, 'skills_data', id));
      fetchSkills();
    } catch (e) {
      console.error(e);
      alert("Erro ao deletar.");
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{
        background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '900px', 
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem' }}>⚙️ Painel de Configurações</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-body)' }}>
          <button className={`tab-btn ${activeTab === 'escolas' ? 'active' : ''}`} onClick={() => setActiveTab('escolas')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'escolas' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'escolas' ? 'bold' : 'normal', cursor: 'pointer', borderBottom: activeTab === 'escolas' ? '2px solid var(--accent-primary)' : 'none' }}>🏫 Escolas</button>
          <button className={`tab-btn ${activeTab === 'turmas' ? 'active' : ''}`} onClick={() => setActiveTab('turmas')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'turmas' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'turmas' ? 'bold' : 'normal', cursor: 'pointer', borderBottom: activeTab === 'turmas' ? '2px solid var(--accent-primary)' : 'none' }}>📚 Turmas</button>
          <button className={`tab-btn ${activeTab === 'habilidades' ? 'active' : ''}`} onClick={() => setActiveTab('habilidades')} style={{ flex: 1, padding: '1rem', border: 'none', background: activeTab === 'habilidades' ? 'var(--bg-card)' : 'transparent', fontWeight: activeTab === 'habilidades' ? 'bold' : 'normal', cursor: 'pointer', borderBottom: activeTab === 'habilidades' ? '2px solid var(--accent-primary)' : 'none' }}>🎯 Habilidades</button>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* TAB: ESCOLAS */}
          {activeTab === 'escolas' && (
            <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <h3>Cadastrar Nova Escola</h3>
                <form onSubmit={handleAddSchool} style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Código de Acesso</label>
                    <input type="text" placeholder="Ex: NOVO002" value={newSchoolCode} onChange={(e) => setNewSchoolCode(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Nome da Escola</label>
                    <input type="text" placeholder="Ex: E. E. Nova Escola" value={newSchoolName} onChange={(e) => setNewSchoolName(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>+ Criar</button>
                </form>
              </div>
              <div>
                <h3>Escolas Existentes</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                  {schools.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma escola cadastrada.</p>}
                  {schools.map(school => (
                    <div key={school.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                      <div>
                        <strong>{school.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Código: {school.code}</div>
                      </div>
                      <button onClick={() => handleDeleteSchool(school.id, school.code)} className="btn-icon delete-btn" title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TURMAS */}
          {activeTab === 'turmas' && (
            <div>
              <div className="form-group">
                <label>Selecione a Escola para gerenciar Turmas:</label>
                <select value={selectedSchoolTurmas} onChange={e => setSelectedSchoolTurmas(e.target.value)}>
                  <option value="">Selecione...</option>
                  {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {selectedSchoolTurmas && (
                <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <h3>Subir Nova Turma (Excel)</h3>
                    <form onSubmit={handleUploadExcel} style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label>Nome da Turma</label>
                        <input type="text" placeholder="Ex: 6º Ano A" value={uploadClassName} onChange={(e) => setUploadClassName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label>Série</label>
                        <select value={uploadGrade} onChange={(e) => setUploadGrade(e.target.value)} required>
                          <option value="">Selecione a Série</option>
                          <option value="6º ANO">6º ANO</option>
                          <option value="7º ANO">7º ANO</option>
                          <option value="8º ANO">8º ANO</option>
                          <option value="9º ANO">9º ANO</option>
                          <option value="1ª SÉRIE">1ª SÉRIE</option>
                          <option value="2ª SÉRIE">2ª SÉRIE</option>
                          <option value="3ª SÉRIE">3ª SÉRIE</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Arquivo Excel</label>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required />
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={isUploading} style={{ width: '100%' }}>
                        {isUploading ? 'Enviando...' : 'Fazer Upload'}
                      </button>
                    </form>
                  </div>
                  <div>
                    <h3>Turmas Cadastradas nesta Escola</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                      {uploadedClasses.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma turma carregada.</p>}
                      {uploadedClasses.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <strong>{c.classRoom}</strong> <span style={{ fontSize: '0.8rem', background: 'var(--accent-secondary)', color: 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{c.grade}</span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.students?.length} alunos</div>
                          </div>
                          <button onClick={() => handleDeleteClass(c.id, c.classRoom)} className="btn-icon delete-btn" title="Excluir" style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: HABILIDADES */}
          {activeTab === 'habilidades' && (
            <div>
              <div className="form-group">
                <label>Selecione a Escola para gerenciar Habilidades:</label>
                <select value={selectedSchoolSkills} onChange={e => setSelectedSchoolSkills(e.target.value)}>
                  <option value="">Selecione...</option>
                  {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              {selectedSchoolSkills && (
                <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <h3>Importar Base de Habilidades</h3>
                    <form onSubmit={handleUploadSkills} style={{ marginTop: '1rem' }}>
                      <div className="form-group">
                        <label>Arquivo Excel (.xlsx)</label>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadSkillsFile(e.target.files?.[0] || null)} required />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Filtra automaticamente acertos &lt; 50%.</p>
                      </div>
                      <button className="btn btn-primary" type="submit" disabled={isUploadingSkills} style={{ width: '100%' }}>
                        {isUploadingSkills ? 'Processando...' : 'Importar'}
                      </button>
                    </form>
                  </div>
                  <div>
                    <h3>Bases Importadas nesta Escola</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
                      {skillsData.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma base importada.</p>}
                      {skillsData.map(s => (
                        <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-body)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <strong>{s.subject}</strong> <span style={{ fontSize: '0.8rem', background: 'var(--accent-secondary)', color: 'var(--accent-primary)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>{s.grade}</span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.skills?.length} habilidades salvas</div>
                          </div>
                          <button onClick={() => handleDeleteSkillSet(s.id, s.grade, s.subject)} className="btn-icon delete-btn" title="Excluir Lote" style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
