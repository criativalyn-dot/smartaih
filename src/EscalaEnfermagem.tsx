import React, { useState } from 'react';
import { Download, Plus, Trash2, Calendar } from 'lucide-react';

export interface Colaborador {
    id: string;
    nome: string;
    categoria: 'ENF' | 'TEC';
    coren: string;
    turnoBase: string;
    setor: string;
    regime: '12x36_PAR' | '12x36_IMPAR' | '8H_DIARIO' | '24H_DOBRA' | '24x24_PAR' | '24x24_IMPAR' | 'SOBREAVISO' | 'FERIAS';
}

interface Props {
    colaboradores: Colaborador[];
    setColaboradores: React.Dispatch<React.SetStateAction<Colaborador[]>>;
    mes: number;
    ano: number;
    setMes: React.Dispatch<React.SetStateAction<number>>;
    setAno: React.Dispatch<React.SetStateAction<number>>;
    excecoes: Record<string, string>;
    setExcecoes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export const EscalaEnfermagem: React.FC<Props> = ({
    colaboradores, setColaboradores, mes, ano, setMes, setAno, excecoes, setExcecoes
}) => {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isNovoSetor, setIsNovoSetor] = useState(false);
    const setores = Array.from(new Set(colaboradores.map(c => c.setor)));

    const [novoColab, setNovoColab] = useState<Partial<Colaborador>>({
        categoria: 'TEC',
        regime: '12x36_PAR',
        setor: setores.length > 0 ? setores[0] : '',
        turnoBase: '07H-19H'
    });

    const getDiasDoMes = (m: number, a: number) => new Date(a, m, 0).getDate();
    const getDiaDaSemana = (dia: number, m: number, a: number) => new Date(a, m - 1, dia).getDay();
    const isFDS = (dia: number, m: number, a: number) => {
        const ds = getDiaDaSemana(dia, m, a);
        return ds === 0 || ds === 6;
    };

    const diasStr = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

    const diasNoMes = getDiasDoMes(mes, ano);
    const diasArray = Array.from({ length: diasNoMes }, (_, i) => i + 1);

    const calcularPlantaoDefault = (dia: number, colab: Colaborador) => {
        if (colab.regime === 'SOBREAVISO') return 'S';
        if (colab.regime === 'FERIAS') return 'F';
        if (colab.regime === '12x36_PAR') return dia % 2 === 0 ? 'P' : 'F';
        if (colab.regime === '12x36_IMPAR') return dia % 2 !== 0 ? 'P' : 'F';
        if (colab.regime === '24x24_PAR' || colab.regime === '24H_DOBRA') return dia % 2 === 0 ? 'P' : 'F';
        if (colab.regime === '24x24_IMPAR') return dia % 2 !== 0 ? 'P' : 'F';
        if (colab.regime === '8H_DIARIO') {
            if (isFDS(dia, mes, ano)) return 'X'; // Cinza, nao trabalha
            return diasStr[getDiaDaSemana(dia, mes, ano)];
        }
        return 'F';
    };

    const getStatusPlantao = (dia: number, colab: Colaborador) => {
        const key = `${colab.id}-${ano}-${mes}-${dia}`;
        if (excecoes[key]) return excecoes[key];
        return calcularPlantaoDefault(dia, colab);
    };

    const cycleStatus = (dia: number, colab: Colaborador) => {
        const key = `${colab.id}-${ano}-${mes}-${dia}`;
        const current = getStatusPlantao(dia, colab);

        // P -> F -> S -> FE -> LM -> (clear/default)
        let next = '';
        if (colab.regime === '8H_DIARIO' && isFDS(dia, mes, ano)) return; // FDS de 8h nao clica

        if (current === 'P') next = 'F';
        else if (current === 'F') next = 'S';
        else if (current === 'S') next = 'FE';
        else if (current === 'FE') next = 'LM';
        else if (current === 'LM') next = 'P';
        else next = 'P'; // Se for o nome do dia na semana (ex: QUA), forca para um P (ou folga se clickar de novo)

        setExcecoes(prev => ({ ...prev, [key]: next }));
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setNovoColab({ categoria: 'TEC', regime: '12x36_PAR', setor: setores.length > 0 ? setores[0] : '', turnoBase: '07H-19H' });
        setIsNovoSetor(setores.length === 0);
        setShowModal(true);
    };

    const handleEdit = (colab: Colaborador) => {
        setEditingId(colab.id);
        setNovoColab({ ...colab });
        setIsNovoSetor(!setores.includes(colab.setor));
        setShowModal(true);
    };

    const handleSaveColaborador = () => {
        if (!novoColab.nome) return alert('Digite o nome');
        if (!novoColab.setor) return alert('Informe o setor do colaborador');

        // Intelligent Parity Incompatibility Check
        const nomeTrim = novoColab.nome.trim().toUpperCase();
        const existingEntries = colaboradores.filter(c =>
            c.id !== editingId &&
            (c.nome.trim().toUpperCase() === nomeTrim || (novoColab.coren && c.coren === novoColab.coren))
        );

        if (existingEntries.length > 0) {
            const isPar = (r?: string) => r === '12x36_PAR' || r === '24x24_PAR' || r === '24H_DOBRA';
            const isImpar = (r?: string) => r === '12x36_IMPAR' || r === '24x24_IMPAR';
            const is8H = (r?: string) => r === '8H_DIARIO' || r === 'SOBREAVISO' || r === 'FERIAS';

            const novoIsPar = isPar(novoColab.regime);
            const novoIsImpar = isImpar(novoColab.regime);
            const novoIs8H = is8H(novoColab.regime);

            for (const existing of existingEntries) {
                const existingIsPar = isPar(existing.regime);
                const existingIsImpar = isImpar(existing.regime);
                const existingIs8H = is8H(existing.regime);

                // Se um dos regimes for 8H_DIARIO, ele nao conflita por paridade com 12x36 (ex: trabalha 8h de dia e 12h a noite).
                // Apenas bloqueamos se houver um conflito direto Par vs Impar entre regimes de 12/24h.
                if (!novoIs8H && !existingIs8H) {
                    if ((novoIsPar && existingIsImpar) || (novoIsImpar && existingIsPar)) {
                        alert(`⚠️ Incompatibilidade de Escala Inteligente Detectada!\n\nO colaborador ${existing.nome} já possui uma escala salva em dias ${existingIsPar ? 'PARES' : 'ÍMPARES'} no setor "${existing.setor}".\n\nNão é possível alocar este profissional em dias opostos (PAR x ÍMPAR), pois causaria um conflito direto na execução do plantão (trabalharia todos os dias sem descanso de 36h).`);
                        return;
                    }
                }
            }
        }

        if (editingId) {
            // Update existing
            setColaboradores(colaboradores.map(c => c.id === editingId ? { ...novoColab, id: editingId } as Colaborador : c));
        } else {
            // Add new
            setColaboradores([...colaboradores, { ...novoColab, id: Date.now().toString() } as Colaborador]);
        }

        setShowModal(false);
        setEditingId(null);
        setNovoColab({ categoria: 'TEC', regime: '12x36_PAR', setor: setores.length > 0 ? setores[0] : '', turnoBase: '07H-19H' });
        setIsNovoSetor(false);
    };

    const handleRemove = (id: string) => {
        if (confirm('Remover colaborador?')) {
            setColaboradores(colaboradores.filter(c => c.id !== id));
        }
    };

    // Agrupar por Setor -> Categoria

    return (
        <div className="w-full bg-white rounded-3xl shadow-xl border border-gray-100 p-6 overflow-x-auto">

            {/* Header Escala */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 print:mb-4">
                <div>
                    <h2 className="text-2xl font-black text-red-700 uppercase flex items-center gap-2">
                        <Calendar className="w-7 h-7" />
                        Escala de Enfermagem
                    </h2>
                    <p className="text-gray-500 font-medium mt-1">Gestão de Plantões e Férias</p>
                </div>

                <div className="flex items-center gap-4 border border-gray-200 p-2 rounded-xl bg-gray-50">
                    <select
                        value={mes}
                        onChange={e => setMes(Number(e.target.value))}
                        className="bg-transparent font-bold text-gray-700 outline-none"
                    >
                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((mText, i) => (
                            <option key={i + 1} value={i + 1}>{mText}</option>
                        ))}
                    </select>
                    <span className="text-gray-300">|</span>
                    <input
                        type="number"
                        value={ano}
                        onChange={e => setAno(Number(e.target.value))}
                        className="w-20 bg-transparent font-bold text-gray-700 outline-none"
                    />
                </div>

                <div className="flex gap-2 print:hidden">
                    <button
                        onClick={handleOpenAdd}
                        className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Colaborador
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Salvar PDF
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          @page { size: A4 landscape; margin: 5mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-landscape { transform: scale(0.65); transform-origin: top left; width: 153%; }
        }
      `}} />

            {/* Tabela Principal */}
            <div className="overflow-x-auto print-landscape">
                <table className="w-full text-xs xl:text-sm border-collapse border border-gray-400">
                    <thead>
                        <tr className="bg-red-600 text-white">
                            <th className="border border-gray-400 p-2 text-left w-64 min-w-[250px]">COLABORADOR</th>
                            <th className="border border-gray-400 p-2 w-12 text-center">CAT</th>
                            <th className="border border-gray-400 p-2 w-20 text-center">COREN</th>
                            <th className="border border-gray-400 p-2 w-20 text-center">TURNO</th>
                            {diasArray.map(dia => (
                                <th key={dia} className={`border border-gray-400 p-1 w-8 text-center ${isFDS(dia, mes, ano) ? 'bg-gray-800' : 'bg-red-700'}`}>
                                    {dia}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {colaboradores.length === 0 ? (
                            <tr>
                                <td colSpan={diasNoMes + 4} className="text-center p-8 text-gray-400">Nenhum colaborador cadastrado. Clique no botão acima para adicionar.</td>
                            </tr>
                        ) : setores.map(setor => (
                            <React.Fragment key={setor}>
                                {/* Header do Setor */}
                                <tr className="bg-gray-200">
                                    <td colSpan={diasNoMes + 4} className="border border-gray-400 p-1.5 font-black text-gray-800 uppercase tracking-widest text-xs">
                                        {setor}
                                    </td>
                                </tr>
                                {/* Linhas dos Colaboradores do Setor */}
                                {colaboradores.filter(c => c.setor === setor).map(colab => (
                                    <tr key={colab.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-400 p-1.5 align-middle">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-bold text-gray-800 text-xs truncate max-w-[190px]" title={colab.nome}>{colab.nome}</span>
                                                <div className="flex items-center gap-1.5 print:hidden shrink-0">
                                                    <button onClick={() => handleEdit(colab)} className="text-gray-400 hover:text-blue-600 transition-colors bg-white/50 hover:bg-white rounded p-1" title="Editar">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                    </button>
                                                    <button onClick={() => handleRemove(colab.id)} className="text-gray-400 hover:text-red-500 transition-colors bg-white/50 hover:bg-white rounded p-1" title="Remover">
                                                        <Trash2 className="w-3.5 h-3.5 block" />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-600 text-xs">{colab.categoria}</td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-600 text-xs">{colab.coren}</td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-800 text-xs">{colab.turnoBase}</td>

                                        {diasArray.map(dia => {
                                            const fds = isFDS(dia, mes, ano);
                                            const status = getStatusPlantao(dia, colab);

                                            let bgClass = '';
                                            let textClass = 'text-gray-900';

                                            if (status === 'X' || (colab.regime === '8H_DIARIO' && fds)) {
                                                bgClass = 'bg-gray-400'; // Cinza escuro para FDS de 8h
                                                textClass = 'text-gray-400';
                                            } else if (fds) {
                                                bgClass = 'bg-gray-200'; // Cinza leve para FDS 12x36
                                            }

                                            if (status === 'F') textClass = 'text-red-600 font-bold';
                                            else if (status === 'FE' || status === 'LM') textClass = 'text-white bg-blue-800 text-[10px]';
                                            else if (status === 'P') textClass = 'text-gray-900 font-bold';
                                            else textClass = 'text-gray-700 font-semibold'; // (QUA, QUI, S)

                                            return (
                                                <td
                                                    key={dia}
                                                    onClick={() => cycleStatus(dia, colab)}
                                                    className={`border border-gray-400 p-1 text-center cursor-pointer select-none transition-colors hover:bg-yellow-100 ${bgClass} ${textClass}`}
                                                    title="Clique para alternar (P / F / S / FE / LM)"
                                                >
                                                    {status === 'X' ? '' : status}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>

                <div className="mt-4 flex gap-6 text-xs text-gray-600 font-bold uppercase tracking-wider justify-center print:justify-start">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-400 text-gray-900 font-black text-[8px] flex items-center justify-center">P</div> Plantão</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-400 text-red-600 font-black text-[8px] flex items-center justify-center">F</div> Folga</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border border-gray-400 text-gray-700 font-black text-[8px] flex items-center justify-center">S</div> Sobreaviso</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-800 border border-gray-400 text-white font-black text-[8px] flex items-center justify-center">FE</div> Férias</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-800 border border-gray-400 text-white font-black text-[8px] flex items-center justify-center">LM</div> Lic. Maternidade</span>
                </div>
            </div>

            {/* Modal Adicionar */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 print:hidden p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
                        <h3 className="text-xl font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">{editingId ? 'Editar Colaborador' : 'Adicionar Colaborador'}</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Nome Completo</label>
                                <input autoFocus type="text" value={novoColab.nome || ''} onChange={e => {
                                    const newName = e.target.value;
                                    const match = colaboradores.find(c => c.nome.trim().toUpperCase() === newName.trim().toUpperCase());
                                    if (match && match.coren && !novoColab.coren) {
                                        setNovoColab({ ...novoColab, nome: newName, coren: match.coren, categoria: match.categoria });
                                    } else {
                                        setNovoColab({ ...novoColab, nome: newName });
                                    }
                                }} className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Categoria</label>
                                <select value={novoColab.categoria} onChange={e => setNovoColab({ ...novoColab, categoria: e.target.value as any })} className="w-full p-2 border rounded outline-none">
                                    <option value="ENF">Enfermeiro(a)</option>
                                    <option value="TEC">Técnico(a)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">COREN</label>
                                <input type="text" value={novoColab.coren || ''} onChange={e => setNovoColab({ ...novoColab, coren: e.target.value })} className="w-full p-2 border rounded outline-none" />
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Setor</label>
                                {isNovoSetor ? (
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Digite o nome do setor" value={novoColab.setor || ''} onChange={e => {
                                            const newSetor = e.target.value.toUpperCase();
                                            if (newSetor === 'FÉRIAS' || newSetor === 'FERIAS') {
                                                setNovoColab({ ...novoColab, setor: newSetor, turnoBase: '00H-00H', regime: 'FERIAS' });
                                            } else {
                                                setNovoColab({ ...novoColab, setor: newSetor });
                                            }
                                        }} className="w-full p-2 border rounded outline-none" autoFocus />
                                        {setores.length > 0 && (
                                            <button onClick={() => { setIsNovoSetor(false); setNovoColab({ ...novoColab, setor: setores[0] }); }} className="px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded hover:bg-gray-300 transition-colors text-xs whitespace-nowrap">
                                                Voltar à Lista
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <select value={novoColab.setor || ''} onChange={e => {
                                        const setVal = e.target.value;
                                        if (setVal === 'NOVO_SETOR') {
                                            setIsNovoSetor(true);
                                            setNovoColab({ ...novoColab, setor: '' });
                                        } else if (setVal === 'FÉRIAS' || setVal === 'FERIAS') {
                                            setNovoColab({ ...novoColab, setor: setVal, turnoBase: '00H-00H', regime: 'FERIAS' });
                                        } else {
                                            setNovoColab({ ...novoColab, setor: setVal });
                                        }
                                    }} className="w-full p-2 border rounded outline-none bg-white">
                                        {setores.map(s => <option key={s} value={s}>{s}</option>)}
                                        <option value="NOVO_SETOR" className="font-bold text-red-600">+ CADASTRAR NOVO SETOR</option>
                                    </select>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Turno Base</label>
                                <select value={novoColab.turnoBase || ''} onChange={e => setNovoColab({ ...novoColab, turnoBase: e.target.value })} className="w-full p-2 border rounded outline-none bg-white">
                                    <option value="06H-18H">06H-18H</option>
                                    <option value="18H-06H">18H-06H</option>
                                    <option value="07H-19H">07H-19H</option>
                                    <option value="19H-07H">19H-07H</option>
                                    <option value="07H-17H">07H-17H</option>
                                    <option value="08H-17H">08H-17H</option>
                                    <option value="00H-00H">00H-00H (Livre/Sobreaviso)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Regime / Padrão</label>
                                <select value={novoColab.regime} onChange={e => setNovoColab({ ...novoColab, regime: e.target.value as any })} className="w-full p-2 border rounded outline-none bg-white">
                                    <option value="12x36_PAR">12x36 (Dias Pares)</option>
                                    <option value="12x36_IMPAR">12x36 (Dias Ímpares)</option>
                                    <option value="8H_DIARIO">8H (Seg-Sex, Folga FDS)</option>
                                    <option value="24x24_PAR">24x24 Dobra (Dias Pares)</option>
                                    <option value="24x24_IMPAR">24x24 Dobra (Dias Ímpares)</option>
                                    <option value="SOBREAVISO">Sobreaviso (S Diário)</option>
                                    <option value="FERIAS">Férias 30 Dias (F Diário)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                            <button onClick={() => { setShowModal(false); setEditingId(null); }} className="px-5 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={handleSaveColaborador} className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">
                                {editingId ? 'Salvar Alterações' : 'Salvar Colaborador'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
