-- Seed para frases de calibração biométrica (Voice Phrases)
-- Essas frases são usadas para criar o "Voice Print" do usuário durante o setup.

INSERT INTO public.voice_phrases (phrase_text, sequence_order, description, created_at)
VALUES 
    ('O sistema de segurança está ativo', 1, 'Frase de ativação padrão para captura de timbre neutro.', NOW()),
    ('Minha voz é minha identidade', 2, 'Frase focada em fonemas de identificação pessoal.', NOW()),
    ('Autorização confirmada pelo motorista', 3, 'Frase de comando para registro de autoridade.', NOW())
ON CONFLICT (sequence_order) DO UPDATE 
SET phrase_text = EXCLUDED.phrase_text, 
    description = EXCLUDED.description;
