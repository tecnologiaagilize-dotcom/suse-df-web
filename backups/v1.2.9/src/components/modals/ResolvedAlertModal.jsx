import React from 'react';
import { X, User, MapPin, Clock, FileText, CheckCircle, Car, Phone, Shield } from 'lucide-react';
import TrackingMap from '../map/TrackingMap';

export default function ResolvedAlertModal({ alert, isOpen, onClose }) {
    if (!isOpen || !alert) return null;

    const formatDate = (dateString) => {
        if (!dateString) return '---';
        return new Date(dateString).toLocaleString('pt-BR');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-blue-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-blue-600 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                        <CheckCircle size={24} /> Ocorrência Finalizada
                    </h3>
                    <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status e Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 uppercase font-bold">Início</span>
                            <div className="flex items-center gap-2 text-gray-700">
                                <Clock size={16} />
                                <span className="font-mono text-sm">{formatDate(alert.created_at)}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 uppercase font-bold">Atendimento</span>
                            <div className="flex items-center gap-2 text-blue-700">
                                <Clock size={16} />
                                <span className="font-mono text-sm">{formatDate(alert.accepted_at)}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 uppercase font-bold">Encerramento</span>
                            <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle size={16} />
                                <span className="font-mono text-sm">{formatDate(alert.resolved_at)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Coluna Esquerda: Dados do Usuário e Veículo */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 border-b pb-2">
                                    <User size={18} /> Dados do Solicitante
                                </h4>
                                <div className="space-y-3 pl-2">
                                    <div className="flex items-center gap-4">
                                        {alert.users?.photo_url ? (
                                            <img src={alert.users.photo_url} alt="User" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                                                <User size={32} />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-lg text-gray-900">{alert.users?.name || 'Desconhecido'}</p>
                                            <p className="text-sm text-gray-500">Matrícula: {alert.users?.matricula || '---'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="block text-xs text-gray-500">Telefone</span>
                                            <span className="flex items-center gap-1 font-medium"><Phone size={12}/> {alert.users?.phone_number}</span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-gray-500">CPF</span>
                                            <span className="font-medium">{alert.users?.cpf || '---'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 border-b pb-2">
                                    <Car size={18} /> Veículo
                                </h4>
                                <div className="bg-blue-50 p-3 rounded-md text-sm border border-blue-100">
                                    <p><span className="font-bold">Modelo:</span> {alert.users?.car_brand} {alert.users?.car_model}</p>
                                    <p><span className="font-bold">Placa:</span> {alert.users?.car_plate}</p>
                                    <p><span className="font-bold">Cor:</span> {alert.users?.car_color}</p>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita: Encerramento e Mapa */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 border-b pb-2">
                                    <Shield size={18} /> Dados do Encerramento
                                </h4>
                                <div className="space-y-3">
                                    {alert.termination_photo_url && (
                                        <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-300 relative group">
                                            <img 
                                                src={alert.termination_photo_url} 
                                                alt="Evidência" 
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a href={alert.termination_photo_url} target="_blank" rel="noopener noreferrer" className="text-white underline text-sm font-bold">
                                                    Ver Original
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Justificativa / Notas</p>
                                        <p className="text-sm text-gray-800 italic">
                                            "{alert.termination_reason || alert.notes || 'Sem observações.'}"
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 border-b pb-2">
                                    <MapPin size={18} /> Localização Final
                                </h4>
                                <div className="h-48 w-full rounded-lg overflow-hidden border border-gray-300 relative">
                                    {/* Usando TrackingMap em modo estático (se suportar, senão renderiza normal) */}
                                    <TrackingMap 
                                        lat={alert.current_lat || alert.initial_lat}
                                        lng={alert.current_lng || alert.initial_lng}
                                        alertId={alert.id}
                                    />
                                    {/* Overlay transparente para bloquear interação se desejar, ou deixar interativo */}
                                </div>
                                <p className="text-xs text-center text-gray-500 mt-1">
                                    Lat: {alert.current_lat || alert.initial_lat}, Lng: {alert.current_lng || alert.initial_lng}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}