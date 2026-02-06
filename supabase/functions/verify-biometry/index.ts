import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();

    if (!audio) {
      throw new Error("Áudio não fornecido.");
    }

    // 1. Validar Usuário (Auth)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Usuário não autenticado.");
    }

    // Criar cliente Supabase com o contexto do usuário (passando o token)
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        throw new Error("Token de usuário inválido.");
    }

    // AQUI ENTRA A INTEGRAÇÃO COM MICROSERVIÇO PYTHON PRÓPRIO (OPÇÃO B)
    // URL do seu serviço Python (Railway, Render, AWS)
    const BIOMETRY_SERVICE_URL = Deno.env.get('BIOMETRY_SERVICE_URL');
    
    // Para o MVP Opção B: Vamos encaminhar o request para o serviço Python
    if (BIOMETRY_SERVICE_URL) {
        console.log(`Encaminhando para serviço de biometria: ${BIOMETRY_SERVICE_URL}`);
        
        const response = await fetch(`${BIOMETRY_SERVICE_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                audio_base64: audio, 
                user_id: user.id // ID REAL DO USUÁRIO
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro no serviço Python: ${response.status} - ${errorText}`);
            throw new Error(`Serviço de biometria falhou: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        return new Response(
            JSON.stringify({
                isVerified: result.is_verified,
                score: result.score,
                details: result.details
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    } 
    
    // FALLBACK SE A URL NÃO ESTIVER CONFIGURADA (Para testes locais sem Python rodando)
    else {
      console.warn("BIOMETRY_SERVICE_URL não definida. Usando Mock de Infraestrutura.");
      const audioSize = audio.length;
      if (audioSize > 1000) {
        return new Response(
          JSON.stringify({
            isVerified: true,
            score: 0.95,
            details: "Validação de infraestrutura (Backend recebeu áudio, mas serviço Python offline)"
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }
    
    throw new Error("Configuração de biometria incompleta.");

  } catch (error) {
    console.error("Erro na Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
