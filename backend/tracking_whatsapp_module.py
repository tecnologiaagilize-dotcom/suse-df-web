import time
import hmac
import hashlib

class TrackingWhatsAppModule:
    """
    Módulo de Rastreio ao Vivo e Integração com WhatsApp para o IRA-SUSE.
    Gera links seguros e formata mensagens de emergência.
    """
    
    def __init__(self, secret_key="IRA_SUSE_SECRET"):
        self.secret_key = secret_key

    def generate_secure_token(self, user_id):
        """Gera um token HMAC para o link SUSI Live."""
        timestamp = int(time.time())
        message = f"{user_id}:{timestamp}"
        signature = hmac.new(self.secret_key.encode(), message.encode(), hashlib.sha256).hexdigest()
        return f"{message}:{signature}"

    def format_whatsapp_link(self, phone, message):
        """Gera o deep link para o WhatsApp."""
        import urllib.parse
        encoded_msg = urllib.parse.quote(message)
        return f"whatsapp://send?phone={phone}&text={encoded_msg}"

    def create_emergency_message(self, user_id, lat, lon, accuracy):
        """Constrói a mensagem de alerta conforme o Caderno Técnico."""
        token = self.generate_secure_token(user_id)
        susi_link = f"https://susi.live/track?t={token}"
        maps_link = f"https://www.google.com/maps?q={lat},{lon}"
        
        msg = (
            "🚨 *ALERTA DE EMERGÊNCIA IRA-SUSE* 🚨\n\n"
            "Um evento crítico foi detectado.\n"
            f"📍 Localização: {maps_link}\n"
            f"⏱ Precisão: {accuracy}m\n"
            f"🔗 Acompanhamento ao vivo: {susi_link}\n\n"
            "A Central de Monitoramento foi notificada."
        )
        return msg

# Exemplo de uso
if __name__ == "__main__":
    module = TrackingWhatsAppModule()
    msg = module.create_emergency_message("USER123", -23.5505, -46.6333, 10)
    link = module.format_whatsapp_link("5511999999999", msg)
    print(f"Link Gerado:\n{link}")
