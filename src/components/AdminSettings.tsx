import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(modalRef.current, 
      { opacity: 0, scale: 0.95, y: 20 }, 
      { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out' }
    );
  }, []);

  const handleClose = () => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(modalRef.current, { opacity: 0, scale: 0.95, y: 20, duration: 0.2, ease: 'power3.in', onComplete: onClose });
  };

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
    <div ref={overlayRef} className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div 
        ref={modalRef} 
        className="w-full max-w-5xl max-h-[90vh] bg-slate-50 dark:bg-[#151322] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-6 md:p-8 bg-white dark:bg-[#1e1b2e] border-b border-slate-200 dark:border-white/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white m-0">Painel de Configurações</h2>
          </div>
          <button 
            onClick={handleClose} 
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <div className="flex border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#1e1b2e] shrink-0 overflow-x-auto">
          {[
            { id: 'escolas', label: 'Escolas', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
            { id: 'turmas', label: 'Turmas', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' },
            { id: 'habilidades', label: 'Habilidades', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' }
          ].map(tab => (
            <button 
              key={tab.id}
              className={`flex-1 py-4 px-6 flex items-center justify-center gap-2 border-b-2 font-medium transition-colors min-w-[150px] ${activeTab === tab.id ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon}></path>
                {tab.id === 'escolas' && <polyline points="9 22 9 12 15 12 15 22"></polyline>}
              </svg>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 md:p-8 overflow-y-auto flex-1">
          {/* TAB: ESCOLAS */}
          {activeTab === 'escolas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </div>
                  Cadastrar Nova Escola
                </h3>
                <form onSubmit={handleAddSchool} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Código de Acesso</label>
                    <input 
                      type="text" 
                      placeholder="Ex: NOVO002" 
                      value={newSchoolCode} 
                      onChange={(e) => setNewSchoolCode(e.target.value)} 
                      required 
                      className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome da Escola</label>
                    <input 
                      type="text" 
                      placeholder="Ex: E. E. Nova Escola" 
                      value={newSchoolName} 
                      onChange={(e) => setNewSchoolName(e.target.value)} 
                      required 
                      className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <button type="submit" className="mt-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/30 transition-colors">
                    Criar Escola
                  </button>
                </form>
              </div>
              
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Escolas Existentes</h3>
                <div className="flex flex-col gap-3 overflow-y-auto pr-2 max-h-[400px]">
                  {schools.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-8 bg-white dark:bg-[#1e1b2e] rounded-2xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma escola cadastrada.</p>}
                  {schools.map(school => (
                    <div key={school.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors">
                      <div>
                        <strong className="text-slate-800 dark:text-white">{school.name}</strong>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Código: <span className="text-blue-600 dark:text-blue-400">{school.code}</span></div>
                      </div>
                      <button 
                        onClick={() => handleDeleteSchool(school.id, school.code)} 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Excluir"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TURMAS */}
          {activeTab === 'turmas' && (
            <div className="flex flex-col gap-8">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm max-w-xl">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Selecione a Escola para gerenciar Turmas</label>
                <div className="relative">
                  <select 
                    value={selectedSchoolTurmas} 
                    onChange={e => setSelectedSchoolTurmas(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-blue-500 transition-colors text-slate-800 dark:text-white"
                  >
                    <option value="">Selecione uma escola...</option>
                    {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>

              {selectedSchoolTurmas && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      </div>
                      Subir Nova Turma (Excel)
                    </h3>
                    <form onSubmit={handleUploadExcel} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome da Turma</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 6º Ano A" 
                          value={uploadClassName} 
                          onChange={(e) => setUploadClassName(e.target.value)} 
                          required 
                          className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-colors"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Série</label>
                        <div className="relative">
                          <select 
                            value={uploadGrade} 
                            onChange={(e) => setUploadGrade(e.target.value)} 
                            required
                            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-green-500 transition-colors text-slate-800 dark:text-white"
                          >
                            <option value="">Selecione a Série</option>
                            <option value="6º ANO">6º ANO</option>
                            <option value="7º ANO">7º ANO</option>
                            <option value="8º ANO">8º ANO</option>
                            <option value="9º ANO">9º ANO</option>
                            <option value="1ª SÉRIE">1ª SÉRIE</option>
                            <option value="2ª SÉRIE">2ª SÉRIE</option>
                            <option value="3ª SÉRIE">3ª SÉRIE</option>
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Arquivo Excel</label>
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)} 
                          required 
                          className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 dark:file:bg-green-500/10 dark:file:text-green-400 hover:file:bg-green-100 dark:hover:file:bg-green-500/20 file:transition-colors cursor-pointer"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isUploading} 
                        className={`mt-2 w-full py-3 rounded-xl text-white font-medium shadow-lg transition-all flex justify-center items-center gap-2 ${isUploading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-500 shadow-green-500/30'}`}
                      >
                        {isUploading ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Enviando...</>
                        ) : 'Fazer Upload'}
                      </button>
                    </form>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Turmas Cadastradas</h3>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-2 max-h-[400px]">
                      {uploadedClasses.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-8 bg-white dark:bg-[#1e1b2e] rounded-2xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma turma carregada.</p>}
                      {uploadedClasses.map(c => (
                        <div key={c.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-green-300 dark:hover:border-green-500/50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <strong className="text-slate-800 dark:text-white">{c.classRoom}</strong> 
                              <span className="text-xs font-bold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-md">{c.grade}</span>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{c.students?.length} alunos</div>
                          </div>
                          <button 
                            onClick={() => handleDeleteClass(c.id, c.classRoom)} 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Excluir"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
            <div className="flex flex-col gap-8">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm max-w-xl">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Selecione a Escola para gerenciar Habilidades</label>
                <div className="relative">
                  <select 
                    value={selectedSchoolSkills} 
                    onChange={e => setSelectedSchoolSkills(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-blue-500 transition-colors text-slate-800 dark:text-white"
                  >
                    <option value="">Selecione uma escola...</option>
                    {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>

              {selectedSchoolSkills && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      </div>
                      Importar Base de Habilidades
                    </h3>
                    <form onSubmit={handleUploadSkills} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Arquivo Excel (.xlsx)</label>
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={(e) => setUploadSkillsFile(e.target.files?.[0] || null)} 
                          required 
                          className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 dark:file:bg-orange-500/10 dark:file:text-orange-400 hover:file:bg-orange-100 dark:hover:file:bg-orange-500/20 file:transition-colors cursor-pointer"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                          Filtra automaticamente acertos &lt; 50%.
                        </p>
                      </div>
                      <button 
                        type="submit" 
                        disabled={isUploadingSkills} 
                        className={`mt-2 w-full py-3 rounded-xl text-white font-medium shadow-lg transition-all flex justify-center items-center gap-2 ${isUploadingSkills ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/30'}`}
                      >
                        {isUploadingSkills ? (
                          <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processando...</>
                        ) : 'Importar Base'}
                      </button>
                    </form>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Bases Importadas</h3>
                    <div className="flex flex-col gap-3 overflow-y-auto pr-2 max-h-[400px]">
                      {skillsData.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-8 bg-white dark:bg-[#1e1b2e] rounded-2xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma base importada.</p>}
                      {skillsData.map(s => (
                        <div key={s.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <strong className="text-slate-800 dark:text-white">{s.subject}</strong> 
                              <span className="text-xs font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-md">{s.grade}</span>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.skills?.length} habilidades salvas</div>
                          </div>
                          <button 
                            onClick={() => handleDeleteSkillSet(s.id, s.grade, s.subject)} 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Excluir Lote"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
