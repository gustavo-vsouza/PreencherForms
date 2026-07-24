import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Combobox } from './Combobox';
import '../index.css';

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
  
  // Custom Modal (Alert/Confirm)
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  } | null>(null);

  // Uploaded Classes (Excel)
  const [uploadedClasses, setUploadedClasses] = useState<any[]>([]);
  const [skillsData, setSkillsData] = useState<any[]>([]);
  const [showLowScoresOnly, setShowLowScoresOnly] = useState(false);

  useEffect(() => {
    const fetchUploadedClassesAndSkills = async () => {
      try {
        const qClasses = query(collection(db, 'uploaded_classes'), where('schoolCode', '==', schoolCode));
        const snapClasses = await getDocs(qClasses);
        setUploadedClasses(snapClasses.docs.map(doc => doc.data()));

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
        .replace(/°/g, "o") // Símbolo de grau, muito comum em teclados
        .replace(/ª/g, "a")
        .replace(/\s+/g, " ")
        .trim();
    };
    
    const normGrade = normalizeString(grade);
    const normSubject = normalizeString(globalInfo.subject);
    
    console.log("TeacherView: Buscando habilidades para", { normGrade, normSubject, skillsDataCount: skillsData.length });
    
    const matchingSkills = skillsData
      .filter(s => {
         const sGrade = normalizeString(s.grade);
         const sSubject = normalizeString(s.subject);
         
         // We do a partial match for grade too, e.g. "6o ano" vs "6 ano"
         // but let's just stick to exact or very close.
         // Wait, the grade from select is "6o ano". The grade from excel might be "6 ano" or "6a serie".
         const gradeMatch = sGrade === normGrade || sGrade.includes(normGrade) || normGrade.includes(sGrade);
         const subjectMatch = sSubject.includes(normSubject) || normSubject.includes(sSubject);
         
         return gradeMatch && subjectMatch;
      })
      .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
      
    console.log("TeacherView: Habilidades encontradas:", matchingSkills);
    
    return matchingSkills.length > 0 ? matchingSkills[0].skills : [];
  }, [selectedUploadedClass, globalInfo.subject, skillsData]);

  const handleClassComboboxChange = (val: string) => {
    setGlobalInfo(prev => {
      if (prev.classRoom === val) return prev; // Do nothing if it's the same
      return { ...prev, classRoom: val, subject: '' };
    });
  };

  const handleSubjectComboboxChange = (val: string) => {
    setGlobalInfo(prev => {
      // Se a disciplina for a mesma, não fazemos nada para não apagar o preenchimento do professor
      if (prev.subject === val) return prev;
      return { ...prev, subject: val };
    });
    
    // Check if the val changed compared to current state before wiping students
    if (val === globalInfo.subject) return;

    if (selectedUploadedClass && val) {
      // Auto populate students only if the subject exactly matches an available one
      if (selectedUploadedClass.subjects.includes(val)) {
        const newStudents = selectedUploadedClass.students.map((s: any) => ({
          name: s.name,
          unreachedSkill: '',
          actionPlan: '',
          score: s.scores[val] !== undefined ? s.scores[val] : undefined
        }));
        setStudents(newStudents);
        setShowLowScoresOnly(false); // Reset filter
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
    // Se o aluno foi inserido manualmente (não tem score), ele NUNCA deve sumir
    if (s.score === undefined) return true;
    return s.score < 0.5;
  });

  const showAlert = (title: string, message: string) => {
    setModalConfig({ title, message, type: 'alert' });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ title, message, type: 'confirm', onConfirm });
  };

  const closeModal = () => {
    setModalConfig(null);
  };

  const handleStartNewClass = () => {
    showConfirm(
      'Iniciar Nova Turma',
      'Você ainda não gerou os relatórios desta turma. Tem certeza que deseja descartar os dados atuais e iniciar uma nova?',
      () => {
        setGlobalInfo(prev => ({ ...prev, classRoom: '', subject: '' }));
        setStudents([{ name: '', unreachedSkill: '', actionPlan: '' }]);
        setExpandedIndex(0);
        closeModal();
      }
    );
  };

  const validateForm = (): boolean => {
    if (visibleStudents.length === 0) {
      showAlert("Atenção", "Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.");
      return false;
    }

    if (!globalInfo.teacherName.trim() || !globalInfo.classRoom.trim() || !globalInfo.subject.trim()) {
      showAlert("Dados Globais Incompletos", "Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).");
      return false;
    }
    
    for (let i = 0; i < visibleStudents.length; i++) {
      const s = visibleStudents[i];
      if (!s.name.trim() || !s.unreachedSkill.trim() || !s.actionPlan.trim()) {
        showAlert("Dados do Aluno Incompletos", `Por favor, preencha todos os campos obrigatórios do aluno ${i + 1} (${s.name || 'Sem nome'}).`);
        return false;
      }
    }
    return true;
  };

  const handleGenerateClick = () => {
    if (!validateForm()) return;
    
    showConfirm(
      'Gerar Relatórios',
      `Você tem certeza que os ${visibleStudents.length} alunos listados estão concluídos? Essa ação irá baixar os PDFs e enviar os dados para a coordenação.`,
      generateReports
    );
  };

  const generateReports = async () => {
    closeModal();
    setIsModalOpen(true);

    try {
      const { jsPDF } = await import('jspdf');
      const JSZip = (await import('jszip')).default;

      const zip = new JSZip();
      const folderName = `${globalInfo.subject} - ${globalInfo.classRoom}`;
      const folder = zip.folder(folderName);

      // We only generate for visibleStudents (the ones who weren't filtered out)
      for (let i = 0; i < visibleStudents.length; i++) {
        const student = visibleStudents[i];
        const doc = new jsPDF();
        
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        let y = margin;

        // Header Background
        doc.setFillColor(37, 99, 235); // var(--accent-primary)
        doc.rect(0, 0, pageWidth, 40, 'FD');

        // Header Text
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Plano de Ação", margin, 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const dateStr = new Date().toLocaleDateString('pt-BR');
        doc.text(`Data: ${dateStr}`, pageWidth - margin - 30, 25);

        y = 55;

        // Global Info Section
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

        // Separator
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        // Student Header
        doc.setFillColor(240, 249, 255);
        doc.rect(margin, y, contentWidth, 12, 'FD');
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        
        // Prevent jsPDF encoding errors
        const safeStudentName = student.name.replace(/[^\x20-\xFF]/g, '');
        const scoreText = student.score !== undefined ? ` (Acerto: ${(student.score * 100).toFixed(1)}%)` : '';
        doc.text(`Nome do Estudante: ${safeStudentName}${scoreText}`, margin + 3, y + 8);
        y += 20;

        // Helper for text areas
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

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(`Documento gerado em ${dateStr} - ${schoolName}`, margin, 285);

        // Save PDF to ZIP folder
        const normalizedName = student.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const safeName = normalizedName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || `aluno_${i+1}`;
        const pdfArrayBuffer = doc.output('arraybuffer');
        folder?.file(`relatorio_${safeName}.pdf`, pdfArrayBuffer);
      }

      // Upload simple log to Firestore
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
      showAlert("Erro", "Ocorreu um erro ao gerar os relatórios. Verifique o console.");
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="container">
      <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Gestão de relatórios</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{schoolName}</p>
        </div>
        <button className="btn btn-outline" onClick={onLogout}>Sair</button>
      </header>

      <section className="section-panel global-info">
        <h2 style={{ color: 'var(--accent-primary)', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Informações Globais
        </h2>
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="teacherName">1. Nome do Professor(a)</label>
            <input type="text" id="teacherName" placeholder="Ex: Maria Silva" value={globalInfo.teacherName} onChange={(e) => setGlobalInfo({ ...globalInfo, teacherName: e.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor="classRoom">2. Turma</label>
            <Combobox 
              options={uploadedClasses.map(c => c.classRoom)}
              value={globalInfo.classRoom}
              onChange={handleClassComboboxChange}
              placeholder="Digite ou selecione a turma..."
              id="classRoom"
            />
          </div>
          <div className="form-group">
            <label htmlFor="subject">3. Disciplina</label>
            {selectedUploadedClass ? (
              <Combobox 
                options={selectedUploadedClass.subjects}
                value={globalInfo.subject}
                onChange={handleSubjectComboboxChange}
                placeholder="Ex: PORT (Digite ou selecione)"
                id="subject"
              />
            ) : (
              <input type="text" id="subject" placeholder="Ex: Ciências" value={globalInfo.subject} onChange={(e) => setGlobalInfo({ ...globalInfo, subject: e.target.value })} />
            )}
          </div>
        </div>
      </section>

      <section className="section-panel students-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <h2 style={{ color: 'var(--accent-primary)', margin: 0 }}>
            Dados dos Alunos
          </h2>
          {selectedUploadedClass && globalInfo.subject && (
            <button 
              className={`filter-pill ${showLowScoresOnly ? 'active' : ''}`}
              onClick={() => setShowLowScoresOnly(!showLowScoresOnly)}
              title="Mostrar apenas alunos com menos de 50% de acerto"
            >
              {showLowScoresOnly ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Mostrando Acertos &lt; 50%
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                  Filtrar Acertos &lt; 50%
                </>
              )}
            </button>
          )}
        </div>

        {visibleStudents.map((student, index) => {
          // Find original index in the main array for updating
          const originalIndex = students.indexOf(student);
          
          return (
            <div key={originalIndex} className="student-card">
              <div 
                className={`student-header ${expandedIndex === originalIndex ? 'expanded' : ''}`}
                onClick={() => toggleAccordion(originalIndex)}
              >
                <div className="student-title">
                  <span className="student-number">{index + 1}</span>
                  <span className="student-name">
                    {student.name || 'Novo Aluno'}
                    {student.score !== undefined && (
                      <span className={`score-badge ${student.score < 0.5 ? 'score-low' : 'score-high'}`}>
                        {(student.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    className="btn-icon delete-btn" 
                    onClick={(e) => { 
                      e.stopPropagation();
                      showConfirm(
                        'Remover Aluno',
                        'Tem certeza que deseja remover este aluno da lista?',
                        () => {
                          removeStudent(originalIndex);
                          closeModal();
                        }
                      );
                    }}
                    title="Remover Aluno"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                  <svg className={`chevron ${expandedIndex === originalIndex ? 'rotated' : ''}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
              </div>
              
              <div className={`student-body ${expandedIndex === originalIndex ? 'open' : ''}`}>
                <div className="form-group">
                  <label>Nome do aluno:</label>
                  <input type="text" placeholder="Nome completo" value={student.name} onChange={(e) => updateStudent(originalIndex, 'name', e.target.value)} disabled={!!selectedUploadedClass && student.score !== undefined} />
                </div>
                
                <div className="form-group">
                  <label>Qual habilidade o aluno não alcançou?</label>
                  <Combobox
                    options={availableSkills.length > 0 ? availableSkills : ['Nenhuma habilidade filtrada encontrada']}
                    value={student.unreachedSkill}
                    onChange={(val) => updateStudent(originalIndex, 'unreachedSkill', val === 'Nenhuma habilidade filtrada encontrada' ? '' : val)}
                    placeholder="Selecione ou digite a habilidade..."
                  />
                </div>
                
                <div className="form-group">
                  <label>Plano de ação:</label>
                  <textarea placeholder="O que será feito..." value={student.actionPlan} onChange={(e) => updateStudent(originalIndex, 'actionPlan', e.target.value)} rows={3} />
                </div>
              </div>
            </div>
          )
        })}

        <button className="btn btn-outline btn-block" onClick={addStudent} style={{ marginTop: '1rem', borderStyle: 'dashed' }}>
          + Adicionar Aluno Manualmente
        </button>
      </section>

      <div className="floating-actions">
        <button className="btn btn-primary" onClick={handleGenerateClick}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Gerar {visibleStudents.length} Relatórios
        </button>
        <button className="btn btn-danger" onClick={handleStartNewClass}>
          Iniciar Nova Turma
        </button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content loading">
            <div className="spinner"></div>
            <p>Gerando arquivos PDF, por favor aguarde...</p>
          </div>
        </div>
      )}

      {modalConfig && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{modalConfig.title}</h3>
            <div className="modal-message">{modalConfig.message}</div>
            <div className="modal-actions">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button className="btn btn-outline" onClick={closeModal}>Cancelar</button>
                  <button className="btn btn-primary" onClick={modalConfig.onConfirm}>Confirmar</button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={closeModal}>Entendi</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
