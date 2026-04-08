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
        const modelsToTry = ['gemini-1.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        let response;
        let lastError;

        for (let i = 0; i < modelsToTry.length; i++) {
            try {
                response = await tryGenerate(modelsToTry[i]);
                break; // Success
            } catch (err: any) {
                lastError = err;
                console.warn(`Tentativa com ${modelsToTry[i]} falhou:`, err?.message || err);
                if (i < modelsToTry.length - 1) {
                    await sleep(3000); // Espera 3 segundos antes do retry
                }
            }
        }

        if (!response) {
            throw lastError;
        }

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
    }
}
