import { useState, useEffect } from 'react'
import { Search, Activity, Stethoscope, AlertTriangle, CheckCircle2, Key, ChevronRight, Eye, Bed, Scissors } from 'lucide-react'
import sigtapDatabase from './data/sigtap_database.json'
import type { CidSigtapRelation, SigtapProcedure } from './data/mockDatabase' // Keeping types for now, though we might need to adjust them if JSON changes
import { PROTOCOLO_MANCHESTER_REFERENCIA } from './data/manchesterReferencia'
import { GoogleGenAI } from '@google/genai';

// Helper para o calculo exato de idade (Anos, Meses ou Dias) usado no prompt e no Header do PDF
const calcularIdadeExata = (dataString: string) => {
  if (!dataString) return 'Idade não informada';
  const hoje = new Date();
  const nasc = new Date(dataString);
  let anos = hoje.getFullYear() - nasc.getFullYear();
  let meses = hoje.getMonth() - nasc.getMonth();
  let dias = hoje.getDate() - nasc.getDate();

  if (dias < 0) {
    meses--;
    const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate();
    dias += ultimoDiaMesAnterior;
  }
  if (meses < 0) {
    anos--;
    meses += 12;
  }

  if (anos > 0) {
    return `${anos} anos${meses > 0 ? ` e ${meses} meses` : ''}`;
  } else if (meses > 0) {
    return `${meses} meses${dias > 0 ? ` e ${dias} dias` : ''}`;
  } else {
    return `${dias} dias de vida`;
  }
};

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('smartaih_apiKey') || '')
  const [activeTab, setActiveTab] = useState<'cid' | 'symptoms' | 'nursing'>('cid')

  // Tab 1 State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CidSigtapRelation[]>([])
  const [isShowingSuggestions, setIsShowingSuggestions] = useState(false)

  // Tab 2 State
  const [patientName, setPatientName] = useState(() => localStorage.getItem('smartaih_patientName') || '')
  const [medicalRecord, setMedicalRecord] = useState(() => localStorage.getItem('smartaih_medicalRecord') || '')
  const [professionalName, setProfessionalName] = useState(() => localStorage.getItem('smartaih_professionalName') || '')
  const [professionalCoren, setProfessionalCoren] = useState(() => localStorage.getItem('smartaih_professionalCoren') || '')
  const [clinicalText, setClinicalText] = useState(() => localStorage.getItem('smartaih_clinicalText') || '')
  const [historicoPaciente, setHistoricoPaciente] = useState(() => {
    const saved = localStorage.getItem('smartaih_historico');
    return saved ? JSON.parse(saved) : {
      dataNascimento: '', comorbidades: '', alergias: '', medicamentos: ''
    };
  })
  const [sinaisVitais, setSinaisVitais] = useState(() => {
    const saved = localStorage.getItem('smartaih_sinais');
    return saved ? JSON.parse(saved) : {
      pa: '', fc: '', fr: '', temp: '', spo2: '', hgt: '',
      peso: '', altura: '', bcf: '', alturaUterina: '', glasgow: '', dor: ''
    };
  })
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [tipoAtendimento, setTipoAtendimento] = useState<'observacao' | 'internacao' | 'cirurgia'>(() => (localStorage.getItem('smartaih_tipoAtendimento') as any) || 'internacao')

  // Tab 3 State (Nursing SAE Wizard)
  const [currentSection, setCurrentSection] = useState(0);
  const saeSections = [
    'Dados do Paciente',
    'Sinais Vitais',
    'Avaliação Neurológica',
    'Avaliação Respiratória',
    'Avaliação Cardiovascular',
    'Avaliação de Pele',
    'Avaliação Gastrointestinal',
    'Avaliação Urinária',
    'Cateteres e Sondas',
    'Escala de Braden',
    'Escala de Morse',
    'Escala de Fugulin',
    'Análise IA (NANDA/NIC/NOC)'
  ];

  const [nursingAssessment, setNursingAssessment] = useState(() => {
    const saved = localStorage.getItem('smartaih_nursingAssessment');
    return saved ? JSON.parse(saved) : {
      neurologicalStatus: [], pupils: [], thermalRegulation: [], oxygenation: [],
      skin: [], gastrointestinal: [], vascular: [], abdominal: [], urinary: [],
      catheters: { peripheral: '', location: '', vesicalProbe: '', drain: '', allergies: '', feeding: [] },
      // Keeping legacy fields for basic info
      leito: '', dataInternacao: '', hipoteseDiagnostica: ''
    };
  });
  const [bradenScore, setBradenScore] = useState(() => {
    const saved = localStorage.getItem('smartaih_braden');
    return saved ? JSON.parse(saved) : { sensoryPerception: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4, frictionShear: 3, total: 23 };
  });
  const [morseScore, setMorseScore] = useState(() => {
    const saved = localStorage.getItem('smartaih_morse');
    return saved ? JSON.parse(saved) : { fallHistory: 0, secondaryDiagnosis: 0, ambulatoryAid: 0, ivTherapy: 0, gait: 0, mentalStatus: 0, total: 0 };
  });
  const [fugulinScore, setFugulinScore] = useState(() => {
    const saved = localStorage.getItem('smartaih_fugulin');
    return saved ? JSON.parse(saved) : { mentalStatus: 1, oxygenation: 1, vitalSigns: 1, motility: 1, walking: 1, feeding: 1, bodyCare: 1, elimination: 1, therapeutics: 1, total: 9 };
  });

  const [nursingResults, setNursingResults] = useState<any>(null);

  // Auto-Save Effect
  useEffect(() => {
    localStorage.setItem('smartaih_apiKey', apiKey);
    localStorage.setItem('smartaih_patientName', patientName);
    localStorage.setItem('smartaih_medicalRecord', medicalRecord);
    localStorage.setItem('smartaih_professionalName', professionalName);
    localStorage.setItem('smartaih_professionalCoren', professionalCoren);
    localStorage.setItem('smartaih_clinicalText', clinicalText);
    localStorage.setItem('smartaih_historico', JSON.stringify(historicoPaciente));
    localStorage.setItem('smartaih_sinais', JSON.stringify(sinaisVitais));
    localStorage.setItem('smartaih_tipoAtendimento', tipoAtendimento);
    localStorage.setItem('smartaih_nursingAssessment', JSON.stringify(nursingAssessment));
    localStorage.setItem('smartaih_braden', JSON.stringify(bradenScore));
    localStorage.setItem('smartaih_morse', JSON.stringify(morseScore));
    localStorage.setItem('smartaih_fugulin', JSON.stringify(fugulinScore));
  }, [apiKey, patientName, medicalRecord, clinicalText, historicoPaciente, sinaisVitais, tipoAtendimento, nursingAssessment, bradenScore, morseScore, fugulinScore]);

  // Calculators for Scales
  useEffect(() => {
    const total = bradenScore.sensoryPerception + bradenScore.moisture + bradenScore.activity + bradenScore.mobility + bradenScore.nutrition + bradenScore.frictionShear;
    setBradenScore((prev: any) => ({ ...prev, total }));
  }, [bradenScore.sensoryPerception, bradenScore.moisture, bradenScore.activity, bradenScore.mobility, bradenScore.nutrition, bradenScore.frictionShear]);

  useEffect(() => {
    const total = morseScore.fallHistory + morseScore.secondaryDiagnosis + morseScore.ambulatoryAid + morseScore.ivTherapy + morseScore.gait + morseScore.mentalStatus;
    setMorseScore((prev: any) => ({ ...prev, total }));
  }, [morseScore.fallHistory, morseScore.secondaryDiagnosis, morseScore.ambulatoryAid, morseScore.ivTherapy, morseScore.gait, morseScore.mentalStatus]);

  const getBradenRisk = (score: number) => {
    if (score <= 9) return 'Risco Altíssimo';
    if (score <= 12) return 'Risco Alto';
    if (score <= 14) return 'Risco Moderado';
    if (score <= 18) return 'Risco Baixo';
    return 'Sem Risco';
  };

  const getMorseRisk = (score: number) => {
    if (score >= 45) return 'Risco Alto';
    if (score >= 25) return 'Risco Moderado';
    return 'Risco Baixo';
  };

  const getFugulinCareLevel = (score: number) => {
    if (score >= 32) return 'Cuidados Intensivos';
    if (score >= 27) return 'Cuidados Semi-Intensivos';
    if (score >= 21) return 'Cuidados de Alta Dependência';
    if (score >= 15) return 'Cuidados Intermediários';
    return 'Cuidados Mínimos';
  };

  useEffect(() => {
    const total = fugulinScore.mentalStatus + fugulinScore.oxygenation + fugulinScore.vitalSigns + fugulinScore.motility + fugulinScore.walking + fugulinScore.feeding + fugulinScore.bodyCare + fugulinScore.elimination + fugulinScore.therapeutics;
    setFugulinScore((prev: any) => ({ ...prev, total }));
  }, [fugulinScore.mentalStatus, fugulinScore.oxygenation, fugulinScore.vitalSigns, fugulinScore.motility, fugulinScore.walking, fugulinScore.feeding, fugulinScore.bodyCare, fugulinScore.elimination, fugulinScore.therapeutics]);

  // Results State
  const [results, setResults] = useState<{
    cidSelecionado: string | null;
    nomeCid: string | null;
    cidsSecundarios?: { cid: string; nome: string }[];
    examesSugeridos?: string[];
    classificacaoManchester?: { cor: string; justificativa: string };
    procedimentosTags: string[];
    procedimentos: SigtapProcedure[];
  }>({ cidSelecionado: null, nomeCid: null, procedimentosTags: [], procedimentos: [] })

  const [aiResults, setAiResults] = useState<{
    cidSelecionado: string | null;
    nomeCid: string | null;
    cidsSecundarios?: { cid: string; nome: string }[];
    examesSugeridos?: string[];
    classificacaoManchester?: { cor: string; justificativa: string };
    procedimentosTags: string[];
    procedimentos: SigtapProcedure[];
  }[]>([])

  const handleCidSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim().length === 0) {
      setSuggestions([]);
      setIsShowingSuggestions(false);
      setResults({ cidSelecionado: null, nomeCid: null, procedimentosTags: [], procedimentos: [] });
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Filtra CIDs que COMECEM com o código digitado OU contenham no NOME a palavra digitada na base falsa/legada (se precisarmos de autocomplete real de ICD10, mudar isso depois)
    // Usando temporariamente um mapa extraido do JSON SIGTAP se não houver um banco CID puro
    const allCidsFromSigtap: Record<string, string> = {};
    sigtapDatabase.forEach(proc => {
      if (proc.defaultCid) allCidsFromSigtap[proc.defaultCid] = "Doença relacionada a " + proc.nome;
    });

    // Mock simples de autocomplete baseado nos defaultCids do JSON para não quebrar a UI
    const mockAutocomplete: CidSigtapRelation[] = Object.keys(allCidsFromSigtap).map(cid => ({
      cid,
      cidNome: allCidsFromSigtap[cid],
      procedimentos: []
    })).filter(item => item.cid.toLowerCase().startsWith(lowerQuery));

    setSuggestions(mockAutocomplete);
    setIsShowingSuggestions(true);
    setResults({ cidSelecionado: null, nomeCid: null, procedimentosTags: [], procedimentos: [] });
    setAiResults([]);
  }

  const selectCid = (cidItem: CidSigtapRelation) => {
    setSearchQuery(cidItem.cid); // Preenche o input
    setIsShowingSuggestions(false); // Esconde a lista
    setResults({
      cidSelecionado: cidItem.cid,
      nomeCid: cidItem.cidNome,
      procedimentosTags: [],
      procedimentos: cidItem.procedimentos || []
    });
    setAiResults([]); // Limpa resultados da IA se havia
  }

  const sanitizeJsonString = (rawJson: string) => {
    // 1. Isolate the JSON block in case the AI added conversational text before or after
    let extracted = rawJson;
    const firstBrace = rawJson.indexOf('{');
    const lastBrace = rawJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      extracted = rawJson.substring(firstBrace, lastBrace + 1);
    }

    // 2. Remove markdown blocks if still present
    let cleaned = extracted.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // 2. Fix extremely common trailing commas before array/object closing brackets
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    // 3. (Optional extreme cleanup) Try to escape unescaped internal quotes inside strings if possible without breaking structure
    // This regex is a simple heuristic: if a quote is preceded by a word char and followed by a word char/space, escape it.
    // cleaned = cleaned.replace(/(?<=\w)"(?=\s*\w)/g, '\\"');

    // 4. Strip out control characters that break parsing (Fixed regex typo)
    cleaned = cleaned.replace(/[\u0000-\u001F]+/g, ' ');

    return cleaned;
  };

  const handleAiAnalysis = async () => {
    if (!clinicalText.trim() || !apiKey) return;

    setIsLoadingAi(true);
    setResults({ cidSelecionado: null, nomeCid: null, procedimentosTags: [], procedimentos: [] });
    setAiResults([]);

    try {
      const idadeCalculada = calcularIdadeExata(historicoPaciente.dataNascimento);
      const ai = new GoogleGenAI({ apiKey });
      const tagsDisponiveis = sigtapDatabase.flatMap(proc => proc.tagsClinicas).join(', ');

      let orientacaoTipo = "";
      if (tipoAtendimento === 'observacao') {
        orientacaoTipo = "ATENÇÃO MÁXIMA: O MÉDICO INDICOU QUE O PACIENTE FICARÁ APENAS EM OBSERVAÇÃO/CONSULTA. VOCÊ DEVE OBRIGATORIAMENTE ESCOLHER TAGS DE CONSULTA/OBSERVAÇÃO (Ex: OBSERVACAO_CLINICA). É ESTRITAMENTE PROIBIDO USAR TAGS DE INTERNAÇÃO OU CIRURGIA. \n\nREGRA OURO MANCHESTER PARA OBSERVAÇÃO: Pacientes puramente em observação, sem sinais vitais alterados, DEVEM ter a base da Classificação de Risco como VERDE (Pouco Urgente) ou AZUL (Não Urgente), pois não necessitam de intervenção hospitalar aguda imediata.";
      } else if (tipoAtendimento === 'cirurgia') {
        orientacaoTipo = `ATENÇÃO MÁXIMA: O MÉDICO INDICOU QUE O PACIENTE FARÁ CIRURGIA. VOCÊ DEVE OBRIGATORIAMENTE ESCOLHER TAGS CIRÚRGICAS (EX: DRENAGEM_ABSCESSO_PELE, CESAREANA) E NÃO APENAS CLÍNICAS.

[ REGRA DE OURO DO SUS - FATURAMENTO CIRÚRGICO MÚLTIPLO ]
Se o relato clínico descrever MAIS DE UMA cirurgia distinta sendo feita no mesmo tempo operatório (Ex: Hernioplastia + Colecistectomia), aja como um Auditor Estratégico para faturamento:
1. O Procedimento Principal (Tag) DEVE SER OBRIGATORIAMENTE a tag coringa "SIGTAP_0415010012_TRATAMENTO_C_CIRURGIAS_MULTIPLAS" (ou Laparotomia Exploratória se aplicável).
2. Você DEVE usar o array "cidsSecundarios" de forma inteligente e exata para "justificar as cirurgias filhas"! Para CADA procedimento cirúrgico real que você "escondeu" dentro de "Cirurgias Múltiplas", você DEVE deduzir do texto e listar o respectivo CID da tabela que autorizaria a cirurgia filha (Ex: Se tirou vesícula por trauma, liste S36 nos secundários; Se corrigiu hérnia incisional, liste K430). 
3. Liste textualmente o nome das cirurgias reais realizadas no campo "examesSugeridos" ou na Justificativa.

REGRA OURO MANCHESTER PARA CIRURGIA: A indicação cirúrgica imediata ou de urgência eleva automaticamente o Risco. A base da Classificação de Risco DEVE ser no mínimo AMARELO (Urgente), podendo ser LARANJA (Muito Urgente) ou VERMELHO (Emergência) se os sinais vitais estiverem em choque.`;
      } else {
        orientacaoTipo = `ATENÇÃO MÁXIMA: O MÉDICO INDICOU INTERNAÇÃO CLÍNICA/TRATAMENTO. VOCÊ DEVE ESCOLHER AS TAGS DE INTERNAÇÃO. PROIBIDO USAR TAGS CIRÚRGICAS OU DE MERA OBSERVAÇÃO.

[ REGRA DE OURO - PACIENTES COM MÚLTIPLAS COMORBIDADES (GERIATRIA) ]
Se o paciente (especialmente idosos) apresentar múltiplos problemas clínicos simultâneos que não necessitam de cirurgia de urgência (Exemplo: Sofreu uma Queda com Fratura Conservadora + Apresenta Infecção Urinária Grave com exames ou sangramento + Descompensação Diabética), você DEVE:
1. Eleger como PROCEDIMENTO PRINCIPAL (e consequentemente base para o CID Principal) a condição de MAIOR GRAVIDADE SISTÊMICA ou risco imediato à vida que motivou o suporte hospitalar na triagem (geralmente a Infecção, Sepsia, ou quadro agudo descompensado). Ex: "TRATAMENTO DE OUTRAS DOENCAS DO APARELHO URINARIO" (para ITU).
2. As demais afecções e traumas (Ex: Fratura de Cóccix fechada S32.2) devem OBRIGATORIAMENTE entrar na lista de "cidsSecundarios" para resguardar o faturamento das medicações de dor e curativos associados.

REGRA OURO MANCHESTER PARA INTERNAÇÃO CLINICA: A necessidade de internação para suporte ou antibioticoterapia eleva o risco. A base da Classificação de Risco DEVE ser no mínimo AMARELO (Urgente), podendo escalar para Laranja/Vermelho se os sinais vitais exigirem suporte de vida imediato.`;
      }

      // --- PASSO 1: Descobrir o Tratamento/Procedimento Ideal ---
      const promptStep1 = `Você é um médico auditor do SUS e especialista clínico.
Sua missão é a MÁXIMA PRECISÃO DIAGNÓSTICA baseada em CRITÉRIO MÉDICO AVANÇADO.

Analise detalhadamente o quadro clínico abaixo (sinais, sintomas, exames laboratoriais e de imagem).
${orientacaoTipo}

1. **A REGRA DE OURO - TAGS CLÍNICAS (MUITO IMPORTANTE):**
Você ESTÁ PROIBIDO de inventar códigos SIGTAP. Ao invés disso, você DEVE retornar APENAS UMA ÚNICA tag de string ("Tags Clínicas") que representa a intenção principal do procedimento/tratamento a ser faturado nesta AIH.
As ÚNICAS Tags Clínicas que você PODE escolher (Obrigatório escolher UMA que corresponda ao Quadro Clínico E ao TIPO DE ATENDIMENTO selecionado pelo médico) são:

[ LISTA OBRIGATÓRIA DE TAGS PERMITIDAS ]: ${tagsDisponiveis}

Se o caso for, por exemplo, um Abcesso Celulite Furúnculo (CID L02 ou L03) e o médico pediu "Cirurgia", retorne exatamente a tag como está na lista, ex: "SIGTAP_0403010098_DRENAGEM_ABSCESSO_PELE".
Se o médico pediu "Internação Clínica" para Abcesso Celulite Furúnculo, retorne a tag completa correspondente, ex: "SIGTAP_0303080060_INTERNACAO_DERMATOLOGIA".
A sua escolha DEVE ser idêntica a uma das tags da lista acima listada. Não corte prefixos nem mude letras.


**INSTRUÇÃO ESPECIAL - DICIONÁRIO DE ABREVIAÇÕES DO SUS:**
No texto clínico, você encontrará várias abreviações médicas de urgência que você DEVE traduzir mentalmente com precisão:
- CBM: Corpo de Bombeiros Militar (apenas meio de transporte, irrelevante para CID)
- PS / PA: Pronto Socorro / Pronto Atendimento
- SVD: Sonda Vesical de Demora (Indica gravidade, retenção urinária ou preparo, mas não é diagnóstico isolado)
- HGT: Glicemia Capilar
Além disso, atenção a cruzamentos laboratoriais (HB, HTO, Leuco, Creat, Ureia, K, Na) com os Sinais Vitais para elevar o nível do Manchester.

2. CIDS SECUNDÁRIOS E COMORBIDADES: Liste todas as comorbidades ativas e secundárias relevantes no array "cidsSecundarios". Exija prioridade absoluta nas comorbidades não-compensadas encontradas pela varredura laboratorial.

3. CLASSIFICAÇÃO DE RISCO DE MANCHESTER: Avalie todos os Sinais Vitais fornecidos, os RESULTADOS LABORATORIAIS e o Quadro Clínico para determinar a Cor.
DIRETRIZES DE MANCHESTER:
${PROTOCOLO_MANCHESTER_REFERENCIA}

4. EXAMES SUGERIDOS: Retorne uma lista com os Nomes Completos dos Exames de Imagem e Laboratório adicionais necessários.

Quadro Clínico e Motivo da Consulta:
"${clinicalText}"

Histórico do Paciente e Exames Criptografados no Texto:
Idade Exata Calculada: ${idadeCalculada}
Comorbidades/Doenças Crônicas: ${historicoPaciente.comorbidades || 'Não informadas'}

Sinais Vitais Registrados na Triagem:
PA: ${sinaisVitais.pa || '-'} | FC: ${sinaisVitais.fc || '-'} | SpO2: ${sinaisVitais.spo2 || '-'}
Temp: ${sinaisVitais.temp || '-'}

**ATENÇÃO:** NESTE PASSO, NÃO ENVIE O CID PRINCIPAL. APENAS A TAG E DETALHES CLÍNICOS SECUNDÁRIOS.

**[ REGRA ANTI-CRASH DE FORMATAÇÃO JSON (CRÍTICA) ]**
1. NUNCA use aspas duplas dentro de nenhuma string de texto explicativo (exemplo: na Justificativa). Se precisar citar algo, use aspas simples ('texto').
2. NUNCA pule de linha "dando Enter" dentro das strings. Se precisar de parágrafos, digite literalmente os caracteres "\\n" em sequência.

Retorne EXATAMENTE no seguinte formato JSON, sem crases markdown ou texto extra:
{
  "procedimentoTagPrincipal": "UMA_DAS_TAGS_DA_LISTA_PERMITIDA_ACIMA",
  "cidsSecundarios": [
    { "cid": "CÓDIGO_SECUNDARIO", "nome": "Nome" }
  ],
  "examesSugeridos": [
    "Nome Completo do Exame 1"
  ],
  "classificacaoManchester": {
    "cor": "Vermelho, Laranja, Amarelo, Verde ou Azul",
    "justificativa": "Justificativa..."
  }
}
`;

      const responseStep1 = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptStep1,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      if (!responseStep1.text) {
        throw new Error("IA não retornou resposta no Passo 1.");
      }

      const cleanTextStep1 = sanitizeJsonString(responseStep1.text);
      let resultStep1;
      try {
        resultStep1 = JSON.parse(cleanTextStep1);
      } catch (parseError) {
        console.error("Parse Error no Passo 1:", parseError);
        console.error("Texto Bruto da IA (Passo 1):", responseStep1.text);
        console.error("Texto Limpo Tentado Mapear (Passo 1):", cleanTextStep1);
        throw new Error("A Inteligência Artificial retornou um texto com formatação corrompida (erro de aspas ou vírgulas). Tente Analisar Novamente.");
      }

      const tagEscolhida = resultStep1.procedimentoTagPrincipal;
      if (!tagEscolhida) throw new Error("IA não conseguiu definir uma Tag Clínica correspondente.");

      // Encontrar o procedimento no banco de dados para extrair CIDs permitidos
      // Aceita correspondência exata ou parcial (caso a IA teimosamente remova o prefixo SIGTAP_)
      let foundProc = sigtapDatabase.find(p =>
        p.tagsClinicas.some(t => t === tagEscolhida || t.includes(tagEscolhida) || tagEscolhida.includes(t))
      );

      // Failsafe 1: Busca Semântica básica caso a IA tenha alucinado a tag
      if (!foundProc) {
        const cleanHallucination = tagEscolhida.replace('SIGTAP_', '').replace(/_/g, ' ').toLowerCase();
        const searchTerms = cleanHallucination.split(' ').filter((w: string) => w.length > 4); // Busca palavras com mais de 4 letras
        foundProc = sigtapDatabase.find(p => {
          const nomeProc = p.nome.toLowerCase();
          return searchTerms.some((term: string) => nomeProc.includes(term));
        });
      }

      // Failsafe 2: Defaults genéricos de sobrevivência do SUS
      if (!foundProc) {
        if (tipoAtendimento === 'cirurgia') {
          foundProc = sigtapDatabase.find(p => p.codigo === "0415010012"); // TRATAMENTO C/ CIRURGIAS MULTIPLAS
        } else if (tipoAtendimento === 'observacao') {
          foundProc = sigtapDatabase.find(p => p.codigo === "0301060029"); // OBSERVACAO ATE 24H
        } else {
          foundProc = sigtapDatabase.find(p => p.codigo === "0301060061"); // ATENDIMENTO DE URGENCIA
        }
      }

      if (!foundProc) {
        // Fallback final extremo
        foundProc = sigtapDatabase[0];
      }

      const cidsPermitidosString = foundProc.cidsPermitidos && foundProc.cidsPermitidos.length > 0
        ? foundProc.cidsPermitidos.join(', ')
        : "Qualquer CID é permitido para este procedimento.";

      // --- PASSO 2: Definir CID Principal Estrito ---
      const promptStep2 = `Você analisou o caso clínico anteriormente e escolheu a seguinte Tag de Procedimento SUS para internar o paciente: ${tagEscolhida} (${foundProc.nome}).

AGORA, SUA MISSÃO É DEFINIR O CID PRINCIPAL COM BASE **ESTRITAMENTE** NAS REGRAS DO SUS.
Para o procedimento escolhido, o Sistema de Faturamento do SUS SÓ ACEITA OS SEGUINTES CIDS PRINCIPAIS:
[ ${cidsPermitidosString} ]

**INSTRUÇÃO SUPREMA:** 
Você está PROIBIDO de sugerir qualquer CID Principal que não esteja exata e literalmente escrito na lista acima.
Se o CID ideal que você pensou (ex: E16.2 para Hipoglicemia) NÃO ESTÁ na lista, você DEVE procurar o CID mais próximo que ESTÁ na lista e que englobe os sintomas/condição base (ex: buscando entre E10 e E14 para diabetes causador).
Retorne o CID com sua grafia exata (ex: E100, N390 - removendo o ponto no formato final se estava assim na lista acima, ou mantendo o ponto se a lista tem ponto, apenas copie o formato da lista).

1. Escolha o melhor CID DENTRO DA LISTA PERMITIDA.
2. Dê o nome real descritivo desse CID.

Quadro Clínico Original para referência:
"${clinicalText}"

**[ REGRA ANTI-CRASH DE FORMATAÇÃO JSON (CRÍTICA) ]**
NUNCA use aspas duplas dentro dos textos (use aspas simples) e NUNCA pule de linha teclando enter (digite \\n).

Retorne EXATAMENTE no seguinte formato JSON, sem crases markdown:
{
  "cidSelecionado": "CÓDIGO_ESCOLHIDO_DA_LISTA_PERMITIDA",
  "nomeCid": "Nome descritivo real do CID"
}
`;

      const responseStep2 = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptStep2,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      if (!responseStep2.text) {
        throw new Error("IA não retornou resposta no Passo 2.");
      }

      const cleanTextStep2 = sanitizeJsonString(responseStep2.text);
      let resultStep2;
      try {
        resultStep2 = JSON.parse(cleanTextStep2);
      } catch (parseError) {
        console.error("Parse Error no Passo 2:", parseError);
        console.error("Texto Bruto da IA (Passo 2):", responseStep2.text);
        console.error("Texto Limpo Tentado Mapear (Passo 2):", cleanTextStep2);
        throw new Error("A Inteligência Artificial retornou um texto com formatação corrompida no Passo 2. Tente Analisar Novamente.");
      }

      // --- Mapeando e Formatando Saída Final ---
      const finalProcedure: SigtapProcedure = {
        codigo: foundProc.codigo,
        nome: foundProc.nome,
        grupo: `${foundProc.grupo} - Carregado Localmente`,
        subGrupo: `${foundProc.subGrupo} - Carregado Localmente`,
        formaOrganizacao: `${foundProc.formaOrganizacao} - Carregado Localmente`,
        complexidade: "Alta Complexidade",
        justificativaCompatibilidade: "Atrelado via Tag (Two-Step Engine): " + tagEscolhida
      };

      const finalResult = {
        cidSelecionado: resultStep2.cidSelecionado,
        nomeCid: resultStep2.nomeCid,
        cidsSecundarios: resultStep1.cidsSecundarios || [],
        examesSugeridos: resultStep1.examesSugeridos || [],
        classificacaoManchester: resultStep1.classificacaoManchester,
        procedimentosTags: [tagEscolhida],
        procedimentos: [finalProcedure]
      };

      setAiResults([finalResult]);

    } catch (error: any) {
      console.error("Erro detalhado na IA (Two-Step):", error);
      alert(`Erro ao contatar API ou processar dados: ${error?.message || 'Erro desconhecido'}\n\nAbra o console do navegador (F12) para mais detalhes.`);
    } finally {
      setIsLoadingAi(false);
    }
  }

  const handleNursingAnalysis = async () => {
    if (!apiKey) {
      alert("Por favor, insira sua chave API do Google Gemini no topo da página.");
      return;
    }

    setIsLoadingAi(true);
    setNursingResults(null);
    try {
      const genAI = new GoogleGenAI({ apiKey: apiKey });
      const prompt = `Você é um Enfermeiro Especialista em Sistematização da Assistência de Enfermagem (SAE) de altíssimo nível, seguindo diretrizes da ANVISA.
Sua missão é gerar os Diagnósticos de Enfermagem (NANDA-I), Intervenções (NIC) e Resultados Esperados (NOC) com base nos dados vitais e avaliação física do paciente fornecidos abaixo.

DADOS DO PACIENTE:
Nome: ${patientName || 'Não informado'}
Idade/Nascimento: ${calcularIdadeExata(historicoPaciente.dataNascimento)}
Diagnóstico Médico: ${nursingAssessment.hipoteseDiagnostica || 'Não informado'}

DADOS DE AVALIAÇÃO DA ENFERMAGEM (CEFALOCAUDAL E SONDAS):
${JSON.stringify(nursingAssessment, null, 2)}
SINAIS VITAIS:
${JSON.stringify(sinaisVitais, null, 2)}
ESCALA DE FUGLIN (Grau de Dependência - ${getFugulinCareLevel(fugulinScore.total)}):
${JSON.stringify(fugulinScore, null, 2)}
ESCALA DE BRADEN MANUAL (Escore Total: ${bradenScore.total}):
${JSON.stringify(bradenScore, null, 2)}
ESCALA DE MORSE MANUAL (Escore Total: ${morseScore.total}):
${JSON.stringify(morseScore, null, 2)}

INSTRUÇÕES OBRIGATÓRIAS:
1. Avalie criticamente os sinais vitais, os checkboxes ativados e as Escalas de Fugulin, Braden e Morse.
2. Identifique os diagnósticos de enfermagem reais e potencias priorizados de acordo com o Nível de Dependência (Fugulin).
3. Se houver risco de queda (Morse Alto/Moderado) ou lesão por pressão (Braden Baixo/Moderado/Alto/Altíssimo), INCLUA DIAGNÓSTICOS NANDA E INTERVENÇÕES NIC CORRESPONDENTES OBRIGATORIAMENTE.

[ REGRA ANTI-CRASH DE FORMATAÇÃO JSON (CRÍTICA) ]
Você DEVE obrigatoriamente retornar APENAS um objeto JSON rigorosamente válido. NENHUM texto markdown.
Use aspas simples (') se precisar adicionar aspas dentro do texto.
NUNCA adicione vírgula no último item de uma lista ou objeto.

FORMATO OBRIGATÓRIO DE SAÍDA JSON:
{
  "diagnosticosNANDA": [
    {
      "titulo": "Risco de...",
      "fatorRelacionado": "Fator que causa o problema (se houver/se aplicável)",
      "caracteristicaDefinidora": "Sinal ou sintoma (se houver/se aplicável)"
    }
  ],
  "intervencoesNIC": [
    "Intervenção 1 com base no protocolo ANVISA",
    "Monitoramento de ..."
  ],
  "resultadosNOC": [
    "Melhora do estado...",
    "Ausência de sinais de..."
  ],
  "riscoBradenAnalise": "Breve texto explicativo sobre o risco de LPP do paciente baseado na avaliação",
  "riscoMorseAnalise": "Breve texto explicativo sobre o risco de queda"
}`;

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text;
      if (!text) throw new Error("A IA não retornou nenhum texto.");

      const cleanedJsonStr = sanitizeJsonString(text);
      console.log("Raw AI Nursing String:", text);
      console.log("Cleaned Nursing JSON:", cleanedJsonStr);

      const parsedData = JSON.parse(cleanedJsonStr);
      setNursingResults(parsedData);

    } catch (error: any) {
      console.error("Erro detalhado na IA (Enfermagem):", error);
      alert(`Erro ao contatar API ou processar dados: ${error?.message || 'Erro desconhecido'}

Abra o console do navegador (F12) para mais detalhes.`);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleNursingCheck = (category: string, item: string) => {
    setNursingAssessment((prev: any) => {
      const currentList = prev[category] || [];
      if (currentList.includes(item)) {
        return { ...prev, [category]: currentList.filter((i: string) => i !== item) };
      }
      return { ...prev, [category]: [...currentList, item] };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full font-sans text-gray-900">
      {/* Modern, Sticky Glassmorphism Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50 transition-all duration-300 print:hidden">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2.5 rounded-xl shadow-md shadow-blue-500/20 transform hover:scale-105 transition-transform">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-500 bg-clip-text text-transparent tracking-tight">
                Smart AIH
              </h1>
              <span className="text-xs text-gray-500 font-semibold tracking-wider uppercase hidden sm:block">Inteligência Clínica & Faturamento</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <Key className="w-4 h-4 text-gray-400" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Google Gemini API Key"
              className="bg-transparent border-none focus:outline-none text-sm w-48 xl:w-64 placeholder-gray-400"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12 md:py-16">

        {/* Main Search Container */}
        <div className={`bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 mb-8 overflow-hidden ${aiResults.length > 0 ? 'print:hidden' : ''}`}>

          {/* Segmented Control Tabs */}
          <div className="bg-gray-50 p-2 border-b border-gray-100 print:hidden">
            <div className="flex flex-col sm:flex-row p-2 bg-gray-200/70 rounded-2xl gap-2">
              <button
                onClick={() => setActiveTab('cid')}
                className={`flex-1 py-4 px-6 font-bold text-base sm:text-lg text-center transition-all duration-300 rounded-xl ${activeTab === 'cid' ? 'bg-white text-blue-700 shadow-md ring-1 ring-gray-200 transform scale-[1.02]' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'} `}
              >
                1. Já sei o CID principal
              </button>
              <button
                onClick={() => setActiveTab('symptoms')}
                className={`flex-1 py-4 px-6 font-bold text-base sm:text-lg text-center transition-all duration-300 rounded-xl ${activeTab === 'symptoms' ? 'bg-white text-blue-700 shadow-md ring-1 ring-gray-200 transform scale-[1.02]' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'} `}
              >
                2. Buscar por Sintomas/Quadro Clínico
              </button>
              <button
                onClick={() => setActiveTab('nursing')}
                className={`flex-1 py-4 px-6 font-bold text-base sm:text-lg text-center transition-all duration-300 rounded-xl ${activeTab === 'nursing' ? 'bg-white text-blue-700 shadow-md ring-1 ring-gray-200 transform scale-[1.02]' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'} `}
              >
                3. Processo de Enfermagem (SAE)
              </button>
            </div>
          </div>

          {/* Search Inputs area */}
          <div className="p-6 md:p-8">
            {activeTab === 'cid' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <label className="block text-sm font-bold text-gray-700 mb-3 tracking-wide flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" /> Digite o código ou nome do CID-10
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleCidSearch(e.target.value)}
                    onFocus={() => { if (searchQuery.length > 0) setIsShowingSuggestions(true) }}
                    className="block w-full pl-11 pr-4 py-4 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow text-lg"
                    placeholder="Ex: R10.4, Apendicite, Pneumonia, etc..."
                  />

                  {/* Suggestions Dropdown */}
                  {isShowingSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-blue-100 max-h-96 overflow-y-auto ring-1 ring-black ring-opacity-5">
                      <div className="sticky top-0 bg-blue-50/90 backdrop-blur-sm border-b border-blue-100 px-5 py-2 text-xs font-bold text-blue-800 uppercase tracking-wide z-10">
                        {suggestions.length} resultados encontrados
                      </div>
                      <ul className="py-1">
                        {suggestions.map((item: CidSigtapRelation) => (
                          <li key={item.cid}>
                            <button
                              onClick={() => selectCid(item)}
                              className="w-full text-left px-5 py-4 hover:bg-blue-50 focus:bg-blue-100 focus:outline-none transition-colors border-b border-gray-100 last:border-0 flex items-center justify-between group"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                <span className="font-black text-blue-700 text-lg w-16 flex-shrink-0">{item.cid}</span>
                                <span className="text-gray-800 font-medium text-base">{item.cidNome}</span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 ml-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isShowingSuggestions && suggestions.length === 0 && searchQuery.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 p-4 text-gray-500 text-center text-sm">
                      Nenhum CID encontrado para essa busca.
                    </div>
                  )}
                </div>
                <p className="mt-4 text-sm text-gray-500">Iremos buscar automaticamente os procedimentos SIGTAP compatíveis após a seleção.</p>
              </div>
            )}

            {activeTab === 'symptoms' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-blue-900/5 mb-8 transform transition-all hover:scale-[1.01]">
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Nome do Paciente</label>
                      <input
                        type="text"
                        placeholder="Nome completo..."
                        className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={patientName}
                        onChange={e => setPatientName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Prontuário / Registro</label>
                      <input
                        type="text"
                        placeholder="Nº do prontuário..."
                        className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        value={medicalRecord}
                        onChange={e => setMedicalRecord(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <label className="block text-sm font-bold text-gray-700 mb-3 tracking-wide flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-500" /> Justificativa Clínica (Sinais, Sintomas, Exames)
                </label>
                <div className="mb-6 break-inside-avoid-page print:break-inside-avoid">
                  {/* Visível na tela, editável */}
                  <textarea
                    rows={5}
                    value={clinicalText}
                    onChange={(e) => setClinicalText(e.target.value)}
                    className="block w-full p-5 border-2 border-transparent bg-gray-50 rounded-2xl leading-relaxed placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-800 text-lg resize-none shadow-inner print:hidden"
                    placeholder="Cole ou digite aqui o quadro clínico (Ex: Paciente admitido no PS com febre, dor em fossa ilíaca direita intensa...)"
                  />
                  {/* Visível apenas na impressão para não cortar texto longo (auto-expansível) */}
                  <div className="hidden print:block w-full p-5 border border-gray-200 bg-white rounded-2xl leading-relaxed text-gray-800 text-lg whitespace-pre-wrap">
                    {clinicalText || "Nenhum quadro clínico informado."}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 mb-8 shadow-sm print:break-inside-avoid">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-500" /> Histórico do Paciente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Data de Nascimento</label>
                      <input type="date" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={historicoPaciente.dataNascimento} onChange={e => setHistoricoPaciente({ ...historicoPaciente, dataNascimento: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Alergias</label>
                      <input type="text" placeholder="Ex: Dipirona, Iodo, etc..." className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={historicoPaciente.alergias} onChange={e => setHistoricoPaciente({ ...historicoPaciente, alergias: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Comorbidades / Doenças Crônicas</label>
                      <textarea rows={2} placeholder="Ex: HAS, Diabetes Tipo 2, Asma..." className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all" value={historicoPaciente.comorbidades} onChange={e => setHistoricoPaciente({ ...historicoPaciente, comorbidades: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Medicamentos em Uso Contínuo</label>
                      <textarea rows={2} placeholder="Ex: Losartana 50mg, Metformina..." className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none transition-all" value={historicoPaciente.medicamentos} onChange={e => setHistoricoPaciente({ ...historicoPaciente, medicamentos: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 mb-8 shadow-sm print:break-inside-avoid">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-rose-500" /> Sinais Vitais <span className="text-xs font-semibold normal-case text-gray-500 bg-gray-100 px-3 py-1 rounded-md ml-2">Opcional p/ Manchester</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">PA (mmHg)</label><input type="text" placeholder="120x80" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.pa} onChange={e => setSinaisVitais({ ...sinaisVitais, pa: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">FC (bpm)</label><input type="text" placeholder="80" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.fc} onChange={e => setSinaisVitais({ ...sinaisVitais, fc: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">FR (irpm)</label><input type="text" placeholder="18" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.fr} onChange={e => setSinaisVitais({ ...sinaisVitais, fr: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Temp (ºC)</label><input type="text" placeholder="36.5" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.temp} onChange={e => setSinaisVitais({ ...sinaisVitais, temp: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">SpO2 (%)</label><input type="text" placeholder="98" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.spo2} onChange={e => setSinaisVitais({ ...sinaisVitais, spo2: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">HGT (mg/dL)</label><input type="text" placeholder="99" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.hgt} onChange={e => setSinaisVitais({ ...sinaisVitais, hgt: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Peso (kg)</label><input type="text" placeholder="70" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.peso} onChange={e => setSinaisVitais({ ...sinaisVitais, peso: e.target.value })} /></div>
                    <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Altura (m)</label><input type="text" placeholder="1.75" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.altura} onChange={e => setSinaisVitais({ ...sinaisVitais, altura: e.target.value })} /></div>
                    <div className="md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Dor (0-10)</label>
                        <select className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer transition-all" value={sinaisVitais.dor} onChange={e => setSinaisVitais({ ...sinaisVitais, dor: e.target.value })}>
                          <option value="">Sem registro</option>
                          <option value="0">0 - Sem Dor</option>
                          <option value="1">1 - Muito Leve</option>
                          <option value="2">2 - Leve</option>
                          <option value="3">3 - Leve (Desconforto)</option>
                          <option value="4">4 - Moderada</option>
                          <option value="5">5 - Moderada (Incomoda muito)</option>
                          <option value="6">6 - Moderada a Forte</option>
                          <option value="7">7 - Forte</option>
                          <option value="8">8 - Forte a Muito Forte</option>
                          <option value="9">9 - Muito Forte</option>
                          <option value="10">10 - Pior Dor Possível</option>
                        </select>
                      </div>
                      <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Glasgow</label><input type="text" placeholder="15" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.glasgow} onChange={e => setSinaisVitais({ ...sinaisVitais, glasgow: e.target.value })} /></div>
                      <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">Altura Uterina (cm)</label><input type="text" placeholder="32" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.alturaUterina} onChange={e => setSinaisVitais({ ...sinaisVitais, alturaUterina: e.target.value })} /></div>
                      <div><label className="text-sm font-bold text-gray-700 mb-2 block tracking-wide">BCF (bpm)</label><input type="text" placeholder="140" className="w-full text-base p-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" value={sinaisVitais.bcf} onChange={e => setSinaisVitais({ ...sinaisVitais, bcf: e.target.value })} /></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-blue-100 mt-6 shadow-sm print:hidden">
                  <h3 className="text-sm font-bold text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                    Objetivo do Atendimento
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => setTipoAtendimento('observacao')}
                      className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${tipoAtendimento === 'observacao' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:bg-gray-50'}`}
                    >
                      <Eye className="w-6 h-6" />
                      <span className="font-bold">Apenas Observação</span>
                    </button>
                    <button
                      onClick={() => setTipoAtendimento('internacao')}
                      className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${tipoAtendimento === 'internacao' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:bg-gray-50'}`}
                    >
                      <Bed className="w-6 h-6" />
                      <span className="font-bold">Internação Clínica</span>
                    </button>
                    <button
                      onClick={() => setTipoAtendimento('cirurgia')}
                      className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${tipoAtendimento === 'cirurgia' ? 'border-red-500 bg-red-50 text-red-700 shadow-md transform scale-[1.02]' : 'border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:bg-gray-50'}`}
                    >
                      <Scissors className="w-6 h-6" />
                      <span className="font-bold">Procedimento Cirúrgico</span>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">Isso forçará a Inteligência Clínica a selecionar SOMENTE códigos e categorias de procedimentos compatíveis com a sua escolha acima.</p>
                </div>

                <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <span className="text-sm font-medium flex items-center gap-2">
                    {apiKey ? (
                      <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200"><CheckCircle2 className="w-4 h-4 inline mr-1" />API Conectada</span>
                    ) : (
                      <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200"><AlertTriangle className="w-4 h-4 inline mr-1" />Insira sua chave no topo</span>
                    )}
                  </span>
                  <button
                    onClick={handleAiAnalysis}
                    disabled={isLoadingAi || !clinicalText.trim() || !apiKey}
                    className="w-full sm:w-auto overflow-hidden relative group disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
                    <span className="relative flex items-center gap-2">
                      {isLoadingAi ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Processando Inteligência...
                        </>
                      ) : (
                        <>
                          <Activity className="w-5 h-5" /> Analisar Quadro com IA
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'nursing' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-blue-900/5 mb-8 print:shadow-none print:border-none print:p-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Activity className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-gray-800">Processo de Enfermagem (SAE)</h2>
                        <p className="text-sm text-gray-500 font-medium">Sistematização da Assistência de Enfermagem</p>
                      </div>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="bg-gray-50 rounded-2xl p-4 mb-6 border border-gray-100 print:hidden">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-500">
                        Etapa {currentSection + 1} de {saeSections.length}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {Math.round(((currentSection + 1) / saeSections.length) * 100)}% Completo
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${((currentSection + 1) / saeSections.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-center mt-3 font-bold text-gray-700 bg-white py-2 rounded-lg border border-gray-100 shadow-sm">
                      {saeSections[currentSection]}
                    </p>
                  </div>

                  {/* WIZARD CONTENT SECTIONS */}
                  <div className="min-h-[400px]">
                    {/* Section 1: Dados do Paciente */}
                    {currentSection === 0 && (
                      <div className="animate-in fade-in duration-300">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                          <h3 className="text-sm font-bold text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <Activity className="w-4 h-4 text-blue-500" /> Identificação e Internação
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2"><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Nome do Paciente</label><input type="text" placeholder="Nome Completo" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={patientName} onChange={e => setPatientName(e.target.value)} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Prontuário</label><input type="text" placeholder="Ex: 596290" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={medicalRecord} onChange={e => setMedicalRecord(e.target.value)} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Nascimento</label><input type="date" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={historicoPaciente.dataNascimento || ''} onChange={e => setHistoricoPaciente({ ...historicoPaciente, dataNascimento: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Data de Internação</label><input type="date" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={nursingAssessment.dataInternacao || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, dataInternacao: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Leito</label><input type="text" placeholder="Ex: UTI-01" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={nursingAssessment.leito || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, leito: e.target.value })} /></div>
                            <div className="md:col-span-3"><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Hipótese Diagnóstica / Quadro</label><input type="text" placeholder="Ex: Sepse de Foco Pulmonar, Pós-Op..." className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-gray-50 focus:bg-white" value={nursingAssessment.hipoteseDiagnostica || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, hipoteseDiagnostica: e.target.value })} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 2: Sinais Vitais */}
                    {currentSection === 1 && (
                      <div className="animate-in fade-in duration-300">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-rose-500">
                          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                            <Activity className="w-4 h-4 text-rose-500" /> Sinais Vitais Atuais
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Pressão Arterial (PA)</label><input type="text" placeholder="Ex: 120x80 mmHg" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.pa || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, pa: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Frequência Cardíaca (FC/Pulso)</label><input type="text" placeholder="Ex: 80 bpm" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.fc || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, fc: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Saturação (SpO2)</label><input type="text" placeholder="Ex: 98%" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.spo2 || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, spo2: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Frequência Respiratória (FR)</label><input type="text" placeholder="Ex: 18 irpm" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.fr || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, fr: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Temperatura (Temp)</label><input type="text" placeholder="Ex: 36.5 °C" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.temp || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, temp: e.target.value })} /></div>
                            <div><label className="text-sm font-bold text-gray-700 uppercase block tracking-wide mb-2">Glicemia (HGT)</label><input type="text" placeholder="Ex: 100 mg/dL" className="w-full text-base p-4 border border-gray-300 rounded-xl focus:ring-4 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all bg-gray-50 focus:bg-white" value={sinaisVitais.hgt || ''} onChange={e => setSinaisVitais({ ...sinaisVitais, hgt: e.target.value })} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 3: Avaliação Neurológica */}
                    {currentSection === 2 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                          <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Estado Neurológico</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                            {['Lúcido', 'Desorientado', 'Confuso', 'Agitado', 'Letárgico', 'Comatoso', 'Déficit Motor'].map(item => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-blue-50 p-2.5 rounded-xl border border-transparent hover:border-blue-100 transition-all">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" checked={(nursingAssessment.neurologicalStatus || []).includes(item)} onChange={() => handleNursingCheck('neurologicalStatus', item)} />
                                <span className="group-hover:text-blue-700 font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-blue-400">
                          <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Pupilas</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
                            {['Isocóricas', 'Anisocóricas', 'Mióticas', 'Midriáticas', 'Fotorreagentes', 'Não-reagentes'].map(item => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-blue-50 p-2.5 rounded-xl border border-transparent hover:border-blue-100 transition-all">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer" checked={(nursingAssessment.pupils || []).includes(item)} onChange={() => handleNursingCheck('pupils', item)} />
                                <span className="group-hover:text-blue-700 font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 4: Avaliação Respiratória */}
                    {currentSection === 3 && (
                      <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-cyan-500">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> Oxigenação & Respiração</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                          {['Eupneico', 'Taquipneico', 'Bradipneico', 'Dispneico', 'Uso de Musculatura Acessória', 'Cianose', 'Tosse Produtiva', 'Tosse Seca', 'Ventilação Mecânica', 'Cateter de O2', 'Máscara de Venturi', 'Macronebulização'].map(item => (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-cyan-50 p-2.5 rounded-xl border border-transparent hover:border-cyan-100 transition-all">
                              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 transition-all cursor-pointer" checked={(nursingAssessment.oxygenation || []).includes(item)} onChange={() => handleNursingCheck('oxygenation', item)} />
                              <span className="group-hover:text-cyan-700 font-medium">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 5: Avaliação Cardiovascular */}
                    {currentSection === 4 && (
                      <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-pink-500">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Sistema Cardiovascular e Perfusão</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                          {['Normotenso', 'Hipertenso', 'Hipotenso', 'Taquicárdico', 'Bradicárdico', 'Arritmia', 'Edema Periférico', 'Perfusão Periférica Lenta', 'Palidez', 'Pulso Fino', 'Pulso Cheio'].map(item => (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-pink-50 p-2.5 rounded-xl border border-transparent hover:border-pink-100 transition-all">
                              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-pink-600 focus:ring-pink-500 transition-all cursor-pointer" checked={(nursingAssessment.vascular || []).includes(item)} onChange={() => handleNursingCheck('vascular', item)} />
                              <span className="group-hover:text-pink-700 font-medium">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 6: Avaliação de Pele */}
                    {currentSection === 5 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-orange-400">
                          <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400"></div> Pele e Integridade Cutânea</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                            {['Pele Íntegra', 'Corada', 'Hidratada', 'Desidratada', 'Ictérica', 'Eritema', 'Equimose', 'Hematoma', 'Lesão por Pressão (LPP)', 'Ferida Operatória', 'Curativo Oclusivo'].map(item => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-orange-50 p-2.5 rounded-xl border border-transparent hover:border-orange-100 transition-all">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500 transition-all cursor-pointer" checked={(nursingAssessment.skin || []).includes(item)} onChange={() => handleNursingCheck('skin', item)} />
                                <span className="group-hover:text-orange-700 font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-red-400">
                          <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400"></div> Termorregulação</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-gray-700">
                            {['Normotérmico', 'Febril', 'Hipotérmico', 'Sudorese Fria', 'Calafrios'].map(item => (
                              <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-red-50 p-2.5 rounded-xl border border-transparent hover:border-red-100 transition-all">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-500 transition-all cursor-pointer" checked={(nursingAssessment.thermalRegulation || []).includes(item)} onChange={() => handleNursingCheck('thermalRegulation', item)} />
                                <span className="group-hover:text-red-700 font-medium">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 7: Avaliação Gastrointestinal */}
                    {currentSection === 6 && (
                      <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-emerald-500">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Gastrointestinal & Exame Abdominal</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                          {['Abdome Plano', 'Abdome Globoso', 'Abdome Distendido', 'Dor à Palpação', 'Ruídos Hidroaéreos Presentes', 'RHA Ausentes/Diminuídos', 'Vômito', 'Náusea', 'Diarreia', 'Constipação', 'Sonda Nasoentérica (SNE)', 'Estomia Intestinal', 'Melena', 'Jejum'].map(item => (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-emerald-50 p-2.5 rounded-xl border border-transparent hover:border-emerald-100 transition-all">
                              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer" checked={(nursingAssessment.gastrointestinal || []).includes(item)} onChange={() => handleNursingCheck('gastrointestinal', item)} />
                              <span className="group-hover:text-emerald-800 font-medium">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 8: Avaliação Urinária */}
                    {currentSection === 7 && (
                      <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-yellow-500">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> Sistema Genitourinário</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 text-sm text-gray-700">
                          {['Diurese Espontânea', 'Oligúria', 'Anúria', 'Disúria', 'Hematúria', 'Urina Colúrica', 'Poliúria', 'Sonda Vesical de Demora (SVD)', 'Sonda Vesical de Alívio', 'Incontinência Urinária'].map(item => (
                            <label key={item} className="flex items-center gap-3 cursor-pointer group bg-gray-50 hover:bg-yellow-50 p-2.5 rounded-xl border border-transparent hover:border-yellow-100 transition-all">
                              <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500 transition-all cursor-pointer" checked={(nursingAssessment.urinary || []).includes(item)} onChange={() => handleNursingCheck('urinary', item)} />
                              <span className="group-hover:text-yellow-700 font-medium">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 9: Cateteres e Sondas */}
                    {currentSection === 8 && (
                      <div className="animate-in fade-in duration-300 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-indigo-500">
                        <h4 className="font-bold text-sm text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Acessos, Drenos e Dispositivos Especiais</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-gray-700">
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Acesso Venoso (Tipo/Local)</label>
                            <input type="text" placeholder="Ex: AVP MSD, CVC Subclávia" className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow bg-gray-50 focus:bg-white" value={nursingAssessment.catheters?.peripheral || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, catheters: { ...nursingAssessment.catheters, peripheral: e.target.value } })} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Sonda/Cateter Vesical</label>
                            <input type="text" placeholder="Ex: SVD Fio Guia, Shilley" className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow bg-gray-50 focus:bg-white" value={nursingAssessment.catheters?.vesicalProbe || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, catheters: { ...nursingAssessment.catheters, vesicalProbe: e.target.value } })} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-gray-500 font-semibold uppercase block mb-1">Drenos</label>
                            <input type="text" placeholder="Ex: Dreno Torácico D, Penrose" className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow bg-gray-50 focus:bg-white" value={nursingAssessment.catheters?.drain || ''} onChange={e => setNursingAssessment({ ...nursingAssessment, catheters: { ...nursingAssessment.catheters, drain: e.target.value } })} />
                          </div>
                          <div className="md:col-span-2 lg:col-span-3 pt-4 border-t border-gray-100">
                            <label className="text-xs text-gray-500 font-semibold uppercase block mb-3">Via Alimentar / Suporte Nutricional</label>
                            <div className="flex flex-wrap gap-2">
                              {['Dieta Oral', 'SNE', 'SNG', 'Gastrostomia', 'NPT (Nutrição Parenteral)', 'Jejum'].map(item => (
                                <label key={item} className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-indigo-50 px-3 py-2 rounded-lg border border-transparent hover:border-indigo-100 transition-all">
                                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer" checked={(nursingAssessment.catheters?.feeding || []).includes(item)} onChange={() => {
                                    const currentFeeding = nursingAssessment.catheters?.feeding || [];
                                    const newFeeding = currentFeeding.includes(item) ? currentFeeding.filter((i: string) => i !== item) : [...currentFeeding, item];
                                    setNursingAssessment({ ...nursingAssessment, catheters: { ...nursingAssessment.catheters, feeding: newFeeding } });
                                  }} />
                                  <span className="text-sm font-medium">{item}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 10: Escala de Braden */}
                    {currentSection === 9 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                          <h4 className="font-bold text-lg text-gray-800 mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500"></div> Escala de Braden Manual
                            </span>
                            <div className="px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                              Escore: <span className="font-bold text-lg">{bradenScore.total}</span> - {getBradenRisk(bradenScore.total)}
                            </div>
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Percepção Sensorial */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">1. Percepção Sensorial</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Completamente limitado' }, { v: 2, l: 'Muito limitado' }, { v: 3, l: 'Levemente limitado' }, { v: 4, l: 'Nenhuma limitação' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.sensoryPerception === opt.v} onChange={() => setBradenScore({ ...bradenScore, sensoryPerception: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Umidade */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">2. Umidade</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Constantemente úmida' }, { v: 2, l: 'Muito úmida' }, { v: 3, l: 'Ocasionalmente úmida' }, { v: 4, l: 'Raramente úmida' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.moisture === opt.v} onChange={() => setBradenScore({ ...bradenScore, moisture: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Atividade */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">3. Atividade</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Acamado' }, { v: 2, l: 'Confinado à cadeira' }, { v: 3, l: 'Anda ocasionalmente' }, { v: 4, l: 'Anda frequentemente' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.activity === opt.v} onChange={() => setBradenScore({ ...bradenScore, activity: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Mobilidade */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">4. Mobilidade</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Totalmente imóvel' }, { v: 2, l: 'Bastante limitado' }, { v: 3, l: 'Levemente limitado' }, { v: 4, l: 'Não apresenta limitações' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.mobility === opt.v} onChange={() => setBradenScore({ ...bradenScore, mobility: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Nutrição */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">5. Nutrição</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Muito pobre' }, { v: 2, l: 'Provavelmente inadequada' }, { v: 3, l: 'Adequada' }, { v: 4, l: 'Excelente' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.nutrition === opt.v} onChange={() => setBradenScore({ ...bradenScore, nutrition: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Fricção e Cisalhamento */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">6. Fricção e Cisalhamento</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Problema' }, { v: 2, l: 'Problema em potencial' }, { v: 3, l: 'Nenhum problema aparente' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                    <input type="radio" checked={bradenScore.frictionShear === opt.v} onChange={() => setBradenScore({ ...bradenScore, frictionShear: opt.v })} className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 11: Escala de Morse */}
                    {currentSection === 10 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                          <h4 className="font-bold text-lg text-gray-800 mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500"></div> Escala de Morse Manual
                            </span>
                            <div className="px-4 py-2 bg-orange-50 text-orange-700 rounded-xl text-sm border border-orange-100">
                              Escore: <span className="font-bold text-lg">{morseScore.total}</span> - {getMorseRisk(morseScore.total)}
                            </div>
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Histórico de Quedas */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">1. Histórico de Quedas</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Não' }, { v: 25, l: 'Sim' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.fallHistory === opt.v} onChange={() => setMorseScore({ ...morseScore, fallHistory: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Diagnóstico Secundário */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">2. Diagnóstico Secundário</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Não' }, { v: 15, l: 'Sim' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.secondaryDiagnosis === opt.v} onChange={() => setMorseScore({ ...morseScore, secondaryDiagnosis: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Auxílio na Deambulação */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">3. Auxílio na Deambulação</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Nenhum/Acamado/Auxílio de enfermagem' }, { v: 15, l: 'Muletas/Bengala/Andador' }, { v: 30, l: 'Apoio em Mobília' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.ambulatoryAid === opt.v} onChange={() => setMorseScore({ ...morseScore, ambulatoryAid: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Terapia Endovenosa */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">4. Terapia Endovenosa</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Não' }, { v: 20, l: 'Sim' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.ivTherapy === opt.v} onChange={() => setMorseScore({ ...morseScore, ivTherapy: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Marcha */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">5. Marcha</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Normal/Acamado/Cadeira de rodas' }, { v: 10, l: 'Fraca' }, { v: 20, l: 'Comprometida' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.gait === opt.v} onChange={() => setMorseScore({ ...morseScore, gait: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Estado Mental */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">6. Estado Mental</label>
                              <div className="space-y-2">
                                {[{ v: 0, l: 'Orientado/Capaz' }, { v: 15, l: 'Superestima/Esquece limitações' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-orange-50 transition-colors">
                                    <input type="radio" checked={morseScore.mentalStatus === opt.v} onChange={() => setMorseScore({ ...morseScore, mentalStatus: opt.v })} className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 12: Escala de Fugulin */}
                    {currentSection === 11 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                          <h4 className="font-bold text-lg text-gray-800 mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500"></div> Escala de Fugulin (Grau de Dependência)
                            </span>
                            <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm border border-purple-100">
                              Escore: <span className="font-bold text-lg">{fugulinScore.total}</span> - {getFugulinCareLevel(fugulinScore.total)}
                            </div>
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Estado Mental */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">1. Estado Mental</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Consciente e Orientado' }, { v: 2, l: 'Confuso' }, { v: 3, l: 'Períodos de Inconsciência' }, { v: 4, l: 'Inconsciente/Coma' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.mentalStatus === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, mentalStatus: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Oxigenação */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">2. Oxigenação</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Ar ambiente' }, { v: 2, l: 'Necessita de O2 (Cateter/Máscara)' }, { v: 3, l: 'VNI / CPAP' }, { v: 4, l: 'Ventilação Mecânica / Intubado' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.oxygenation === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, oxygenation: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Sinais Vitais */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">3. Sinais Vitais</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Rotina (Ex: 6/6h)' }, { v: 2, l: 'A cada 4 horas' }, { v: 3, l: 'A cada 2 horas' }, { v: 4, l: 'Controles Contínuos' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.vitalSigns === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, vitalSigns: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Motilidade */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">4. Motilidade</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Movimentação Ampla' }, { v: 2, l: 'Limitação de Movimentos' }, { v: 3, l: 'Dificuldade p/ movimentar-se' }, { v: 4, l: 'Totalmente Imóvel' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.motility === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, motility: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Deambulação */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">5. Deambulação</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Ambulante' }, { v: 2, l: 'Deambula com Auxílio' }, { v: 3, l: 'Restrito à Cadeira/Poltrona' }, { v: 4, l: 'Restrito ao Leito' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.walking === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, walking: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Alimentação */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">6. Alimentação</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Auto-suficiente' }, { v: 2, l: 'Auxílio Parcial' }, { v: 3, l: 'Sonda Nasogástrica/Enteral' }, { v: 4, l: 'Nutrição Parenteral / Jejum estrito' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.feeding === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, feeding: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Cuidado Corporal / Higiene */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">7. Cuidado Corporal / Cuidado com a pele</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Autocuidado (Banho de chuveiro)' }, { v: 2, l: 'Auxílio no chuveiro/cadeira' }, { v: 3, l: 'Banho no leito parcial' }, { v: 4, l: 'Banho no leito total (Higiene íntima/oral)' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.bodyCare === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, bodyCare: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Eliminação */}
                            <div className="space-y-3">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">8. Eliminação</label>
                              <div className="space-y-2">
                                {[{ v: 1, l: 'Uso de banheiro independente' }, { v: 2, l: 'Comadre/papagaio c/ auxílio' }, { v: 3, l: 'Sonda Vesical / Fralda / Ostomia' }, { v: 4, l: 'Evacuação no leito / Descontrole / Diálise' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.elimination === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, elimination: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            {/* Terapêutica */}
                            <div className="space-y-3 md:col-span-2">
                              <label className="text-sm font-bold text-gray-800 mb-2 block">9. Terapêutica</label>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {[{ v: 1, l: 'IM/VO/SC (Até 2x/dia)' }, { v: 2, l: 'EV Intermitente (Até 4x/dia)' }, { v: 3, l: 'EV Contínua / NPP / Sangue' }, { v: 4, l: 'Drogas Vasoativas / Hemoderivados contínuos' }].map(opt => (
                                  <label key={opt.v} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-purple-50 transition-colors">
                                    <input type="radio" checked={fugulinScore.therapeutics === opt.v} onChange={() => setFugulinScore({ ...fugulinScore, therapeutics: opt.v })} className="w-4 h-4 text-purple-600 border-gray-300 focus:ring-purple-500 cursor-pointer" />
                                    <span className="text-sm text-gray-700 font-medium">{opt.l} ({opt.v})</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 13: Análise IA */}
                    {currentSection === 12 && (
                      <div className="animate-in fade-in duration-300 space-y-6">
                        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm text-center">
                          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <Activity className="w-10 h-10" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-800 mb-3">Conclusão da Avaliação de Enfermagem</h3>
                          <p className="text-gray-600 max-w-xl mx-auto mb-8 text-lg">
                            Você completou todas as etapas {nursingResults ? 'com sucesso.' : 'da avaliação. Clique no botão abaixo para enviar os dados à Inteligência Artificial e gerar seu plano de cuidados estruturado.'}
                          </p>

                          {!nursingResults ? (
                            <button
                              onClick={handleNursingAnalysis}
                              disabled={isLoadingAi || !apiKey}
                              className="w-full md:w-auto overflow-hidden relative group disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 mx-auto text-lg"
                            >
                              {isLoadingAi ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                  Processando Dados Clínicos...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-7 h-7" /> Gerar Plano NANDA / NIC / NOC
                                </>
                              )}
                            </button>
                          ) : (
                            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 inline-flex items-center gap-2 font-bold mb-4">
                              <CheckCircle2 className="w-5 h-5" /> Plano de Cuidados Gerado com Sucesso! (Role para baixo)
                            </div>
                          )}

                          {!apiKey && (
                            <p className="text-red-500 text-sm mt-4 font-bold flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4" /> Configuração Obrigatória: Insira a API Key do Google Gemini no topo da página antes de continuar.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation Footer */}
                  <div className="pt-6 mt-8 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden">
                    <button
                      onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                      disabled={currentSection === 0}
                      className="w-full sm:w-auto px-6 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => setCurrentSection(0)}
                        className="w-full sm:w-auto px-6 py-2.5 font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
                      >
                        Início
                      </button>

                      {currentSection < saeSections.length - 1 ? (
                        <button
                          onClick={() => setCurrentSection(Math.min(saeSections.length - 1, currentSection + 1))}
                          className="w-full sm:w-auto px-8 py-2.5 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          Próximo <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => window.print()}
                          className="w-full sm:w-auto px-8 py-2.5 font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                          Salvar Resumo (PDF)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Area */}
        {(results.cidSelecionado || aiResults.length > 0 || nursingResults) ? (
          <div className="flex flex-col gap-6">
            {/* Cabecalho de Identificacao do Paciente (Para Impressao/PDF) */}
            {(patientName || medicalRecord || historicoPaciente.dataNascimento) && (
              <div className="bg-white border-2 border-gray-800 rounded-xl p-6 mb-4 print:border-black print:mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-bold block mb-1">Paciente</span>
                    <h2 className="text-2xl font-black text-gray-900 uppercase">{patientName || 'NÃO INFORMADO'}</h2>
                    {historicoPaciente.dataNascimento && (
                      <p className="text-sm font-medium text-gray-600 mt-1">Nasc: {new Date(historicoPaciente.dataNascimento).toLocaleDateString('pt-BR')} (Idade: {calcularIdadeExata(historicoPaciente.dataNascimento)})</p>
                    )}
                  </div>
                  <div className="md:text-right bg-gray-100 px-4 py-2 rounded-lg print:bg-transparent print:border print:border-gray-300 print:px-0 print:py-0">
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-bold block mb-1">Prontuário / Registro</span>
                    <span className="text-xl font-mono font-bold text-blue-900">{medicalRecord || 'NÃO INFORMADO'}</span>
                  </div>
                </div>

                {/* Resumo Clínico Exclusivo para Impressão */}
                <div className="mt-6 pt-5 border-t border-gray-200 hidden print:block">
                  <h3 className="font-bold text-sm text-gray-800 uppercase tracking-widest mb-3">Resumo Clínico e Sinais Vitais</h3>
                  {clinicalText && <p className="text-sm text-gray-800 mb-4 whitespace-pre-wrap"><span className="font-semibold text-gray-500 mr-2 uppercase">Quadro:</span> {clinicalText}</p>}

                  <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 p-3 rounded-lg border border-gray-200">
                    {sinaisVitais.pa && <div><span className="font-bold block text-xs text-gray-500 uppercase">PA</span>{sinaisVitais.pa}</div>}
                    {sinaisVitais.fc && <div><span className="font-bold block text-xs text-gray-500 uppercase">FC</span>{sinaisVitais.fc}</div>}
                    {sinaisVitais.spo2 && <div><span className="font-bold block text-xs text-gray-500 uppercase">SpO2</span>{sinaisVitais.spo2}</div>}
                    {sinaisVitais.temp && <div><span className="font-bold block text-xs text-gray-500 uppercase">Temp</span>{sinaisVitais.temp}</div>}
                    {sinaisVitais.fr && <div><span className="font-bold block text-xs text-gray-500 uppercase">FR</span>{sinaisVitais.fr}</div>}
                    {sinaisVitais.hgt && <div><span className="font-bold block text-xs text-gray-500 uppercase">Glicemia</span>{sinaisVitais.hgt}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Área de Preenchimento do Profissional (Apenas Tela, Não Imprime) */}
            <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-5 mb-4 print:hidden">
              <h3 className="font-bold text-sm text-gray-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                Assinatura do Documento
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
                    {activeTab === 'nursing' ? 'Nome do Enfermeiro(a)' : 'Nome do Médico Solicitante'}
                  </label>
                  <input
                    type="text"
                    placeholder={activeTab === 'nursing' ? "Ex: Enf. Ana Silva" : "Ex: Dr. João Pedro"}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={professionalName}
                    onChange={e => setProfessionalName(e.target.value)}
                  />
                </div>
                {activeTab === 'nursing' && (
                  <div className="w-full sm:w-1/3">
                    <label className="text-xs font-bold text-gray-600 uppercase block mb-1">COREN</label>
                    <input
                      type="text"
                      placeholder="Ex: 123456-SP"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      value={professionalCoren}
                      onChange={e => setProfessionalCoren(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Header if AI generated multiple results */}
            {aiResults.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-blue-800 print:hidden">
                <div className="flex items-center gap-3">
                  <Stethoscope className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h3 className="font-bold">Análise da Inteligência Artificial Concluída</h3>
                    <p className="text-sm">Foram encontrados {aiResults.length} CIDs clinicamente prováveis para o quadro descrito, com seus respectivos procedimentos SIGTAP sugeridos.</p>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Salvar em PDF
                </button>
              </div>
            )}

            {/* Mapping over single result or AI results array */}
            {(aiResults.length > 0 ? aiResults : [results]).map((res: any, index: number) => {
              // Map Manchester Colors to Tailwind Classes
              let manchesterBg = 'bg-gray-100';
              let manchesterText = 'text-gray-800';
              let manchesterBorder = 'border-gray-200';
              const corLower = res.classificacaoManchester?.cor?.toLowerCase() || '';

              if (corLower.includes('vermelho')) { manchesterBg = 'bg-red-600'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-red-700'; }
              else if (corLower.includes('laranja')) { manchesterBg = 'bg-orange-500'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-orange-600'; }
              else if (corLower.includes('amarelo')) { manchesterBg = 'bg-yellow-400'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-yellow-500'; }
              else if (corLower.includes('verde')) { manchesterBg = 'bg-green-500'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-green-600'; }
              else if (corLower.includes('azul')) { manchesterBg = 'bg-blue-500'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-blue-600'; }

              return (
                <div key={index} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-6 flex items-center gap-3 print:break-after-avoid">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-500 inline-block pb-1">
                        CID Principal: {res.cidSelecionado}
                      </h2>
                      <p className="text-gray-600 text-lg mt-1 font-medium">{res.nomeCid}</p>

                      {/* Secondary CIDs Rendering */}
                      {res.cidsSecundarios && res.cidsSecundarios.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {res.cidsSecundarios.map((sec: any, sIdx: number) => (
                            <span key={sIdx} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200" title={sec.nome}>
                              <span className="font-bold whitespace-nowrap">{sec.cid}</span>
                              <span className="opacity-70 mx-1">•</span>
                              <span>{sec.nome}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resposta do Manchester Rendering */}
                  {res.classificacaoManchester && (
                    <div className={`mb-6 rounded-2xl overflow-hidden shadow-sm border-2 ${manchesterBorder} relative break-inside-avoid print:break-inside-avoid print:bg-white print:border-4`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none print:hidden"></div>
                      <div className={`px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center gap-5 ${manchesterBg} print:bg-transparent`}>
                        <div className="flex-shrink-0 flex items-center gap-3 bg-white/20 p-3 rounded-2xl backdrop-blur-sm print:backdrop-blur-none print:bg-gray-100">
                          <Activity className={`w-8 h-8 ${manchesterText} print:text-black`} />
                        </div>
                        <div className="flex-1 relative z-10">
                          <h3 className={`font-black text-xl uppercase tracking-widest ${manchesterText} print:text-black mb-1 drop-shadow-sm print:drop-shadow-none`}>
                            TRIAGEM: {res.classificacaoManchester.cor}
                          </h3>
                          <div className={`text-sm md:text-base font-medium opacity-95 leading-relaxed ${manchesterText} print:text-black`}>
                            {res.classificacaoManchester.justificativa}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Exames Sugeridos Rendering */}
                  {res.examesSugeridos && res.examesSugeridos.length > 0 && (
                    <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow break-inside-avoid-page print:break-inside-avoid print:bg-white print:border-purple-300 print:border-2">
                      <div className="bg-white/60 backdrop-blur-md print:backdrop-blur-none print:bg-transparent px-6 py-4 border-b border-purple-100 flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg print:bg-purple-50"><Activity className="w-5 h-5 text-purple-600 print:text-purple-800" /></div>
                        <h3 className="font-bold text-purple-900 text-sm md:text-base uppercase tracking-wider print:text-black">Investigação Diagnóstica Sugerida</h3>
                      </div>
                      <div className="px-6 py-5 relative z-10">
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-purple-900/80 print:text-black">
                          {res.examesSugeridos.map((exame: string, eIdx: number) => (
                            <li key={eIdx} className="flex items-start gap-2.5 group">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 text-purple-700 print:bg-gray-200 print:text-black flex items-center justify-center text-xs font-bold mt-0.5 transition-colors">{eIdx + 1}</span>
                              <span className="font-medium leading-relaxed">{exame}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300 print:break-inside-avoid">
                    <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-200 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-black">{(res.procedimentos || []).length}</div>
                      <h3 className="font-bold text-gray-800 text-lg uppercase tracking-wide">Procedimentos SIGTAP Recomendados</h3>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {(res.procedimentos || []).map((proc: any, idx: number) => (
                        <div key={idx} className="p-6 hover:bg-blue-50/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {proc.codigo && (
                                  <span className="bg-blue-100 text-blue-800 text-sm font-mono font-bold px-3 py-1 rounded-md">
                                    {proc.codigo}
                                  </span>
                                )}
                                <h4 className="text-lg font-bold text-gray-900">{proc.nome}</h4>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6 mt-4 text-sm text-gray-600">
                                {proc.grupo && <div className="flex flex-col"><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Grupo</span>{proc.grupo}</div>}
                                {proc.subGrupo && <div className="flex flex-col"><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Sub-Grupo</span>{proc.subGrupo}</div>}
                                {proc.formaOrganizacao && <div className="flex flex-col md:col-span-2"><span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Forma de Organização</span>{proc.formaOrganizacao}</div>}
                              </div>
                            </div>

                            {/* Restricted Professional Alert Badge */}
                            {proc.restricaoProfissional && (
                              <div className="ml-4 flex-shrink-0 flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-3 rounded-xl border border-amber-200 max-w-xs">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                <div className="text-sm">
                                  <p className="font-bold">Atenção à Especialidade</p>
                                  <p className="font-medium opacity-90">{proc.restricaoProfissional}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Nursing Results Rendering */}
            {nursingResults && (
              <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:border-black print:border-2">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 flex flex-col md:flex-row justify-between md:items-center gap-3 print:bg-transparent print:bg-none print:border-b print:border-black">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 text-emerald-700 rounded-lg shadow-sm print:bg-gray-100 print:text-black"><Activity className="w-6 h-6" /></div>
                    <h3 className="text-xl font-black text-white tracking-wide drop-shadow-sm print:text-black print:drop-shadow-none uppercase">Processo de Enfermagem Gerado com IA</h3>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/50 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors print:hidden"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Salvar PDF
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* NANDA */}
                  <div className="bg-red-50 border border-red-100 rounded-xl p-5 break-inside-avoid print:bg-white print:border-2 print:border-red-800">
                    <h4 className="font-bold text-red-800 text-lg mb-4 flex items-center gap-2 border-b border-red-200 pb-2"><AlertTriangle className="w-5 h-5" /> Diagnósticos (NANDA-I)</h4>
                    <ul className="space-y-4">
                      {nursingResults.diagnosticosNANDA?.map((n: any, i: number) => (
                        <li key={i} className="text-sm text-gray-800 border-l-4 border-red-300 pl-3">
                          <span className="font-extrabold block text-red-900 drop-shadow-sm text-base">{n.titulo}</span>
                          {n.fatorRelacionado && <span className="block mt-1 font-medium text-gray-700"><b className="text-gray-900">Fator Relacionado:</b> {n.fatorRelacionado}</span>}
                          {n.caracteristicaDefinidora && <span className="block mt-1 font-medium text-gray-700"><b className="text-gray-900">Evidenciado por:</b> {n.caracteristicaDefinidora}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* NIC */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 break-inside-avoid print:bg-white print:border-2 print:border-blue-800">
                    <h4 className="font-bold text-blue-800 text-lg mb-4 flex items-center gap-2 border-b border-blue-200 pb-2"><Stethoscope className="w-5 h-5" /> Intervenções (NIC)</h4>
                    <ul className="list-none space-y-3">
                      {nursingResults.intervencoesNIC?.map((nic: string, i: number) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2 bg-white/50 p-2 rounded-md border border-blue-50/50 print:bg-gray-50 print:border-gray-200">
                          <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">{nic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* NOC */}
                  <div className="bg-green-50 border border-green-100 rounded-xl p-5 break-inside-avoid print:bg-white print:border-2 print:border-green-800">
                    <h4 className="font-bold text-green-800 text-lg mb-4 flex items-center gap-2 border-b border-green-200 pb-2"><CheckCircle2 className="w-5 h-5" /> Resultados (NOC)</h4>
                    <ul className="list-none space-y-3">
                      {nursingResults.resultadosNOC?.map((noc: string, i: number) => (
                        <li key={i} className="text-sm text-gray-800 flex items-start gap-2 bg-white/50 p-2 rounded-md border border-green-50/50 print:bg-gray-50 print:border-gray-200">
                          <Activity className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">{noc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Protocolos Anvisa (Braden/Morse) */}
                {(nursingResults.riscoBradenAnalise || nursingResults.riscoMorseAnalise) && (
                  <div className="bg-amber-50 mx-6 mb-6 p-5 rounded-xl border border-amber-200 break-inside-avoid print:bg-white print:border-2 print:border-amber-800">
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-900 mb-4 pb-2 border-b border-amber-200">
                      <AlertTriangle className="w-5 h-5" /> Análise de Riscos Assistenciais & Protocolos ANVISA
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-sm">
                      {nursingResults.riscoBradenAnalise && (
                        <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                          <strong className="block text-amber-800 mb-1 border-b border-amber-100 pb-1">Escala de Braden (Lesão por Pressão)</strong>
                          <span className="text-amber-950 font-medium leading-relaxed">{nursingResults.riscoBradenAnalise}</span>
                        </div>
                      )}
                      {nursingResults.riscoMorseAnalise && (
                        <div className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm">
                          <strong className="block text-amber-800 mb-1 border-b border-amber-100 pb-1">Escala de Morse (Queda)</strong>
                          <span className="text-amber-950 font-medium leading-relaxed">{nursingResults.riscoMorseAnalise}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bloco de Assinatura para Impressão */}
            <div className="hidden print:flex flex-col items-center justify-center mt-20 pt-10 break-inside-avoid">
              <div className="w-80 border-t-2 border-gray-800 mb-2"></div>
              <h4 className="font-bold text-gray-900 text-lg uppercase">
                {(professionalName || '________________________________________').toUpperCase()}
              </h4>
              <p className="text-gray-700 font-bold mb-1">
                {activeTab === 'nursing' ? 'ENFERMEIRO(A)' : 'MÉDICO(A)'}
              </p>
              {activeTab === 'nursing' && (
                <p className="text-gray-700 font-medium">COREN: {professionalCoren || '___________'}</p>
              )}
              {activeTab !== 'nursing' && professionalCoren && (
                <p className="text-gray-700 font-medium">CRM: {professionalCoren}</p>
              )}
              <p className="text-gray-500 mt-4 text-sm font-medium">
                Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

          </div>
        ) : (
          searchQuery.length > 2 ? (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">
              Nenhum CID ou procedimento encontrado para "{searchQuery}".
            </div>
          ) : (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">Aguardando busca...</h3>
              <p className="text-gray-500 max-w-sm mx-auto">Use uma das opções acima para encontrar CIDs e Procedimentos SIGTAP compatíveis.</p>
            </div>
          )
        )}
      </main>
    </div>
  )
}

export default App
