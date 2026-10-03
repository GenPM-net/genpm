---
title: Política de paquetes
updated: 2026-10-03
---
Esta política mantiene GenPM seguro para quienes instalan paquetes y para los agentes de IA que leen sus reglas. Forma parte de los [Términos del servicio](/terms) y explica nuestras normas de moderación de contenidos conforme al Reglamento (UE) 2022/2065 de Servicios Digitales (DSA).

## 1. Qué no se permite

- Malware, robo de credenciales, minado de criptomonedas o código que exfiltre datos.
- Reglas de IA que intenten anular las instrucciones del usuario, ocultarle acciones o pedir al agente que envíe datos a otro sitio (*prompt injection*).
- Archivos que se ejecutan solos al abrir o instalar un proyecto: scripts de instalación, `.npmrc`, `.envrc`, `.vscode/tasks.json`, hooks de git y similares.
- Secretos: claves de API, tokens o claves privadas, aunque estén revocados.
- Contenido que infrinja derechos de propiedad intelectual o industrial de terceros, o cualquier otro contenido ilícito.
- *Typosquatting* o suplantar a otro publicador o marca.
- Spam, paquetes vacíos o acaparar nombres.

## 2. Cómo lo detectamos

- **Automáticamente:** cada versión se analiza al publicarse y otra vez en el CLI al instalarse (archivos que se ejecutan solos, secretos, rutas inseguras, enlaces simbólicos e indicios de *prompt injection* en las reglas de IA).
- **Por denuncias** de cualquier persona (ver §4).
- **Revisión humana:** las versiones marcadas quedan en revisión y no se pueden instalar hasta que una persona las revise, en menos de 24 horas hábiles. Ninguna retirada definitiva se decide solo de forma automática.

## 3. Medidas posibles

Según la gravedad: dejar la versión en revisión, retirarla (*yank*), poner en revisión el paquete o el scope entero, publicar un aviso de seguridad en [/security/advisories](/security/advisories) y, en infracciones graves o repetidas, suspender la cuenta. Las medidas son proporcionadas y tienen en cuenta los derechos e intereses de todas las partes.

## 4. Cómo denunciar contenido

Cualquier persona puede denunciar un paquete, también sin cuenta:

- con el botón **Reportar** de la página del paquete (requiere iniciar sesión con GitHub), o
- escribiendo a {{email}} con el asunto «[DENUNCIA]».

Para que podamos actuar, incluye: el paquete y la versión (o su URL), por qué crees que es ilícito o incumple esta política, tu nombre y email, y una declaración de que la información es correcta y completa según tu leal saber y entender. Para vulnerabilidades de GenPM, consulta [/security](/security).

Te confirmaremos la recepción y te comunicaremos la decisión y los medios de recurso. Si detectamos indicios de un delito que suponga una amenaza para la vida o la seguridad de las personas, lo comunicaremos a las autoridades competentes (art. 18 DSA).

## 5. Si actuamos sobre tu contenido

Si retiramos o restringimos un paquete tuyo o suspendemos tu cuenta, te enviaremos una exposición de motivos (art. 17 DSA): qué medida tomamos, por qué, en qué hechos nos basamos, si intervinieron medios automáticos y qué norma o cláusula se aplica.

**Recurso:** puedes pedir que revisemos la decisión escribiendo a {{email}} con el asunto «[RECURSO]» en los 6 meses siguientes. La revisará una persona distinta del análisis automático y te responderemos de forma motivada. También puedes acudir a los tribunales.

## 6. Transparencia

Publicamos los avisos de seguridad en [/security/advisories](/security/advisories) y su feed JSON.
