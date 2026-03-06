const fs = require('fs');
const path = './src/data/mockDatabase.ts';
let content = fs.readFileSync(path, 'utf8');

const cids = [];
for (let i = 0; i <= 40; i++) {
  const k = i.toString().padStart(2, '0');
  for (let j = 0; j <= 9; j++) {
    cids.push(`    {
        cid: "K${k}.${j}",
        cidNome: "Doença do aparelho digestivo genérica - K${k}.${j}",
        procedimentos: [
            {
                codigo: "03.01.01.004-8",
                nome: "Consulta médica",
                grupo: "03 - Procedimentos Clínicos",
                subGrupo: "01 - Consultas",
                formaOrganizacao: "01 - Consultas",
                complexidade: "Média Complexidade"
            }
        ]
    }`);
  }
}

const matchRegex = /\.\.\.Array\.from\[\^\]\+\?\}\)\)\),/;
// we'll just replace the original Array.from block directly
content = content.replace(/.*?\.\.\.Array\.from\(\{ length: 15 \}\)\.map\(\(\_, i\) => \(\{[^}]+\}\)\)\),/, cids.join(',\n') + ',');

fs.writeFileSync(path, content, 'utf8');
