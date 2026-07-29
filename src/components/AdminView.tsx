import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useNotification } from '../contexts/NotificationContext';
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
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editSchoolCode, setEditSchoolCode] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');

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
  const [editClassDialog, setEditClassDialog] = useState<{ isOpen: boolean; id: string; classRoom: string; grade: string; period: string; isTecnico?: boolean; students?: any[]; subjects?: string[] }>({ isOpen: false, id: '', classRoom: '', grade: '', period: '', isTecnico: false, students: [], subjects: [] });
  const [tecnicoFile, setTecnicoFile] = useState<File | null>(null);
  const [isUpdatingClass, setIsUpdatingClass] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const [isDevAuth, setIsDevAuth] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const { showToast, showConfirm } = useNotification();

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDevPanelOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      classes.sort((a: any, b: any) => (a.classRoom || '').localeCompare(b.classRoom || ''));
      setUploadedClasses(classes);
    } catch (e) { console.error(e); }
  };

  const fetchSkills = async (schoolCode: string) => {
    try {
      const snap = await getDocs(query(collection(db, 'skills_data'), where('schoolCode', '==', schoolCode)));
      const skills = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      const getGradeWeight = (grade: string) => {
        const g = String(grade || '').toLowerCase();
        if (g.includes('6')) return 6;
        if (g.includes('7')) return 7;
        if (g.includes('8')) return 8;
        if (g.includes('9')) return 9;
        if (g.includes('1')) return 10;
        if (g.includes('2')) return 11;
        if (g.includes('3')) return 12;
        return 99;
      };

      skills.sort((a, b) => {
        const subjectCompare = String(a.subject || '').localeCompare(String(b.subject || ''));
        if (subjectCompare !== 0) return subjectCompare;
        return getGradeWeight(a.grade) - getGradeWeight(b.grade);
      });

      setSkillsData(skills);
    } catch (e) { console.error(e); }
  };

  const handleDeleteAllReports = async () => {
    showConfirm(
      "Apagar Relatórios",
      "ATENÇÃO: Deseja apagar TODOS os relatórios? Apenas para DEV.",
      async () => {
        try {
          setLoading(true);
          const snap = await getDocs(collection(db, 'reports'));
          const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          showToast("Todos os relatórios foram apagados!", "success");
          fetchInitialData();
        } catch (e) {
          console.error(e);
          showToast("Erro ao apagar relatórios.", "error");
          setLoading(false);
        }
      }
    );
  };

  const handleDeleteAllSkills = async () => {
    showConfirm(
      "Apagar Habilidades",
      "ATENÇÃO: Deseja apagar TODAS as habilidades? Apenas para DEV.",
      async () => {
        try {
          setLoading(true);
          const snap = await getDocs(collection(db, 'skills_data'));
          const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          showToast("Todas as habilidades foram apagadas!", "success");
          if (selectedSchoolSkills) fetchSkills(selectedSchoolSkills);
          else fetchInitialData();
        } catch (e) {
          console.error(e);
          showToast("Erro ao apagar habilidades.", "error");
        } finally {
          setLoading(false);
        }
      }
    );
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
      showToast("Escola cadastrada com sucesso!", "success");
    } catch (error) { showToast("Erro ao adicionar escola.", "error"); }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchoolId || !editSchoolCode.trim() || !editSchoolName.trim()) return;
    try {
      await updateDoc(doc(db, 'schools', editingSchoolId), { 
        code: editSchoolCode.trim().toUpperCase(), 
        name: editSchoolName.trim() 
      });
      setEditingSchoolId(null);
      fetchInitialData();
      showToast("Escola atualizada com sucesso!", "success");
    } catch (error) { showToast("Erro ao atualizar escola.", "error"); }
  };

  const handleDeleteSchool = (schoolId: string) => {
    showConfirm(
      'Excluir Escola',
      `Atenção! Excluir a escola removerá TODAS as turmas e relatórios associados a ela. Deseja realmente continuar?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'schools', schoolId));
          fetchInitialData();
        } catch (err) { showToast("Erro ao excluir escola.", "error"); }
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
        if (headerRowIdx === -1) { showToast("Erro: Não foi possível encontrar a coluna 'Nome' exata.", "error"); setIsUploading(false); return; }
        
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
        
        showToast(`Sucesso! Turma ${uploadClassName} carregada.`, "success");
        setUploadClassName('');
        setUploadGrade('');
        setUploadPeriod('');
        setUploadFile(null);
        fetchClasses(selectedSchoolTurmas);
      } catch (err) { showToast("Erro ao processar a planilha.", "error"); } finally { setIsUploading(false); }
    };
    reader.readAsArrayBuffer(uploadFile);
  };

  const handleDeleteClass = (id: string, name: string) => {
    showConfirm(
      'Excluir Turma',
      `Tem certeza que deseja excluir a turma ${name}? Essa ação não pode ser desfeita.`,
      async () => {
        try {
          await deleteDoc(doc(db, 'uploaded_classes', id));
          fetchClasses(selectedSchoolTurmas);
        } catch (e) { showToast("Erro ao deletar.", "error"); }
      }
    );
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingClass(true);
    try {
      let updatedStudents = editClassDialog.students ? [...editClassDialog.students] : [];
      let updatedSubjects = editClassDialog.subjects ? [...editClassDialog.subjects] : [];
      let hasFileChanges = false;

      if (editClassDialog.isTecnico && tecnicoFile) {
        const data = await tecnicoFile.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let headerRowIdx = -1;
        let nomeIdx = -1, componenteIdx = -1, acertosIdx = -1;
        
        for (let i = 0; i < Math.min(10, json.length); i++) {
          const row = json[i];
          if (!row) continue;
          const headers = row.map((cell: any) => String(cell || '').toLowerCase().trim());
          nomeIdx = headers.findIndex((h: string) => h === 'nome');
          componenteIdx = headers.findIndex((h: string) => h === 'componente');
          acertosIdx = headers.findIndex((h: string) => h.includes('acertos'));
          
          if (nomeIdx !== -1 && componenteIdx !== -1 && acertosIdx !== -1) {
            headerRowIdx = i;
            break;
          }
        }
        
        if (headerRowIdx !== -1) {
          hasFileChanges = true;
          for (let i = headerRowIdx + 1; i < json.length; i++) {
            const row = json[i];
            if (!row || !row[nomeIdx]) continue;
            
            const studentName = String(row[nomeIdx]).trim();
            const componente = String(row[componenteIdx]).trim();
            const acertosStr = String(row[acertosIdx]).trim();
            
            let numVal: number | undefined = undefined;
            if (typeof row[acertosIdx] === 'number') {
               numVal = row[acertosIdx] > 1 ? row[acertosIdx] / 100 : row[acertosIdx];
            } else {
               const parsed = parseFloat(acertosStr.replace(',', '.').replace('%', ''));
               if (!isNaN(parsed)) { numVal = parsed > 1 ? parsed / 100 : parsed; }
            }
            
            if (numVal !== undefined && componente) {
              if (!updatedSubjects.includes(componente)) {
                updatedSubjects.push(componente);
              }
              const student = updatedStudents.find(s => s.name.toLowerCase() === studentName.toLowerCase());
              if (student) {
                if (!student.scores) student.scores = {};
                student.scores[componente] = numVal;
              }
            }
          }
        } else {
          showToast("Erro: Planilha do técnico em formato inválido.", "error");
          setIsUpdatingClass(false);
          return;
        }
      }

      const payload: any = {
        classRoom: editClassDialog.classRoom.trim(),
        grade: editClassDialog.grade.trim(),
        period: editClassDialog.period.trim(),
        isTecnico: editClassDialog.isTecnico || false
      };
      
      if (hasFileChanges) {
        payload.students = updatedStudents;
        payload.subjects = updatedSubjects;
      }

      await updateDoc(doc(db, 'uploaded_classes', editClassDialog.id), payload);
      fetchClasses(selectedSchoolTurmas);
      setEditClassDialog({ isOpen: false, id: '', classRoom: '', grade: '', period: '', isTecnico: false, students: [], subjects: [] });
      setTecnicoFile(null);
      showToast("Turma atualizada com sucesso!", "success");
    } catch (e) {
      console.error(e);
      showToast("Erro ao atualizar turma.", "error");
    } finally {
      setIsUpdatingClass(false);
    }
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
        
        if (headerRowIdx === -1) { showToast("Erro: Não foi possível encontrar a coluna 'Descritor' na planilha.", "error"); setIsUploadingSkills(false); return; }

        const headers = json[headerRowIdx].map((h: any) => String(h || '').toLowerCase().trim());
        const serieIdx = headers.findIndex((h: string) => h.includes('série') || h.includes('serie'));
        const acertosIdx = headers.findIndex((h: string) => h.includes('acerto'));
        const descritorIdx = headers.findIndex((h: string) => h.includes('descritor'));
        const disciplinaIdx = headers.findIndex((h: string) => h.includes('disciplina'));

        if (serieIdx === -1 || acertosIdx === -1 || descritorIdx === -1 || disciplinaIdx === -1) {
          showToast("Erro: A planilha deve conter as colunas: Série, Acertos, Descritor e Disciplina.", "error");
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
        
        showToast(`Sucesso! Habilidades abaixo de 50% importadas.`, "success");
        setUploadSkillsFile(null);
        fetchSkills(selectedSchoolSkills);
      } catch (err) { showToast("Erro ao processar a planilha de habilidades.", "error"); } finally { setIsUploadingSkills(false); }
    };
    reader.readAsArrayBuffer(uploadSkillsFile);
  };

  const handleDeleteSkillSet = (id: string, grade: string, subject: string) => {
    showConfirm(
      'Excluir Base de Habilidades',
      `Deletar a base de habilidades para ${grade} - ${subject}?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'skills_data', id));
          fetchSkills(selectedSchoolSkills);
        } catch (e) { showToast("Erro ao deletar.", "error"); }
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
                  <header className="stagger-fade mb-12 flex justify-between items-start">
                    <div>
                      <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Visão Geral</h1>
                      <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Selecione uma escola para visualizar os relatórios</p>
                    </div>
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
                let periodClasses = [];
                if (selectedPeriod === 'Outros') {
                  const manualClassRooms = Array.from(new Set(schoolReports.map(r => r.classRoom))).filter(
                    room => !uploadedClasses.some(c => c.classRoom === room)
                  );
                  periodClasses = manualClassRooms.map(room => ({ id: 'manual_'+room, classRoom: room, period: 'Outros' }));
                } else {
                  periodClasses = uploadedClasses.filter(c => c.period === selectedPeriod || (!c.period && selectedPeriod === 'Manhã'));
                }
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
                            <option value="Outros">Outros</option>
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
                    <div key={school.id} className="group flex flex-col justify-center bg-white dark:bg-[#1e1b2e] p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:border-blue-300 dark:hover:border-blue-500/50 transition-colors min-h-[90px]">
                      {editingSchoolId === school.id ? (
                        <form onSubmit={handleUpdateSchool} className="flex flex-col gap-3 w-full">
                          <input type="text" value={editSchoolName} onChange={e => setEditSchoolName(e.target.value)} required placeholder="Nome da Escola" className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                          <input type="text" value={editSchoolCode} onChange={e => setEditSchoolCode(e.target.value)} required placeholder="Código" className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                          <div className="flex justify-end gap-2 mt-2">
                            <button type="button" onClick={() => setEditingSchoolId(null)} className="px-3 py-1.5 text-xs rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 font-semibold transition-colors">Cancelar</button>
                            <button type="submit" className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-semibold shadow-sm transition-colors">Salvar</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex justify-between items-center w-full">
                          <div>
                            <strong className="text-slate-800 dark:text-white text-lg">{school.name}</strong>
                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Código: <span className="text-blue-600 dark:text-blue-400">{school.code}</span></div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingSchoolId(school.id); setEditSchoolName(school.name); setEditSchoolCode(school.code); }} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Editar">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button onClick={() => handleDeleteSchool(school.id)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                          </div>
                        </div>
                      )}
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
                          <div className="flex gap-2">
                            <button onClick={() => setEditClassDialog({ isOpen: true, id: c.id, classRoom: c.classRoom, grade: c.grade, period: c.period || '', isTecnico: c.isTecnico || false, students: c.students || [], subjects: c.subjects || [] })} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Editar">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button onClick={() => handleDeleteClass(c.id, c.classRoom)} className="w-12 h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100" title="Excluir">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                          </div>
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
              <header className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 dark:text-white">Habilidades</h1>
                  <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Gerencie a base de habilidades do sistema</p>
                </div>
              </header>

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
      

      {/* Edit Class Modal */}
      {editClassDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-white dark:bg-[#1e1b2e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 transform scale-100 opacity-100 transition-all duration-300">
            <div className="p-6 md:p-8">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Editar Turma</h3>
              <form id="editClassForm" onSubmit={handleUpdateClass} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome da Turma</label>
                  <input type="text" required value={editClassDialog.classRoom} onChange={e => setEditClassDialog({...editClassDialog, classRoom: e.target.value})} className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Série/Ano</label>
                  <input type="text" required value={editClassDialog.grade} onChange={e => setEditClassDialog({...editClassDialog, grade: e.target.value})} className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Período</label>
                  <select required value={editClassDialog.period} onChange={e => setEditClassDialog({...editClassDialog, period: e.target.value})} className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Noite">Noite</option>
                    <option value="Integral">Integral</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" id="isTecnicoCheck" checked={editClassDialog.isTecnico || false} onChange={e => setEditClassDialog({...editClassDialog, isTecnico: e.target.checked})} className="w-5 h-5 text-blue-600 bg-slate-50 border-slate-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600 cursor-pointer" />
                  <label htmlFor="isTecnicoCheck" className="text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">É turma do técnico?</label>
                </div>
                {editClassDialog.isTecnico && (
                  <div className="flex flex-col gap-2 mt-2">
                    <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Documento de Notas do Técnico (Excel)</label>
                    <input type="file" accept=".xlsx, .xls" onChange={(e) => setTecnicoFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-500/10 dark:file:text-blue-400 hover:file:bg-blue-100 dark:hover:file:bg-blue-500/20 file:transition-colors cursor-pointer"/>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Selecione o arquivo para carregar as matérias e % de acertos (opcional).</p>
                  </div>
                )}
              </form>
            </div>
            <div className="p-4 md:p-6 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex flex-col-reverse md:flex-row justify-end gap-3">
              <button 
                type="button"
                onClick={() => { setEditClassDialog({ ...editClassDialog, isOpen: false }); setTecnicoFile(null); }} 
                className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors w-full md:w-auto"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                form="editClassForm"
                disabled={isUpdatingClass}
                className={`px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-colors w-full md:w-auto flex items-center justify-center gap-2 ${isUpdatingClass ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}
              >
                {isUpdatingClass ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : null}
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dev Panel Modal */}
      {isDevPanelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all duration-300">
          {!isDevAuth ? (
            <div className="bg-white dark:bg-[#1e1b2e] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-white/10 p-6 md:p-8 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-14 h-14 bg-slate-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-slate-600 dark:text-slate-400 mx-auto mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Acesso DEV</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">Insira a senha de desenvolvedor para continuar.</p>
              
              <input 
                type="password"
                placeholder="Senha de acesso..."
                value={devPasswordInput}
                onChange={e => setDevPasswordInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (btoa(devPasswordInput) === import.meta.env.VITE_DEV_HASH) {
                      setIsDevAuth(true);
                      setDevPasswordInput('');
                    } else {
                      showToast("Senha incorreta", "error");
                      setDevPasswordInput('');
                      setIsDevPanelOpen(false);
                    }
                  }
                }}
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 mb-6 outline-none focus:border-blue-500 transition-colors text-center font-medium"
                autoFocus
              />
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => { setIsDevPanelOpen(false); setDevPasswordInput(''); }} 
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors w-full"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    if (btoa(devPasswordInput) === import.meta.env.VITE_DEV_HASH) {
                      setIsDevAuth(true);
                      setDevPasswordInput('');
                    } else {
                      showToast("Senha incorreta", "error");
                      setDevPasswordInput('');
                      setIsDevPanelOpen(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/30 transition-colors w-full"
                >
                  Entrar
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1e1b2e] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-white/10 transform scale-100 opacity-100 transition-all duration-300 animate-in fade-in zoom-in duration-200">
              <div className="p-6 md:p-8 flex flex-col gap-6">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                  <h3 className="text-2xl font-bold">Painel DEV</h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Utilize as opções abaixo apenas em ambiente de desenvolvimento para facilitar seus testes.
                </p>
                
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => { handleDeleteAllReports(); setIsDevPanelOpen(false); setIsDevAuth(false); }}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-white/10 rounded-xl transition-colors group"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400">Apagar Todos os Relatórios</span>
                    <svg className="text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <button 
                    onClick={() => { handleDeleteAllSkills(); setIsDevPanelOpen(false); setIsDevAuth(false); }}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-white/10 rounded-xl transition-colors group"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-red-600 dark:group-hover:text-red-400">Apagar Todas as Habilidades</span>
                    <svg className="text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
              <div className="p-4 md:p-6 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 flex justify-end">
                <button 
                  onClick={() => { setIsDevPanelOpen(false); setIsDevAuth(false); }} 
                  className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
