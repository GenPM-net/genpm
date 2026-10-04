---
title: Modelo de segurança
section: Segurança
order: 50
---
O GenPM é seguro por design e verificável por qualquer pessoa. Nunca promete "100 % seguro"; garante dez invariantes, cada um com um teste que bloqueia qualquer release:

1. **Integridade**: os bytes instalados são exatamente a árvore do commit `c`, nunca uma branch.
2. **Zero execução**: sem scripts de ciclo de vida, hooks do Git, submódulos nem filtros.
3. **Confinamento**: só se escreve dentro do projeto, nos caminhos do plano.
4. **Sem executáveis**: os arquivos injetados são escritos com permissão `0644`.
5. **Consentimento**: nada de config MCP, instalações npm ou sobrescritas sem o seu sim.
6. **Segredos**: o GenPM nunca lê os valores do `.env`.
7. **Autoridade do registry**: a publicação lê o GitHub, nunca o que o cliente envia.
8. **Manifestos assinados**: o CLI só instala manifestos assinados com Ed25519.
9. **Imutabilidade**: uma versão publicada nunca muda.
10. **Isolamento entre tenants**: nenhuma consulta cruza registries.

O mesmo scanner determinístico roda no registry (ao publicar) e no CLI (em cada instalação), então comprometer o registry não basta para contorná-lo.

## Reportar uma vulnerabilidade

Escreva para **hello@genpm.net** com o assunto `[SECURITY]` ou use o GitHub Private Vulnerability Reporting. Primeira resposta em até 48 horas. Veja [/security](/security).
