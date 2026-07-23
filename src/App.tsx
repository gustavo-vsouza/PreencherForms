import { useState } from 'react';
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

  const [students, setStudents] = useState<Student[]>([
    { 
      id: crypto.randomUUID(), 
      name: '', 
      level: 'Abaixo do básico',
      progress: '',
      skills: '',
      difficulties: '',
      interventions: '',
      observations: ''
    }
  ]);

  const handleGlobalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGlobalInfo(prev => ({ ...prev, [name]: value }));
  };

  const handleStudentChange = (id: string, field: keyof Student, value: string) => {
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
        observations: ''
      }
    ]);
  };

  const removeStudent = (id: string) => {
    if (students.length > 1) {
      setStudents(prev => prev.filter(s => s.id !== id));
    }
  };


  const validateForm = (): boolean => {
    // Check global
    if (!globalInfo.teacherName.trim() || !globalInfo.classRoom.trim() || !globalInfo.subject.trim()) {
      alert("Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).");
      return false;
    }
    
    // Check students
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name.trim() || !s.progress || !s.skills.trim() || !s.difficulties.trim() || !s.interventions.trim() || !s.observations.trim()) {
        alert(`Por favor, preencha todos os campos obrigatórios do aluno ${i + 1}.`);
        return false;
      }
    }
    return true;
  };

  const generateReports = async () => {
    if (!validateForm()) return;

    const { jsPDF } = await import('jspdf');

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const doc = new jsPDF();
      
      const margin = 20;
      let y = 20;
      const pageWidth = 210;
      const contentWidth = pageWidth - margin * 2;

      // Helper function to check page boundaries and add new page if needed
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

      // Save PDF
      const safeName = student.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`relatorio_${safeName}.pdf`);

      await new Promise(resolve => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>E. E. Prefeito Antônio Prátici</h1>
        <p>Sistema de Gerenciamento e Emissão de Relatórios Individuais de Aprendizagem.</p>
      </header>

      <section className="section-panel">
        <h2>Informações Globais</h2>
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

      <section>
        <h2>Avaliações Individuais ({students.length} alunos)</h2>
        {students.map((student, index) => (
          <div key={student.id} className="student-card">
            <div className="student-card-header">
              <h3>
                <span className="student-card-number">{index + 1}</span>
                Dados do Aluno
              </h3>
              {students.length > 1 && (
                <button 
                  className="btn btn-danger"
                  onClick={() => removeStudent(student.id)}
                  title="Remover aluno"
                >
                  ✕ Remover
                </button>
              )}
            </div>
            
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
                placeholder="Observações adicionais..."
                value={student.observations}
                onChange={(e) => handleStudentChange(student.id, 'observations', e.target.value)}
              />
            </div>
          </div>
        ))}
        
        <button className="btn btn-block btn-add" onClick={addStudent}>
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
