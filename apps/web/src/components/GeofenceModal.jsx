import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, MapPin, Check, AlertTriangle } from 'lucide-react';

export default function GeofenceModal({ isOpen, onClose, userId }) {
  const [activeTab, setActiveTab] = useState('DF'); // DF, ENTORNO, ESTADO
  const [regions, setRegions] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar Regiões e Preferências
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Buscar todas as regiões disponíveis
        const { data: allRegions, error: regionError } = await supabase
          .from('administrative_regions')
          .select('*')
          .order('name');
        
        if (regionError) throw regionError;
        setRegions(allRegions);

        // 2. Buscar preferências atuais do usuário
        const { data: userPrefs, error: prefError } = await supabase
          .from('driver_geofence_preferences')
          .select('region_id')
          .eq('user_id', userId)
          .eq('is_active', true);

        if (prefError) throw prefError;

        const activeSet = new Set(userPrefs.map(p => p.region_id));
        setSelectedRegions(activeSet);

      } catch (err) {
        console.error('Erro ao carregar regiões:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, userId]);

  const toggleRegion = (regionId) => {
    const newSet = new Set(selectedRegions);
    if (newSet.has(regionId)) {
      newSet.delete(regionId);
    } else {
      newSet.add(regionId);
    }
    setSelectedRegions(newSet);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Desativar todas as preferências atuais
      await supabase
        .from('driver_geofence_preferences')
        .update({ is_active: false })
        .eq('user_id', userId);

      // 2. Inserir/Atualizar as novas selecionadas
      if (selectedRegions.size > 0) {
        const updates = Array.from(selectedRegions).map(regionId => ({
            user_id: userId,
            region_id: regionId,
            is_active: true
        }));
        
        // Upsert para reativar se já existir ou criar novo
        const { error } = await supabase
            .from('driver_geofence_preferences')
            .upsert(updates, { onConflict: 'user_id, region_id' });
            
        if (error) throw error;
      }
      
      onClose();
      alert('Área de atuação atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar preferências.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  // Filtrar regiões por aba
  const dfRegions = regions.filter(r => r.category === 'DF');
  const entornoRegions = regions.filter(r => r.category === 'ENTORNO');
  const otherRegions = regions.filter(r => r.category === 'ESTADO');

  const renderRegionList = (list) => (
    <div className="grid grid-cols-2 gap-3 mt-4 max-h-60 overflow-y-auto">
      {list.map(region => (
        <div 
            key={region.id}
            onClick={() => toggleRegion(region.id)}
            className={`
                flex items-center p-3 rounded-lg border cursor-pointer transition-colors
                ${selectedRegions.has(region.id) 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'}
            `}
        >
            <div className={`
                w-5 h-5 rounded border flex items-center justify-center mr-3
                ${selectedRegions.has(region.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
            `}>
                {selectedRegions.has(region.id) && <Check size={14} className="text-white" />}
            </div>
            <span className="text-sm font-medium">{region.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="text-blue-600" />
                Área de Atuação (Cerca Virtual)
            </h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
                <X className="text-gray-500" />
            </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
            <button 
                onClick={() => setActiveTab('DF')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'DF' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                Distrito Federal ({dfRegions.length})
            </button>
            <button 
                onClick={() => setActiveTab('ENTORNO')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ENTORNO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                Entorno (GO) ({entornoRegions.length})
            </button>
            <button 
                onClick={() => setActiveTab('ESTADO')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ESTADO' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
                Outros Estados
            </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
            {loading ? (
                <div className="text-center py-10 text-gray-500">Carregando regiões...</div>
            ) : (
                <>
                    {activeTab === 'DF' && renderRegionList(dfRegions)}
                    {activeTab === 'ENTORNO' && renderRegionList(entornoRegions)}
                    {activeTab === 'ESTADO' && (
                        <div className="space-y-4">
                             <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 flex gap-3">
                                <AlertTriangle className="text-yellow-600 shrink-0" />
                                <p className="text-sm text-yellow-800">
                                    Ao selecionar um estado, você ativa o monitoramento em todas as cidades dentro de um raio de 300km da fronteira com o DF.
                                </p>
                             </div>
                             {renderRegionList(otherRegions)}
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg"
            >
                Cancelar
            </button>
            <button 
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
                {saving ? 'Salvando...' : 'Salvar Preferências'}
                <Check size={18} />
            </button>
        </div>

      </div>
    </div>
  );
}
