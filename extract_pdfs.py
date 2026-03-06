import sys, os
from pypdf import PdfReader

pdf_dir = "/Users/evelynmollmann/.gemini/antigravity/scratch/aih-consultation/Protocolos de Solicitacao de Exames"
out_dir = "/Users/evelynmollmann/.gemini/antigravity/scratch/aih-consultation/documentos_referencia_txt"

os.makedirs(out_dir, exist_ok=True)

for file in os.listdir(pdf_dir):
    if file.endswith(".pdf"):
        pdf_path = os.path.join(pdf_dir, file)
        out_path = os.path.join(out_dir, file.replace(".pdf", ".txt"))
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                ext = page.extract_text()
                if ext:
                    text += ext + "\n"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(text)
            print("Processed:", file)
        except Exception as e:
            print("Error:", file, repr(e))
