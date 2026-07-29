# SIGEP — Sistema Integrado de Gestão Pedagógica

Documentação técnica completa do projeto. Este documento complementa o [README.md](README.md) (visão de produto) com detalhes de arquitetura, modelo de dados, fluxos de negócio, segurança e guia de manutenção — destinado a desenvolvedores que vão dar manutenção ou evoluir o sistema.

> **Nome interno do pacote:** `preencherforms` · **Título da aplicação:** SIGEP · **Versão:** 0.0.0 (pré-produção)

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Stack tecnológica](#2-stack-tecnológica)
3. [Arquitetura](#3-arquitetura)
4. [Estrutura de pastas](#4-estrutura-de-pastas)
5. [Modelo de dados (Firestore)](#5-modelo-de-dados-firestore)
6. [Autenticação e controle de acesso](#6-autenticação-e-controle-de-acesso)
7. [Fluxos de negócio](#7-fluxos-de-negócio)
8. [Componentes — referência detalhada](#8-componentes--referência-detalhada)
9. [Geração de PDF/ZIP](#9-geração-de-pdfzip)
10. [Importação de planilhas Excel](#10-importação-de-planilhas-excel)
11. [Setup do ambiente de desenvolvimento](#11-setup-do-ambiente-de-desenvolvimento)
12. [Scripts disponíveis](#12-scripts-disponíveis)
13. [Convenções de código](#13-convenções-de-código)
14. [Débitos técnicos e riscos conhecidos](#14-débitos-técnicos-e-riscos-conhecidos)
15. [Roadmap sugerido](#15-roadmap-sugerido)

---

## 1. Visão geral

O SIGEP é uma aplicação **client-side** (SPA) para gestão de relatórios pedagógicos (Planos de Ação) em escolas. Não existe backend próprio: toda a persistência é feita diretamente do navegador para o **Cloud Firestore**, e a geração de PDF/ZIP acontece 100% no cliente.

Dois perfis de uso, uma única tela de login com uma **rota de acesso implícita** baseada no código digitado (ver [seção 6](#6-autenticação-e-controle-de-acesso)):

| Perfil | Objetivo |
|---|---|
| **Professor** | Selecionar turma/disciplina, preencher habilidades não alcançadas e planos de ação por aluno, gerar PDFs em lote |
| **Coordenação (Admin)** | Cadastrar escolas, importar turmas e bases de habilidades via Excel, navegar pelos relatórios gerados pelos professores |

---

## 2. Stack tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| UI | React | 19.2.7 |
| Build/Dev server | Vite | 8.1.1 |
| Linguagem | TypeScript | 6.0.2 (`strict` via `tsc -b`) |
| Estilo | Tailwind CSS v4 (via `@tailwindcss/vite`) | 4.3.3 |
| Animações | GSAP + `@gsap/react` (`useGSAP`) | 3.15 / 2.1.2 |
| Persistência | Firebase (Firestore + Analytics) | 12.16.0 |
| Planilhas | SheetJS (`xlsx`) | 0.18.5 |
| PDF | `jspdf` | 4.2.1 |
| Compactação | `jszip` | 3.10.1 |
| Lint | `oxlint` (plugins react/typescript/oxc) | 1.71.0 |

Não há: roteador (React Router), gerenciador de estado global (Redux/Zustand), testes automatizados, CI/CD, ou camada de API própria — todo o acesso a dados é feito diretamente do componente para o SDK do Firebase.

---

## 3. Arquitetura

```
┌─────────────────────────────────────────────┐
│                  Browser (SPA)               │
│                                               │
│  App.tsx  ── controla view: login|teacher|admin
│    ├─ LoginView      (autenticação por código)
│    ├─ TeacherView    (preenchimento + geração PDF)
│    │    └─ Combobox  (autocomplete turma/disciplina/habilidade)
│    └─ AdminView      (dashboard + CRUD escolas/turmas/habilidades)
│         └─ AdminSettings (modal alternativo, não usado em runtime)
│                                               │
│  NotificationContext  ── toasts + modais de confirmação globais
│                                               │
└──────────────────┬────────────────────────────┘
                    │ Firebase SDK (client)
                    ▼
┌─────────────────────────────────────────────┐
│          Cloud Firestore (NoSQL)              │
│  schools │ uploaded_classes │ skills_data │ reports │
└─────────────────────────────────────────────┘
```

**Padrão de estado:** cada view (`TeacherView`, `AdminView`) mantém seu próprio estado local via `useState`/`useEffect`; não há normalização nem cache compartilhado entre elas. Toda leitura ao Firestore é refeita (`getDocs`) sempre que a tela monta ou o filtro de escola muda — não há uso de `onSnapshot` (sem tempo real) nem de camada de cache/SWR.

**Sessão:** persistida em `localStorage` (`schoolCode`, `schoolName`, `view`), sem expiração, sem token, sem verificação server-side.

---

## 4. Estrutura de pastas

```
/
├── index.html                    # título "SIGEP", monta <div id="root">
├── vite.config.ts                # plugins: @tailwindcss/vite, @vitejs/plugin-react
├── tsconfig.json / .app.json / .node.json
├── .oxlintrc.json                # regras: rules-of-hooks (error), only-export-components (warn)
├── package.json
├── refactor.cjs                  # script pontual de migração (alert → toast) — já executado
├── refactorTeacher.cjs           # idem, específico para TeacherView.tsx
├── scripts/
│   └── refactorTeacher.cjs       # variante duplicada do script acima
├── public/
│   ├── favicon.svg
│   └── icons.svg
└── src/
    ├── main.tsx                  # ReactDOM.createRoot
    ├── App.tsx                   # roteamento de view + dark mode + sessão
    ├── firebase.ts                # inicialização do Firebase (config hardcoded)
    ├── index.css                  # tokens Tailwind v4 (@theme) + dark mode
    ├── App.css
    ├── assets/                    # hero.png, react.svg, vite.svg
    ├── contexts/
    │   └── NotificationContext.tsx  # toasts + confirm modal (usePattern global)
    └── components/
        ├── LoginView.tsx           # tela de entrada por código de escola
        ├── TeacherView.tsx         # núcleo do fluxo do professor
        ├── AdminView.tsx           # núcleo do fluxo da coordenação (1033 linhas)
        ├── AdminSettings.tsx       # modal CRUD alternativo — não referenciado em nenhum lugar
        └── Combobox.tsx            # input com autocomplete reutilizável
```

> Não existem as pastas `/hooks`, `/lib`, `/types` mencionadas em templates genéricos de projeto — este projeto não as usa; toda a lógica está embutida nos próprios componentes.

---

## 5. Modelo de dados (Firestore)

Não há schema declarado (é NoSQL/schemaless) nem tipos TypeScript compartilhados para os documentos — os componentes usam `any[]` para os dados vindos do Firestore. As coleções abaixo foram inferidas da leitura do código-fonte:

### `schools`
```ts
{
  code: string   // código de acesso, uppercase, usado no login do professor
  name: string   // nome de exibição da escola
}
```
Criada/lida em `AdminView.handleAddSchool` / `fetchInitialData`. **Excluir uma escola não apaga em cascata** `uploaded_classes`, `skills_data` nem `reports` associados, apesar do modal de confirmação avisar que isso acontece (ver [débitos técnicos](#14-débitos-técnicos-e-riscos-conhecidos)).

### `uploaded_classes`
Uma turma importada via planilha Excel pela coordenação.
```ts
{
  schoolCode: string
  classRoom: string          // ex: "6º Ano A"
  grade: string               // ex: "6º ANO", "1ª SÉRIE"
  period: string              // "Manhã" | "Tarde" | "Noite"
  subjects: string[]          // nomes das colunas de disciplina detectadas na planilha
  students: {
    name: string
    scores: Record<string, number>   // chave = nome da disciplina, valor = percentual 0–1
  }[]
  uploadedAt: string          // ISO date
}
```

### `skills_data`
Base de habilidades (BNCC/currículo) com acertos < 50%, agrupada por série+disciplina.
```ts
{
  schoolCode: string
  grade: string          // "série" da planilha original
  subject: string        // "disciplina"
  skills: string[]       // lista de descritores únicos
  uploadedAt: string
}
```

### `reports`
Um relatório gerado pelo professor para uma turma+disciplina (o "Plano de Ação" agregado).
```ts
{
  schoolCode: string
  teacherName: string
  classRoom: string
  subject: string
  students: {
    name: string
    unreachedSkill: string
    actionPlan: string
    score: number | null
  }[]
  createdAt: string      // ISO date, usado em orderBy('createdAt', 'desc')
}
```

### Regras de segurança do Firestore
Não estão versionadas no repositório (não há pasta `firestore.rules` nem `firebase.json`). Presume-se que as regras vivam apenas no Console do Firebase — **verificar diretamente no console do projeto `gestao-de-relatorios-af618` antes de qualquer alteração de acesso**, pois nada aqui garante que as coleções estejam protegidas contra leitura/escrita anônima.

---

## 6. Autenticação e controle de acesso

Não há Firebase Auth, OAuth ou JWT. O "login" (`App.tsx:handleLogin`) é um único campo de texto (código da escola) resolvido em cascata:

1. **Acesso Admin hardcoded:** se `btoa(code) === 'Q09PUkRFTkFDQU8x'` (isto é, o código digitado é literalmente `COORDENACAO1`), libera a view `admin`.
2. **Escola hardcoded:** se o código for exatamente `PRATICI001`, libera a view `teacher` para a escola "Antônio Prátici" sem consultar o Firestore.
3. **Fallback:** consulta `schools` no Firestore por `code == <valor digitado>`; se encontrar, libera `teacher` com o nome da escola encontrada.

Além disso, `AdminView` tem um **painel DEV oculto** acionado por `Ctrl+Shift+D`, protegido por uma senha fixa no código-fonte (`adm@123`), que permite apagar **todos** os relatórios ou **todas** as bases de habilidades do sistema (todas as escolas, não só a selecionada).

> ⚠️ **Isto não é controle de acesso seguro.** Credenciais fixas no bundle JavaScript são visíveis a qualquer pessoa que inspecione o código-fonte servido ao navegador (basta abrir o DevTools ou o arquivo `.js` buildado). `btoa` é apenas codificação Base64, não criptografia. Ver [seção 14](#14-débitos-técnicos-e-riscos-conhecidos) para recomendações.

---

## 7. Fluxos de negócio

### 7.1 Fluxo da Coordenação (Admin)

```
Login "COORDENACAO1" ──▶ AdminView
 ├─ Dashboard: Escola ▶ Período (Manhã/Tarde/Noite/Outros) ▶ Turma ▶ Disciplina ▶ Tabela do relatório (somente leitura)
 ├─ Escolas: cadastrar (code + name) / excluir
 ├─ Turmas: selecionar escola ▶ upload de planilha Excel ▶ turma criada em `uploaded_classes`
 │           editar (nome/série/período) / excluir turma
 └─ Habilidades: selecionar escola ▶ upload de planilha de habilidades (filtra acertos < 50%) ▶ agrupado em `skills_data`
```

O item **"Outros"** no filtro de período do Dashboard é um caso especial: mostra turmas que aparecem em `reports` mas **não** existem em `uploaded_classes` — ou seja, turmas criadas manualmente pelo professor sem upload prévio de planilha pela coordenação.

### 7.2 Fluxo do Professor

```
Login com código de escola ──▶ TeacherView
 1. Preenche Informações Globais: Nome do professor, Turma (Combobox das uploaded_classes), Disciplina
    → ao escolher uma turma+disciplina já importada, os alunos e seus % de acerto são
      carregados automaticamente a partir de `uploaded_classes.students[].scores`
 2. (Opcional) Ativa filtro "Acertos < 50%" → oculta alunos acima do corte da lista visível
 3. Para cada aluno: seleciona "Habilidade não alcançada" (autocomplete vindo de `skills_data`,
    casado por série normalizada + disciplina normalizada) e digita o "Plano de ação"
 4. Adiciona alunos manualmente (um a um) ou em lote (colando uma lista de nomes, um por linha)
 5. Clica em "Gerar Relatórios" → validação de campos obrigatórios → modal de confirmação
    → gera 1 PDF por aluno + salva 1 documento agregado em `reports` → baixa .zip com todos os PDFs
```

**Regra de negócio central:** o sistema existe para focar a atenção do professor nos alunos com desempenho abaixo de 50% de acertos — daí o filtro dedicado e o fato de a importação de habilidades já descartar descritores com acerto ≥ 50% no momento do upload (`handleUploadSkills`, `numVal < 0.5`).

### 7.3 Normalização de texto para casamento de habilidades

`TeacherView.availableSkills` casa a série/disciplina da turma selecionada com as entradas de `skills_data` usando uma função de normalização (remove acentos, normaliza `º/°/ª`, lowercase, colapsa espaços) e depois um match parcial bidirecional (`includes`). Isso é necessário porque as planilhas de origem (turmas x habilidades) não seguem um formato padronizado de nomenclatura de série/disciplina.

---

## 8. Componentes — referência detalhada

### `App.tsx`
Componente raiz. Responsabilidades:
- Alterna entre `login | teacher | admin` (estado `view`, sem router).
- Restaura sessão de `localStorage` no mount (evita flicker com flag `isReady`).
- Toggle de dark mode (persistido em `localStorage.theme`, aplicado via classe `.dark` no `<html>`).
- Contém a lógica de autenticação descrita na [seção 6](#6-autenticação-e-controle-de-acesso).
- Envolve tudo em `<NotificationProvider>`.

### `contexts/NotificationContext.tsx`
Substituto para `alert()`/`confirm()` nativos do navegador. Expõe via `useNotification()`:
- `showToast(message, type?)` — toast auto-dispensado após 5s, tipos `success|error|info|warning`.
- `showConfirm(title, message, onConfirm)` — modal de confirmação bloqueante com callback.

Todo o código do projeto que antes usava `alert`/`window.confirm` foi migrado para este contexto (ver scripts de refactor na [seção 12](#12-scripts-disponíveis)).

### `components/LoginView.tsx`
Tela de entrada. Puramente apresentacional + animações GSAP de entrada (`useGSAP`). Delega toda a lógica de autenticação para a prop `onLogin` recebida de `App.tsx`.

### `components/Combobox.tsx`
Input de texto com dropdown de sugestões filtradas por substring (case-insensitive). Fecha ao clicar fora (`mousedown` listener em `document`). Reutilizado em `TeacherView` para Turma, Disciplina e Habilidade não alcançada.

### `components/TeacherView.tsx` (603 linhas)
Ver [seção 7.2](#72-fluxo-do-professor) e [seção 9](#9-geração-de-pdfzip). Estado principal: `globalInfo` (professor/turma/disciplina), `students[]`, `expandedIndex` (acordeão), `showLowScoresOnly`.

### `components/AdminView.tsx` (1033 linhas)
Maior componente do projeto — acumula 4 telas (dashboard + 3 tabs de CRUD) e o painel DEV em um único arquivo. Ver [seção 7.1](#71-fluxo-da-coordenação-admin) e [seção 10](#10-importação-de-planilhas-excel). Candidato prioritário a refatoração (ver [débitos técnicos](#14-débitos-técnicos-e-riscos-conhecidos)).

### `components/AdminSettings.tsx` (662 linhas)
**Não é importado por nenhum outro arquivo do projeto** (confirmado via busca global). Parece ser uma versão anterior/alternativa do CRUD de `AdminView` empacotada como modal (`onClose`, `schools`, `refreshData` como props). Mantido no repositório mas morto em termos de runtime — ver recomendação em [14](#14-débitos-técnicos-e-riscos-conhecidos).

---

## 9. Geração de PDF/ZIP

Implementada em `TeacherView.generateReports` (import dinâmico de `jspdf` e `jszip` para code-splitting):

1. Para cada aluno visível, monta uma página A4 com `jsPDF`: cabeçalho azul "Plano de Ação" + data, bloco "Informações da Turma" (professor/turma/disciplina), bloco com nome do aluno (+ % de acerto se disponível), e dois blocos de texto (habilidade não alcançada / plano de ação) com quebra automática de linha via `doc.splitTextToSize`.
2. Nome de arquivo do aluno é sanitizado: remove acentos (`normalize('NFD')` + strip de diacríticos) e caracteres não alfanuméricos (`replace(/[^a-z0-9]/gi, '_')`), com fallback `aluno_{i+1}` se o nome ficar vazio.
3. Todos os PDFs (como `ArrayBuffer`) são adicionados a uma pasta dentro de um `JSZip`, nomeada `"{disciplina} - {turma}"`.
4. Um documento agregado é gravado em `reports` no Firestore (dados brutos, não o PDF).
5. O `.zip` é gerado como Blob e baixado via link temporário (`URL.createObjectURL` + `a.click()` + `revokeObjectURL`).

> Nota: `student.name.replace(/[^\x20-\xFF]/g, '')` no corpo do PDF remove qualquer caractere fora do Latin-1 antes de renderizar — nomes com caracteres fora dessa faixa (ex: emojis, outros alfabetos) serão truncados/alterados no PDF, embora preservados no Firestore.

---

## 10. Importação de planilhas Excel

Duas rotinas distintas em `AdminView`, ambas usando `XLSX.read` (SheetJS) sobre o `ArrayBuffer` do arquivo:

### 10.1 Upload de turma (`handleUploadExcel`)
- Varre as primeiras 10 linhas procurando uma célula cujo texto (case-insensitive, trim) seja exatamente `"nome"` — define a linha de cabeçalho e a coluna dos nomes.
- Todas as colunas à direita da coluna "Nome" com um nome de cabeçalho com mais de 2 caracteres viram "disciplinas".
- Cada célula de nota é convertida para uma fração 0–1: números já entre 0–1 ficam como estão; números > 1 são divididos por 100 (assume-se percentual, ex. `85` → `0.85`); strings são parseadas trocando `,` por `.` e removendo `%`.
- Falha com toast de erro se a coluna "Nome" não for encontrada nas 10 primeiras linhas.

### 10.2 Upload de base de habilidades (`handleUploadSkills`)
- Procura uma linha de cabeçalho contendo a palavra `"descritor"`.
- Exige as 4 colunas: `Série`/`Serie`, `Acertos`, `Descritor`, `Disciplina` (busca por `includes`, não exata) — falha com toast se qualquer uma faltar.
- **Filtra no momento da importação**: só persiste descritores com acertos convertidos < 0.5 (50%).
- Agrupa por (série, disciplina), deduplicando descritores, e grava **um documento por combinação série+disciplina** em `skills_data`.

---

## 11. Setup do ambiente de desenvolvimento

Pré-requisitos: Node.js compatível com Vite 8 / React 19 (recomendado Node 20+).

```bash
npm install
npm run dev          # http://localhost:5173 (padrão Vite)
```

Não há arquivo `.env`/`.env.example` no projeto — as credenciais do Firebase estão hardcoded em [src/firebase.ts](src/firebase.ts). Isso é aceitável para a `apiKey` do Firebase Web SDK (ela não é secreta por design — a segurança real depende das *Security Rules* do Firestore), mas ainda assim é uma prática a evoluir (ver [14](#14-débitos-técnicos-e-riscos-conhecidos)).

Para apontar o projeto para outra instância do Firebase, edite diretamente o objeto `firebaseConfig` em `src/firebase.ts`.

---

## 12. Scripts disponíveis

| Comando | Ação |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento Vite |
| `npm run build` | `tsc -b` (type-check) seguido de `vite build` |
| `npm run lint` | Executa `oxlint` com as regras de `.oxlintrc.json` |
| `npm run preview` | Serve o build de produção localmente |

Scripts Node soltos na raiz e em `/scripts` (**não fazem parte do build, não são chamados por `package.json`**):
- `refactor.cjs` — script de migração pontual que já foi executado (substituía `alert(...)` por `showToast(...)` no código-fonte via regex). Mantido como histórico.
- `refactorTeacher.cjs` (raiz) e `scripts/refactorTeacher.cjs` (duplicata) — mesma ideia, focado em `TeacherView.tsx`, migrando `modalConfig`/`showAlert`/`showConfirm` locais para o `NotificationContext`.

Estes três arquivos são segurança/histórico de migração, não utilitários de manutenção contínua — podem ser removidos com segurança se a migração para `NotificationContext` já estiver 100% consolidada (confirmar antes de apagar).

---

## 13. Convenções de código

- **Todo componente é Client-side** — não há SSR/RSC (é Vite + React puro, sem Next.js).
- Estado local via hooks (`useState`/`useEffect`/`useMemo`); sem Redux/Zustand/Context API para dados de domínio (apenas notificações usam Context).
- Tailwind v4 com tokens definidos em `src/index.css` via `@theme` (cores `brand-*`, `accent-*`, fontes `--font-sans`/`--font-display`) + dark mode via classe `.dark` (`@custom-variant dark`).
- Animações de entrada de UI padronizadas com a classe utilitária `.stagger-fade` + `gsap.fromTo` dentro de `useGSAP(..., { scope: ref })`.
- Tipagem de dados do Firestore é fraca (`any[]`/`any`) em todo o projeto — não há `/types` nem interfaces compartilhadas para os documentos do Firestore (diferente das interfaces locais como `Student`/`GlobalInfo` em `TeacherView`, que são bem tipadas).
- Nomenclatura em português para domínio (variáveis, textos de UI, coleções), inglês para nomes técnicos de componentes/props.

---

## 14. Débitos técnicos e riscos conhecidos

Lista priorizada por impacto, levantada a partir da leitura direta do código-fonte:

1. **Credenciais de acesso hardcoded no bundle cliente (alto risco de segurança).**
   O código de coordenação (`COORDENACAO1`, ofuscado via `btoa`), o código de escola de fallback (`PRATICI001`) e a senha do painel DEV (`adm@123`) estão em texto/Base64 no código-fonte que é enviado ao navegador de qualquer usuário. Qualquer pessoa pode abrir o DevTools, ler o bundle e obter acesso de coordenação ou ao painel de exclusão em massa.
   **Recomendação:** mover autenticação para Firebase Auth (mesmo que só com custom claims para o papel "coordenação"), ou no mínimo validar o código de acesso em uma Cloud Function/regra de segurança do lado do servidor em vez de comparação no cliente.

2. **Sem Firestore Security Rules versionadas no repositório.**
   Não há `firestore.rules` no projeto. Não é possível auditar quem pode ler/escrever cada coleção sem acessar o Console do Firebase diretamente. Isso deveria ser versionado junto ao código (`firebase.json` + `firestore.rules`) para review e deploy consistentes.

3. **Exclusão de escola não é transacional/cascata.**
   `handleDeleteSchool` apaga apenas o documento em `schools`; o modal de confirmação alerta que turmas e relatórios associados serão removidos, mas isso **não acontece** — ficam órfãos em `uploaded_classes`, `skills_data` e `reports`, referenciando um `schoolCode` que não existe mais em `schools`. Ou implementar a cascata de fato (idealmente via Cloud Function) ou corrigir o texto do aviso.

4. **`AdminSettings.tsx` é código morto (662 linhas).**
   Não é importado em nenhum lugar do projeto. Duplica boa parte da lógica de CRUD já presente em `AdminView.tsx`, criando risco de divergência caso alguém edite um sem lembrar do outro. Recomenda-se removê-lo ou, se for reaproveitável, extrair a lógica compartilhada para hooks e apagar o duplicado.

5. **`AdminView.tsx` concentra 1033 linhas / 4 responsabilidades.**
   Dashboard de drill-down + CRUD de Escolas + CRUD de Turmas + CRUD de Habilidades + painel DEV, tudo em um único componente com dezenas de `useState`. Dificulta manutenção e testes. Recomenda-se dividir por tab (`DashboardTab`, `EscolasTab`, `TurmasTab`, `HabilidadesTab`) e extrair os parsers de planilha (`handleUploadExcel`, `handleUploadSkills`) para funções puras testáveis em `/lib`.

6. **Sem testes automatizados.**
   Nenhum framework de teste configurado (`vitest`, `jest`, etc). A lógica de parsing de planilhas (a parte mais frágil do sistema, dependente de heurísticas de nome de coluna) roda sem cobertura alguma.

7. **Scripts de migração (`refactor*.cjs`) versionados na raiz do repositório.**
   São descartáveis (rodaram uma vez, via regex, para migrar `alert()`→toast). Poluem a raiz do projeto; mover para uma pasta `/tools/one-off` ou remover após confirmar que a migração está completa.

8. **Parsing de planilhas por heurística de nome de coluna, sem validação de schema.**
   Tanto `handleUploadExcel` quanto `handleUploadSkills` procuram cabeçalhos por substring case-insensitive nas primeiras 10 linhas. Planilhas fora do padrão esperado falham silenciosamente com toast genérico, sem detalhar qual célula/linha causou o problema — dificulta o suporte a coordenadores que erram o formato.

9. **Sem paginação em nenhuma leitura do Firestore.**
   `getDocs(collection(db, 'reports'))`, `schools`, etc. sempre trazem a coleção inteira. Funcional em escala pequena/média, mas não escala para muitas escolas/anos de relatórios acumulados.

---

## 15. Roadmap sugerido

Sugestões de evolução, sem compromisso de prioridade — a definir com o time/produto:

- [ ] Substituir autenticação por código hardcoded por Firebase Auth (email/senha ou magic link) + custom claims para o papel de coordenação.
- [ ] Versionar `firestore.rules` no repositório e configurar `firebase deploy --only firestore:rules` no fluxo de deploy.
- [ ] Remover `AdminSettings.tsx` (código morto) ou decidir formalmente reativá-lo substituindo o CRUD de `AdminView`.
- [ ] Dividir `AdminView.tsx` em subcomponentes por aba.
- [ ] Extrair os parsers de Excel para funções puras em `src/lib/` com testes unitários (`vitest`) cobrindo variações de planilha (cabeçalho deslocado, percentuais como string vs. número, colunas extras).
- [ ] Implementar exclusão em cascata real (Cloud Function `onDelete` do documento de escola) ou ajustar a mensagem de confirmação para refletir o comportamento real.
- [ ] Avaliar `onSnapshot` para o Dashboard da coordenação, para refletir novos relatórios em tempo real sem recarregar a página.
- [ ] Adicionar paginação/`limit()` nas queries de `reports` conforme o volume crescer.
