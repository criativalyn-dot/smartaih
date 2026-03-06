import fs from 'fs';

const path = './src/data/mockDatabase.ts';
let content = fs.readFileSync(path, 'utf8');

const cids = [];
for (let i = 0; i <= 40; i++) {
    const k = i.toString().padStart(2, '0');
    for (let j = 0; j <= 9; j++) {
        cids.push(`\t{
\t\tcid: "K${k}.${j}",
\t\tcidNome: "Doença CID genérica - K${k}.${j}",
\t\tprocedimentos: [
\t\t\t{
\t\t\t\tcodigo: "03.01.01.004-8",
\t\t\t\tnome: "Consulta médica",
\t\t\t\tgrupo: "03 - Procedimentos Clínicos",
\t\t\t\tsubGrupo: "01 - Consultas",
\t\t\t\tformaOrganizacao: "01 - Consultas",
\t\t\t\tcomplexidade: "Média Complexidade"
\t\t\t}
\t\t]
\t}`);
    }
}

content = content.replace(/\.\.\.Array\.from\(\{ length: 15 \}\)\.map\(\(\_, i\) => \(\{[^]+?\}\)\),/, cids.join(',\n') + ',');

fs.writeFileSync(path, content, 'utf8');
