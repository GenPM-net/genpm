---
title: Política de Cookies
updated: 2026-10-05
---
Esta política cumpre o artigo 22.2 da Lei espanhola 34/2002 de Serviços da Sociedade da Informação (LSSI-CE) e o guia de cookies da Agência Espanhola de Proteção de Dados. Em caso de divergência, prevalece a versão em espanhol.

## Resumo

O genpm.net usa **cookies técnicos e de preferências que você mesmo escolhe**, isentos de consentimento (art. 22.2 LSSI-CE), e **uma analítica opcional que só é ativada se você aceitar** no aviso que aparece na sua primeira visita. "Aceitar" e "Recusar" têm o mesmo peso: se você recusar ou não escolher, nenhum script de analítica é carregado e nada dele é guardado no seu dispositivo. Não usamos cookies de publicidade. À parte, contamos nos nossos servidores as páginas que você pede (páginas vistas, buscas, pacotes, origem e país, sem IP nem identificadores): isso não guarda nada no seu navegador.

## O que guardamos no seu navegador

| Nome | Tipo | Titular | Finalidade | Duração |
|---|---|---|---|---|
| `__Host-genpm_session` | Cookie técnico | GenPM | Manter sua sessão, só se você entrar | 30 dias |
| `__Host-genpm_oauth` | Cookie técnico | GenPM | Proteger o login com GitHub contra falsificação (CSRF) | 10 minutos |
| `genpm-theme` | Armazenamento local | GenPM | Lembrar o modo claro ou escuro escolhido | Até você apagar |
| `genpm-lang-dismissed` | Armazenamento local | GenPM | Não sugerir outro idioma depois que você fechou o aviso | Até você apagar |
| `genpm_consent` | Cookie de preferência | GenPM | Lembrar se você aceitou ou recusou a analítica opcional | 6 meses |

## Analítica opcional (só se você aceitar)

Se você clicar em "Aceitar", usamos o **PostHog** (PostHog, Inc., com os dados hospedados na UE) para ver mapas de calor de cliques e rolagem e gravações anônimas da sessão, com os campos de formulário ocultos. As páginas da conta (login, tokens, painel e publicação) nunca são gravadas, e as requisições passam pelo nosso próprio domínio sem repassar o seu IP.

| Nome | Tipo | Titular | Finalidade | Duração |
|---|---|---|---|---|
| `ph_<chave>_posthog` | Cookie e armazenamento local de analítica | PostHog (terceiro, operador da GenPM) | Identificador aleatório para agrupar as suas visitas e a sessão gravada | 12 meses |
| `ph_*` em `sessionStorage` | Armazenamento de sessão de analítica | PostHog | Manter a gravação da sessão em curso | Até fechar a aba |

**Mudar de ideia:** clique em "Preferências de cookies" no rodapé de qualquer página. Se você retirar o consentimento, deixamos de carregar o PostHog e apagamos do seu navegador os cookies e o armazenamento dele. Retirar é tão fácil quanto dar e não limita nada do que você pode fazer no site.

## Segurança da Cloudflare

O site é servido pela Cloudflare. Para protegê-lo contra ataques automatizados, a Cloudflare pode definir cookies técnicos de segurança (por exemplo `__cf_bm`, 30 minutos, ou `cf_clearance`) e, nos formulários de patrocínio e empresas, o desafio antibots **Turnstile** pode ler informações técnicas do navegador para distinguir pessoas de bots. Sua única finalidade é a segurança do serviço solicitado: não são usados para publicidade nem para rastrear você entre sites. Mais na [política de cookies da Cloudflare](https://www.cloudflare.com/cookie-policy/).

## Como apagar ou bloquear

Você pode apagar ou bloquear cookies e o armazenamento local nas configurações do navegador. Se bloquear `__Host-genpm_session`, não poderá entrar, mas continuará podendo pesquisar e instalar pacotes.

## O CLI e o servidor MCP

O CLI `genpm` e o servidor `@genpm-net/mcp` não usam cookies. Sobre a telemetria de instalações e como desativá-la, veja a [Política de privacidade](/privacy).

Se mudarmos os cookies que usamos, atualizaremos esta política e, se a finalidade mudar, pediremos o seu consentimento de novo.
