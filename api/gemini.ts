export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, config } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY environment variable');
      return res.status(500).json({ error: 'Erro de configuração do servidor: GEMINI_API_KEY ausente no Vercel' });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt ausente' });
    }

    const generationConfig: Record<string, any> = {
      temperature: config?.temperature ?? 1,
      maxOutputTokens: 16384,
    };
    if (config?.responseMimeType) {
      generationConfig.responseMimeType = config.responseMimeType;
    }

    const tryGenerate = async (modelName: string) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': process.env.GEMINI_API_KEY as string,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        const err: any = new Error(`${response.status} ${body}`);
        err.status = response.status;
        throw err;
      }

      const data: any = await response.json();
      const parts: any[] = data?.candidates?.[0]?.content?.parts || [];
      const text = parts
        .filter((p: any) => typeof p.text === 'string' && !p.thought)
        .map((p: any) => p.text)
        .join('');
      if (!text) {
        const err: any = new Error('Resposta vazia do modelo: ' + JSON.stringify(data?.promptFeedback || data?.candidates?.[0]?.finishReason || 'sem detalhes'));
        err.status = 502;
        throw err;
      }
      return { text };
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Modelo principal (pode ser trocado pela variável GEMINI_MODEL no Vercel) com fallback automático
    // para modelos alternativos em caso de sobrecarga, limite de cota ou modelo indisponível.
    const modelsToTry = Array.from(
      new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'].filter(Boolean))
    ) as string[];

    let response;
    const errorsRecord: any[] = [];

    for (let i = 0; i < modelsToTry.length; i++) {
      try {
        response = await tryGenerate(modelsToTry[i]);
        break; // Success
      } catch (err: any) {
        errorsRecord.push({ model: modelsToTry[i], error: err?.message || String(err) });
        console.warn(`Tentativa com ${modelsToTry[i]} falhou:`, err?.message || err);
        if (err?.status === 404 || err?.status === 429 || err?.status === 503 || err?.status === 529) {
          // Modelo não encontrado, limite de cota ou servidor sobrecarregado: pula logo pro próximo
          continue;
        }
        if (i < modelsToTry.length - 1) {
          await sleep(1000); // Espera 1 seg antes do retry
        }
      }
    }

    if (!response) {
      console.error('All models failed. Error record:', JSON.stringify(errorsRecord, null, 2));
      return res.status(500).json({ error: 'Nenhum modelo disponível no momento. Detalhes: ' + JSON.stringify(errorsRecord) });
    }

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message || 'Erro ao comunicar com a Inteligência Artificial' });
  }
}
