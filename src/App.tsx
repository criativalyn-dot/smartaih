import { useState } from 'react'
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
  const [apiKey, setApiKey] = useState('')
  const [activeTab, setActiveTab] = useState<'cid' | 'symptoms'>('cid')

  // Tab 1 State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CidSigtapRelation[]>([])
  const [isShowingSuggestions, setIsShowingSuggestions] = useState(false)

  // Tab 2 State
  const [patientName, setPatientName] = useState('')
  const [medicalRecord, setMedicalRecord] = useState('')
  const [clinicalText, setClinicalText] = useState('')
  const [historicoPaciente, setHistoricoPaciente] = useState({
    dataNascimento: '',
    comorbidades: '',
    alergias: '',
    medicamentos: ''
  })
  const [sinaisVitais, setSinaisVitais] = useState({
    pa: '', fc: '', fr: '', temp: '', spo2: '', hgt: '',
    peso: '', altura: '', bcf: '', alturaUterina: '', glasgow: '', dor: ''
  })
  const [isLoadingAi, setIsLoadingAi] = useState(false)
  const [tipoAtendimento, setTipoAtendimento] = useState<'observacao' | 'internacao' | 'cirurgia'>('internacao')

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
        orientacaoTipo = "ATENÇÃO MÁXIMA: O MÉDICO INDICOU QUE O PACIENTE FARÁ CIRURGIA. VOCÊ DEVE OBRIGATORIAMENTE ESCOLHER TAGS CIRÚRGICAS (EX: DRENAGEM_ABSCESSO_PELE, CESAREANA) E NÃO APENAS CLÍNICAS. \n\nREGRA OURO MANCHESTER PARA CIRURGIA: A indicação cirúrgica imediata ou de urgência eleva automaticamente o Risco. A base da Classificação de Risco DEVE ser no mínimo AMARELO (Urgente), podendo ser LARANJA (Muito Urgente) ou VERMELHO (Emergência) se os sinais vitais estiverem comprometidos.";
      } else {
        orientacaoTipo = "ATENÇÃO MÁXIMA: O MÉDICO INDICOU INTERNAÇÃO CLÍNICA/TRATAMENTO. VOCÊ DEVE ESCOLHER AS TAGS DE INTERNAÇÃO. PROIBIDO USAR TAGS CIRÚRGICAS OU DE MERA OBSERVAÇÃO. \n\nREGRA OURO MANCHESTER PARA INTERNAÇÃO CLINICA: A necessidade de internação para suporte ou antibioticoterapia eleva o risco. A base da Classificação de Risco DEVE ser no mínimo AMARELO (Urgente), podendo escalar para Laranja/Vermelho se os sinais vitais exigirem suporte de vida imediato.";
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

Se o caso for, por exemplo, um Abcesso Celulite Furúnculo (CID L02 ou L03) e o médico pediu "Cirurgia", retorne "DRENAGEM_ABSCESSO_PELE".
Se o médico pediu "Internação Clínica" para Abcesso Celulite Furúnculo, retorne "INTERNACAO_DERMATOLOGIA".
A sua escolha DEVE estar EXATAMENTE ESCRITA na lista acima. Não mude uma letra.

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

Retorne EXATAMENTE no seguinte formato JSON:
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

      const cleanTextStep1 = responseStep1.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const resultStep1 = JSON.parse(cleanTextStep1);

      const tagEscolhida = resultStep1.procedimentoTagPrincipal;
      if (!tagEscolhida) throw new Error("IA não conseguiu definir uma Tag Clínica correspondente.");

      // Encontrar o procedimento no banco de dados para extrair CIDs permitidos
      const foundProc = sigtapDatabase.find(p => p.tagsClinicas.includes(tagEscolhida));

      if (!foundProc) {
        throw new Error(`A Tag escolhida pela IA (${tagEscolhida}) não existe no banco de dados SIGTAP.`);
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

Retorne EXATAMENTE no seguinte formato JSON:
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

      const cleanTextStep2 = responseStep2.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const resultStep2 = JSON.parse(cleanTextStep2);

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

  return (
    <div className="min-h-screen bg-gray-50 w-full font-sans text-gray-900">
      {/* Modern, Sticky Glassmorphism Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-50 transition-all duration-300">
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
        <div className="bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-gray-100 mb-8 overflow-hidden">

          {/* Segmented Control Tabs */}
          <div className="bg-gray-50 p-2 border-b border-gray-100">
            <div className="flex p-1 bg-gray-200/50 rounded-2xl">
              <button
                onClick={() => setActiveTab('cid')}
                className={`flex-1 py-3.5 px-4 font-semibold text-sm sm:text-base text-center transition-all duration-300 rounded-xl ${activeTab === 'cid' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
              >
                1. Já sei o CID principal
              </button>
              <button
                onClick={() => setActiveTab('symptoms')}
                className={`flex-1 py-3.5 px-4 font-semibold text-sm sm:text-base text-center transition-all duration-300 rounded-xl ${activeTab === 'symptoms' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
              >
                2. Buscar por Sintomas/Quadro Clínico
              </button>
            </div>
          </div>

          {/* Search Inputs area */}
          <div className="p-6 md:p-8">
            {activeTab === 'cid' ? (
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
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-blue-900/5 mb-8 transform transition-all hover:scale-[1.01]">
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Nome do Paciente</label>
                      <input
                        type="text"
                        placeholder="Nome completo..."
                        className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                        value={patientName}
                        onChange={e => setPatientName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Prontuário / Registro</label>
                      <input
                        type="text"
                        placeholder="Nº do prontuário..."
                        className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
                  <textarea
                    rows={5}
                    value={clinicalText}
                    onChange={(e) => setClinicalText(e.target.value)}
                    className="block w-full p-5 border-2 border-transparent bg-gray-50 rounded-2xl leading-relaxed placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-800 text-lg resize-none shadow-inner print:border print:border-gray-200 print:bg-white"
                    placeholder="Cole ou digite aqui o quadro clínico (Ex: Paciente admitido no PS com febre, dor em fossa ilíaca direita intensa...)"
                  />
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 mb-8 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-500" /> Histórico do Paciente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Data de Nascimento</label>
                      <input type="date" className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={historicoPaciente.dataNascimento} onChange={e => setHistoricoPaciente({ ...historicoPaciente, dataNascimento: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Alergias</label>
                      <input type="text" placeholder="Ex: Dipirona, Iodo, etc..." className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={historicoPaciente.alergias} onChange={e => setHistoricoPaciente({ ...historicoPaciente, alergias: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Comorbidades / Doenças Crônicas</label>
                      <textarea rows={2} placeholder="Ex: HAS, Diabetes Tipo 2, Asma..." className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={historicoPaciente.comorbidades} onChange={e => setHistoricoPaciente({ ...historicoPaciente, comorbidades: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Medicamentos em Uso Contínuo</label>
                      <textarea rows={2} placeholder="Ex: Losartana 50mg, Metformina..." className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={historicoPaciente.medicamentos} onChange={e => setHistoricoPaciente({ ...historicoPaciente, medicamentos: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 mb-8 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-rose-500" /> Sinais Vitais <span className="text-xs font-semibold normal-case text-gray-400 bg-gray-100 px-2 py-1 rounded-md ml-2">Opcional p/ Manchester</span>
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-x-5 gap-y-6">
                    <div><label className="text-xs text-gray-500 mb-1 block">PA (mmHg)</label><input type="text" placeholder="120x80" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.pa} onChange={e => setSinaisVitais({ ...sinaisVitais, pa: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">FC (bpm)</label><input type="text" placeholder="80" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.fc} onChange={e => setSinaisVitais({ ...sinaisVitais, fc: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">FR (irpm)</label><input type="text" placeholder="18" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.fr} onChange={e => setSinaisVitais({ ...sinaisVitais, fr: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Temp (ºC)</label><input type="text" placeholder="36.5" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.temp} onChange={e => setSinaisVitais({ ...sinaisVitais, temp: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">SpO2 (%)</label><input type="text" placeholder="98" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.spo2} onChange={e => setSinaisVitais({ ...sinaisVitais, spo2: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">HGT (mg/dL)</label><input type="text" placeholder="99" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.hgt} onChange={e => setSinaisVitais({ ...sinaisVitais, hgt: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Peso (kg)</label><input type="text" placeholder="70" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.peso} onChange={e => setSinaisVitais({ ...sinaisVitais, peso: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Altura (m)</label><input type="text" placeholder="1.75" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.altura} onChange={e => setSinaisVitais({ ...sinaisVitais, altura: e.target.value })} /></div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Dor (0-10)</label>
                      <select className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" value={sinaisVitais.dor} onChange={e => setSinaisVitais({ ...sinaisVitais, dor: e.target.value })}>
                        <option value="">Sem reg.</option>
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
                    <div><label className="text-xs text-gray-500 mb-1 block">Glasgow</label><input type="text" placeholder="15" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.glasgow} onChange={e => setSinaisVitais({ ...sinaisVitais, glasgow: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">BCF (bpm)</label><input type="text" placeholder="140" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.bcf} onChange={e => setSinaisVitais({ ...sinaisVitais, bcf: e.target.value })} /></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">AU (cm)</label><input type="text" placeholder="32" className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={sinaisVitais.alturaUterina} onChange={e => setSinaisVitais({ ...sinaisVitais, alturaUterina: e.target.value })} /></div>
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
          </div>
        </div>

        {/* Results Area */}
        {(results.cidSelecionado || aiResults.length > 0) ? (
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
                  <div className="md:text-right bg-gray-100 px-4 py-2 rounded-lg print:bg-transparent print:border print:border-gray-300">
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-bold block mb-1">Prontuário / Registro</span>
                    <span className="text-xl font-mono font-bold text-blue-900">{medicalRecord || 'NÃO INFORMADO'}</span>
                  </div>
                </div>
              </div>
            )}

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
                  <div className="mb-4 flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-green-500 inline-block">
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
                    <div className={`mb-6 rounded-2xl overflow-hidden shadow-sm border-2 ${manchesterBorder} relative break-inside-avoid-page print:break-inside-avoid`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                      <div className={`px-6 md:px-8 py-5 flex flex-col md:flex-row md:items-center gap-5 ${manchesterBg}`}>
                        <div className="flex-shrink-0 flex items-center gap-3 bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                          <Activity className={`w-8 h-8 ${manchesterText}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-black text-xl uppercase tracking-widest ${manchesterText} mb-1 drop-shadow-sm`}>
                            TRIAGEM: {res.classificacaoManchester.cor}
                          </h3>
                          <div className={`text-sm md:text-base font-medium opacity-95 leading-relaxed ${manchesterText}`}>
                            {res.classificacaoManchester.justificativa}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Exames Sugeridos Rendering */}
                  {res.examesSugeridos && res.examesSugeridos.length > 0 && (
                    <div className="mb-6 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      <div className="bg-white/60 backdrop-blur-md px-6 py-4 border-b border-purple-100 flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg"><Activity className="w-5 h-5 text-purple-600" /></div>
                        <h3 className="font-bold text-purple-900 text-sm md:text-base uppercase tracking-wider">Investigação Diagnóstica Sugerida</h3>
                      </div>
                      <div className="px-6 py-5">
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-purple-900/80">
                          {res.examesSugeridos.map((exame: string, eIdx: number) => (
                            <li key={eIdx} className="flex items-start gap-2.5 group">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-200 text-purple-700 flex items-center justify-center text-xs font-bold mt-0.5 group-hover:bg-purple-600 group-hover:text-white transition-colors">{eIdx + 1}</span>
                              <span className="font-medium leading-relaxed">{exame}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-300">
                    <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-200 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-black">{(res.procedimentos || []).length}</div>
                      <h3 className="font-bold text-gray-800 text-lg">Procedimentos SIGTAP Recomendados</h3>
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
