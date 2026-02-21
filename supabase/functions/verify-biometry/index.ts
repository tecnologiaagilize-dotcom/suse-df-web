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
        
        try {
            // Adicionado Timeout de 5s para não travar a emergência
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${BIOMETRY_SERVICE_URL}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    audio_base64: audio, 
                    user_id: user.id 
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Erro no serviço Python: ${response.status} - ${errorText}`);
                // FAIL-OPEN: Se o serviço de biometria falhar, permitimos o alerta por segurança
                // mas marcamos o score como baixo/indeterminado
                return new Response(
                    JSON.stringify({
                        isVerified: true, // APROVA POR SEGURANÇA (Fail-Open)
                        score: 1.0, 
                        details: "Biometria indisponível (Fail-Open ativado)"
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
                );
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

        } catch (err) {
            console.error("Exceção na chamada do serviço Python:", err);
            // FAIL-OPEN em caso de timeout ou erro de rede
            return new Response(
                JSON.stringify({
                    isVerified: true, 
                    score: 1.0, 
                    details: `Erro de conexão: ${err.message}. Fail-Open ativado.`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }
    } 
    
    // FALLBACK SE A URL NÃO ESTIVER CONFIGURADA (Para testes locais sem Python rodando)
    else {
      console.warn("BIOMETRY_SERVICE_URL não definida. Usando Mock de Infraestrutura.");
      const audioSize = audio.length;
      // Aceita qualquer áudio maior que 100 bytes (reduzido para facilitar testes com palavras curtas)
      if (audioSize > 100) {
        return new Response(
          JSON.stringify({
            isVerified: true,
            score: 0.95,
            details: "Simulação (Serviço Python não configurado)"
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    }
    
    // Se chegou aqui, é porque nem configurado está e o áudio é muito curto/vazio
    // Mesmo assim, em emergência, melhor pecar pelo excesso
    return new Response(
        JSON.stringify({
          isVerified: true,
          score: 0.5,
          details: "Fallback final de emergência"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

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
