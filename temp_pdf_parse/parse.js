const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const pdfDir = '/Users/evelynmollmann/.gemini/antigravity/scratch/aih-consultation/Protocolos de Solicitacao de Exames';
const outDir = '/Users/evelynmollmann/.gemini/antigravity/scratch/aih-consultation/documentos_referencia_txt';

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
}

const files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

async function processPdfs() {
    for (const file of files) {
        const dataBuffer = fs.readFileSync(path.join(pdfDir, file));
        try {
            const data = await pdf(dataBuffer);
            fs.writeFileSync(path.join(outDir, file.replace('.pdf', '.txt')), data.text);
            console.log("Processed:", file);
        } catch (e) {
            console.error("Error processing", file, e);
        }
    }
}

processPdfs();
