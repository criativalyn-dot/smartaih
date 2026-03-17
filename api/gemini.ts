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

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: config || undefined
        });

        return res.status(200).json({ text: response.text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
    }
}
