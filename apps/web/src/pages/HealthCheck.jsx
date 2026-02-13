import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function HealthCheck() {
  const [results, setResults] = useState({
    env: { url: !!import.meta.env.VITE_SUPABASE_URL, key: !!import.meta.env.VITE_SUPABASE_ANON_KEY },
    api: { ok: null, status: null, error: null },
    auth: { hasSession: null, error: null },
    origin: window.location.origin
  });

  useEffect(() => {
    async function run() {
      try {
        const { data, error, status } = await supabase
          .from('voice_phrases')
          .select('*')
          .limit(1);
        setResults(prev => ({
          ...prev,
          api: { ok: !error, status: status ?? 200, error: error?.message || null }
        }));
      } catch (e) {
        setResults(prev => ({
          ...prev,
          api: { ok: false, status: null, error: e?.message || 'Unknown error' }
        }));
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        setResults(prev => ({
          ...prev,
          auth: { hasSession: !!sessionData?.session, error: sessionError?.message || null }
        }));
      } catch (e) {
        setResults(prev => ({
          ...prev,
          auth: { hasSession: false, error: e?.message || 'Unknown error' }
        }));
      }
    }
    run();
  }, []);

  const hint = (() => {
    if (!results.env.url || !results.env.key) {
      return 'Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não definidas no ambiente de build (Vercel).';
    }
    if (results.api.ok === false && /Service Unavailable|503/i.test(results.api.error || '')) {
      return 'Supabase indisponível no momento (503). Verifique se o projeto não está pausado e aguarde o cold start.';
    }
    if (results.api.ok === false) {
      return 'Falha na consulta pública (voice_phrases). Verifique políticas RLS e CORS no Supabase.';
    }
    return 'Tudo certo com variáveis e consulta básica. Se ainda falhar em produção, verifique domínios permitidos e logs.';
  })();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow p-6 space-y-4">
        <h1 className="text-xl font-bold">Health Check - Supabase</h1>
        <div className="text-sm space-y-1">
          <p><span className="font-medium">Origin:</span> {results.origin}</p>
          <p><span className="font-medium">VITE_SUPABASE_URL:</span> {String(results.env.url)}</p>
          <p><span className="font-medium">VITE_SUPABASE_ANON_KEY:</span> {String(results.env.key)}</p>
          <p><span className="font-medium">Consulta voice_phrases:</span> {results.api.ok === null ? '...' : results.api.ok ? `OK (status ${results.api.status})` : `ERRO (${results.api.error || 'desconhecido'})`}</p>
          <p><span className="font-medium">Sessão de Auth presente:</span> {results.auth.hasSession === null ? '...' : String(results.auth.hasSession)}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-900">
          <p className="font-semibold">Dica:</p>
          <p>{hint}</p>
        </div>
      </div>
    </div>
  );
}
