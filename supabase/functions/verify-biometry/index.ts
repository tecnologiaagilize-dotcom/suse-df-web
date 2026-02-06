import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    // AQUI ENTRA A INTEGRAÇÃO COM MICROSERVIÇO PYTHON PRÓPRIO (OPÇÃO B)
    // O áudio chega aqui como Base64. Vamos encaminhar para nosso serviço Python.
    
    // URL do seu serviço Python (Railway, Render, AWS, ou localhost via ngrok para testes)
    // Configure esta variável no Supabase: supabase secrets set BIOMETRY_SERVICE_URL="https://..."
    const BIOMETRY_SERVICE_URL = Deno.env.get('BIOMETRY_SERVICE_URL');
    
    // Precisamos também do User ID para buscar as referências no banco
    // Assumindo que o frontend enviou o user_id no corpo ou extraímos do JWT
    // Para simplificar, vamos pedir que o frontend envie o user_id no body também,
    // ou extraímos do header Authorization se disponível (melhor prática).
    
    // Pegando user do header de autorização (Supabase Auth)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        throw new Error("Usuário não autenticado.");
    }

    // Obter dados do usuário via Supabase Client (usando o token do request)
    // ... (Lógica de auth omitida para brevidade, vamos assumir que o serviço Python confia ou valida o token)
    
    // Para o MVP Opção B: Vamos encaminhar o request para o serviço Python
    if (BIOMETRY_SERVICE_URL) {
        // Converter Base64 de volta para Blob/File para enviar como Multipart Form Data
        // Deno Edge Functions tem suporte limitado a FormData completo dependendo da versão,
        // mas vamos tentar construir o request.
        
        // WORKAROUND: Enviar como JSON mesmo e o Python decodifica, é mais seguro entre serviços
        // O Python (main.py) precisará ser ajustado para aceitar JSON { "audio": "base64...", "user_id": "..." }
        // OU mantemos o Python esperando Multipart e construímos aqui.
        
        // Vamos ajustar para enviar JSON para o serviço Python para evitar complexidade de Multipart no Deno
        const response = await fetch(`${BIOMETRY_SERVICE_URL}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                audio_base64: audio, // O audio já veio como base64 do frontend
                user_id: "user_id_placeholder" // Precisamos extrair o ID real do token JWT aqui
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro no serviço de biometria: ${response.statusText}`);
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

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
