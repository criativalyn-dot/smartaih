export default function PrintableSaeReport({
  patientName,
  historicoPaciente,
  idadeCalculada,
  leito,
  prontuario = '',
  dataInternacao,
  hipoteseDiagnostica,
  sinaisVitais,
  nursingAssessment,
  nursingResults,
  bradenScore,
  morseScore,
  fugulinScore,
  previewMode = false
}: any) {
  
  // Helpers to render checkboxes
  const renderCheckGroup = (title: string, options: string[], selectedOptions: string[]) => {
    return (
      <div className="mb-1 text-[10px] print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
        <div className="font-bold border-b border-black text-center bg-gray-200 uppercase" style={{ fontSize: '9px' }}>{title}</div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1 p-1">
          {options.map(opt => {
            const isChecked = (selectedOptions || []).includes(opt);
            return (
              <label key={opt} className="flex items-center gap-1">
                <span>{isChecked ? '[X]' : '[_]'}</span>
                <span className={isChecked ? 'underline font-bold' : ''}>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const today = new Date().toLocaleDateString('pt-BR');

  const getBradenRisk = (score: number) => {
    if (score <= 9) return 'Risco Altíssimo';
    if (score <= 12) return 'Risco Alto';
    if (score <= 14) return 'Risco Moderado';
    if (score <= 18) return 'Risco Baixo';
    if (score >= 19 && score <= 23) return 'Sem Risco';
    return 'Não avaliado';
  };

  const getMorseRisk = (score: number) => {
    if (score >= 45) return 'Risco Alto';
    if (score >= 25) return 'Risco Moderado';
    if (score >= 0) return 'Risco Baixo/Sem Risco';
    return 'Não avaliado';
  };

  const getFugulinCareLevel = (score: number) => {
    if (score >= 32) return 'Cuidados Intensivos';
    if (score >= 27) return 'Cuidados Semi-Intensivos';
    if (score >= 21) return 'Cuidados de Alta Dependência';
    if (score >= 15) return 'Cuidados Intermediários';
    if (score >= 9) return 'Cuidados Mínimos';
    return 'Não avaliado';
  };

  const renderList = (arr: any[], isObj = false) => {
    if (!arr || arr.length === 0) return '-';
    return arr.map((x, i) => (
      <div key={i} className="mb-2 leading-tight">
        {isObj ? (
          <>
            <span className="font-bold block">• {x.titulo || x.diagnostico || 'Diagnóstico'}</span>
            {x.fatorRelacionado && <span className="block text-[8px] pl-2 text-gray-700">Relacionado a: {x.fatorRelacionado}</span>}
          </>
        ) : (
          `• ${x}`
        )}
      </div>
    ));
  };

  return (
    <div className={`bg-white text-black font-sans leading-tight ${previewMode ? 'w-[210mm] mx-auto shadow-2xl ring-1 ring-black/5 mt-8 border border-gray-300 transform md:scale-95 origin-top' : 'print-only'}`}>
      
      {/* PAGE 1: SAE */}
      <div className={`page box-border w-full flex flex-col mb-10 print:pl-[20mm] print:pr-[10mm] print:py-[10mm] ${previewMode ? 'p-6 border-b-[16px] border-gray-200' : 'break-after-page'}`}>
        {/* Header */}
        <header className="flex w-full border border-black mb-2 h-[60px]">
          <div className="w-[80px] p-1 flex items-center justify-center border-r border-black font-bold text-center relative overflow-hidden">
             {/* Logo SVG Imitando o Hospital Darci João Bigaton */}
             <svg viewBox="0 0 200 200" className="w-14 h-14">
               {/* Outer and Inner circles */}
               <circle cx="100" cy="100" r="95" stroke="black" strokeWidth="3" fill="none" />
               <circle cx="100" cy="100" r="82" stroke="black" strokeWidth="2" fill="none" />
               
               {/* Text around circle (Rough approximation via paths) */}
               <path id="curveTop" d="M 30,100 A 70,70 0 0,1 170,100" fill="transparent" />
               <path id="curveBot" d="M 170,100 A 70,70 0 0,1 30,100" fill="transparent" />
               <text fontSize="13" fontWeight="bold" fill="black" letterSpacing="1">
                 <textPath href="#curveTop" startOffset="50%" textAnchor="middle">ASSOCIAÇÃO BENEFICENTE</textPath>
               </text>
               <text fontSize="10.5" fontWeight="bold" fill="black" letterSpacing="0.5">
                 <textPath href="#curveBot" startOffset="50%" textAnchor="middle">HOSPITAL DARCI JOÃO BIGATON</textPath>
               </text>

               {/* Inner Cross and Sunburst */}
               <g transform="translate(100 100) scale(0.65)">
                 {/* Cross Base */}
                 <path d="M-30,-80 L30,-80 L30,-30 L80,-30 L80,30 L30,30 L30,80 L-30,80 L-30,30 L-80,30 L-80,-30 L-30,-30 Z" fill="#222"/>
                 {/* Radial Lines (Sunburst) */}
                 {Array.from({length: 24}).map((_, i) => (
                   <line key={i} x1="0" y1="0" x2="80" y2="0" stroke="white" strokeWidth="2" transform={`rotate(${i * 15})`} />
                 ))}
                 {/* Center White Circle */}
                 <circle cx="0" cy="0" r="25" fill="white" stroke="#222" strokeWidth="2" />
               </g>
             </svg>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center text-center p-2 font-bold text-[13px] leading-tight">
            <div>ASSOCIAÇÃO BENEFICENTE HOSPITAL DARCI JOÃO BIGATON DE BONITO-MS</div>
            <div>PROCESSO DE ENFERMAGEM</div>
          </div>
        </header>

        {/* Patient Data */}
        <div className="text-[10px] mb-2 space-y-1">
          <div className="flex justify-between">
            <span>Data: <span className="border-b border-black inline-block w-24 text-center">{today}</span></span>
            <span className="flex-1 ml-2">Nome do paciente: <span className="border-b border-black inline-block w-full">{patientName}</span></span>
          </div>
          <div className="flex justify-between">
            <span>Sexo: [{historicoPaciente?.sexo === 'M' ? 'X' : '_'}] M [{historicoPaciente?.sexo === 'F' ? 'X' : '_'}] F </span>
            {historicoPaciente?.sexo === 'F' && (
              <span className="ml-4 font-bold border border-black px-1">Gestante: {historicoPaciente?.gestante === 'Sim' ? 'SIM' : 'NÃO'}</span>
            )}
            <span className="ml-4">Idade: <span className="border-b border-black inline-block w-24 text-center">{idadeCalculada}</span></span>
            <span className="ml-4">Prontuário: <span className="border-b border-black inline-block w-24 text-center">{prontuario}</span></span>
            <span className="flex-1 text-right">Leito: <span className="border-b border-black inline-block w-16 text-center">{leito}</span></span>
          </div>
          <div className="flex justify-between">
            <span>Data da internação: <span className="border-b border-black inline-block w-24 text-center">{new Date(dataInternacao || Date.now()).toLocaleDateString('pt-BR')}</span></span>
            <span className="flex-1 ml-4">Hipótese Diagnóstica: <span className="border-b border-black inline-block w-full">{hipoteseDiagnostica}</span></span>
          </div>
        </div>

        {/* Controls & Vitals Table */}
        <div className="flex border border-black mb-2 text-[10px]">
          <div className="w-2/3 border-r border-black">
             <div className="font-bold text-center border-b border-black bg-gray-200 uppercase" style={{ fontSize: '9px' }}>CONTROLE DE CATETERES E SONDAS</div>
             <div className="flex flex-col p-1">
               <div className="flex justify-between border-b border-gray-300 border-dotted mb-1 pb-1">
                 <span className="w-1/2">Cateter periférico: <span className="font-semibold">{nursingAssessment?.catheters?.peripheral}</span></span>
                 <span className="w-1/2 border-l border-black pl-1">Local: <span className="font-semibold">{nursingAssessment?.catheters?.location}</span></span>
               </div>
               <div className="flex justify-between border-b border-gray-300 border-dotted mb-1 pb-1">
                 <span className="w-1/2">Sonda vesical: <span className="font-semibold">{nursingAssessment?.catheters?.vesicalProbe}</span></span>
                 <span className="w-1/2 border-l border-black pl-1">Dreno de: <span className="font-semibold">{nursingAssessment?.catheters?.drain}</span></span>
               </div>
               <div className="flex justify-between mb-1 pb-1">
                 <span className="w-full text-red-800 font-bold">ALERGIAS: <span className="border-b border-red-800 inline-block px-2 text-black">{historicoPaciente?.alergias || 'Nenhuma'}</span></span>
               </div>
               <div className="border border-black">
                 <div className="bg-gray-100 text-[9px] px-1 border-b border-black">Via Alimentar / Suporte Nutricional:</div>
                 <div className="flex flex-wrap p-1 gap-x-3 gap-y-1">
                   {['Dieta Oral', 'SNE', 'SNG', 'Gastrostomia', 'NPT (Nutrição Parenteral)', 'Jejum'].map(item => (
                     <label key={item}>[{(nursingAssessment?.catheters?.feeding || []).includes(item) ? 'X' : '_'}] {item}</label>
                   ))}
                 </div>
               </div>
             </div>
          </div>
          <div className="w-1/3 flex flex-col">
             <div className="font-bold text-center border-b border-black bg-gray-200 uppercase" style={{ fontSize: '9px' }}>SINAIS VITAIS</div>
             <div className="flex flex-col p-1 text-[9px] gap-0.5">
               <div className="flex justify-between border-b border-dotted border-gray-400"><span>PA:</span> <span className="font-bold text-red-600">{sinaisVitais?.pa || '_____'} mmHg</span></div>
               <div className="flex justify-between border-b border-dotted border-gray-400"><span>TA:</span> <span className="font-bold text-red-600">{sinaisVitais?.temp || '_____'} °C</span></div>
               <div className="flex justify-between border-b border-dotted border-gray-400"><span>P:</span> <span className="font-bold text-red-600">{sinaisVitais?.fc || '_____'} bpm</span></div>
               <div className="flex justify-between border-b border-dotted border-gray-400"><span>FR:</span> <span className="font-bold text-red-600">{sinaisVitais?.fr || '_____'} irpm</span></div>
               <div className="flex justify-between border-b border-dotted border-gray-400"><span>HGT:</span> <span className="font-bold text-red-600">{sinaisVitais?.hgt || '_____'} mg/dl</span></div>
               <div className={`flex justify-between ${historicoPaciente?.sexo === 'F' && historicoPaciente?.gestante === 'Sim' ? 'border-b border-dotted border-gray-400' : ''}`}><span>SPO2:</span> <span className="font-bold text-red-600">{sinaisVitais?.spo2 || '_____'} %</span></div>
               {historicoPaciente?.sexo === 'F' && historicoPaciente?.gestante === 'Sim' && (
                 <>
                   <div className="flex justify-between border-b border-dotted border-gray-400"><span>BCF:</span> <span className="font-bold text-pink-600">{sinaisVitais?.bcf || '_____'} bpm</span></div>
                   <div className="flex justify-between"><span>AU:</span> <span className="font-bold text-pink-600">{sinaisVitais?.alturaUterina || '_____'} cm</span></div>
                 </>
               )}
             </div>
          </div>
        </div>

        {/* Risk Scores Grid */}
        <div className="flex border border-black mb-2 text-[10px]">
          <div className="w-1/3 border-r border-black flex flex-col p-1 text-center bg-gray-50">
             <span className="font-bold border-b border-gray-300 pb-1 mb-1">Escala de Braden (Lesão)</span>
             <span className="font-extrabold text-red-700 text-xs">{bradenScore?.total || 0}</span>
             <span className="text-[9px] font-medium">{getBradenRisk(bradenScore?.total || 0)}</span>
          </div>
          <div className="w-1/3 border-r border-black flex flex-col p-1 text-center bg-gray-50">
             <span className="font-bold border-b border-gray-300 pb-1 mb-1">Escala de Morse (Queda)</span>
             <span className="font-extrabold text-orange-700 text-xs">{morseScore?.total || 0}</span>
             <span className="text-[9px] font-medium">{getMorseRisk(morseScore?.total || 0)}</span>
          </div>
          <div className="w-1/3 flex flex-col p-1 text-center bg-gray-50">
             <span className="font-bold border-b border-gray-300 pb-1 mb-1">Fugulin (Dependência)</span>
             <span className="font-extrabold text-purple-700 text-xs">{fugulinScore?.total || 0}</span>
             <span className="text-[9px] font-medium">{getFugulinCareLevel(fugulinScore?.total || 0)}</span>
          </div>
        </div>

        {/* NANDA/NIC/NOC Grid with Systems */}
        <div className="flex border border-black text-[10px] w-full">
          {/* Left Column: Systems */}
          <div className="w-1/2 border-r border-black flex flex-col divide-y divide-black">
            {renderCheckGroup('ESTADO NEUROLÓGICO', ['Lúcido', 'Desorientado', 'Confuso', 'Agitado', 'Letárgico', 'Comatoso', 'Déficit Motor'], nursingAssessment?.neurologicalStatus)}
            {renderCheckGroup('PUPILAS', ['Isocóricas', 'Anisocóricas', 'Mióticas', 'Midriáticas', 'Fotorreagentes', 'Não-reagentes'], nursingAssessment?.pupils)}
            {renderCheckGroup('SISTEMA RESPIRATÓRIO E OXIGENAÇÃO', ['Eupneico', 'Taquipneico', 'Bradipneico', 'Dispneico', 'Uso de Musculatura Acessória', 'Cianose', 'Tosse Produtiva', 'Tosse Seca', 'Ventilação Mecânica', 'Cateter de O2', 'Máscara de Venturi', 'Macronebulização'], nursingAssessment?.oxygenation)}
            {renderCheckGroup('SISTEMA CARDIOVASCULAR E PERFUSÃO', ['Normotenso', 'Hipertenso', 'Hipotenso', 'Taquicárdico', 'Bradicárdico', 'Arritmia', 'Edema Periférico', 'Perfusão Periférica Lenta', 'Palidez', 'Pulso Fino', 'Pulso Cheio'], nursingAssessment?.vascular)}
            {renderCheckGroup('PELE E INTEGRIDADE CUTÂNEA', ['Pele Íntegra', 'Corada', 'Hidratada', 'Desidratada', 'Ictérica', 'Eritema', 'Equimose', 'Hematoma', 'Lesão por Pressão (LPP)', 'Ferida Operatória', 'Curativo Oclusivo'], nursingAssessment?.skin)}
            {renderCheckGroup('TERMORREGULAÇÃO', ['Normotérmico', 'Febril', 'Hipotérmico', 'Sudorese Fria', 'Calafrios'], nursingAssessment?.thermalRegulation)}
            {renderCheckGroup('SISTEMA GASTROINTESTINAL E ABDOME', ['Abdome Plano', 'Abdome Globoso', 'Abdome Distendido', 'Dor à Palpação', 'Ruídos Hidroaéreos Presentes', 'RHA Ausentes/Diminuídos', 'Vômito', 'Náusea', 'Diarreia', 'Constipação', 'Sonda Nasoentérica (SNE)', 'Estomia Intestinal', 'Melena', 'Jejum'], nursingAssessment?.gastrointestinal)}
            {renderCheckGroup('SISTEMA URINÁRIO', ['Diurese Espontânea', 'Oligúria', 'Anúria', 'Disúria', 'Hematúria', 'Urina Colúrica', 'Poliúria', 'Sonda Vesical de Demora (SVD)', 'Sonda Vesical de Alívio', 'Incontinência Urinária'], nursingAssessment?.urinary)}
          </div>
          
          {/* Right Column: NANDA/NIC/NOC */}
          <div className="w-1/2 flex flex-col divide-y divide-black bg-white">
            <div className="flex-1 flex flex-col print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <div className="font-bold text-center border-b border-black bg-gray-200 uppercase py-1" style={{ fontSize: '9px' }}>DIAGNÓSTICO DE ENFERMAGEM (NANDA)</div>
              <div className="p-1 flex-1 text-[9px] font-semibold text-red-900 whitespace-pre-wrap leading-tight">{nursingResults ? renderList(nursingResults.diagnosticosNANDA, true) : '-'}</div>
            </div>
            <div className="flex-1 flex flex-col border-t border-black print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <div className="font-bold text-center border-b border-black bg-gray-200 uppercase py-1" style={{ fontSize: '9px' }}>PRESCRIÇÃO DE ENFERMAGEM (NIC)</div>
              <div className="p-1 flex-1 text-[9px] font-semibold text-blue-900 whitespace-pre-wrap leading-tight">{nursingResults ? renderList(nursingResults.intervencoesNIC, false) : '-'}</div>
            </div>
            <div className="flex-1 flex flex-col border-t border-black print:break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
              <div className="font-bold text-center border-b border-black bg-gray-200 uppercase py-1" style={{ fontSize: '9px' }}>RESULTADOS ESPERADOS (NOC)</div>
              <div className="p-1 flex-1 text-[9px] font-semibold text-green-900 whitespace-pre-wrap leading-tight">{nursingResults ? renderList(nursingResults.resultadosNOC, false) : '-'}</div>
            </div>
            
            {/* Signature Block on Page 1 Bottom */}
            <div className="h-20 flex flex-col items-center justify-end pb-4 pt-6">
              <div className="w-48 border-t border-black mb-1"></div>
              <div className="text-[9px] uppercase font-bold text-center leading-tight">
                Assinatura / Carimbo do Enfermeiro<br/>
                COREN-___________
              </div>
            </div>
          </div>
        </div>

        {/* Risk Narratives Grid */}
        {nursingResults?.riscoBradenAnalise && (
          <div className="border border-black mt-2 text-[10px] flex flex-col mb-auto bg-orange-50/30">
            <div className="bg-orange-100 border-b border-black font-bold p-1 uppercase text-center text-[9px] flex items-center justify-center gap-1 text-orange-900 leading-none">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              ANÁLISE DE RISCOS ASSISTENCIAIS & PROTOCOLOS ANVISA
            </div>
            <div className="flex text-[9px] divide-x divide-black min-h-[60px]">
               <div className="w-1/3 p-2 flex flex-col text-justify"><span className="font-bold border-b border-orange-200 text-orange-900 pb-1 mb-1">Escala de Braden (Lesão por Pressão)</span> <span>{nursingResults.riscoBradenAnalise}</span></div>
               <div className="w-1/3 p-2 flex flex-col text-justify"><span className="font-bold border-b border-orange-200 text-orange-900 pb-1 mb-1">Escala de Morse (Queda)</span> <span>{nursingResults.riscoMorseAnalise}</span></div>
               <div className="w-1/3 p-2 flex flex-col text-justify"><span className="font-bold border-b border-orange-200 text-orange-900 pb-1 mb-1">Fugulin (Dependência)</span> <span>{nursingResults.riscoFugulinAnalise || `Paciente foi classificado com Cuidados Mínimos no momento da avaliação, refletindo estabilidade e baixo nível de dependência da enfermagem.`}</span></div>
            </div>
          </div>
        )}

        {/* Pagination Page 1 */}
        <div className="text-right text-[10px] mt-2 font-bold text-gray-600">Página 1 / 3</div>
      </div>

      {/* PAGE 2: Evolução de Enfermagem */}
      <div className={`page box-border w-full flex flex-col h-[270mm] print:pl-[20mm] print:pr-[10mm] print:py-[10mm] ${previewMode ? 'p-6' : ''}`} style={{ pageBreakBefore: 'always' }}>
        <header className="flex w-full mb-2 h-[60px]">
          <div className="w-[80px] p-1 flex items-center justify-center font-bold text-center relative overflow-hidden">
             {/* Logo SVG (Repeated) */}
             <svg viewBox="0 0 200 200" className="w-14 h-14">
               <circle cx="100" cy="100" r="95" stroke="black" strokeWidth="3" fill="none" />
               <circle cx="100" cy="100" r="82" stroke="black" strokeWidth="2" fill="none" />
               <path id="curveTop2" d="M 30,100 A 70,70 0 0,1 170,100" fill="transparent" />
               <path id="curveBot2" d="M 170,100 A 70,70 0 0,1 30,100" fill="transparent" />
               <text fontSize="13" fontWeight="bold" fill="black" letterSpacing="1"><textPath href="#curveTop2" startOffset="50%" textAnchor="middle">ASSOCIAÇÃO BENEFICENTE</textPath></text>
               <text fontSize="10.5" fontWeight="bold" fill="black" letterSpacing="0.5"><textPath href="#curveBot2" startOffset="50%" textAnchor="middle">HOSPITAL DARCI JOÃO BIGATON</textPath></text>
               <g transform="translate(100 100) scale(0.65)">
                 <path d="M-30,-80 L30,-80 L30,-30 L80,-30 L80,30 L30,30 L30,80 L-30,80 L-30,30 L-80,30 L-80,-30 L-30,-30 Z" fill="#222"/>
                 {Array.from({length: 24}).map((_, i) => <line key={i} x1="0" y1="0" x2="80" y2="0" stroke="white" strokeWidth="2" transform={`rotate(${i * 15})`} />)}
                 <circle cx="0" cy="0" r="25" fill="white" stroke="#222" strokeWidth="2" />
               </g>
             </svg>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center text-center p-2 font-bold text-[13px] leading-tight">
            <div>ASSOCIAÇÃO BENEFICENTE HOSPITAL DARCI JOÃO BIGATON DE BONITO-MS</div>
            <div>PROCESSO DE ENFERMAGEM</div>
            <div>EVOLUÇÃO DE ENFERMAGEM</div>
          </div>
        </header>
        
        <div className="text-right text-[8px] font-bold pb-1 pr-2">RESOLUÇÃO COFEN N.º 358/2009</div>
        
        {/* TABELA DE SINAIS VITAIS */}
        <table className="w-full border-collapse text-[9px] text-center mb-0">
          <thead>
            <tr><td colSpan={10} className="text-left font-bold py-1 border border-black border-b-0 pl-2">DATA ____/____/____</td></tr>
            <tr className="border border-black bg-gray-100">
              <th className="border border-black p-1 w-[8%]">HORA</th>
              <th className="border border-black p-1 w-[12%]">PA<br/>mmHg</th>
              <th className="border border-black p-1 w-[10%]">PULSO<br/>bpm</th>
              <th className="border border-black p-1 w-[10%]">TEMP.<br/>°C</th>
              <th className="border border-black p-1 w-[10%]">RESP.<br/>irpm</th>
              <th className="border border-black p-1 w-[10%]">PESO<br/>Kg</th>
              <th className="border border-black p-1 w-[10%]">GLIC.<br/>Mg/dl</th>
              <th className="border border-black p-1 w-[10%]">BCF<br/>bpm</th>
              <th className="border border-black p-1 w-[10%]">SAT. O²<br/>%</th>
              <th className="border border-black p-1 w-[10%]">HORA</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td></tr>
            ))}
          </tbody>
        </table>

        {/* TABELA DE CONTROLES E DRENOS */}
        <table className="w-full border-collapse text-[9px] text-center border-t-0">
          <thead>
            <tr className="bg-gray-100">
              <th colSpan={2} className="border border-black p-1">DIURESE</th>
              <th colSpan={2} className="border border-black p-1">CONTROLES</th>
              <th colSpan={2} className="border border-black p-1">DRENOS</th>
            </tr>
            <tr className="bg-gray-50 text-[8px]">
              <th className="border border-black p-1 w-[15%]">HORA</th>
              <th className="border border-black p-1 w-[18%]">DÉBITO (ml)</th>
              <th className="border border-black p-1 w-[15%]">HORA</th>
              <th className="border border-black p-1 w-[19%] text-transparent">TXT</th>
              <th className="border border-black p-1 w-[15%]">HORA</th>
              <th className="border border-black p-1 w-[18%]">DÉBITO (ml)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td><td className="border border-black h-5"></td></tr>
            ))}
          </tbody>
        </table>

        {/* ANOTAÇÃO DE ENFERMAGEM */}
        <div className="flex border border-black border-t-0 flex-1 overflow-hidden relative">
          <div className="w-[12%] border-r border-black flex flex-col">
            <div className="text-[9px] text-center font-bold bg-gray-100 border-b border-black py-1">HORA</div>
          </div>
          <div className="w-[70%] flex flex-col border-r border-black relative">
            <div className="text-[10px] text-center font-bold bg-gray-100 border-b border-black py-1 z-10 w-full relative">ANOTAÇÃO DE ENFERMAGEM</div>
            {/* Linhas Pautadas */}
            <div className="w-full flex-1 flex flex-col overflow-hidden px-1">
              {Array.from({ length: 30 }).map((_, i) => (
                <div key={i} className="border-b border-dotted border-gray-400 flex-1 min-h-[16px] w-full"></div>
              ))}
            </div>
          </div>
          <div className="w-[18%] flex flex-col">
            <div className="text-[9px] text-center font-bold bg-gray-100 border-b border-black py-1 whitespace-pre-wrap">CARIMBO E{'\n'}ASSINATURA</div>
          </div>
        </div>

        {/* Pagination Page 2 */}
        <div className="text-right text-[10px] mt-2 font-bold text-gray-600">Página 2 / 3</div>
      </div>

      {/* PAGE 3: Continuação de Evolução */}
      <div className={`page box-border w-full flex flex-col h-[270mm] print:pl-[20mm] print:pr-[10mm] print:py-[10mm] ${previewMode ? 'p-6' : ''}`} style={{ pageBreakBefore: 'always' }}>
        <div className="text-[9px] mb-1 flex justify-between font-bold text-gray-600 px-1">
           <span>Paciente: {patientName || '_________________________________'}</span>
           <span>Data: {today}</span>
        </div>
        
        {/* ANOTAÇÃO DE ENFERMAGEM CONTINUAÇÃO */}
        <div className="flex border border-black flex-1 overflow-hidden relative">
          <div className="w-[12%] border-r border-black flex flex-col bg-gray-50/10">
            <div className="text-[9px] text-center font-bold bg-gray-100 border-b border-black py-1">HORA</div>
          </div>
          <div className="w-[70%] flex flex-col border-r border-black relative">
            <div className="text-[10px] text-center font-bold bg-gray-100 border-b border-black py-1 z-10 w-full relative">ANOTAÇÃO DE ENFERMAGEM (CONTINUAÇÃO)</div>
            {/* Linhas Pautadas */}
            <div className="w-full flex-1 flex flex-col overflow-hidden px-1">
              {Array.from({ length: 55 }).map((_, i) => (
                <div key={i} className="border-b border-dotted border-gray-400 flex-1 min-h-[16px] w-full"></div>
              ))}
            </div>
          </div>
          <div className="w-[18%] flex flex-col bg-gray-50/10">
            <div className="text-[9px] text-center font-bold bg-gray-100 border-b border-black py-1 whitespace-pre-wrap">CARIMBO E{'\n'}ASSINATURA</div>
          </div>
        </div>

        {/* Pagination Page 3 */}
        <div className="text-right text-[10px] mt-2 font-bold text-gray-600">Página 3 / 3</div>
      </div>
      
    </div>
  );
}
