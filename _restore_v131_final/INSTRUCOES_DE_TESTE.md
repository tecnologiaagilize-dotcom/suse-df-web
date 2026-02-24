# Instruções de Teste - SUSE-DF (Versão 1.2.9)

Como o servidor de desenvolvimento automático pode ser encerrado pelo ambiente, siga os passos abaixo para testar a aplicação localmente.

## 1. Iniciar o Servidor Localmente

Abra um terminal neste projeto (Terminal > New Terminal) e execute:

```bash
cd apps/web
npm run dev -- --host
```

Aguarde aparecer a mensagem: `➜ Local: http://localhost:5173/`

## 2. Acessar os Painéis

Com o terminal rodando, acesse os links abaixo no seu navegador:

| Perfil | Link de Acesso | Funcionalidade Principal |
| :--- | :--- | :--- |
| **Passageiro** | [http://localhost:5173/passenger/login](http://localhost:5173/passenger/login) | Botão de Pânico, Áudio "Socorro" (Offline) |
| **Condutor** | [http://localhost:5173/driver/login](http://localhost:5173/driver/login) | Monitoramento de Rota, Áudio Crítico |
| **Profissional** | [http://localhost:5173/professional/login](http://localhost:5173/professional/login) | Leitura de QR Code, Prontuário |
| **Central Admin** | [http://localhost:5173/admin/login](http://localhost:5173/admin/login) | Gestão de Usuários, Auditoria |

## 3. Teste de Áudio Offline (Passo a Passo)

1.  Faça login como Passageiro.
2.  No Dashboard, verifique se o ícone de microfone está ativo (verde).
3.  Permita o acesso ao microfone no navegador.
4.  **Teste de Wake Word:** Diga **"STOP"** ou **"NO"** em voz alta.
    *   *Nota:* O modelo atual é de teste (inglês). Na versão final, será treinado para "SOCORRO".
5.  O sistema deve exibir um alerta visual de "Validando Biometria..." e depois acionar a emergência.

## 4. Teste em Produção (Vercel)

Se preferir testar a versão online (deployada):
*   **URL:** https://suse-df-web-web.vercel.app/

---
*Gerado em 14/02/2026 por Trae AI*
