import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'xlsx';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

type Tab = 'dashboard' | 'escolas' | 'turmas' | 'habilidades';

export function AdminView({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data State
  const [schools, setSchools] = useState<{ id: string; code: string; name: string }[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [uploadedClasses, setUploadedClasses] = useState<any[]>([]);
  const [skillsData, setSkillsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dashboard Drill-down state
  const [selectedSchoolCode, setSelectedSchoolCode] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedClassRoom, setSelectedClassRoom] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // CRUD Escolas
  const [newSchoolCode, setNewSchoolCode] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');

  // CRUD Turmas
  const [selectedSchoolTurmas, setSelectedSchoolTurmas] = useState<string>('');
  const [uploadClassName, setUploadClassName] = useState('');
  const [uploadGrade, setUploadGrade] = useState('');
  const [uploadPeriod, setUploadPeriod] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // CRUD Habilidades
  const [selectedSchoolSkills, setSelectedSchoolSkills] = useState<string>('');
  const [uploadSkillsFile, setUploadSkillsFile] = useState<File | null>(null);
  const [isUploadingSkills, setIsUploadingSkills] = useState(false);

  // Modal Confirm
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!loading && contentRef.current) {
      gsap.fromTo('.stagger-fade', 
        { opacity: 0, y: 20 }, 
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }
      );
    }
  }, { scope: contentRef, dependencies: [loading, activeTab, selectedSchoolCode, selectedPeriod, selectedClassRoom, selectedReport] });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      setSchools(schoolsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));

      const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc')));
      setReports(reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'turmas' && selectedSchoolTurmas) fetchClasses(selectedSchoolTurmas);
    if (activeTab === 'dashboard' && selectedSchoolCode) fetchClasses(selectedSchoolCode);
  }, [activeTab, selectedSchoolTurmas, selectedSchoolCode]);

  useEffect(() => {
    if (activeTab === 'habilidades' && selectedSchoolSkills) fetchSkills(selectedSchoolSkills);
  }, [activeTab, selectedSchoolSkills]);

  const fetchClasses = async (schoolCode: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'uploaded_classes'), where('schoolCode', '==', schoolCode)));
      setUploadedClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const fetchSkills = async (schoolCode: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'skills_data'), where('schoolCode', '==', schoolCode)));
      setSkillsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  // --- Funções CRUD Escolas ---
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolCode.trim() || !newSchoolName.trim()) return;
    try {
      await addDoc(collection(db, 'schools'), { code: newSchoolCode.trim().toUpperCase(), name: newSchoolName.trim() });
      setNewSchoolCode('');
      setNewSchoolName('');
      fetchInitialData();
    } catch (error) { alert("Erro ao adicionar escola."); }
  };

  const handleDeleteSchool = (schoolId: string, schoolCode: string) => {
    confirmAction(
      'Excluir Escola',
      `Atenção! Excluir a escola removerá TODAS as turmas e relatórios associados a ela. Deseja realmente continuar?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'schools', schoolId));
          fetchInitialData();
        } catch (err) { alert("Erro ao excluir escola."); }
      }
    );
  };

  // --- Funções CRUD Turmas ---
  const handleUploadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadClassName.trim() || !uploadGrade || !uploadPeriod || !selectedSchoolTurmas) return;
    
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
          if (idx !== -1) { headerRowIdx = i; nameColIdx = idx; break; }
        }
        if (headerRowIdx === -1) { alert("Erro: Não foi possível encontrar a coluna 'Nome' exata."); setIsUploading(false); return; }
        
        const headerRow = json[headerRowIdx];
        const subjectCols: { index: number, name: string }[] = [];
        for (let j = nameColIdx + 1; j < headerRow.length; j++) {
          const colName = String(headerRow[j] || '').trim();
          if (colName && colName.length > 2) subjectCols.push({ index: j, name: colName });
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
            if (typeof rawValue === 'number') numVal = rawValue > 1 ? rawValue / 100 : rawValue;
            else if (typeof rawValue === 'string') {
              const parsed = parseFloat(rawValue.replace(',', '.').replace('%', ''));
              if (!isNaN(parsed)) numVal = parsed > 1 ? parsed / 100 : parsed;
            }
            if (numVal !== undefined) scores[subjectCol.name] = numVal;
          }
          students.push({ name: studentName, scores });
        }
        
        await addDoc(collection(db, 'uploaded_classes'), {
          schoolCode: selectedSchoolTurmas,
          classRoom: uploadClassName.trim(),
          grade: uploadGrade,
          period: uploadPeriod,
          subjects: subjectCols.map(s => s.name),
          students,
          uploadedAt: new Date().toISOString()
        });
        
        alert(`Sucesso! Turma ${uploadClassName} carregada.`);
        setUploadClassName('');
        setUploadGrade('');
        setUploadPeriod('');
        setUploadFile(null);
        fetchClasses(selectedSchoolTurmas);
      } catch (err) { alert("Erro ao processar a planilha."); } finally { setIsUploading(false); }
    };
    reader.readAsArrayBuffer(uploadFile);
  };

  const handleDeleteClass = (id: string, name: string) => {
    confirmAction(
      'Excluir Turma',
      `Tem certeza que deseja excluir a turma ${name}? Essa ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'uploaded_classes', id));
          fetchClasses(selectedSchoolTurmas);
        } catch (e) { alert("Erro ao deletar."); }
      }
    );
  };

  // --- Funções CRUD Habilidades ---
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
            headerRowIdx = i; break;
          }
        }
        
        if (headerRowIdx === -1) { alert("Erro: Não foi possível encontrar a coluna 'Descritor' na planilha."); setIsUploadingSkills(false); return; }

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
             if (!isNaN(parsed)) { numVal = parsed > 1 ? parsed / 100 : parsed; }
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
        fetchSkills(selectedSchoolSkills);
      } catch (err) { alert("Erro ao processar a planilha de habilidades."); } finally { setIsUploadingSkills(false); }
    };
    reader.readAsArrayBuffer(uploadSkillsFile);
  };

  const handleDeleteSkillSet = (id: string, grade: string, subject: string) => {
    confirmAction(
      'Excluir Base de Habilidades',
      `Deletar a base de habilidades para ${grade} - ${subject}?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'skills_data', id));
          fetchSkills(selectedSchoolSkills);
        } catch (e) { alert("Erro ao deletar."); }
      }
    );
  };

  // --- Render Helpers ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0f0e17]">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <div className="text-slate-500 font-medium animate-pulse">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0f0e17]">
      {/* Sidebar */}
      <div className={`flex flex-col bg-white dark:bg-[#1e1b2e] border-r border-slate-200 dark:border-white/10 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          {isSidebarOpen && <span className="font-display font-bold text-xl text-slate-800 dark:text-white truncate">Coordenação</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors mx-auto shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <nav className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto">
          <button onClick={() => { setActiveTab('dashboard'); setSelectedSchoolCode(null); setSelectedPeriod(null); setSelectedClassRoom(null); setSelectedReport(null); }} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            {isSidebarOpen && <span className="font-medium truncate">Dashboard</span>}
          </button>
          <button onClick={() => setActiveTab('escolas')} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${activeTab === 'escolas' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            {isSidebarOpen && <span className="font-medium truncate">Escolas</span>}
          </button>
          <button onClick={() => setActiveTab('turmas')} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${activeTab === 'turmas' ? 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            {isSidebarOpen && <span className="font-medium truncate">Turmas</span>}
          </button>
          <button onClick={() => setActiveTab('habilidades')} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${activeTab === 'habilidades' ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            {isSidebarOpen && <span className="font-medium truncate">Habilidades</span>}
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-200 dark:border-white/10 shrink-0">
          <button onClick={onLogout} className={`w-full flex items-center justify-center gap-3 px-3 py-3 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors`}>
            <svg className="shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            {isSidebarOpen && <span className="font-medium truncate">Sair</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto" ref={contentRef}>
        <div className="max-w-7xl mx-auto px-6 py-12 pb-32">
          
          {/* TAB: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {/* Dashboard Nível 1: Escolas */}
              {!selectedSchoolCode && (
                <>
                  <header className="stagger-fade mb-12">
                    <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Visão Geral</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Selecione uma escola para visualizar os relatórios</p>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schools.length === 0 && <p className="col-span-full text-slate-500">Nenhuma escola cadastrada.</p>}
                    {Array.from(new Set([...schools.map(s => s.code), ...reports.map(r => r.schoolCode)])).map(code => {
                      const schoolInfo = schools.find(s => s.code === code);
                      const schoolName = schoolInfo ? schoolInfo.name : 'Escola ' + code;
                      const reportsForSchool = reports.filter(r => r.schoolCode === code);
                      return (
                        <div key={code} onClick={() => { setSelectedSchoolCode(code); setSelectedPeriod('Manhã'); }} className="stagger-fade group cursor-pointer bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-400 dark:hover:border-blue-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{schoolName}</h3>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex-1">Código: {code}</p>
                          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold">{reportsForSchool.length} Relatórios</span>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Dashboard Nível 2/3: Turmas com Dropdown de Período */}
              {selectedSchoolCode && selectedPeriod && !selectedClassRoom && (() => {
                const schoolReports = reports.filter(r => r.schoolCode === selectedSchoolCode);
                const periodClasses = uploadedClasses.filter(c => c.period === selectedPeriod || (!c.period && selectedPeriod === 'Manhã'));
                
                return (
                  <>
                    <header className="stagger-fade mb-12 flex flex-col gap-4">
                      <button onClick={() => { setSelectedSchoolCode(null); setSelectedPeriod(null); }} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors self-start">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Voltar para Escolas
                      </button>
                      <div className="flex justify-between items-end">
                        <div>
                          <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Turmas</h1>
                        </div>
                        <div className="relative">
                          <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="appearance-none bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors cursor-pointer shadow-sm">
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                          </select>
                          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </div>
                    </header>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      {periodClasses.length === 0 && <p className="col-span-full text-slate-500">Nenhuma turma cadastrada neste período.</p>}
                      {periodClasses.map(cls => {
                        const reportsForClass = schoolReports.filter(r => r.classRoom === cls.classRoom);
                        return (
                          <div key={cls.id} onClick={() => setSelectedClassRoom(cls.classRoom)} className="stagger-fade group cursor-pointer bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-green-500/10 hover:border-green-400 dark:hover:border-green-500/50 transition-all duration-300 transform hover:-translate-y-1">
                            <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 mb-6 group-hover:scale-110 transition-transform duration-300">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{cls.classRoom}</h3>
                            <div className="flex justify-between items-center mt-4">
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{reportsForClass.length} relatórios</p>
                              <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-green-600 group-hover:text-white transition-colors">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* Dashboard Nível 4: Matérias */}
              {selectedSchoolCode && selectedPeriod && selectedClassRoom && !selectedReport && (() => {
                const classReports = reports.filter(r => r.schoolCode === selectedSchoolCode && r.classRoom === selectedClassRoom);
                return (
                  <>
                    <header className="stagger-fade mb-12 flex flex-col gap-4">
                      <button onClick={() => setSelectedClassRoom(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors self-start">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Voltar para Turmas
                      </button>
                      <div>
                        <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Selecione a Matéria</h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Turma: <span className="text-slate-800 dark:text-white">{selectedClassRoom}</span></p>
                      </div>
                    </header>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {classReports.length === 0 && <p className="col-span-full text-slate-500">Nenhum relatório gerado para esta turma.</p>}
                      {classReports.map(report => (
                        <div key={report.id} onClick={() => setSelectedReport(report)} className="stagger-fade group cursor-pointer bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-400 dark:hover:border-cyan-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full">
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-6">
                              <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold">{new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{report.subject}</h3>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Prof: {report.teacherName}
                            </p>
                          </div>
                          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{report.students?.length || 0} Alunos</span>
                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}

              {/* Dashboard Nível 5: Tabela do Relatório */}
              {selectedReport && (
                <>
                  <header className="stagger-fade flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div className="flex flex-col items-start gap-4">
                      <button onClick={() => setSelectedReport(null)} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Voltar para Matérias
                      </button>
                      <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Turma: {selectedReport.classRoom}</h1>
                    </div>
                    <div className="md:text-right flex flex-col items-start md:items-end p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                      <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400">{selectedReport.subject}</h2>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">Prof(a): {selectedReport.teacherName}</p>
                    </div>
                  </header>
                  <div className="stagger-fade bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-black/20 border-b border-slate-200 dark:border-white/10">
                            <th className="py-4 px-6 font-bold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider w-[20%]">Nome do Aluno</th>
                            <th className="py-4 px-6 font-bold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider w-[40%]">Habilidade não alcançada</th>
                            <th className="py-4 px-6 font-bold text-sm text-slate-600 dark:text-slate-300 uppercase tracking-wider w-[40%]">Plano de Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                          {selectedReport.students?.map((student: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                              <td className="py-5 px-6 align-top">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">{idx + 1}</div>
                                  <span className="font-semibold text-slate-800 dark:text-white">{student.name}</span>
                                </div>
                              </td>
                              <td className="py-5 px-6 align-top"><p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{student.unreachedSkill}</p></td>
                              <td className="py-5 px-6 align-top">
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4">
                                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{student.actionPlan}</p>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* TAB: ESCOLAS */}
          {activeTab === 'escolas' && (
            <div className="stagger-fade grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  </div>
                  Cadastrar Nova Escola
                </h3>
                <form onSubmit={handleAddSchool} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Código de Acesso</label>
                    <input type="text" placeholder="Ex: NOVO002" value={newSchoolCode} onChange={(e) => setNewSchoolCode(e.target.value)} required className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"/>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome da Escola</label>
                    <input type="text" placeholder="Ex: E. E. Nova Escola" value={newSchoolName} onChange={(e) => setNewSchoolName(e.target.value)} required className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"/>
                  </div>
                  <button type="submit" className="mt-2 w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/30 transition-colors">
                    Criar Escola
                  </button>
                </form>
              </div>
              
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Escolas Existentes</h3>
                <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                  {schools.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-12 bg-white dark:bg-[#1e1b2e] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma escola cadastrada.</p>}
                  {schools.map(school => (
                    <div key={school.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors">
                      <div>
                        <strong className="text-slate-800 dark:text-white text-lg">{school.name}</strong>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Código: <span className="text-blue-600 dark:text-blue-400">{school.code}</span></div>
                      </div>
                      <button onClick={() => handleDeleteSchool(school.id, school.code)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TURMAS */}
          {activeTab === 'turmas' && (
            <div className="stagger-fade flex flex-col gap-8">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm max-w-xl">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Selecione a Escola para gerenciar Turmas</label>
                <div className="relative">
                  <select value={selectedSchoolTurmas} onChange={e => setSelectedSchoolTurmas(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-blue-500 transition-colors text-slate-800 dark:text-white">
                    <option value="">Selecione uma escola...</option>
                    {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>

              {selectedSchoolTurmas && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div className="bg-white dark:bg-[#1e1b2e] p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      </div>
                      Subir Nova Turma (Excel)
                    </h3>
                    <form onSubmit={handleUploadExcel} className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome da Turma</label>
                        <input type="text" placeholder="Ex: 6º Ano A" value={uploadClassName} onChange={(e) => setUploadClassName(e.target.value)} required className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-colors"/>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Série</label>
                        <div className="relative">
                          <select value={uploadGrade} onChange={(e) => setUploadGrade(e.target.value)} required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-green-500 transition-colors text-slate-800 dark:text-white">
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
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Período</label>
                        <div className="relative">
                          <select value={uploadPeriod} onChange={(e) => setUploadPeriod(e.target.value)} required className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-green-500 transition-colors text-slate-800 dark:text-white">
                            <option value="">Selecione o Período</option>
                            <option value="Manhã">Manhã</option>
                            <option value="Tarde">Tarde</option>
                            <option value="Noite">Noite</option>
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Arquivo Excel</label>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} required className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 dark:file:bg-green-500/10 dark:file:text-green-400 hover:file:bg-green-100 dark:hover:file:bg-green-500/20 file:transition-colors cursor-pointer"/>
                      </div>
                      <button type="submit" disabled={isUploading} className={`mt-2 w-full py-4 rounded-xl text-white font-medium shadow-lg transition-all flex justify-center items-center gap-2 ${isUploading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-500 shadow-green-500/30'}`}>
                        {isUploading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Enviando...</> : 'Fazer Upload'}
                      </button>
                    </form>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Turmas Cadastradas</h3>
                    <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                      {uploadedClasses.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-12 bg-white dark:bg-[#1e1b2e] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma turma carregada.</p>}
                      {uploadedClasses.map(c => (
                        <div key={c.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-green-300 dark:hover:border-green-500/50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <strong className="text-slate-800 dark:text-white text-lg">{c.classRoom}</strong> 
                              <span className="text-xs font-bold bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-2.5 py-1 rounded-md">{c.grade}</span>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                              <span>Período: {c.period || 'Manhã'}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                              <span>{c.students?.length} alunos</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteClass(c.id, c.classRoom)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
            <div className="stagger-fade flex flex-col gap-8">
              <div className="bg-white dark:bg-[#1e1b2e] p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm max-w-xl">
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-3">Selecione a Escola para gerenciar Habilidades</label>
                <div className="relative">
                  <select value={selectedSchoolSkills} onChange={e => setSelectedSchoolSkills(e.target.value)} className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 appearance-none outline-none focus:border-blue-500 transition-colors text-slate-800 dark:text-white">
                    <option value="">Selecione uma escola...</option>
                    {schools.map(s => <option key={s.id} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>

              {selectedSchoolSkills && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                  <div className="bg-white dark:bg-[#1e1b2e] p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                      </div>
                      Importar Base de Habilidades
                    </h3>
                    <form onSubmit={handleUploadSkills} className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Arquivo Excel (.xlsx)</label>
                        <input type="file" accept=".xlsx, .xls" onChange={(e) => setUploadSkillsFile(e.target.files?.[0] || null)} required className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 dark:file:bg-orange-500/10 dark:file:text-orange-400 hover:file:bg-orange-100 dark:hover:file:bg-orange-500/20 file:transition-colors cursor-pointer"/>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                          Filtra automaticamente acertos &lt; 50%.
                        </p>
                      </div>
                      <button type="submit" disabled={isUploadingSkills} className={`mt-2 w-full py-4 rounded-xl text-white font-medium shadow-lg transition-all flex justify-center items-center gap-2 ${isUploadingSkills ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/30'}`}>
                        {isUploadingSkills ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processando...</> : 'Importar Base'}
                      </button>
                    </form>
                  </div>
                  
                  <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Bases Importadas</h3>
                    <div className="flex flex-col gap-4 overflow-y-auto pr-2">
                      {skillsData.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-center py-12 bg-white dark:bg-[#1e1b2e] rounded-3xl border border-slate-200 dark:border-white/10 border-dashed">Nenhuma base importada.</p>}
                      {skillsData.map(s => (
                        <div key={s.id} className="group flex justify-between items-center bg-white dark:bg-[#1e1b2e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-orange-300 dark:hover:border-orange-500/50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <strong className="text-slate-800 dark:text-white text-lg">{s.subject}</strong> 
                              <span className="text-xs font-bold bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-md">{s.grade}</span>
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.skills?.length} habilidades salvas</div>
                          </div>
                          <button onClick={() => handleDeleteSkillSet(s.id, s.grade, s.subject)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir Lote">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
      
      {/* Confirm Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-[#1e1b2e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 transform scale-100 opacity-100 transition-all duration-300">
            <div className="p-6 md:p-8">
              <div className="w-14 h-14 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{confirmDialog.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="p-4 md:p-6 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex flex-col-reverse md:flex-row justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} 
                className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors w-full md:w-auto"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }} 
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-500/30 transition-colors w-full md:w-auto"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
