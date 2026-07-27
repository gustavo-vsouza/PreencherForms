const fs = require('fs');

let content = fs.readFileSync('src/components/TeacherView.tsx', 'utf8');

// Import NotificationContext
content = content.replace(
  "import { db } from '../firebase';",
  "import { db } from '../firebase';\nimport { useNotification } from '../contexts/NotificationContext';"
);

// Remove modalConfig state
const modalConfigState = `  // Custom Modal (Alert/Confirm)
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  } | null>(null);`;

content = content.replace(modalConfigState, '  const { showToast, showConfirm } = useNotification();');

// Replace alerts
content = content.replaceAll('showAlert("Atenção", "Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.");', 'showToast("Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.", "warning");');
// unicode fallback
content = content.replaceAll('showAlert("Aten\u00e7\u00e3o", "Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relat\u00f3rios.");', 'showToast("Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.", "warning");'); 

content = content.replaceAll('showAlert("Dados Incompletos", "Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).");', 'showToast("Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).", "warning");');

content = content.replaceAll('showAlert("Dados Incompletos", `Por favor, preencha todos os campos do aluno ${i + 1} (${s.name || \'Sem nome\'}).`);', 'showToast(`Por favor, preencha todos os campos do aluno ${i + 1} (${s.name || \'Sem nome\'}).`, "warning");');

content = content.replaceAll('showAlert("Erro", "Ocorreu um erro ao gerar os relatórios. Verifique o console.");', 'showToast("Ocorreu um erro ao gerar os relatórios. Verifique o console.", "error");');
content = content.replaceAll('showAlert("Erro", "Ocorreu um erro ao gerar os relat\u00f3rios. Verifique o console.");', 'showToast("Ocorreu um erro ao gerar os relatórios. Verifique o console.", "error");');

// Remove closeModal in specific places
content = content.replaceAll('; closeModal();', ';');
content = content.replaceAll('closeModal();\n', '');

// Remove the local showConfirm definition
const localShowConfirm = `  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({ title, message, type: 'confirm', onConfirm });
  };`;
content = content.replace(localShowConfirm, '');

// Remove the local showAlert definition
const localShowAlert = `  const showAlert = (title: string, message: string) => {
    setModalConfig({ title, message, type: 'alert' });
  };`;
content = content.replace(localShowAlert, '');

// Remove closeModal definition
const localCloseModal = `  const closeModal = () => {
    setModalConfig(null);
  };`;
content = content.replace(localCloseModal, '');

// Remove JSX modal
const modalJsxStart = content.indexOf('{modalConfig && (');
if (modalJsxStart !== -1) {
  // Find the closing of this modal config block
  // It's the last JSX before the end of the file basically. 
  // Let's use substring indexOf to find '      )}'
  const afterStart = content.substring(modalJsxStart);
  const closingIdx = afterStart.indexOf('      )}\n    </div>\n  );\n}');
  if (closingIdx !== -1) {
    content = content.substring(0, modalJsxStart) + afterStart.substring(closingIdx + 8);
  } else {
    console.log("Could not find precise closing tags, leaving it for manual removal");
  }
}

fs.writeFileSync('src/components/TeacherView.tsx', content);
console.log('Teacher refactored');
