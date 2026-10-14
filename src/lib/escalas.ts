// Classificações oficiais das escalas usadas na SAE.
// Centralizadas aqui para que tela, impresso e prompt da IA usem exatamente os mesmos cortes.

// Braden (Paranhos & Santos, 1999 - validação brasileira): 6 a 23 pontos
export const getBradenRisk = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'Não avaliado';
  if (score <= 9) return 'Risco Muito Alto';
  if (score <= 12) return 'Risco Alto';
  if (score <= 14) return 'Risco Moderado';
  if (score <= 18) return 'Risco Leve';
  return 'Sem Risco';
};

// Morse Fall Scale (Urbanetto et al., 2013 - versão brasileira): 0 a 125 pontos
export const getMorseRisk = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'Não avaliado';
  if (score >= 45) return 'Risco Alto';
  if (score >= 25) return 'Risco Moderado';
  return 'Risco Baixo';
};

// Fugulin (SCP - Sistema de Classificação de Pacientes): 9 a 36 pontos
export const getFugulinCareLevel = (score: number | null | undefined) => {
  if (score === null || score === undefined) return 'Não avaliado';
  if (score >= 32) return 'Cuidados Intensivos';
  if (score >= 27) return 'Cuidados Semi-Intensivos';
  if (score >= 21) return 'Cuidados de Alta Dependência';
  if (score >= 15) return 'Cuidados Intermediários';
  return 'Cuidados Mínimos';
};

type ScoreMap = Record<string, number | null>;

// Soma os itens da escala; devolve null enquanto algum item não foi respondido.
export const sumScale = (items: ScoreMap): number | null => {
  const values = Object.values(items);
  if (values.some(v => v === null || v === undefined)) return null;
  return values.reduce<number>((acc, v) => acc + (v as number), 0);
};

export const scaleMissingItems = (items: ScoreMap, labels: Record<string, string>): string[] =>
  Object.entries(items)
    .filter(([, v]) => v === null || v === undefined)
    .map(([k]) => labels[k] || k);

// ---- Datas ----
// <input type="date"> devolve 'YYYY-MM-DD'. `new Date('YYYY-MM-DD')` interpreta como UTC
// e, no fuso brasileiro, recua um dia. Aqui a data é criada no fuso local.
export const parseLocalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

export const formatDateBR = (value?: string | null, fallback = '') => {
  const d = parseLocalDate(value);
  return d ? d.toLocaleDateString('pt-BR') : fallback;
};

export const calcularIdadeExata = (dataString?: string | null) => {
  const nasc = parseLocalDate(dataString);
  if (!nasc) return 'Idade não informada';
  const hoje = new Date();
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
  }
  return `${dias} dias de vida`;
};
