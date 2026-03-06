import fs from 'fs';

const path = './src/data/mockDatabase.ts';

// Categories of CID-10 chapters roughly mapped for realism
const cidChapters = [
  { prefix: 'A', name: 'Algumas doenças infecciosas e parasitárias', max: 99 },
  { prefix: 'B', name: 'Doenças infecciosas virais, micoses', max: 99 },
  { prefix: 'C', name: 'Neoplasias (tumores) malignas', max: 97 },
  { prefix: 'D', name: 'Neoplasias in situ, benignas / Doenças do sangue', max: 89 },
  { prefix: 'E', name: 'Doenças endócrinas, nutricionais e metabólicas', max: 90 },
  { prefix: 'F', name: 'Transtornos mentais e comportamentais', max: 99 },
  { prefix: 'G', name: 'Doenças do sistema nervoso', max: 99 },
  { prefix: 'H', name: 'Doenças do olho / ouvido', max: 95 },
  { prefix: 'I', name: 'Doenças do aparelho circulatório', max: 99 },
  { prefix: 'J', name: 'Doenças do aparelho respiratório', max: 99 },
  { prefix: 'K', name: 'Doenças do aparelho digestivo', max: 93 },
  { prefix: 'L', name: 'Doenças da pele e do tecido subcutâneo', max: 99 },
  { prefix: 'M', name: 'Doenças do sistema osteomuscular e do tecido conjuntivo', max: 99 },
  { prefix: 'N', name: 'Doenças do aparelho geniturinário', max: 99 },
  { prefix: 'O', name: 'Gravidez, parto e puerpério', max: 99 },
  { prefix: 'P', name: 'Afecções originadas no período perinatal', max: 96 },
  { prefix: 'Q', name: 'Malformações congênitas, deformidades e anomalias cromossômicas', max: 99 },
  { prefix: 'R', name: 'Sintomas, sinais e achados anormais em exames clínicos', max: 99 },
  { prefix: 'S', name: 'Lesões, envenenamentos (traumas)', max: 99 },
  { prefix: 'T', name: 'Causas externas, queimaduras', max: 98 },
  { prefix: 'V', name: 'Acidentes de transporte', max: 99 },
  { prefix: 'W', name: 'Quedas, exposição a forças mecânicas', max: 99 },
  { prefix: 'X', name: 'Lesões autoprovocadas, agressões', max: 99 },
  { prefix: 'Y', name: 'Complicações da assistência médica e cirúrgica', max: 98 },
  { prefix: 'Z', name: 'Fatores que influenciam o estado de saúde e o contato com os serviços de saúde', max: 99 }
];

let cids = [];

// Generate base structure so TS doesn't complain
const baseContent = `export interface CidSigtapRelation {
  cid: string;
  cidNome: string;
  procedimentos: SigtapProcedure[];
}

export interface SigtapProcedure {
  codigo: string;
  nome: string;
  grupo: string;
  subGrupo: string;
  formaOrganizacao: string;
  complexidade: string;
  restricaoProfissional?: string;
}

export const MOCK_DATABASE: CidSigtapRelation[] = [
REPLACE_ME
];
`;

for (let chapter of cidChapters) {
  for (let i = 0; i <= chapter.max; i++) {
    // skip some numbers randomly or keep it simple? keep it exhaustive for the UI test
    const num = i.toString().padStart(2, '0');
    // Just add .0 to .3 for each to simulate variants, keeping array somewhat manageable
    for (let j = 0; j <= 2; j++) {
      let rest = "";
      if (chapter.prefix === 'K' && i === 40) rest = 'Exclusivo Cirurgião Geral';
      if (chapter.prefix === 'O') rest = 'Exclusivo Obstetra';
      if (chapter.prefix === 'F') rest = 'Exclusivo Psiquiatra';

      cids.push(`  {
    cid: "${chapter.prefix}${num}.${j}",
    cidNome: "${chapter.name} - Variante ${chapter.prefix}${num}.${j}",
    procedimentos: [
      {
        codigo: "03.01.01.004-8",
        nome: "Consulta médica em atenção especializada",
        grupo: "03 - Procedimentos Clínicos",
        subGrupo: "01 - Consultas",
        formaOrganizacao: "01 - Consultas",
        complexidade: "Média Complexidade",
        ${rest ? `restricaoProfissional: "${rest}"` : ''}
      },
      {
        codigo: "02.04.02.003-8",
        nome: "Exames de imagem padrão - ${chapter.name}",
        grupo: "02 - Diagnósticos",
        subGrupo: "04 - Radiologia",
        formaOrganizacao: "02 - Radiografia",
        complexidade: "Média Complexidade"
      }
    ]
  }`);
    } // ~3 variations per CID code
  }
}

// Add the exact specific ones the user cared about strictly at the end/top:
const exactMatches = `  {
    cid: "J18.9",
    cidNome: "Pneumonia não especificada",
    procedimentos: [
      { codigo: "03.03.01.014-0", nome: "Tratamento de pneumonias ou broncopneumonias", grupo: "03", subGrupo: "03", formaOrganizacao: "01", complexidade: "Média", restricaoProfissional: "Clínico Geral / Pneumologista" },
      { codigo: "02.04.03.015-7", nome: "Radiografia de tórax (PA e Perfil)", grupo: "02", subGrupo: "04", formaOrganizacao: "03", complexidade: "Básica" }
    ]
  },
  {
    cid: "J15.9",
    cidNome: "Pneumonia bacteriana não especificada",
    procedimentos: [{ codigo: "03.03.01.014-0", nome: "Tratamento de pneumonias ou broncopneumonias", grupo: "03", subGrupo: "03", formaOrganizacao: "01", complexidade: "Média", restricaoProfissional: "Clínico Geral / Pneumologista" }]
  },
  {
    cid: "J12.9",
    cidNome: "Pneumonia viral não especificada",
    procedimentos: [{ codigo: "03.03.01.014-0", nome: "Tratamento de pneumonias ou broncopneumonias", grupo: "03", subGrupo: "03", formaOrganizacao: "01", complexidade: "Média", restricaoProfissional: "Clínico Geral / Pneumologista" }]
  },
  {
    cid: "R10.4",
    cidNome: "Outras dores abdominais e as não especificadas",
    procedimentos: [{ codigo: "03.01.01.007-2", nome: "Consulta", grupo: "03", subGrupo: "01", formaOrganizacao: "01", complexidade: "Média", restricaoProfissional: "Clínico Geral" }]
  },
  {
    cid: "K35.8",
    cidNome: "Outras apendicites agudas e as não especificadas",
    procedimentos: [{ codigo: "04.07.02.003-9", nome: "Apendicectomia", grupo: "04", subGrupo: "07", formaOrganizacao: "02", complexidade: "Alta", restricaoProfissional: "Exclusivo Cirurgião Geral" }]
  },
  {
    cid: "I10",
    cidNome: "Hipertensão essencial (primária)",
    procedimentos: [{ codigo: "03.01.01.007-2", nome: "Acompanhamento UBS", grupo: "03", subGrupo: "01", formaOrganizacao: "01", complexidade: "Básica" }]
  }`;

cids.push(exactMatches);

let finalFile = baseContent.replace('REPLACE_ME', cids.join(',\n'));
fs.writeFileSync(path, finalFile, 'utf8');
console.log("Mock database generated with", cids.length, "CID entries.");
