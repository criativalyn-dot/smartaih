import fs from 'fs';
import path from 'path';
import readline from 'readline';

const INPUT_DIR = path.resolve(process.cwd(), 'sigtap_data_raw');
const PROCEDURES_FILE = path.join(INPUT_DIR, 'tb_procedimento.txt');
const RELATIONS_FILE = path.join(INPUT_DIR, 'rl_procedimento_cid.txt');
const OUTPUT_FILE = path.resolve(process.cwd(), 'src', 'data', 'sigtap_database.json');

// Map holding the permitted CIDs for each procedure: Map<codigo, string[]>
const procedureCidsMap = new Map();

async function parseRelations() {
    console.log('1. Parsing Procedure -> CID relations (rl_procedimento_cid.txt)...');
    const fileStream = fs.createReadStream(RELATIONS_FILE, { encoding: 'latin1' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let count = 0;
    for await (const line of rl) {
        if (line.trim().length < 14) continue;

        const codigo = line.substring(0, 10);
        // Ignore relations for groups other than 03 and 04 to save memory
        if (!codigo.startsWith('03') && !codigo.startsWith('04')) continue;

        // ISO-8859-1 conversion implicitly handled if we just use normal string splitting,
        // but the file is fixed width. 
        const cid = line.substring(10, 14).trim();

        if (!procedureCidsMap.has(codigo)) {
            procedureCidsMap.set(codigo, []);
        }
        procedureCidsMap.get(codigo).push(cid);

        count++;
        if (count % 500000 === 0) console.log(`   Read ${count} lines...`);
    }
    console.log(`   Done. Loaded CIDs for ${procedureCidsMap.size} procedures.`);
}

function sanitizeTagName(codigo, nome) {
    // Generate a clinical tag like "0303140046_TRATAMENTO_DAS_DOENCAS"
    let cleanName = nome
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^A-Za-z0-9]/g, "_") // Replace non-alphanumeric with underscore
        .replace(/_+/g, "_") // Remove consecutive underscores
        .toUpperCase()
        .slice(0, 120); // AUMENTADO: Evitar cortar palavras críticas como ONCOLOGICO no final do nome

    if (cleanName.endsWith('_')) cleanName = cleanName.slice(0, -1);
    return `SIGTAP_${codigo}_${cleanName}`;
}

async function parseProcedures() {
    console.log('2. Parsing Procedures (tb_procedimento.txt) and building final JSON...');
    const fileStream = fs.createReadStream(PROCEDURES_FILE, { encoding: 'latin1' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const finalDatabase = [];
    let addedCount = 0;

    for await (const line of rl) {
        if (line.trim().length < 20) continue;

        const codigo = line.substring(0, 10);

        // Only Clinical (03) and Surgical (04)
        if (!codigo.startsWith('03') && !codigo.startsWith('04')) continue;

        const nome = line.substring(10, 260).trim();

        const grupo = codigo.substring(0, 2);
        const subGrupo = codigo.substring(2, 4);
        const formaOrganizacao = codigo.substring(4, 6);

        const permittedCids = procedureCidsMap.get(codigo) || [];

        // Only add procedures that have at least one CID allowed (or we can add all if we want, but SUS procedures without CIDs are usually non-diagnosable actions)
        if (permittedCids.length > 0) {
            const tag = sanitizeTagName(codigo, nome);

            finalDatabase.push({
                id: tag.toLowerCase(),
                codigo: `${codigo.substring(0, 2)}.${codigo.substring(2, 4)}.${codigo.substring(4, 6)}.${codigo.substring(6, 9)}-${codigo.substring(9)}`,
                nome: nome,
                grupo: grupo,
                subGrupo: subGrupo,
                formaOrganizacao: formaOrganizacao,
                tagsClinicas: [tag],
                cidsPermitidos: permittedCids,
                cidsProibidos: [],
                defaultCid: permittedCids[0] || '*'
            });
            addedCount++;
        }
    }

    console.log(`   Extracted ${addedCount} valid clinical/surgical procedures.`);
    return finalDatabase;
}

async function run() {
    try {
        await parseRelations();
        const db = await parseProcedures();

        console.log(`3. Writing output to ${OUTPUT_FILE}...`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(db, null, 2), 'utf-8');

        console.log(`✓ Pipeline SIGTAP master file built successfully (${db.length} entries).`);
    } catch (err) {
        console.error('Fatal error during ETL:', err);
        process.exit(1);
    }
}

run();
