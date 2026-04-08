import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, config } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            console.error("Missing GEMINI_API_KEY environment variable");
            return res.status(500).json({ error: 'Erro de configuração do servidor: API Key ausente no Vercel' });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const tryGenerate = async (modelName: string) => {
            return await ai.models.generateContent({
                model: modelName,
                contents: prompt,
                config: config || undefined
            });
        };

        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        // Agora que a conta é paga, o 2.0-flash tem cota liberada e não sofre o 503 severo do 2.5
        const modelsToTry = ['gemini-2.0-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];
        let response;
        let errorsRecord: any[] = [];

        for (let i = 0; i < modelsToTry.length; i++) {
            try {
                response = await tryGenerate(modelsToTry[i]);
                break; // Success
            } catch (err: any) {
                errorsRecord.push({ model: modelsToTry[i], error: err?.message || err });
                console.warn(`Tentativa com ${modelsToTry[i]} falhou:`, err?.message || err);
                if (err?.message?.includes('404')) {
                   // Se for 404, não adianta esperar, pula logo pro próximo
                   continue;
                }
                if (i < modelsToTry.length - 1) {
                    await sleep(2000); // Espera 2 segundos antes do retry
                }
            }
        }

        if (!response) {
            console.error("All models failed. Error record:", JSON.stringify(errorsRecord, null, 2));
            return res.status(500).json({ error: 'Nenhum modelo disponível no momento. Detalhes: ' + JSON.stringify(errorsRecord) });
        }

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
    }
}
