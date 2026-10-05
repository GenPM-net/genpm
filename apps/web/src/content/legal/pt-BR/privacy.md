---
title: Política de Privacidade
updated: 2026-10-05
---
Esta política explica quais dados pessoais o GenPM (genpm.net, a API `api.genpm.net`, o CLI `genpm` e o servidor `@genpm-net/mcp`) trata, para quê, com qual base legal e quais são os seus direitos. Ela cumpre o Regulamento (UE) 2016/679 (RGPD) e a Lei Orgânica espanhola 3/2018 (LOPDGDD) e, para titulares no Brasil, a Lei 13.709/2018 (LGPD). Em caso de divergência, prevalece a versão em espanhol.

## 1. Controlador

- **Controlador:** {{name}}
- **NIF (identificação fiscal espanhola):** {{nif}}
- **Endereço:** {{address}}
- **Contato:** {{email}} (coloque «[PRIVACIDADE]» no assunto)

Não é obrigatório designar um encarregado de proteção de dados (art. 37 RGPD, art. 34 LOPDGDD); para qualquer questão, escreva para o contato acima.

## 2. Quais dados tratamos, para quê e com qual base

| Dados | Finalidade | Base legal | Retenção |
|---|---|---|---|
| ID, login, nome, avatar e organizações do GitHub (ao entrar) | Criar e manter sua conta, mostrar quem publica cada pacote e autorizar a publicação nos seus scopes | Execução do contrato (art. 6.1.b RGPD; art. 7, V LGPD): os Termos de Serviço | Enquanto sua conta existir |
| E-mail da sua conta do GitHub (nunca exibido) | Avisos de segurança e do serviço sobre seus pacotes | Contrato e interesse legítimo na segurança do ecossistema | Enquanto sua conta existir |
| Tokens de API (guardamos só o hash) | Autenticar o CLI e a integração contínua | Contrato | Até expirarem ou serem revogados |
| Pacotes publicados: manifesto, repositório, commit e seu login do GitHub | Operar o registro: pesquisar, verificar e instalar pacotes | Contrato | Indefinida: as versões publicadas são imutáveis para que os projetos que as usam continuem verificáveis (ver §6) |
| Eventos de instalação: pacote, versão, cliente (`cli`/`mcp`), versão do CLI e país (deduzido do IP, que não é guardado) | Contadores públicos de instalações e estatísticas agregadas | Interesse legítimo em medir o uso do registro | Agregados por dia; eventos individuais, 90 dias |
| Endereço IP, convertido em hash com um sal que muda diariamente | Limitar requisições e prevenir abusos | Interesse legítimo na segurança do serviço | No máximo 30 dias |
| Logs técnicos do servidor (Cloudflare Workers) | Diagnosticar erros e ataques | Interesse legítimo na segurança e continuidade do serviço | No máximo 7 dias |
| Analítica da web: páginas vistas, buscas, pacote visto, idioma, rota, domínio de origem, campanha, país e se a visita é de um robô (sem IP nem identificadores) | Saber o que se busca e se usa, e de onde vêm as visitas, para melhorar o serviço | Interesse legítimo em medir o uso de forma agregada (art. 6.1.f) | 3 meses (Analytics Engine da Cloudflare) |
| **Só se você aceitar a analítica opcional:** cliques, rolagem, páginas visitadas e gravação da sessão com os campos de formulário ocultos, identificador aleatório do navegador, navegador e tipo de dispositivo (PostHog). As páginas da conta nunca são gravadas e o seu IP não é repassado | Mapas de calor e descobrir onde as pessoas travam, para melhorar o site | Seu consentimento (art. 6.1.a RGPD e art. 22.2 LSSI-CE), que você pode retirar quando quiser em "Preferências de cookies" no rodapé | Eventos, 12 meses; gravações, 30 dias |
| Formulário de patrocínio ou empresas: e-mail, empresa, tamanho da equipe, IDE e mensagem | Responder à sua solicitação | Procedimentos preliminares a pedido seu | 12 meses, salvo acordo |
| Denúncias de pacotes: sua conta, o pacote, o motivo e sua descrição | Revisar o conteúdo denunciado e comunicar a decisão | Obrigação legal do Regulamento (UE) 2022/2065 de Serviços Digitais, art. 16 | 2 anos após a decisão |
| E-mails que você nos envia | Atender sua solicitação ou o exercício dos seus direitos | Interesse legítimo em responder ou, quando aplicável, obrigação legal | O necessário e até 2 anos depois |

Esses prazos são aplicados automaticamente: um processo diário apaga ou anonimiza o que expirou.

**O que nunca tratamos:** o conteúdo do seu projeto, seus arquivos `.env` ou os valores das suas variáveis de ambiente. Não usamos cookies de publicidade nem de rastreamento entre sites. A menos que você aceite a analítica opcional, o seu navegador não envia nada para a analítica: contamos nos nossos servidores as páginas que você pede (ver a [Política de cookies](/cookies)).

**Telemetria do CLI e do MCP:** com `GENPM_TELEMETRY=0` ou `DO_NOT_TRACK=1`, o cliente envia `client=none` e o registro não guarda o evento.

Não tomamos decisões baseadas unicamente em tratamento automatizado que produzam efeitos jurídicos sobre você. O analisador automático pode colocar um pacote em revisão, mas a decisão final de retirá-lo é de uma pessoa (ver a [Política de pacotes](/policy)).

Os dados do GitHub são necessários para criar uma conta; sem eles você não pode publicar, mas pode pesquisar e instalar pacotes, o que não exige conta.

## 3. Destinatários e operadores

Não vendemos nem compartilhamos seus dados com terceiros. Estes fornecedores os tratam em nosso nome, com contrato conforme o art. 28 RGPD:

| Fornecedor | Serviço | Localização |
|---|---|---|
| Cloudflare, Inc. | Hospedagem (Workers), banco de dados (D1), rede de entrega, proteção antibots (Turnstile) e analítica agregada | UE e EUA |
| PostHog, Inc. | Analítica opcional da web (mapas de calor e gravação de sessões), só com o seu consentimento | UE (Frankfurt, Alemanha) |
| Piensa Solutions (Arsys Internet, S.L.U.) | Domínio e e-mail | Espanha |

O **GitHub, Inc.** atua como controlador independente quando você entra com o GitHub e quando o registro lê repositórios públicos; aplica-se a sua própria [declaração de privacidade](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Os dados públicos dos pacotes (nome, versões, repositório e login do publicador) são exibidos a qualquer visitante e aos agentes de IA que usam o registro, pois essa é a finalidade do serviço.

## 4. Transferências internacionais

Cloudflare, Inc. e GitHub, Inc. aderiram ao EU-US Data Privacy Framework, reconhecido pela decisão de adequação da Comissão Europeia de 10 de julho de 2023 (art. 45 RGPD), e seus contratos incluem as cláusulas contratuais padrão da Comissão (art. 46 RGPD). A PostHog hospeda os dados na UE; qualquer acesso a partir dos EUA é coberto pelas cláusulas contratuais-padrão da Comissão (art. 46 RGPD).

## 5. Seus direitos

Você pode exercer a qualquer momento os direitos de **acesso, retificação, eliminação, oposição, limitação e portabilidade**, e revogar o consentimento dado, escrevendo para {{email}} com o assunto «[PRIVACIDADE]». Responderemos em até um mês.

Você pode apresentar reclamação à **Agência Espanhola de Proteção de Dados** ([www.aepd.es](https://www.aepd.es)) ou, no Brasil, à **ANPD** ([www.gov.br/anpd](https://www.gov.br/anpd)).

## 6. Encerramento da conta

Se você pedir o encerramento, anonimizamos seus dados pessoais em até 30 dias; os backups são sobrescritos em mais 30. Os pacotes que você publicou continuam disponíveis, atribuídos a uma conta do sistema, porque outros projetos dependem deles e suas versões são imutáveis. A URL do repositório de cada pacote, que pode conter seu login, faz parte do pacote publicado; se quiser que deixem de ser instalados, retire-os (*yank*) antes de encerrar a conta.

## 7. Menores

O GenPM é um serviço para desenvolvedores. É preciso ter pelo menos 16 anos para criar uma conta: é a idade geral do art. 8 do RGPD e a fixada pelo projeto de lei orgânica espanhol de proteção de menores em ambientes digitais, que elevará os 14 anos do art. 7 da LOPDGDD. Não aceitamos contas de menores dessa idade; se identificarmos uma, encerramos a conta e apagamos os dados.

## 8. Segurança

Aplicamos medidas técnicas e organizacionais adequadas ao risco: criptografia em trânsito (HTTPS com HSTS), tokens guardados só como hash, cookies `HttpOnly` e `Secure`, IPs pseudonimizados, acesso restrito com dois fatores e manifestos assinados. Se ocorrer um incidente que coloque seus direitos em risco, notificaremos as autoridades e, quando cabível, você.

## 9. Alterações

Se alterarmos esta política de forma relevante, avisaremos em genpm.net e, se você tiver conta, por e-mail com antecedência.
