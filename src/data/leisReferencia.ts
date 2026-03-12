export const LEIS_REFERENCIA_AUDITORIA = `
LEI DO PLANEJAMENTO FAMILIAR - ESTERILIZAÇÃO VOLUNTÁRIA (Laqueadura e Vasectomia)
Base Legal: Lei nº 9.263/1996 atualizada pela Lei nº 14.443/2022.

ATENÇÃO REDOBRADA DA IA: Caso o texto clínico, a justificativa do paciente ou o CID solicitado cite expressamente "Laqueadura", "Vasectomia", "Laqueadura Tubária", "Esterilização", ou "Planejamento Familiar com Intenção Definitiva", VOCÊ DEVE OBRIGATORIAMENTE auditar se os seguintes CRITÉRIOS LEGAIS estão descritos no quadro clínico fornecido:

1. IDADE OU FILHOS:
   - REGRA: O(A) paciente deve ter pelo menos 21 (VINTE E UM) ANOS DE IDADE completos OU ter pelo menos 2 (DOIS) FILHOS VIVOS.
   - EXCEÇÃO DA IDADE: A capacidade civil plena e idade maior que 21 anos são exigidos, EXCETO se o paciente possuir 2 filhos vivos (neste caso, a idade não importa).
   
2. PRAZO DE REFLEXÃO E ARREPENDIMENTO:
   - REGRA: Deve haver um prazo MÍNIMO de 60 (SESSENTA) DIAS entre a manifestação da vontade (assinatura do termo/início do planejamento) e a realização do ato cirúrgico.
   - EXCEÇÃO: Mulheres grávidas podem realizar a laqueadura durante o parto, desde que este prazo de 60 dias tenha sido cumprido durante o pré-natal e devidamente registrado.

3. CONSENTIMENTO DO CÔNJUGE:
   - REGRA (ATUALIZADA LEI 14.443/2022): NÃO É MAIS EXIGIDO o consentimento expresso do cônjuge/parceiro para a realização da esterilização voluntária. A decisão é estritamente do indivíduo.

4. LAQUEADURA DURANTE PARTO OU ABORTO:
   - REGRA (ATUALIZADA LEI 14.443/2022): É PERMITIDA a esterilização cirúrgica em mulheres durante o período de parto, pós-parto imediato ou aborto, DESDE QUE tenham cumprido o prazo mínimo de 60 dias de manifestação prévia (relatado no pré-natal).

5. INDICAÇÃO CLÍNICA DE RISCO DE VIDA (Exceção aos critérios acima):
   - REGRA: A esterilização pode ser feita FORA das regras de idade, filhos e prazos SOMENTE se houver: Risco de Vida atual ou futuro para a mulher em caso de nova gestação, atestado em relatorio médico por 2 médicos especialistas (incluindo laudo psiquiátrico se for o caso).
   - CESARIANAS PRÉVIAS: O histórico de "Múltiplas Cesarianas Anteriores" isolado não isenta a regra dos 60 dias, a menos que os 2 médicos atestem expressamente o "Risco Iminente de Vida/Ruptura Uterina". O CID O34.2 (Cicatriz uterina prévia) por si só não justifica quebrar o prazo.

INSTRUÇÕES PARA AUDITORIA DA IA DE FARURAMENTO (SIGTAP):
- Se o quadro apontar solicitação de Vasectomia ou Laqueadura, e o texto clínico (Justificativa) NÃO COMPROVAR o cumprimento explícito das regras acima (ex: não citar o prazo de 60 dias, ou se o paciente for menor de 21 anos SEM 2 filhos), você NÃO PODE emitir a cor 'Verde' ou 'Azul' de faturamento irrestrito ou autorização no Manchester sem fazer uma forte RESSALVA Legal.
- Na sua "justificativa" (dentro da estrutura JSON), crie um Alerta de Auditoria Médica, citando as "Exigências da Lei 14.443/2022".
- Se todos os critérios forem cumpridos maravilhosamente bem, você PODE aprovar a justificativa, citando a adequação à Lei 14.443/2022 em seu relatório de parecer.
`;
