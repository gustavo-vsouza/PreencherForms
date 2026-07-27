const fs = require('fs');

let content = fs.readFileSync('src/components/TeacherView.tsx', 'utf8');

content = content.replace(
  "import { db } from '../firebase';",
  "import { db } from '../firebase';\nimport { useNotification } from '../contexts/NotificationContext';"
);

// Replace modalConfig state
content = content.replace(
  /  const \[modalConfig, setModalConfig\] = useState<\{[\s\S]*?\} \| null>\(null\);/,
  '  const { showToast, showConfirm } = useNotification();'
);

// Remove local modal functions
content = content.replace(
  /  const showAlert = \([^)]*\) => \{[\s\S]*?\};\n/,
  ''
);
content = content.replace(
  /  const showConfirm = \([^)]*\) => \{[\s\S]*?\};\n/,
  ''
);
content = content.replace(
  /  const closeModal = \(\) => \{[\s\S]*?\};\n/,
  ''
);

// Replace alert messages (Unicode for Atenção)
content = content.replace(
  /showAlert\("Aten\u00e7\u00e3o", "Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relat\u00f3rios\."\);/g,
  'showToast("Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.", "warning");'
);
content = content.replace(
  /showAlert\("Atenção", "Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios\."\);/g,
  'showToast("Por favor, adicione ou filtre pelo menos um aluno antes de gerar os relatórios.", "warning");'
);
content = content.replace(
  /showAlert\("Dados Incompletos", "Por favor, preencha todos os dados globais \(Professor, Turma, Disciplina\)\."\);/g,
  'showToast("Por favor, preencha todos os dados globais (Professor, Turma, Disciplina).", "warning");'
);
content = content.replace(
  /showAlert\("Dados Incompletos", `Por favor, preencha todos os campos do aluno \$\{i \+ 1\} \(\$\{s\.name \|\| 'Sem nome'\}\)\.`\);/g,
  'showToast(`Por favor, preencha todos os campos do aluno ${i + 1} (${s.name || \'Sem nome\'}).`, "warning");'
);
content = content.replace(
  /showAlert\("Erro", "Ocorreu um erro ao gerar os relat\u00f3rios\. Verifique o console\."\);/g,
  'showToast("Ocorreu um erro ao gerar os relatórios. Verifique o console.", "error");'
);
content = content.replace(
  /showAlert\("Erro", "Ocorreu um erro ao gerar os relatórios\. Verifique o console\."\);/g,
  'showToast("Ocorreu um erro ao gerar os relatórios. Verifique o console.", "error");'
);

// Remove closeModal usages
content = content.replace(/; closeModal\(\);/g, ';');
content = content.replace(/closeModal\(\);\n/g, '');

// Remove JSX
const idx = content.indexOf('{modalConfig && (');
if (idx !== -1) {
  content = content.replace(/      \{modalConfig && \([\s\S]*?      \)\}\n/g, '');
}

fs.writeFileSync('src/components/TeacherView.tsx', content);
console.log('TeacherView fixed.');
