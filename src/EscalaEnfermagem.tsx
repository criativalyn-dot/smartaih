import React, { useState } from 'react';
import { Download, Plus, Trash2, Calendar, Settings } from 'lucide-react';

export interface Colaborador {
    id: string;
    nome: string;
    categoria: 'ENF' | 'TEC';
    coren: string;
    turnoBase: string;
    setor: string;
    regime: '12x36_PAR' | '12x36_IMPAR' | '8H_DIARIO' | '24H_DOBRA';
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
    const [novoColab, setNovoColab] = useState<Partial<Colaborador>>({
        categoria: 'TEC',
        regime: '12x36_PAR',
        setor: 'Pronto Socorro',
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
        if (colab.regime === '12x36_PAR') return dia % 2 === 0 ? 'P' : 'F';
        if (colab.regime === '12x36_IMPAR') return dia % 2 !== 0 ? 'P' : 'F';
        if (colab.regime === '24H_DOBRA') return dia % 2 === 0 ? 'P' : 'F';
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
        setNovoColab({ categoria: 'TEC', regime: '12x36_PAR', setor: 'Pronto Socorro', turnoBase: '07H-19H' });
        setShowModal(true);
    };

    const handleEdit = (colab: Colaborador) => {
        setEditingId(colab.id);
        setNovoColab({ ...colab });
        setShowModal(true);
    };

    const handleSaveColaborador = () => {
        if (!novoColab.nome) return alert('Digite o nome');

        if (editingId) {
            // Update existing
            setColaboradores(colaboradores.map(c => c.id === editingId ? { ...novoColab, id: editingId } as Colaborador : c));
        } else {
            // Add new
            setColaboradores([...colaboradores, { ...novoColab, id: Date.now().toString() } as Colaborador]);
        }

        setShowModal(false);
        setEditingId(null);
        setNovoColab({ categoria: 'TEC', regime: '12x36_PAR', setor: 'Pronto Socorro', turnoBase: '07H-19H' });
    };

    const handleRemove = (id: string) => {
        if (confirm('Remover colaborador?')) {
            setColaboradores(colaboradores.filter(c => c.id !== id));
        }
    };

    // Agrupar por Setor -> Categoria
    const setores = Array.from(new Set(colaboradores.map(c => c.setor)));

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
                            <th className="border border-gray-400 p-2 text-center w-8 print:hidden"><Settings className="w-4 h-4 mx-auto" /></th>
                        </tr>
                    </thead>
                    <tbody>
                        {colaboradores.length === 0 ? (
                            <tr>
                                <td colSpan={diasNoMes + 5} className="text-center p-8 text-gray-400">Nenhum colaborador cadastrado. Clique no botão acima para adicionar.</td>
                            </tr>
                        ) : setores.map(setor => (
                            <React.Fragment key={setor}>
                                {/* Header do Setor */}
                                <tr className="bg-gray-200">
                                    <td colSpan={diasNoMes + 5} className="border border-gray-400 p-1.5 font-black text-gray-800 uppercase tracking-widest text-xs">
                                        {setor}
                                    </td>
                                </tr>
                                {/* Linhas dos Colaboradores do Setor */}
                                {colaboradores.filter(c => c.setor === setor).map(colab => (
                                    <tr key={colab.id} className="hover:bg-gray-50">
                                        <td className="border border-gray-400 p-1.5 font-bold text-gray-800 text-xs truncate max-w-[250px]">{colab.nome}</td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-600">{colab.categoria}</td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-600">{colab.coren}</td>
                                        <td className="border border-gray-400 p-1 text-center font-bold text-gray-800">{colab.turnoBase}</td>

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
                                        <td className="border border-gray-400 p-1 text-center print:hidden">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => handleEdit(colab)} className="text-gray-400 hover:text-blue-600 transition-colors" title="Editar">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                                </button>
                                                <button onClick={() => handleRemove(colab.id)} className="text-gray-400 hover:text-red-500 transition-colors" title="Remover">
                                                    <Trash2 className="w-4 h-4 mx-auto" />
                                                </button>
                                            </div>
                                        </td>
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
                                <input autoFocus type="text" value={novoColab.nome || ''} onChange={e => setNovoColab({ ...novoColab, nome: e.target.value })} className="w-full p-2 border rounded focus:ring-2 focus:ring-red-500 outline-none" />
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
                                <input type="text" placeholder="Ex: Pronto Socorro, Clínica Médica" value={novoColab.setor || ''} onChange={e => setNovoColab({ ...novoColab, setor: e.target.value })} className="w-full p-2 border rounded outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Turno Base (Ex: 07H-19H)</label>
                                <input type="text" value={novoColab.turnoBase || ''} onChange={e => setNovoColab({ ...novoColab, turnoBase: e.target.value })} className="w-full p-2 border rounded outline-none" />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Regime / Padrão</label>
                                <select value={novoColab.regime} onChange={e => setNovoColab({ ...novoColab, regime: e.target.value as any })} className="w-full p-2 border rounded outline-none">
                                    <option value="12x36_PAR">12x36 (Dias Pares)</option>
                                    <option value="12x36_IMPAR">12x36 (Dias Ímpares)</option>
                                    <option value="8H_DIARIO">8H (Seg-Sex, Folga FDS)</option>
                                    <option value="24H_DOBRA">24x24 (Dobra)</option>
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
