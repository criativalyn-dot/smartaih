import { useState } from 'react'
import { Search, Activity, Stethoscope, AlertTriangle, CheckCircle2, Key, ChevronRight } from 'lucide-react'
import { MOCK_DATABASE } from './data/mockDatabase'
import type { SigtapProcedure, CidSigtapRelation } from './data/mockDatabase'
import { CURATED_SIGTAP_PROCEDURES } from './data/sigtapReferencia'
import { PROTOCOLOS_CLINICOS_REFERENCIA } from './data/protocolosReferencia'
import { PROTOCOLO_MANCHESTER_REFERENCIA } from './data/manchesterReferencia'
import { GoogleGenAI } from '@google/genai';

function App() {
  const [apiKey, setApiKey] = useState('')
  const [activeTab, setActiveTab] = useState<'cid' | 'symptoms'>('cid')

  // Tab 1 State
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<CidSigtapRelation[]>([])
  const [isShowingSuggestions, setIsShowingSuggestions] = useState(false)

  // Tab 2 State
  const [clinicalText, setClinicalText] = useState('')
  const [historicoPaciente, setHistoricoPaciente] = useState({
    idade: '',
    comorbidades: '',
    alergias: '',
    medicamentos: ''
  })
  const [sinaisVitais, setSinaisVitais] = useState({
    pa: '', fc: '', fr: '', temp: '', spo2: '', hgt: '',
    peso: '', altura: '', bcf: '', alturaUterina: '', glasgow: '', dor: ''
  })
  const [isLoadingAi, setIsLoadingAi] = useState(false)

  // Results State
  const [results, setResults] = useState<{
    cidSelecionado: string | null;
    nomeCid: string | null;
    cidsSecundarios?: { cid: string; nome: string }[];
    examesSugeridos?: string[];
    classificacaoManchester?: { cor: string; justificativa: string };
    procedimentos: SigtapProcedure[];
  }>({ cidSelecionado: null, nomeCid: null, procedimentos: [] })

  const [aiResults, setAiResults] = useState<{
    cidSelecionado: string | null;
    nomeCid: string | null;
    cidsSecundarios?: { cid: string; nome: string }[];
    examesSugeridos?: string[];
    classificacaoManchester?: { cor: string; justificativa: string };
    procedimentos: SigtapProcedure[];
  }[]>([])

  const handleCidSearch = (query: string) => {
    setSearchQuery(query);

    if (query.trim().length === 0) {
      setSuggestions([]);
      setIsShowingSuggestions(false);
      setResults({ cidSelecionado: null, nomeCid: null, procedimentos: [] });
      return;
    }

    const lowerQuery = query.toLowerCase();

    // Filtra CIDs que COMECEM com o código digitado OU contenham no NOME a palavra digitada
    const filtered = MOCK_DATABASE.filter(item => {
      const isCidMatch = item.cid.toLowerCase().startsWith(lowerQuery);
      const isNameMatch = item.cidNome.toLowerCase().includes(lowerQuery);
      return isCidMatch || isNameMatch;
    });

    setSuggestions(filtered);
    setIsShowingSuggestions(true);
    setResults({ cidSelecionado: null, nomeCid: null, procedimentos: [] });
    setAiResults([]);
  }

  const selectCid = (cidItem: CidSigtapRelation) => {
    setSearchQuery(cidItem.cid); // Preenche o input
    setIsShowingSuggestions(false); // Esconde a lista
    setResults({
      cidSelecionado: cidItem.cid,
      nomeCid: cidItem.cidNome,
      procedimentos: cidItem.procedimentos
    });
    setAiResults([]); // Limpa resultados da IA se havia
  }

  const handleAiAnalysis = async () => {
    if (!clinicalText.trim() || !apiKey) return;

    setIsLoadingAi(true);
    setResults({ cidSelecionado: null, nomeCid: null, procedimentos: [] });
    setAiResults([]);

    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Você é um médico auditor do SUS e especialista em auditoria clínica hospitalar sênior, com conhecimento profundo e avançado em semiologia, fisiopatologia, codificação clínica e regras de faturamento do SIGTAP (Datasus).
Sua missão é a MÁXIMA PRECISÃO DIAGNÓSTICA baseada em CRITÉRIO MÉDICO AVANÇADO e EXTREMA RIGIDEZ nas regras de compatibilidade do SIGTAP.

Atue RIGOROSAMENTE e de forma EXTENSIVA a TODOS os sistemas do corpo humano e TODOS os CIDs-10 existentes.
Analise detalhadamente o quadro clínico abaixo (sinais, sintomas, exames laboratoriais e de imagem).
Liste os CIDs-10 MAIS PROVÁVEIS (diagnósticos diferenciais) que sejam perfeitamente CONGRUENTES com a justificativa apresentada.
Liste APENAS as opções que tenham probabilidade clínica altíssima e sustentada pela literatura médica atual (entre 1 a no máximo 4 opções). Se o quadro for muito claro para uma suspeita específica, liste apenas as variações daquela doença.

Para cada CID listado, você DEVE encontrar o procedimento principal do SIGTAP para o tratamento.
MUITO IMPORTANTE - OBRIGATÓRIO SEGUIR A LÓGICA OFICIAL DA TABELA SIGTAP:
ATENÇÃO: VOCÊ DEVE INVESTIGAR E CONSIDERAR TODOS OS GRUPOS DO SIGTAP DISPONÍVEIS (DO 01 AO 09), SEUS RESPECTIVOS SUB-GRUPOS E FORMAS DE ORGANIZAÇÃO.
1. Identifique o GRUPO (Pode ser qualquer um dos 9 grupos: 01, 02, 03, 04, 05, 06, 07, 08 ou 09).
2. Identifique o SUB-GRUPO compatível dentro do grupo escolhido.
3. Identifique a FORMA DE ORGANIZAÇÃO compatível.
4. Identifique o CÓDIGO DO PROCEDIMENTO exato (formato GG.SS.FF.PPP-D).
5. REGRA DE COMPATIBILIDADE E FATURAMENTO (A MAIS IMPORTANTE DE TODAS): O procedimento escolhido DEVE OBRIGATORIAMENTE ter o "CID Principal" (cidSelecionado) sugerido na sua lista oficial de CIDs compatíveis da Tabela SIGTAP.
5.1. FATURAMENTO SOBREPÕE A CLÍNICA: Se o "CID Clínico" que motivou o caso (ex: O34.2 - Cicatriz uterina) NÃO possuir compatibilidade oficial de faturamento com o procedimento necessário (ex: 04.11.01.004-2 Parto Cesariano c/ Laqueadura), VOCÊ NÃO PODE usá-lo como CID Principal. Você DEVE escolher um CID que SEJA compatível e autorize o faturamento (ex: Z30.2, O82.0, O24.4, etc - desde que aplicável ao caso) como "cidSelecionado", e mover o CID puramente clínico (O34.2) para o array de "cidsSecundarios". JAMAIS sugira um pacote onde o CID Principal rejeita o Procedimento no SUS.
6. NOME EXATO DO PROCEDIMENTO (LEI ABSOLUTA PARA TODOS OS 9 GRUPOS): Você NUNCA, SOB HIPÓTESE ALGUMA, deve inventar ou alterar o nome de um procedimento juntando o código oficial com o nome da doença, órgão afetado ou sintoma. O nome retornado DEVE ser a nomenclatura oficial, seca e exata da tabela SIGTAP, sem adornos. A sua validação de "compatibilidade" deve ser rigorosa, garantindo que o CID real da doença exista na aba de CIDs compatíveis daquele procedimento EXATO.
7. OBRIGATÓRIO MULTIDISCIPLINAR (CÓDIGOS COMPLEMENTARES): Nunca retorne apenas 1 procedimento se o quadro clínico for complexo (ex: urgências, traumas, psiquiatria severa, UTI). Você é OBRIGADO a vasculhar os 9 Grupos e retornar também os Procedimentos Complementares obrigatórios para aquele caso. Exemplos:
- Se internar em Psiquiatria (Grupo 03), inclua também códigos do Grupo 09 (Atenção Psicossocial).
- Se tiver trauma sangrante, inclua as suturas (Grupo 04) + Vacina antitetânica ou Imunoglobulina (Grupo 06 - Medicamentos).
- Se for emergência grave, considere Diárias de UTI (Grupo 08) ou Exames Diagnósticos essenciais (Grupo 02) que justificam a internação.

8. TRADUÇÃO DE ABREVIAÇÕES MÉDICAS: O quadro clínico pode conter abreviações médicas comuns em prontuários (ex: G2P1C1 = Gesta 2, Para 1, Cesárea 1; DMG = Diabetes Mellitus Gestacional; HAS = Hipertensão Arterial Sistêmica; DPNI = Descolamento Prematuro de Placenta, etc). Traduza e compreenda TODAS as abreviações de todas as especialidades antes de sugerir o CID.
9. PLANEJAMENTO FAMILIAR E ESTERILIZAÇÃO: Se a justificativa citar "planejamento familiar", "laqueadura", "vasectomia" ou "esterilização cirúrgica", você DEVE obrigatoriamente incluir o CID-10 Z30.2 (Esterilização) como um dos CIDs (seja principal ou secundário) e sugerir o procedimento SIGTAP correspondente para a laqueadura ou vasectomia (ex: 04.11.01.004-2 PARTO CESARIANO C/ LAQUEADURA TUBARIA ou 04.09.06.014-3 LAQUEADURA TUBARIA).
10. CIDS SECUNDÁRIOS E COMORBIDADES (JUSTIFICATIVA CLÍNICA LIVRE): Diferente do "CID Principal" que DEVE obrigatoriamente cruzar com a regra de faturamento do procedimento SIGTAP, os CIDs que você enviar para a lista "cidsSecundarios" NÃO PRECISAM ser compatíveis com o procedimento na tabela. Eles servem exclusivamente para justificar a gravidade, a necessidade de internação ou a complexidade clínica do caso. Exemplo: Se o paciente internar por Pneumonia (onde o Procedimento exige CID Principal de Pneumonia), mas ele possui Asma (que agravou o quadro e exigiu hospitalização), a Asma deve constar como CID Secundário para embasar clinicamente a decisão do médico assistente, mesmo que a Asma não esteja na lista de CIDs oficiais daquele procedimento. Portanto, liste todas as comorbidades ativas relevantes no array "cidsSecundarios".
10. IGNORAR HISTÓRICO RESOLVIDO: Preste muita atenção ao tempo verbal e a palavras como "tratada" ou "cicatriz sorológica". Doenças ou condições passadas não ativas (ex: "Sífilis tratada", "apendicectomia prévia") NÃO devem constar como CIDs Ativos.
11. FOCO OBRIGATÓRIO EM PROCEDIMENTOS HOSPITALARES (AIH): O objetivo central desta auditoria é faturar as Internações e Cirurgias. Se o quadro descreve gestação, irregularidade menstrual que requeira intervenção, candidíase de repetição, fraturas, tumores ou urgências... VOCÊ É EXTREMAMENTE PROIBIDO de devolver apenas "03.01.01.007-2 Consulta Médica em Atenção Especializada". Você DEVE caçar o procedimento raiz de tratamento na Tabela (ex: curetagem, parto, tratamento de transtornos endócrinos, laqueadura, ressecção, etc.). Se não for cirúrgico, busque "Tratamento de [Doença]" no Grupo 03 (ex: "Tratamento de Doenças Bacterianas", "Tratamento de Transtornos Infecciosos", "Tratamento de Intercorrências da Gestação"). Só use "Consulta Médica" se o paciente estiver puramente relatando dor crônica de nível 0-2 (Azul).

Abaixo está uma lista de referência rápida com alguns procedimentos REAIS do SIGTAP (use-os prioritariamente se aplicável ao caso):
${CURATED_SIGTAP_PROCEDURES}

E MUITO IMPORTANTE: Abaixo estão as Diretrizes de Protocolos de Exames de Referência do Hospital.
12. EXAMES SUGERIDOS: Baseado NESTAS diretrizes abaixo e cruzando com o quadro clínico e os CIDs prováveis, retorne uma lista com os Nomes Completos dos Exames de Imagem e Laboratório que OBRIGATORIAMENTE deveriam ser solicitados para fechar, monitorar ou descartar esse diagnóstico no Pronto-Socorro. Não abrevie o nome do exame na resposta.
DIRETRIZES DE EXAMES PARA REFERÊNCIA:
${PROTOCOLOS_CLINICOS_REFERENCIA}

13. CLASSIFICAÇÃO DE RISCO DE MANCHESTER: Avalie todos os Sinais Vitais fornecidos e o Quadro Clínico detalhado e determine a Cor da Classificação de Risco (Vermelho, Laranja, Amarelo, Verde, Azul) de acordo com o Protocolo de Manchester. Forneça uma justificativa clínica robusta defendendo a cor escolhida.
DIRETRIZES DE MANCHESTER PARA REFERÊNCIA:
${PROTOCOLO_MANCHESTER_REFERENCIA}

Caso não use a lista de referência acima, vasculhe sua base de conhecimento para encontrar o código SIGTAP real, grupo, sub-grupo, e forma de organização, garantindo a compatibilidade CID x Procedimento.

Quadro Clínico e Motivo da Consulta:
"${clinicalText}"

Histórico do Paciente:
Idade: ${historicoPaciente.idade || 'Não informada'}
Comorbidades/Doenças Crônicas: ${historicoPaciente.comorbidades || 'Não informadas'}
Alergias: ${historicoPaciente.alergias || 'Não informadas'}
Medicamentos em uso contínuo: ${historicoPaciente.medicamentos || 'Não informados'}

Sinais Vitais Registrados na Triagem:
PA: ${sinaisVitais.pa || 'Não preenchido'} | FC: ${sinaisVitais.fc || 'Não preenchido'} bpm | FR: ${sinaisVitais.fr || 'Não preenchido'} irpm
Temp: ${sinaisVitais.temp || 'Não preenchido'} °C | SpO2: ${sinaisVitais.spo2 || 'Não preenchido'} % | HGT: ${sinaisVitais.hgt || 'Não preenchido'}
Peso: ${sinaisVitais.peso || 'Não preenchido'} kg | Altura: ${sinaisVitais.altura || 'Não preenchido'} m
BCF: ${sinaisVitais.bcf || 'Não preenchido'} bpm | Altura Uterina: ${sinaisVitais.alturaUterina || 'Não preenchido'} cm
Glasgow: ${sinaisVitais.glasgow || 'Não preenchido'} | Escala de Dor (0-10): ${sinaisVitais.dor || 'Não preenchido'}

Retorne o resultado EXATAMENTE no seguinte formato JSON (array de objetos):
[
  {
    "cidSelecionado": "CÓDIGO_DO_CID_PRINCIPAL (Ex: O34.2)",
    "nomeCid": "Nome descritivo do CID Principal (Ex: Assistência prestada à mãe por cicatriz uterina devida a cirurgia anterior)",
    "cidsSecundarios": [
      { "cid": "CÓDIGO_SECUNDARIO", "nome": "Nome do CID secundário/comorbidade (Ex: O24.4 Diabetes mellitus gestacional)" },
      { "cid": "Z30.2", "nome": "Esterilização (Se aplicável)" }
    ],
    "examesSugeridos": [
      "Nome Completo do Exame de Imagem ou Laboratório 1",
      "Nome Completo do Exame 2"
    ],
    "classificacaoManchester": {
      "cor": "Vermelho, Laranja, Amarelo, Verde ou Azul",
      "justificativa": "Sua justificativa clínica detalhada explicando o porquê desta cor baseado nos sinais vitais e quadro clínico informados."
    },
    "procedimentos": [
      {
        "codigo": "CÓDIGO_SIGTAP (Ex: 04.11.01.004-2)",
        "nome": "NOME EXATO DO PROCEDIMENTO SIGTAP COMPATÍVEL",
        "grupo": "Ex: 04 - Procedimentos Cirúrgicos",
        "subGrupo": "Ex: 11 - Cirurgia obstétrica",
        "formaOrganizacao": "Ex: 01 - Partos e outros procedimentos obstétricos",
        "complexidade": "Média Complexidade ou Alta Complexidade"
      }
    ]
  }
]
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1, // Reduz drasticamente a "criatividade" para forçar precisão clínica
        }
      });

      if (response.text) {
        // Remove blocos de markdown ```json e ``` para evitar crash no parse
        const cleanText = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        try {
          const parsedResults = JSON.parse(cleanText);
          if (Array.isArray(parsedResults) && parsedResults.length > 0) {
            setAiResults(parsedResults);
          } else {
            alert("A IA analisou, mas não encontrou resultados compatíveis ou não retornou no formato correto.");
          }
        } catch (parseError) {
          console.error("Erro ao fazer parse do JSON:", parseError, response.text);
          alert("A IA retornou um texto que não pôde ser interpretado pelo sistema. Tente novamente.");
        }
      }
    } catch (error: any) {
      console.error("Erro detalhado na IA:", error);
      alert(`Erro ao contatar API do Gemini: ${error?.message || 'Erro desconhecido'}\n\nAbra o console do navegador (F12) para mais detalhes.`);
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
                        {suggestions.map((item) => (
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
                <label className="block text-sm font-bold text-gray-700 mb-3 tracking-wide flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-500" /> Justificativa Clínica (Sinais, Sintomas, Exames)
                </label>
                <div className="mb-6">
                  <textarea
                    rows={5}
                    value={clinicalText}
                    onChange={(e) => setClinicalText(e.target.value)}
                    className="block w-full p-5 border-2 border-transparent bg-gray-50 rounded-2xl leading-relaxed placeholder-gray-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-800 text-lg resize-none shadow-inner"
                    placeholder="Cole ou digite aqui o quadro clínico (Ex: Paciente admitido no PS com febre, dor em fossa ilíaca direita intensa...)"
                  />
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 mb-8 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                    <Activity className="w-5 h-5 text-blue-500" /> Histórico do Paciente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Idade</label>
                      <input type="text" placeholder="Ex: 45 anos, 8 meses..." className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={historicoPaciente.idade} onChange={e => setHistoricoPaciente({ ...historicoPaciente, idade: e.target.value })} />
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
            {/* Header if AI generated multiple results */}
            {aiResults.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3 text-blue-800">
                <Stethoscope className="w-6 h-6" />
                <div>
                  <h3 className="font-bold">Análise da Inteligência Artificial Concluída</h3>
                  <p className="text-sm">Foram encontrados {aiResults.length} CIDs clinicamente prováveis para o quadro descrito, com seus respectivos procedimentos SIGTAP sugeridos.</p>
                </div>
              </div>
            )}

            {/* Mapping over single result or AI results array */}
            {(aiResults.length > 0 ? aiResults : [results]).map((res, index) => {
              // Map Manchester Colors to Tailwind Classes
              let manchesterBg = 'bg-gray-100';
              let manchesterText = 'text-gray-800';
              let manchesterBorder = 'border-gray-200';
              const corLower = res.classificacaoManchester?.cor?.toLowerCase() || '';

              if (corLower.includes('vermelho')) { manchesterBg = 'bg-red-600'; manchesterText = 'text-white'; manchesterBorder = 'border-red-700'; }
              else if (corLower.includes('laranja')) { manchesterBg = 'bg-orange-500'; manchesterText = 'text-white'; manchesterBorder = 'border-orange-600'; }
              else if (corLower.includes('amarelo')) { manchesterBg = 'bg-yellow-400'; manchesterText = 'text-gray-900'; manchesterBorder = 'border-yellow-500'; }
              else if (corLower.includes('verde')) { manchesterBg = 'bg-green-500'; manchesterText = 'text-white'; manchesterBorder = 'border-green-600'; }
              else if (corLower.includes('azul')) { manchesterBg = 'bg-blue-500'; manchesterText = 'text-white'; manchesterBorder = 'border-blue-600'; }

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
                          {res.cidsSecundarios.map((sec, sIdx) => (
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
                    <div className={`mb-6 rounded-2xl overflow-hidden shadow-sm border-2 ${manchesterBorder} relative`}>
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
                          {res.examesSugeridos.map((exame, eIdx) => (
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
                      {(res.procedimentos || []).map((proc, idx) => (
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
