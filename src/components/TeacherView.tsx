import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useNotification } from '../contexts/NotificationContext';
import { Combobox } from './Combobox';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface GlobalInfo {
  teacherName: string;
  classRoom: string;
  subject: string;
}

interface Student {
  name: string;
  unreachedSkill: string;
  actionPlan: string;
  score?: number;
}

interface TeacherViewProps {
  schoolCode: string;
  schoolName: string;
  onLogout: () => void;
}

export function TeacherView({ schoolCode, schoolName, onLogout }: TeacherViewProps) {
  const [globalInfo, setGlobalInfo] = useState<GlobalInfo>({
    teacherName: '',
    classRoom: '',
    subject: ''
  });

  const [students, setStudents] = useState<Student[]>([{ name: '', unreachedSkill: '', actionPlan: '' }]);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchStudentNames, setBatchStudentNames] = useState('');
  
  // Custom Modal (Alert/Confirm)
  const { showToast, showConfirm } = useNotification();

  // Uploaded Classes (Excel)
  const [uploadedClasses, setUploadedClasses] = useState<any[]>([]);
  const [skillsData, setSkillsData] = useState<any[]>([]);
  const [showLowScoresOnly, setShowLowScoresOnly] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    gsap.fromTo('.stagger-fade', 
      { opacity: 0, y: 30 }, 
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
    );
  }, { scope: containerRef });

  useEffect(() => {
    const fetchUploadedClassesAndSkills = async () => {
      try {
        const qClasses = query(collection(db, 'uploaded_classes'), where('schoolCode', '==', schoolCode));
        const snapClasses = await getDocs(qClasses);
        const fetchedClasses = snapClasses.docs.map(doc => doc.data());
        fetchedClasses.sort((a, b) => (a.classRoom || '').localeCompare(b.classRoom || ''));
        setUploadedClasses(fetchedClasses);

        const qSkills = query(collection(db, 'skills_data'), where('schoolCode', '==', schoolCode));
        const snapSkills = await getDocs(qSkills);
        setSkillsData(snapSkills.docs.map(doc => doc.data()));
      } catch (err) {
        console.error("Erro ao carregar dados", err);
      }
    };
    fetchUploadedClassesAndSkills();
  }, [schoolCode]);

  const selectedUploadedClass = uploadedClasses.find(c => c.classRoom === globalInfo.classRoom);

  const availableSkills = useMemo(() => {
    if (!selectedUploadedClass || !globalInfo.subject) return [];
    const grade = selectedUploadedClass.grade;
    if (!grade) return [];

    const normalizeString = (str: string) => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/º/g, "o")
        .replace(/°/g, "o") 
        .replace(/ª/g, "a")
        .replace(/\s+/g, " ")
        .trim();
    };
    
    const normGrade = normalizeString(grade);
    const normSubject = normalizeString(globalInfo.subject);
    
    const matchingSkills = skillsData
      .filter(s => {
         const sGrade = normalizeString(s.grade);
         const sSubject = normalizeString(s.subject);
         const gradeMatch = sGrade === normGrade || sGrade.includes(normGrade) || normGrade.includes(sGrade);
         const subjectMatch = sSubject.includes(normSubject) || normSubject.includes(sSubject);
         return gradeMatch && subjectMatch;
      })
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
      
    return matchingSkills.length > 0 ? matchingSkills[0].skills : [];
  }, [selectedUploadedClass, globalInfo.subject, skillsData]);

  const handleClassComboboxChange = (val: string) => {
    setGlobalInfo(prev => {
      if (prev.classRoom === val) return prev; 
      return { ...prev, classRoom: val, subject: '' };
    });
  };

  const handleSubjectComboboxChange = (val: string) => {
    setGlobalInfo(prev => {
      if (prev.subject === val) return prev;
      return { ...prev, subject: val };
    });
    
    if (val === globalInfo.subject) return;

    if (selectedUploadedClass && val) {
      if (selectedUploadedClass.subjects.includes(val)) {
        const newStudents = selectedUploadedClass.students.map((s: any) => ({
          name: s.name,
          unreachedSkill: '',
          actionPlan: '',
          score: s.scores[val] !== undefined ? s.scores[val] : undefined
        }));
        setStudents(newStudents);
        setShowLowScoresOnly(false);
      }
    }
  };

  const toggleAccordion = (index: number) => {
    setExpandedIndex(index === expandedIndex ? -1 : index);
  };

  const addStudent = () => {
    setStudents([...students, { name: '', unreachedSkill: '', actionPlan: '' }]);
    setExpandedIndex(students.length);
  };

  const handleBatchAddStudents = () => {
    const names = batchStudentNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) {
      showToast("Insira pelo menos um nome.", "warning");
      return;
    }
    
    let currentStudents = [...students];
    if (currentStudents.length === 1 && !currentStudents[0].name && !currentStudents[0].unreachedSkill && !currentStudents[0].actionPlan) {
      currentStudents = [];
    }

    const newStudents = names.map(name => ({ name, unreachedSkill: '', actionPlan: '' }));
    setStudents([...currentStudents, ...newStudents]);
    setIsBatchModalOpen(false);
    setBatchStudentNames('');
    showToast(`${names.length} alunos adicionados!`, "success");
  };

  const removeStudent = (index: number) => {
    const newStudents = students.filter((_, i) => i !== index);
    setStudents(newStudents);
  };

  const updateStudent = (index: number, field: keyof Student, value: string) => {
    const newStudents = [...students];
    newStudents[index] = { ...newStudents[index], [field]: value };
    setStudents(newStudents);
  };

  const visibleStudents = students.filter(s => {
    if (!showLowScoresOnly) return true;
    if (s.score === undefined) return true;
    return s.score < 0.5;
  });


  const handleStartNewClass = () => {
    showConfirm(
      'Iniciar Nova Turma',
      'Você ainda não gerou os relatórios desta turma. Tem certeza que deseja descartar os dados atuais e iniciar uma nova?',
      () => {
        setGlobalInfo({ teacherName: '', classRoom: '', subject: '' });
        setStudents([{ name: '', unreachedSkill: '', actionPlan: '' }]);
        setExpandedIndex(0);
      }
    );
  };

  const validateForm = (): boolean => {
    if (visibleStudents.length === 0) {
      showToast("Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.", "warning");
      return false;
    }

    if (!globalInfo.teacherName.trim() || !globalInfo.classRoom.trim() || !globalInfo.subject.trim()) {
      showToast("Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).", "warning");
      return false;
    }
    
    for (let i = 0; i < visibleStudents.length; i++) {
      const s = visibleStudents[i];
      if (!s.name.trim() || !s.unreachedSkill.trim() || !s.actionPlan.trim()) {
        showToast(`Por favor, preencha todos os campos do aluno ${i + 1} (${s.name || 'Sem nome'}).`, "warning");
        return false;
      }
    }
    return true;
  };

  const handleGenerateClick = () => {
    if (!validateForm()) return;
    
    showConfirm(
      'Gerar Relatórios',
      `Você tem certeza que os ${visibleStudents.length} alunos listados estão concluídos?`,
      generateReports
    );
  };

  const generateReports = async () => {
    setIsModalOpen(true);

    try {
      const { jsPDF } = await import('jspdf');
      const JSZip = (await import('jszip')).default;

      const zip = new JSZip();
      const folderName = `${globalInfo.subject} - ${globalInfo.classRoom}`;
      const folder = zip.folder(folderName);

      for (let i = 0; i < visibleStudents.length; i++) {
        const student = visibleStudents[i];
        const doc = new jsPDF();
        
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageWidth, 40, 'FD');

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Plano de Ação", margin, 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`Data: ${dateStr}`, pageWidth - margin - 30, 25);

        y = 55;

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Informações da Turma", margin, y);
        y += 10;

        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Professor: ${globalInfo.teacherName}`, margin, y);
        y += 7;
        doc.text(`Turma: ${globalInfo.classRoom}`, margin, y);
        y += 7;
        doc.text(`Disciplina: ${globalInfo.subject}`, margin, y);
        y += 15;

        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        doc.setFillColor(240, 249, 255);
        doc.rect(margin, y, contentWidth, 12, 'FD');
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        const safeStudentName = student.name.replace(/[^\x20-\xFF]/g, '');
        const scoreText = student.score !== undefined ? ` (Acerto: ${(student.score * 100).toFixed(1)}%)` : '';
        doc.text(`Nome do Estudante: ${safeStudentName}${scoreText}`, margin + 3, y + 8);
        y += 20;

        const addTextArea = (title: string, text: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(title, margin, y);
          y += 7;
          
          doc.setFont("helvetica", "normal");
          const splitText = doc.splitTextToSize(text, contentWidth - 6);
          const blockHeight = splitText.length * 6 + 6;

          doc.setDrawColor(200, 200, 200);
          doc.setFillColor(255, 255, 255);
          doc.rect(margin, y, contentWidth, blockHeight, 'FD');
          doc.text(splitText, margin + 3, y + 6);
          
          y += blockHeight + 10;
        };

        addTextArea("Habilidade não alcançada:", student.unreachedSkill);
        addTextArea("Plano de ação:", student.actionPlan);

        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Documento gerado em ${dateStr} - ${schoolName}`, margin, 285);

        const normalizedName = student.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const safeName = normalizedName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `aluno_${i+1}`;
        const pdfArrayBuffer = doc.output('arraybuffer');
        folder?.file(`relatorio_${safeName}.pdf`, pdfArrayBuffer);
      }

      await addDoc(collection(db, 'reports'), {
        schoolCode,
        teacherName: globalInfo.teacherName,
        classRoom: globalInfo.classRoom,
        subject: globalInfo.subject,
        students: visibleStudents.map(s => ({
          name: s.name,
          unreachedSkill: s.unreachedSkill,
          actionPlan: s.actionPlan,
          score: s.score || null
        })),
        createdAt: new Date().toISOString()
      });

      const zipContent = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipContent);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folderName}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error(error);
      showToast("Ocorreu um erro ao gerar os relatórios. Verifique o console.", "error");
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="max-w-6xl mx-auto px-6 py-12 pb-32">
      <header className="stagger-fade flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-white dark:to-blue-200">
            Gestão de Relatórios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider text-sm font-semibold">{schoolName}</p>
        </div>
        <button 
          onClick={onLogout}
          className="px-5 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Global Info */}
      <section className="stagger-fade relative z-50 bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-8 mb-8 shadow-sm">
        <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">1</div>
          Informações Globais
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="teacherName" className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome do Professor(a)</label>
            <input 
              type="text" 
              id="teacherName" 
              placeholder="Ex: Maria Silva" 
              value={globalInfo.teacherName} 
              onChange={(e) => setGlobalInfo({ ...globalInfo, teacherName: e.target.value })}
              className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-2 relative z-50">
            <label htmlFor="classRoom" className="text-sm font-semibold text-slate-600 dark:text-slate-400">Turma</label>
            <Combobox 
              options={uploadedClasses.map(c => c.classRoom)}
              value={globalInfo.classRoom}
              onChange={handleClassComboboxChange}
              placeholder="Selecione a turma..."
              id="classRoom"
            />
          </div>
          <div className="flex flex-col gap-2 relative z-40">
            <label htmlFor="subject" className="text-sm font-semibold text-slate-600 dark:text-slate-400">Disciplina</label>
            {selectedUploadedClass ? (
              <Combobox 
                options={selectedUploadedClass.subjects.filter((s: string) => !s.includes('(%) Participação') && !s.includes('(%) Acertos'))}
                value={globalInfo.subject}
                onChange={handleSubjectComboboxChange}
                placeholder="Ex: PORT"
                id="subject"
              />
            ) : (
              <input 
                type="text" 
                id="subject" 
                placeholder="Ex: Ciências" 
                value={globalInfo.subject} 
                onChange={(e) => setGlobalInfo({ ...globalInfo, subject: e.target.value })}
                className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors"
              />
            )}
          </div>
        </div>
      </section>

      {/* Students Section */}
      <section className="stagger-fade relative z-40 bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">2</div>
            Dados dos Alunos
          </h2>
          {selectedUploadedClass && globalInfo.subject && (
            <button 
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 border ${showLowScoresOnly ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-blue-500'}`}
              onClick={() => setShowLowScoresOnly(!showLowScoresOnly)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {showLowScoresOnly ? <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path> : <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>}
                {showLowScoresOnly ? <polyline points="22 4 12 14.01 9 11.01"></polyline> : null}
              </svg>
              {showLowScoresOnly ? 'Mostrando Acertos < 50%' : 'Filtrar Acertos < 50%'}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {visibleStudents.map((student, index) => {
            const originalIndex = students.indexOf(student);
            const isOpen = expandedIndex === originalIndex;
            
            return (
              <div key={originalIndex} className={`relative border ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20 z-50 overflow-visible' : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-white/30 z-10 overflow-hidden'} rounded-2xl transition-all duration-300 bg-slate-50 dark:bg-black/20`}>
                <div 
                  className={`flex justify-between items-center p-4 md:p-5 cursor-pointer select-none transition-colors ${isOpen ? 'bg-blue-50/50 dark:bg-blue-900/20 rounded-t-2xl' : 'rounded-2xl'}`}
                  onClick={() => toggleAccordion(originalIndex)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
                      {index + 1}
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {student.name || 'Novo Aluno'}
                      </span>
                      {student.score !== undefined && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${student.score < 0.5 ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'}`}>
                          {(student.score * 100).toFixed(0)}% de acerto
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation();
                        showConfirm('Remover Aluno', 'Tem certeza que deseja remover este aluno?', () => { removeStudent(originalIndex); });
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
                
                <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  <div className="p-5 md:p-6 bg-white dark:bg-[#1e1b2e] border-t border-slate-100 dark:border-white/5 flex flex-col gap-5 rounded-b-2xl">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Nome do aluno</label>
                      <input 
                        type="text" 
                        value={student.name} 
                        onChange={(e) => updateStudent(originalIndex, 'name', e.target.value)} 
                        disabled={!!selectedUploadedClass && student.score !== undefined}
                        className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div className="flex flex-col gap-2 relative z-30">
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Habilidade não alcançada</label>
                      <Combobox
                        options={availableSkills.length > 0 ? availableSkills : ['Nenhuma habilidade filtrada encontrada']}
                        value={student.unreachedSkill}
                        onChange={(val) => updateStudent(originalIndex, 'unreachedSkill', val === 'Nenhuma habilidade filtrada encontrada' ? '' : val)}
                        placeholder="Selecione ou digite a habilidade..."
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-slate-600 dark:text-slate-400">Plano de ação</label>
                      <textarea 
                        value={student.actionPlan} 
                        onChange={(e) => updateStudent(originalIndex, 'actionPlan', e.target.value)} 
                        rows={3}
                        placeholder="O que será feito..."
                        className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors resize-y min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-6 w-full">
          <button 
            onClick={addStudent} 
            className="flex-1 py-4 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl text-slate-500 dark:text-slate-400 font-semibold hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
          >
            + Adicionar Aluno Manualmente
          </button>
          <button 
            onClick={() => setIsBatchModalOpen(true)} 
            className="flex-1 py-4 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl text-slate-500 dark:text-slate-400 font-semibold hover:border-green-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
          >
            + Adicionar Alunos em Lote
          </button>
        </div>
      </section>

      {/* Floating Actions */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40 flex flex-col sm:flex-row gap-3">
        <button 
          onClick={handleStartNewClass}
          className="px-6 py-3 rounded-xl bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 text-red-500 font-semibold shadow-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors order-2 sm:order-1"
        >
          Nova Turma
        </button>
        <button 
          onClick={handleGenerateClick}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-95 transition-all order-1 sm:order-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Gerar {visibleStudents.length} Relatórios
        </button>
      </div>

      {/* Modals */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-8 max-w-lg w-full shadow-2xl flex flex-col">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Adicionar Alunos em Lote</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Cole ou digite o nome de cada aluno em uma linha separada.</p>
            
            <textarea
              value={batchStudentNames}
              onChange={(e) => setBatchStudentNames(e.target.value)}
              rows={8}
              placeholder="Exemplo:&#10;Maria Silva&#10;João Souza&#10;Pedro Santos"
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500 transition-colors resize-y mb-6"
            />
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => { setIsBatchModalOpen(false); setBatchStudentNames(''); }}
                className="px-6 py-3 rounded-xl border border-slate-300 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBatchAddStudents}
                className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold shadow-lg shadow-green-500/30 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-[#1e1b2e] border border-slate-200 dark:border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="font-semibold text-slate-800 dark:text-white text-center">Gerando arquivos PDF, por favor aguarde...</p>
          </div>
        </div>
      )}


    </div>
  );
}
