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
        // Foco vital nos únicos modelos que o Google aprovou como 'Encontrados' (sem 404)
        const modelsToTry = [
            'gemini-2.0-flash', 
            'gemini-2.5-flash',
            'gemini-2.0-pro'
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
                if (err?.message?.includes('404') || err?.message?.includes('429')) {
                   // Se for 404 ou limite de cota, não adianta esperar, pula logo pro próximo
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
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
    }
}
