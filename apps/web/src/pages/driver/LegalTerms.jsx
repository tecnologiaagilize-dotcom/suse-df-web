import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ShieldCheck, ScrollText, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

export default function LegalTerms() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checks, setChecks] = useState({
    read: false,
    auxiliary: false,
    legitimate: false,
    accept: false
  });
  const [submitting, setSubmitting] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    fetchLatestDocument();
  }, []);

  const fetchLatestDocument = async () => {
    try {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error('Erro ao buscar termos:', error);
      // Fallback content if DB fails (shouldn't happen in prod)
      setDocument({
        version: '1.0',
        content_snapshot: '# TERMO DE USO E POLÍTICA DE PRIVACIDADE (LGPD) - SUSE\n\nErro ao carregar documento. Por favor, tente novamente.',
        document_hash: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Check if scrolled to bottom (with small buffer)
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setScrolledToBottom(true);
    }
  };

  const handleCheckboxChange = (key) => {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAccept = async () => {
    if (!user || !document) return;
    setSubmitting(true);

    try {
      // 1. Get device info (basic)
      const userAgent = navigator.userAgent;
      
      // 2. Insert acceptance
      const { error } = await supabase
        .from('user_legal_acceptance')
        .insert({
          user_id: user.id,
          document_version: document.version,
          document_hash: document.document_hash,
          ip_address: '0.0.0.0', // Captured by server ideally, client can't reliably get it without external service
          user_agent: userAgent,
          device_id: 'browser-' + Date.now(), // Simple client-side ID
          accepted_at: new Date().toISOString()
        });

      if (error) {
          if (error.code === '23505') { // Unique violation - already accepted
              alert('Você já aceitou estes termos.');
              navigate('/driver/dashboard');
              return;
          }
          throw error;
      }

      // 3. Log audit event (optional, but good practice)
      console.log('LGPD Accepted:', document.version);

      alert('Termos aceitos com sucesso! Você já pode utilizar o sistema.');

      // 4. Redirect
      if (userRole === 'passenger') {
          navigate('/passenger/dashboard');
      } else if (userRole === 'professional') {
          navigate('/professional/dashboard');
      } else {
          navigate('/driver/dashboard');
      }

    } catch (error) {
      console.error('Erro ao aceitar termos:', error);
      alert('Erro ao processar aceitação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const allChecked = checks.read && checks.auxiliary && checks.legitimate && checks.accept;
  const canSubmit = scrolledToBottom && allChecked;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      <div className="max-w-3xl w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="bg-blue-900 px-6 py-6 text-white text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-yellow-400 mb-3" />
          <h1 className="text-2xl font-bold uppercase tracking-wider">Termo de Ciência Obrigatório</h1>
          <p className="text-blue-200 text-sm mt-2 font-mono">LGPD & POLÍTICA DE USO - SUSE™ v{document?.version}</p>
        </div>

        {/* Content Area */}
        <div className="p-6">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-yellow-600" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Para sua segurança e conformidade legal, leia o documento até o final para habilitar a aceitação.
                </p>
              </div>
            </div>
          </div>

          <div 
            ref={contentRef}
            onScroll={handleScroll}
            className="h-96 overflow-y-auto bg-gray-50 p-6 rounded-lg border border-gray-300 text-gray-800 text-sm leading-relaxed font-sans shadow-inner mb-6"
          >
            {document?.content_snapshot.split('\n').map((line, i) => (
               <p key={i} className={`mb-3 ${line.startsWith('#') ? 'font-bold text-lg text-blue-900 mt-4' : ''}`}>
                 {line.replace(/^#+ /, '')}
               </p>
            ))}
            
            {/* Force user to see bottom */}
            <div className="mt-8 pt-8 border-t border-gray-200 text-center text-gray-500 text-xs italic">
              --- Fim do Documento ---
            </div>
          </div>

          {/* Checkboxes Area */}
          <div className={`transition-opacity duration-500 ${scrolledToBottom ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle size={18} className="text-green-600" /> Declarações Obrigatórias
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={checks.read}
                  onChange={() => handleCheckboxChange('read')}
                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Li integralmente o Termo de Uso e Política de Privacidade.</span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={checks.auxiliary}
                  onChange={() => handleCheckboxChange('auxiliary')}
                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Compreendo que o sistema é <strong>auxiliar</strong> e pode apresentar falhas ou indisponibilidade.</span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={checks.legitimate}
                  onChange={() => handleCheckboxChange('legitimate')}
                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Declaro que utilizarei o sistema de forma legítima, apenas em situações reais de risco.</span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                <input 
                  type="checkbox" 
                  checked={checks.accept}
                  onChange={() => handleCheckboxChange('accept')}
                  className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm font-bold text-blue-900">ACEITO INTEGRALMENTE OS TERMOS E CONDIÇÕES.</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={handleAccept}
            disabled={!canSubmit || submitting}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all
              ${canSubmit && !submitting 
                ? 'bg-green-600 hover:bg-green-700 active:scale-95' 
                : 'bg-gray-400 cursor-not-allowed'}
            `}
          >
            {submitting ? 'Registrando...' : 'ACEITO E DECLARO CIÊNCIA'}
            {!submitting && <FileText size={18} />}
          </button>
        </div>

      </div>
      
      <p className="mt-8 text-center text-xs text-gray-500 max-w-md">
        Seu aceite será registrado digitalmente com Timestamp, IP e ID do Dispositivo para fins de auditoria e prova jurídica, conforme Art. 7º da LGPD.
      </p>
    </div>
  );
}
