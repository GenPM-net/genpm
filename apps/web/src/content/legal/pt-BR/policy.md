---
title: Política de Pacotes
updated: 2026-10-03
---
Esta política mantém o GenPM seguro para quem instala pacotes e para os agentes de IA que leem suas regras. Faz parte dos [Termos de Serviço](/terms) e expõe nossas regras de moderação conforme o Regulamento (UE) 2022/2065 (DSA). Em caso de divergência, prevalece a versão em espanhol.

## 1. Não é permitido

- Malware, ladrões de credenciais, mineradores de criptomoedas ou código que exfiltra dados.
- Regras de IA que tentam sobrepor as instruções do usuário, esconder ações dele ou pedir ao agente que envie dados para outro lugar (*prompt injection*).
- Arquivos executados automaticamente ao abrir ou instalar um projeto: scripts de instalação, `.npmrc`, `.envrc`, `.vscode/tasks.json`, hooks do git e similares.
- Segredos: chaves de API, tokens ou chaves privadas, mesmo revogados.
- Conteúdo que viole direitos de propriedade intelectual de terceiros ou qualquer outro conteúdo ilícito.
- Typosquatting ou passar-se por outro publicador ou marca.
- Spam, pacotes vazios ou ocupação indevida de nomes.

## 2. Como detectamos

- **Automaticamente:** cada versão é analisada ao ser publicada e de novo pelo CLI na instalação.
- **Por denúncias** de qualquer pessoa (ver §4).
- **Revisão humana:** as versões marcadas ficam em revisão e não podem ser instaladas até que uma pessoa as revise, em até 24 horas úteis. Nenhuma retirada definitiva é decidida apenas por meios automáticos.

## 3. Medidas possíveis

Conforme a gravidade: colocar a versão em revisão, retirá-la (*yank*), colocar o pacote ou o scope em revisão, publicar um alerta de segurança em [/security/advisories](/security/advisories) e, em violações graves ou repetidas, suspender a conta. As medidas são proporcionais.

## 4. Como denunciar

Qualquer pessoa pode denunciar um pacote, também sem conta:

- com o botão **Denunciar** na página do pacote (requer login com GitHub), ou
- escrevendo para {{email}} com o assunto «[DENÚNCIA]».

Inclua: o pacote e a versão (ou a URL), por que você considera ilícito ou contrário a esta política, seu nome e e-mail, e uma declaração de que as informações são corretas e completas segundo seu conhecimento. Confirmaremos o recebimento e comunicaremos a decisão e os meios de recurso.

## 5. Se agirmos sobre o seu conteúdo

Se retirarmos ou restringirmos um pacote seu ou suspendermos sua conta, enviaremos uma exposição de motivos (art. 17 DSA): a medida, por quê, os fatos considerados, se houve meios automáticos e a regra aplicada.

**Recurso:** você pode pedir a revisão escrevendo para {{email}} com o assunto «[RECURSO]» em até 6 meses. Uma pessoa revisará a decisão e responderemos de forma fundamentada. Você também pode recorrer aos tribunais.

## 6. Transparência

Publicamos os alertas de segurança em [/security/advisories](/security/advisories) e em um feed JSON.
