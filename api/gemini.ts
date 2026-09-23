import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req: any, res: any) {
        if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method Not Allowed' });
        }

        try {
                    const { prompt, config } = req.body;

                    if (!process.env.ANTHROPIC_API_KEY) {
                                    console.error("Missing ANTHROPIC_API_KEY environment variable");
                                    return res.status(500).json({ error: 'Erro de configuração do servidor: API Key ausente no Vercel' });
                    }

                    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

                    const tryGenerate = async (modelName: string) => {
                                    const response = await anthropic.messages.create({
                                                        model: modelName,
                                                        max_tokens: 8192,
                                                        temperature: config?.temperature ?? 1,
                                                        messages: [{ role: 'user', content: prompt }]
                                    });
                                    const textBlock: any = response.content.find((block: any) => block.type === 'text');
                                    return { text: textBlock ? textBlock.text : '' };
                    };

                    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
                    // Modelo principal (melhor qualidade) com fallback automático para um modelo mais rápido/barato em caso de sobrecarga
                    const modelsToTry = [
                                    'claude-sonnet-5',
                                    'claude-haiku-4-5'
                                ];
                    let response;
                    let errorsRecord: any[] = [];

                    for (let i = 0; i < modelsToTry.length; i++) {
                                    try {
                                                        response = await tryGenerate(modelsToTry[i]);
                                                        break; // Success
                                    } catch (err: any) {
                                                        errorsRecord.push({ model: modelsToTry[i], error: err?.message || err });
                                                        console.warn(`Tentativa com ${modelsToTry[i]} falhou:`, err?.message || err);
                                                        if (err?.status === 404 || err?.status === 429 || err?.status === 529) {
                                                                                // Modelo não encontrado, limite de cota, ou servidor sobrecarregado: pula logo pro próximo
                                                                                continue;
                                                        }
                                                        if (i < modelsToTry.length - 1) {
                                                                                await sleep(1000); // Espera 1 seg antes do retry
                                                        }
                                    }
                    }

                    if (!response) {
                                    console.error("All models failed. Error record:", JSON.stringify(errorsRecord, null, 2));
                                    return res.status(500).json({ error: 'Nenhum modelo disponível no momento. Detalhes: ' + JSON.stringify(errorsRecord) });
                    }

                    return res.status(200).json({ text: response.text });
        } catch (error: any) {
                    console.error("Claude API Error:", error);
                    return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
        }
}
