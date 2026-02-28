class ImpactEscalationEngine:
    """
    Motor de Decisão e Escalonamento de Emergência IRA-SUSE.
    Integra Impacto, Biometria e Botão de Pânico.
    """
    
    def __init__(self):
        self.threshold_impact_flag = 0.65
        self.threshold_impact_critical = 0.85

    def evaluate_emergency(self, 
                           voice_auth_valid, 
                           button_pressed, 
                           impact_value, 
                           no_response_timeout, 
                           stress_detected):
        """
        Determina se a Central de Monitoramento deve ser acionada.
        EmergencyCall = 1 se: 
        VoiceAuth_valid = 1 OU 
        Button_pressed = 1 OU 
        (ImpactCritical = 1 AND NoResponseTimeout = 1 AND StressDetected = 1)
        """
        
        impact_flag = impact_value >= self.threshold_impact_flag
        impact_critical = impact_value >= self.threshold_impact_critical
        
        # Lógica de acionamento da Central (EmergencyCall)
        emergency_call = (voice_auth_valid == 1) or \
                         (button_pressed == 1) or \
                         (impact_critical and no_response_timeout and stress_detected)
        
        # Ações automáticas (WhatsApp)
        send_whatsapp = impact_flag or impact_critical or voice_auth_valid or button_pressed
        
        return {
            "EmergencyCall": 1 if emergency_call else 0,
            "SendWhatsApp": 1 if send_whatsapp else 0,
            "Status": {
                "ImpactFlag": impact_flag,
                "ImpactCritical": impact_critical,
                "VoiceAuth": voice_auth_valid,
                "Button": button_pressed
            }
        }

# Exemplo de teste de cenário crítico
if __name__ == "__main__":
    engine = ImpactEscalationEngine()
    
    # Cenário: Impacto Crítico + Silêncio (NoResponse) + Estresse detectado
    print("Cenário: Impacto Crítico + Silêncio + Estresse")
    res = engine.evaluate_emergency(voice_auth_valid=0, 
                                    button_pressed=0, 
                                    impact_value=0.90, 
                                    no_response_timeout=1, 
                                    stress_detected=1)
    print(f"Resultado: {res}")
    
    # Cenário: Apenas Impacto (sem resposta)
    print("\nCenário: Apenas Impacto Provável")
    res = engine.evaluate_emergency(voice_auth_valid=0, 
                                    button_pressed=0, 
                                    impact_value=0.70, 
                                    no_response_timeout=0, 
                                    stress_detected=0)
    print(f"Resultado: {res}")
