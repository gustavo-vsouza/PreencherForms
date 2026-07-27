const fs = require('fs');

function refactorFile(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  content = content.replaceAll('alert("Erro ao adicionar escola.");', 'showToast("Erro ao adicionar escola.", "error");');
  content = content.replaceAll('alert("Erro ao adicionar escola.")', 'showToast("Erro ao adicionar escola.", "error")');
  
  content = content.replaceAll('alert("Erro ao excluir escola.");', 'showToast("Erro ao excluir escola.", "error");');
  content = content.replaceAll('alert("Erro ao excluir escola.")', 'showToast("Erro ao excluir escola.", "error")');

  content = content.replaceAll('alert("Erro: Não foi possível encontrar a coluna \'Nome\' exata.");', 'showToast("Erro: Não foi possível encontrar a coluna \'Nome\' exata.", "error");');
  
  content = content.replaceAll('alert(`Sucesso! Turma ${uploadClassName} carregada.`);', 'showToast(`Sucesso! Turma ${uploadClassName} carregada.`, "success");');
  
  content = content.replaceAll('alert("Erro ao processar a planilha.");', 'showToast("Erro ao processar a planilha.", "error");');
  content = content.replaceAll('alert("Erro ao processar a planilha.")', 'showToast("Erro ao processar a planilha.", "error")');
  
  content = content.replaceAll('alert("Erro ao deletar.");', 'showToast("Erro ao deletar.", "error");');
  content = content.replaceAll('alert("Erro ao deletar.")', 'showToast("Erro ao deletar.", "error")');
  
  content = content.replaceAll('alert("Erro ao atualizar turma.");', 'showToast("Erro ao atualizar turma.", "error");');
  content = content.replaceAll('alert("Erro ao atualizar turma.")', 'showToast("Erro ao atualizar turma.", "error")');
  
  content = content.replaceAll('alert("Erro: Não foi possível encontrar a coluna \'Descritor\' na planilha.");', 'showToast("Erro: Não foi possível encontrar a coluna \'Descritor\' na planilha.", "error");');
  
  content = content.replaceAll('alert("Erro: A planilha deve conter as colunas: Série, Acertos, Descritor e Disciplina.");', 'showToast("Erro: A planilha deve conter as colunas: Série, Acertos, Descritor e Disciplina.", "error");');
  
  content = content.replaceAll('alert(`Sucesso! Habilidades abaixo de 50% importadas.`);', 'showToast(`Sucesso! Habilidades abaixo de 50% importadas.`, "success");');
  
  content = content.replaceAll('alert("Erro ao processar a planilha de habilidades.");', 'showToast("Erro ao processar a planilha de habilidades.", "error");');
  content = content.replaceAll('alert("Erro ao processar a planilha de habilidades.")', 'showToast("Erro ao processar a planilha de habilidades.", "error")');

  content = content.replaceAll('confirmAction(', 'showConfirm(');

  fs.writeFileSync(path, content);
  console.log('Refactored ' + path);
}

refactorFile('src/components/AdminView.tsx');
