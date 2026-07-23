import { useState, useEffect } from 'react';
import './index.css';

interface GlobalInfo {
  teacherName: string;
  classRoom: string;
  subject: string;
}

interface Student {
  id: string;
  name: string;
  level: string; // Always "Abaixo do básico"
  progress: string;
  skills: string;
  difficulties: string;
  interventions: string;
  observations: string;
  isExpanded?: boolean;
}

const PROGRESS_OPTIONS = [
  "Permaneceu no mesmo nível",
  "Evoluiu um nível",
  "Evoluiu dois níveis",
  "Regrediu um nível"
];

function App() {
  const [globalInfo, setGlobalInfo] = useState<GlobalInfo>({
    teacherName: '',
    classRoom: '',
    subject: '',
  });

  const [students, setStudents] = useState<Student[]>([]);

  const [bulkNames, setBulkNames] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [hasGeneratedReports, setHasGeneratedReports] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedGlobal = localStorage.getItem('globalInfo');
    if (savedGlobal) setGlobalInfo(JSON.parse(savedGlobal));
    
    const savedStudents = localStorage.getItem('students');
    if (savedStudents) setStudents(JSON.parse(savedStudents));

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('globalInfo', JSON.stringify(globalInfo));
    localStorage.setItem('students', JSON.stringify(students));
  }, [globalInfo, students]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleGlobalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGlobalInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentChange = (id: string, field: keyof Student, value: string | boolean) => {
    setStudents(prev => prev.map(student => 
      student.id === id ? { ...student, [field]: value } : student
    ));
  };

  const addStudent = () => {
    setStudents(prev => [
      ...prev,
      { 
        id: crypto.randomUUID(), 
        name: '', 
        level: 'Abaixo do básico',
        progress: '',
        skills: '',
        difficulties: '',
        interventions: '',
        observations: '',
        isExpanded: true
      }
    ]);
  };

  const removeStudent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const duplicateStudent = (student: Student, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStudent = { ...student, id: crypto.randomUUID(), name: student.name + ' (Cópia)', isExpanded: true };
    setStudents(prev => [...prev, newStudent]);
  };

  const toggleStudentExpansion = (id: string) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s));
  };

  const handleBulkAdd = () => {
    const names = bulkNames.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) return;
    
    const newStudents = names.map(name => ({
      id: crypto.randomUUID(),
      name,
      level: 'Abaixo do básico',
      progress: '',
      skills: '',
      difficulties: '',
      interventions: '',
      observations: '',
      isExpanded: false
    }));
    
    // if the list is empty, just replace it
    if (students.length === 0) {
      setStudents(newStudents);
    } else {
      setStudents(prev => [...prev, ...newStudents]);
    }
    setBulkNames('');
  };

  const startNewClass = () => {
    if (students.length === 0) return;

    if (!hasGeneratedReports) {
      if (!confirm('⚠️ ATENÇÃO: Você ainda não gerou (baixou) os relatórios desta turma!\n\nTem certeza que deseja apagar todos os alunos e iniciar uma nova turma?')) {
        return;
      }
    } else {
      if (!confirm('Isso excluirá todos os alunos da lista atual. O nome do professor e os dados da turma serão mantidos. Tem certeza?')) {
        return;
      }
    }
    
    setStudents([]);
    setHasGeneratedReports(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key === 'Tab' && index === students.length - 1 && field === 'observations') {
      e.preventDefault();
      addStudent();
    }
  };


  const validateForm = (): boolean => {
    if (students.length === 0) {
      alert("Por favor, adicione pelo menos um aluno antes de gerar os relatórios.");
      return false;
    }

    if (!globalInfo.teacherName.trim() || !globalInfo.classRoom.trim() || !globalInfo.subject.trim()) {
      alert("Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).");
      return false;
    }
    
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name.trim() || !s.progress || !s.skills.trim() || !s.difficulties.trim() || !s.interventions.trim() || !s.observations.trim()) {
        alert(`Por favor, preencha todos os campos obrigatórios do aluno ${i + 1} (${s.name || 'Sem nome'}).`);
        return false;
      }
    }
    return true;
  };

  const generateReports = async () => {
    if (!validateForm()) return;

    const { jsPDF } = await import('jspdf');
    const JSZip = (await import('jszip')).default;

    const zip = new JSZip();
    const folderName = `${globalInfo.subject || 'Materia'} - ${globalInfo.classRoom || 'Turma'}`;
    const folder = zip.folder(folderName);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const doc = new jsPDF();
      
      const margin = 20;
      let y = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - margin * 2;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > 280) {
          doc.addPage();
          y = 20;
        }
      };

      // School Institutional Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text("E. E. PREFEITO ANTÔNIO PRÁTICI", pageWidth / 2, y, { align: "center" });
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("GOVERNO DO ESTADO DE SÃO PAULO", pageWidth / 2, y, { align: "center" });
      y += 4;
      doc.text("Secretaria da Educação", pageWidth / 2, y, { align: "center" });
      y += 10;

      // Report Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("RELATÓRIO INDIVIDUAL DE APRENDIZAGEM", pageWidth / 2, y, { align: "center" });
      y += 8;

      // Separator
      doc.setDrawColor(150, 150, 150);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Global Information Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, contentWidth, 25, 'FD');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      
      doc.text(`Professor(a):`, margin + 3, y + 6);
      doc.setFont("helvetica", "normal");
      doc.text(`${globalInfo.teacherName}`, margin + 28, y + 6);

      doc.setFont("helvetica", "bold");
      doc.text(`Turma:`, margin + 3, y + 14);
      doc.setFont("helvetica", "normal");
      doc.text(`${globalInfo.classRoom}`, margin + 18, y + 14);

      doc.setFont("helvetica", "bold");
      doc.text(`Disciplina:`, margin + 3, y + 22);
      doc.setFont("helvetica", "normal");
      doc.text(`${globalInfo.subject}`, margin + 23, y + 22);
      y += 35;

      // Student Header
      doc.setFillColor(240, 249, 255);
      doc.rect(margin, y, contentWidth, 12, 'FD');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Nome do Estudante: ${student.name}`, margin + 3, y + 8);
      y += 20;

      // Level
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`5. Nível de aprendizagem:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(student.level, margin, y + 6);
      y += 14;

      // Progress
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(`6. Em relação à última avaliação, os estudantes:`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(student.progress, margin, y + 6);
      y += 14;

      // Helper for text areas
      const writeSection = (title: string, content: string) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 33, 33);
        const titleLines = doc.splitTextToSize(title, contentWidth);
        checkPageBreak(titleLines.length * 6 + 10);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 6 + 2;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        const textLines = doc.splitTextToSize(content, contentWidth);
        checkPageBreak(textLines.length * 6 + 10);
        doc.text(textLines, margin, y);
        y += textLines.length * 6 + 6;
      };

      writeSection("7. Quais habilidades apresentaram maior evolução?", student.skills);
      writeSection("8. Quais dificuldades ainda persistem?", student.difficulties);
      writeSection("9. Quais intervenções serão realizadas?", student.interventions);
      writeSection("10. Observações", student.observations);

      // Footer on the last page
      checkPageBreak(20);
      y += 10;

      const dateStr = new Date().toLocaleDateString('pt-BR');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Documento gerado em ${dateStr} - E. E. Prefeito Antônio Prátici`, margin, 285);

      // Save PDF to ZIP folder
      const safeName = student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const pdfArrayBuffer = doc.output('arraybuffer');
      folder?.file(`relatorio_${safeName}.pdf`, pdfArrayBuffer);
    }
    
    // Generate ZIP and trigger download
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setHasGeneratedReports(true);
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '1rem' }}>
        <button className="btn btn-outline" onClick={toggleTheme}>
          {isDarkMode ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
        </button>
      </div>
      
      <header className="header">
        <h1>E. E. Prefeito Antônio Prátici</h1>
        <p>Sistema de Gerenciamento e Emissão de Relatórios Individuais de Aprendizagem.</p>
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8 }}>Autosalvamento ativo. Seus dados estão seguros neste navegador.</p>
      </header>

      <section className="section-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: 0 }}>Informações Globais</h2>
        </div>
        <button className="btn btn-danger" onClick={startNewClass}>
          ⟲ Iniciar Nova Turma
        </button>
      </section>

      <section className="section-panel">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="teacherName">1. Professor(a) *</label>
            <input
              type="text"
              id="teacherName"
              name="teacherName"
              placeholder="Ex: Prof. João Silva"
              value={globalInfo.teacherName}
              onChange={handleGlobalChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="classRoom">2. Turma *</label>
            <input
              type="text"
              id="classRoom"
              name="classRoom"
              placeholder="Ex: 8º Ano A"
              value={globalInfo.classRoom}
              onChange={handleGlobalChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="subject">3. Disciplina *</label>
            <input
              type="text"
              id="subject"
              name="subject"
              placeholder="Ex: Matemática"
              value={globalInfo.subject}
              onChange={handleGlobalChange}
            />
          </div>
        </div>
      </section>

      <section className="section-panel">
        <h2>Adicionar Nomes em Lote</h2>
        <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Cole uma lista de nomes de alunos (um por linha) para gerar os formulários automaticamente.</p>
        <textarea 
          className="bulk-add-textarea" 
          placeholder="Maria da Silva&#10;João de Souza&#10;Ana Beatriz"
          value={bulkNames}
          onChange={(e) => setBulkNames(e.target.value)}
        />
        <button className="btn btn-outline" style={{ marginTop: '0.5rem' }} onClick={handleBulkAdd}>
          + Adicionar Lista
        </button>
      </section>

      <section>
        <h2>Avaliações Individuais ({students.length} alunos)</h2>
        {students.map((student, index) => (
          <div key={student.id} className={`student-card ${student.isExpanded ? '' : 'collapsed'}`}>
            <div className="student-card-header" onClick={() => toggleStudentExpansion(student.id)}>
              <h3>
                <span className="student-card-number">{index + 1}</span>
                {student.name || 'Aluno sem nome'}
              </h3>
              <div className="actions-group">
                <button 
                  className="btn btn-outline"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={(e) => duplicateStudent(student, e)}
                  title="Duplicar informações para um novo aluno"
                >
                  ⎘ Clonar
                </button>
                <button 
                  className="btn btn-danger"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={(e) => removeStudent(student.id, e)}
                  title="Remover aluno"
                >
                  ✕ Remover
                </button>
                <svg className="accordion-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            </div>
            
            <div className="student-card-body">
              <div className="form-group">
                <label>4. Nome do estudante *</label>
                <input
                  type="text"
                  placeholder="Nome completo do estudante"
                  value={student.name}
                  onChange={(e) => handleStudentChange(student.id, 'name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>5. Nível de aprendizagem *</label>
                <input
                  type="text"
                  value={student.level}
                  disabled
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>6. Em relação à última avaliação, os estudantes: *</label>
                <select 
                  value={student.progress}
                  onChange={(e) => handleStudentChange(student.id, 'progress', e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    appearance: 'none'
                  }}
                >
                  <option value="" disabled>Selecione uma opção...</option>
                  {PROGRESS_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>7. Quais habilidades apresentaram maior evolução? *</label>
                <textarea
                  placeholder="Descreva as habilidades..."
                  value={student.skills}
                  onChange={(e) => handleStudentChange(student.id, 'skills', e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label>8. Quais dificuldades ainda persistem? *</label>
                <textarea
                  placeholder="Descreva as dificuldades..."
                  value={student.difficulties}
                  onChange={(e) => handleStudentChange(student.id, 'difficulties', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>9. Quais intervenções serão realizadas? *</label>
                <textarea
                  placeholder="Plano de ação e intervenções..."
                  value={student.interventions}
                  onChange={(e) => handleStudentChange(student.id, 'interventions', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>10. Observações *</label>
                <textarea
                  placeholder="Observações adicionais... (Pressione TAB ao final para adicionar novo aluno)"
                  value={student.observations}
                  onChange={(e) => handleStudentChange(student.id, 'observations', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index, 'observations')}
                />
              </div>
            </div>
          </div>
        ))}
        
        {students.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            Nenhum aluno adicionado ainda. Adicione alunos manualmente ou cole uma lista acima.
          </div>
        )}
        
        <button className="btn btn-block btn-add" onClick={addStudent} style={{ marginTop: '1rem' }}>
          + Adicionar Novo Aluno
        </button>
      </section>

      <div className="floating-actions">
        <button className="btn btn-primary" onClick={generateReports}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Gerar {students.length} Relatórios
        </button>
      </div>
    </div>
  );
}

export default App;
