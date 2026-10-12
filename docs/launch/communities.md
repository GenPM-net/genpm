# Comunidades por idioma

Adaptaciones, no traducciones literales (branding §9). Enlaza siempre a la web en el idioma de la comunidad.
Nivel 1 (es, pt-BR): listos. Nivel 2 (ja, zh-CN, ko, fr, de): **pendiente de revisión nativa** antes de publicar.

## es · LATAM y España (X, LinkedIn, Discords de dev, r/programacion, midudev)

> Lancé GenPM: en vez de esconder dependencias en node_modules, inyecta módulos completos (código + reglas para tu IA +
> MCP) en tu proyecto, anclados a un commit. Tu IA los entiende, tú los controlas.
>
> `npx @genpm-net/cli add @core/auth` → login con GitHub y Google, sesiones seguras y Drizzle, en ~1 s.
> O pídeselo a tu agente: "añade login con GitHub y suscripciones con Stripe".
>
> Gratis en beta: https://genpm.net/es — ¿qué módulo reescribes en cada proyecto?

## pt-BR · TabNews, Discords BR, LinkedIn

> **GenPM: módulos completos com código, regras para IA e MCP direto no seu repositório**
>
> Em vez de esconder dependências em node_modules, o GenPM injeta o código-fonte de módulos inteiros (auth, Stripe,
> e-mail, chat com IA) no seu projeto, fixados num commit e verificados por assinatura. Cada módulo traz as regras que o
> seu agente precisa para integrá-lo e os servidores MCP que usa, adicionados só com o seu consentimento.
>
> `npx @genpm-net/cli add @core/billing` instala billing + Stripe + auth + db em ~1 s. Beta gratuita: https://genpm.net/pt-br

## ja · Zenn / Qiita（記事形式）— pendiente de revisión nativa

> **AI エージェント時代のパッケージマネージャー「GenPM」を公開しました**
>
> GenPM は node_modules に依存関係を隠す代わりに、認証・Stripe 課金・メール・AI チャットなどのモジュールを
> **ソースコードとして**プロジェクトに注入します。各モジュールは Git コミットに固定され、マニフェストは Ed25519 で署名されています。
> モジュールごとに AI 向けのルール（AGENTS.md）が付属し、エージェントがそのフォルダで作業するときだけ読み込まれます。
>
> `npx @genpm-net/cli add @core/auth` — 詳しくは https://genpm.net/ja

## zh-CN · 掘金 / V2EX — pendiente de revisión nativa

> **GenPM：把完整模块（代码 + AI 规则 + MCP）直接注入你的仓库**
>
> GenPM 不把依赖藏进 node_modules，而是把认证、Stripe 订阅、邮件、AI 聊天等完整模块以**源代码**形式注入项目，
> 固定到 Git 提交并用 Ed25519 签名校验。每个模块自带给 AI 代理的规则，只在代理处理该目录时加载；需要的 MCP 服务器经你同意后才会添加。
>
> `npx @genpm-net/cli add @core/billing` · https://genpm.net/zh-cn

## ko · GeekNews — pendiente de revisión nativa

> **GenPM: 코드·AI 규칙·MCP를 저장소에 바로 주입하는 패키지 매니저**
>
> node_modules에 의존성을 숨기는 대신, 인증·Stripe 결제·이메일·AI 채팅 같은 모듈 전체를 **소스 코드**로 프로젝트에
> 주입합니다. Git 커밋에 고정되고 매니페스트는 Ed25519 서명으로 검증됩니다. 모듈마다 AI 에이전트용 규칙이 포함되어
> 해당 폴더에서 작업할 때만 로드됩니다.
>
> `npx @genpm-net/cli add @core/auth` · https://genpm.net/ko

## fr · Discords dev FR, LinkedIn — pendiente de revisión nativa

> J'ai lancé **GenPM** : au lieu de cacher les dépendances dans node_modules, il injecte des modules complets
> (auth, abonnements Stripe, e-mails, chat IA) en **code source** dans ton projet, figés sur un commit Git et vérifiés
> par signature. Chaque module embarque les règles dont ton agent IA a besoin et les serveurs MCP qu'il utilise,
> ajoutés seulement avec ton accord.
>
> `npx @genpm-net/cli add @core/auth` · Bêta gratuite : https://genpm.net/fr

## de · Discords, LinkedIn, dev.to DE — pendiente de revisión nativa

> **GenPM**: Statt Abhängigkeiten in node_modules zu verstecken, fügt GenPM komplette Module (Auth, Stripe-Abos,
> E-Mail, KI-Chat) als **Quellcode** in dein Projekt ein – festgelegt auf einen Git-Commit und per Signatur geprüft.
> Jedes Modul bringt die Regeln für deinen KI-Agenten und die nötigen MCP-Server mit, die nur mit deiner Zustimmung
> eingetragen werden.
>
> `npx @genpm-net/cli add @core/auth` · Kostenlose Beta: https://genpm.net/de
