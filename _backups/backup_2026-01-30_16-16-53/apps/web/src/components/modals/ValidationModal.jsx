import React, { useState, useEffect } from 'react';
import { ShieldAlert, X, Eye, User, FileText, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ValidationModal({ alert: alertData, isOpen, onClose, onSuccess }) {
    const [officerRank, setOfficerRank] = useState('');
    const [officerName, setOfficerName] = useState('');
    const [officerMatricula, setOfficerMatricula] = useState('');
    const [officerPhone, setOfficerPhone] = useState('');
    const [officerBattalion, setOfficerBattalion] = useState('');
    const [validationToken, setValidationToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentAlert, setCurrentAlert] = useState(alertData);

    // Sincronizar com dados mais recentes e limpar formulário ao abrir
    useEffect(() => {
        if (isOpen && alertData) {
            // Resetar formulário
            setOfficerRank('');
            setOfficerName('');
            setOfficerMatricula('');
            setOfficerPhone('');
            setOfficerBattalion('');
            setValidationToken('');
            setLoading(false);
            
            // Tentar buscar versão mais fresca do alerta (foto/justificativa)
            fetchFreshAlert(alertData.id);
        }
    }, [isOpen, alertData]);

    const fetchFreshAlert = async (id) => {
        try {
            const { data, error } = await supabase
                .from('emergency_alerts')
                .select('*')
                .eq('id', id)
                .single();
            
            if (data) {
                setCurrentAlert(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            console.error("Erro ao atualizar alerta no modal:", err);
        }
    };

    const handleValidationAction = async (action) => {
        setLoading(true);
        try {
            if (action === 'approve') {
                if (!validationToken) {
                    alert("O campo TOKEN DE SEGURANÇA é obrigatório.");
                    setLoading(false);
                    return;
                }
                if (!officerRank) {
                    alert("O campo POSTO/GRADUAÇÃO é obrigatório.");
                    setLoading(false);
                    return;
                }
                if (!officerName) {
                    alert("O campo NOME DE GUERRA é obrigatório.");
                    setLoading(false);
                    return;
                }
                if (!officerMatricula) {
                    alert("O campo MATRÍCULA é obrigatório.");
                    setLoading(false);
                    return;
                }
                if (!officerPhone) {
                    alert("O campo TELEFONE é obrigatório.");
                    setLoading(false);
                    return;
                }
                if (!officerBattalion) {
                    alert("O campo BATALHÃO é obrigatório.");
                    setLoading(false);
                    return;
                }

                // Chamar RPC para validar token
                console.log("Enviando validação:", {
                        p_alert_id: currentAlert.id,
                        p_token_input: validationToken,
                        p_rank: officerRank,
                        p_name: officerName,
                        p_matricula: officerMatricula,
                        p_phone: officerPhone,
                        p_battalion: officerBattalion
                });

                const { data, error } = await supabase
                    .rpc('validate_termination_token', {
                        p_alert_id: currentAlert.id,
                        p_token_input: validationToken.trim().toUpperCase(),
                        p_rank: officerRank,
                        p_name: officerName,
                        p_matricula: officerMatricula,
                        p_phone: officerPhone,
                        p_battalion: officerBattalion
                    });

                if (error) {
                    console.error("Erro RPC:", error);
                    throw error;
                }

                console.log("RPC Data:", data);

                if (data && data.success) {
                    alert(data.message);
                    if (onSuccess) {
                        onSuccess(currentAlert, {
                            rank: officerRank,
                            name: officerName,
                            matricula: officerMatricula,
                            battalion: officerBattalion,
                            phone: officerPhone
                        });
                    }
                    if (onClose) onClose();
                } else {
                    alert("Falha na validação: " + (data?.message || "Token inválido."));
                }
            } else {
                // Rejeitar (Manter Monitoramento)
                const { error } = await supabase
                    .from('emergency_alerts')
                    .update({ status: 'active' }) // Volta para active
                    .eq('id', currentAlert.id);
                
                if (error) throw error;
                alert("Monitoramento mantido. Status retornado para Ativo.");
                if (onSuccess) onSuccess(null); // Apenas refresh
                if (onClose) onClose();
            }
        } catch (error) {
            console.error("Erro na validação:", error);
            alert("Erro: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !currentAlert) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden animate-fade-in border-4 border-yellow-500 flex flex-col max-h-[90vh]">
                <div className="bg-yellow-500 text-yellow-900 p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-xl flex items-center gap-2 uppercase tracking-wide">
                        <ShieldAlert size={28} /> Validação de Encerramento
                    </h3>
                    <button onClick={onClose} className="text-yellow-800 hover:text-black transition-colors">
                        <X size={28} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
                    {/* Evidência Visual */}
                    <div className="w-full md:w-1/2 flex flex-col">
                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                            <Eye size={18}/> Evidência Visual
                            <button 
                                onClick={() => fetchFreshAlert(currentAlert.id)} 
                                className="text-xs text-blue-600 underline ml-2 hover:text-blue-800"
                                title="Clique para recarregar a imagem se ela foi enviada recentemente"
                            >
                                (Atualizar Foto)
                            </button>
                        </h4>
                        <div className="bg-gray-100 rounded-lg border border-gray-300 flex-1 flex items-center justify-center overflow-hidden min-h-[300px] relative">
                            {currentAlert.termination_photo_url ? (
                                <img 
                                    src={currentAlert.termination_photo_url} 
                                    alt="Evidência de Encerramento" 
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center">
                                    <User size={48} />
                                    <p>Sem foto disponível</p>
                                    <p className="text-xs mt-2">Aguardando envio do motorista...</p>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Foto capturada em: {currentAlert.termination_requested_at ? new Date(currentAlert.termination_requested_at).toLocaleString() : '---'}
                        </p>
                    </div>

                    {/* Justificativa e Ações */}
                    <div className="w-full md:w-1/2 flex flex-col space-y-6">
                        <div>
                            <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText size={18}/> Justificativa do Usuário</h4>
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-gray-800 italic text-lg leading-relaxed">
                                "{currentAlert.termination_reason || 'Sem justificativa informada.'}"
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-sm text-blue-900 space-y-2">
                            <h5 className="font-bold flex items-center gap-2"><Shield size={16}/> Protocolo de Validação</h5>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Verifique se a foto corresponde ao usuário.</li>
                                <li>Analise se a expressão facial indica coação.</li>
                                <li>Confirme se o usuário está em local seguro (Delegacia/Posto PM).</li>
                                <li><strong>Solicite o TOKEN DE SEGURANÇA ao motorista.</strong></li>
                            </ul>
                        </div>

                        <div className="space-y-3 pt-2">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Identificação do Oficial (PM/Autoridade)</label>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <select 
                                        value={officerRank} 
                                        onChange={e => setOfficerRank(e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2 text-sm"
                                    >
                                        <option value="">Posto/Graduação...</option>
                                        <option value="Soldado">Soldado</option>
                                        <option value="Cabo">Cabo</option>
                                        <option value="Sargento">Sargento</option>
                                        <option value="Subtenente">Subtenente</option>
                                        <option value="Aspirante">Aspirante</option>
                                        <option value="Tenente">Tenente</option>
                                        <option value="Capitão">Capitão</option>
                                        <option value="Major">Major</option>
                                        <option value="Tenente-Coronel">Tenente-Coronel</option>
                                        <option value="Coronel">Coronel</option>
                                        <option value="Delegado">Delegado</option>
                                        <option value="Agente">Agente PC</option>
                                    </select>
                                    <input 
                                        type="text" 
                                        placeholder="Nome de Guerra"
                                        value={officerName}
                                        onChange={(e) => setOfficerName(e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Matrícula"
                                        value={officerMatricula}
                                        onChange={(e) => setOfficerMatricula(e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2 text-sm"
                                    />
                                    <input 
                                        type="tel" 
                                        placeholder="Telefone (WhatsApp)"
                                        value={officerPhone}
                                        onChange={(e) => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.length > 11) val = val.slice(0, 11);
                                            setOfficerPhone(val);
                                        }}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Batalhão / Unidade</label>
                                <select 
                                    value={officerBattalion}
                                    onChange={(e) => setOfficerBattalion(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2"
                                >
                                    <option value="">Selecione o Batalhão...</option>
                                    <optgroup label="Batalhões de Policiamento de Área (BPM)">
                                        <option value="1º BPM – Asa Sul">1º BPM – Asa Sul</option>
                                        <option value="2º BPM – Taguatinga">2º BPM – Taguatinga</option>
                                        <option value="3º BPM – Ceilândia">3º BPM – Ceilândia</option>
                                        <option value="4º BPM – Guará">4º BPM – Guará</option>
                                        <option value="5º BPM – Asa Norte">5º BPM – Asa Norte</option>
                                        <option value="6º BPM – Esplanada dos Ministérios">6º BPM – Esplanada dos Ministérios</option>
                                        <option value="7º BPM – Lago Sul">7º BPM – Lago Sul</option>
                                        <option value="8º BPM – Ceilândia">8º BPM – Ceilândia</option>
                                        <option value="9º BPM – Gama">9º BPM – Gama</option>
                                        <option value="10º BPM – Ceilândia">10º BPM – Ceilândia</option>
                                        <option value="11º BPM – Samambaia">11º BPM – Samambaia</option>
                                        <option value="12º BPM – Judiciário">12º BPM – Judiciário (Tribunais)</option>
                                        <option value="13º BPM – Sobradinho">13º BPM – Sobradinho</option>
                                        <option value="14º BPM – Planaltina">14º BPM – Planaltina</option>
                                        <option value="15º BPM – Ceilândia">15º BPM – Ceilândia</option>
                                        <option value="16º BPM – Brazlândia">16º BPM – Brazlândia</option>
                                        <option value="17º BPM – Águas Claras">17º BPM – Águas Claras</option>
                                        <option value="18º BPM – Recanto das Emas">18º BPM – Recanto das Emas</option>
                                        <option value="19º BPM – Ceilândia">19º BPM – Ceilândia</option>
                                        <option value="20º BPM – Paranoá">20º BPM – Paranoá</option>
                                        <option value="21º BPM – São Sebastião">21º BPM – São Sebastião</option>
                                        <option value="22º BPM – Jardim Botânico">22º BPM – Jardim Botânico</option>
                                        <option value="23º BPM – Ceilândia">23º BPM – Ceilândia</option>
                                        <option value="24º BPM – Lago Norte">24º BPM – Lago Norte</option>
                                        <option value="25º BPM – Samambaia">25º BPM – Samambaia</option>
                                        <option value="26º BPM – Santa Maria">26º BPM – Santa Maria</option>
                                        <option value="27º BPM – Recanto das Emas">27º BPM – Recanto das Emas</option>
                                        <option value="28º BPM – Riacho Fundo">28º BPM – Riacho Fundo</option>
                                        <option value="29º BPM – SIA/SCIA">29º BPM – SIA/SCIA</option>
                                        <option value="30º BPM – Planaltina">30º BPM – Planaltina</option>
                                        <option value="31º BPM – Fercal">31º BPM – Fercal (Ambiental)</option>
                                        <option value="32º BPM – Ceilândia">32º BPM – Ceilândia</option>
                                        <option value="33º BPM – Sol Nascente/Pôr do Sol">33º BPM – Sol Nascente/Pôr do Sol</option>
                                    </optgroup>
                                    <optgroup label="Batalhões Especializados e Operacionais">
                                        <option value="BOPE">BOPE – Batalhão de Operações Especiais</option>
                                        <option value="BPCHOQUE">BPCHOQUE – Batalhão de Polícia de Choque</option>
                                        <option value="BPATAMO">BPATAMO – Batalhão de Polícia de Choque (Tático Motorizado)</option>
                                        <option value="BPTRAN">BPTRAN – Batalhão de Polícia de Trânsito</option>
                                        <option value="BPRV">BPRV – Batalhão de Polícia Rodoviária</option>
                                        <option value="BPMA">BPMA – Batalhão de Polícia Militar Ambiental</option>
                                        <option value="BPCÃES">BPCÃES – Batalhão de Policiamento com Cães</option>
                                        <option value="BPGEP">BPGEP – Batalhão de Polícia de Guarda e Escolta</option>
                                        <option value="BAvOp">BAvOp – Batalhão de Aviação Operacional</option>
                                        <option value="BPESC">BPESC – Batalhão de Polícia Escolar</option>
                                        <option value="BPChoque/RPon">BPChoque/RPon – Batalhão de Polícia Montada</option>
                                    </optgroup>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Token de Segurança (Fornecido pelo Motorista)</label>
                                <input 
                                    type="text" 
                                    placeholder="Informe o token de 8 dígitos"
                                    maxLength={8}
                                    value={validationToken}
                                    onChange={(e) => setValidationToken(e.target.value.toUpperCase())}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 border p-2 font-mono text-lg tracking-widest text-center uppercase"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Footer com Botões Fixos */}
                <div className="p-4 border-t border-yellow-200 bg-yellow-50 shrink-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button 
                            type="button"
                            onClick={() => handleValidationAction('reject')}
                            disabled={loading}
                            className="w-full py-3 bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold hover:bg-red-200 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                        >
                            <X size={20} /> REJEITAR / MANTER MONITORAMENTO
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => handleValidationAction('approve')}
                            disabled={loading}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg flex justify-center items-center gap-2 text-lg disabled:opacity-50"
                        >
                            {loading ? (
                                <span className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                                <><CheckCircle size={24} /> CONFIRMAR E ENCERRAR</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
