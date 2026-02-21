import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { trigger_type, latitude, longitude, notes } = await req.json();

    // 1. Validar Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Criar cliente Supabase com contexto do usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Obter usuário logado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Invalid user token");
    }

    console.log(`[Emergency] Triggered by ${user.id} via ${trigger_type}`);

    // 2. Auto-healing: Garantir que o usuário existe na tabela 'users'
    // (Previne erro de Foreign Key se o usuário acabou de criar conta e o trigger falhou)
    const { data: userProfile } = await supabaseClient
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
    
    if (!userProfile) {
        console.warn(`[Auto-Healing] Creating profile for ${user.id}`);
        await supabaseClient.from('users').insert([{
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || 'Motorista (Auto)',
            phone_number: user.user_metadata?.phone_number || '00000000000',
            secret_word: 'socorro' // Default seguro
        }]);
    }

    // 3. Criar o Alerta de Emergência
    const { data: alertData, error: insertError } = await supabaseClient
      .from('emergency_alerts')
      .insert([
        {
          user_id: user.id,
          status: 'active',
          trigger_type: trigger_type || 'unknown',
          initial_lat: latitude,
          initial_lng: longitude,
          notes: notes || 'Acionado via API Segura'
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error("[Database Error]", insertError);
      throw insertError;
    }

    // 4. (Futuro) Disparar Notificações (SMS, Push, Webhook Policial)
    // await sendSMSToEmergencyContacts(user.id, alertData.id);
    console.log(`[Emergency] Alert created: ${alertData.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alert: alertData,
        message: "Emergency alert activated successfully" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("[Emergency Error]", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
