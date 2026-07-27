# Sistema de Gestão de Relatórios Pedagógicos

Este é um sistema desenvolvido para facilitar a criação, gestão e análise de relatórios acadêmicos e planos de ação. A plataforma atende tanto professores quanto coordenadores pedagógicos, automatizando a geração de documentos e centralizando o desempenho dos alunos.

## 🎯 Objetivo da Plataforma

O objetivo principal é identificar alunos que necessitam de intervenção pedagógica (por exemplo, com acertos inferiores a 50% em avaliações) e gerar **Planos de Ação** estruturados em PDF para cada um deles. O sistema cruza dados de desempenho com uma base de habilidades da BNCC/Currículo local para facilitar o preenchimento pelo professor.

## 👥 Perfis de Acesso

A plataforma é dividida em duas visões principais:

### 1. Visão do Professor
Focada na agilidade do preenchimento e geração de relatórios.
- **Seleção de Turma e Disciplina:** O professor seleciona a turma e a disciplina em que atua.
- **Gestão de Alunos:** Os alunos podem vir pré-carregados (via planilhas da coordenação) ou inseridos manualmente (individualmente ou em lote).
- **Filtro Inteligente:** Possibilidade de filtrar automaticamente alunos com desempenho (acertos) abaixo de 50%.
- **Preenchimento do Plano de Ação:** Para cada aluno, o professor seleciona a "Habilidade não alcançada" (buscada automaticamente da base) e digita o "Plano de Ação" correspondente.
- **Geração de PDF:** Com um clique, o sistema gera relatórios individuais em PDF para todos os alunos selecionados e faz o download de um arquivo ZIP contendo todos os documentos organizados.

### 2. Visão da Coordenação (Admin)
Focada na gestão de dados, inserção de planilhas e acompanhamento do trabalho dos professores.
- **Gestão de Escolas e Turmas:** Cadastro de escolas e importação de turmas via planilhas Excel (contendo nomes dos alunos e notas/acertos por disciplina).
- **Base de Habilidades:** Importação de planilhas com a base de habilidades (relacionando série, disciplina e a descrição da habilidade).
- **Dashboard de Acompanhamento:** A coordenação pode navegar pelas escolas, períodos (Manhã, Tarde, Noite e Outros), turmas e matérias para visualizar os relatórios preenchidos pelos professores em tempo real.

## 🚀 Tecnologias Utilizadas

O projeto foi construído utilizando um stack moderno para garantir velocidade e manutenibilidade:
- **React (com TypeScript):** Biblioteca principal para a interface de usuário.
- **Vite:** Ferramenta de build e servidor de desenvolvimento ultra-rápido.
- **Tailwind CSS:** Framework de estilização utilitária para o design responsivo e moderno (incluindo Dark Mode nativo).
- **Firebase (Firestore):** Banco de dados NoSQL utilizado para armazenar turmas, relatórios gerados e a base de habilidades.
- **jsPDF & JSZip:** Bibliotecas utilizadas no lado do cliente para a geração dos relatórios em PDF e compactação em arquivos ZIP.
- **XLSX (SheetJS):** Leitura nativa de arquivos Excel no navegador para a importação de turmas e habilidades.

## 🔒 Segurança e Privacidade

Nenhum dado pessoal de acesso (senhas, tokens de banco de dados, etc.) deve ser versionado no código-fonte. O controle de acesso e autenticação é gerenciado através do Firebase, garantindo a integridade dos dados escolares.

---
*Criado por Prof. Wesley & Prof. Gustavo ® 2026*
