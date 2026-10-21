# Security policy of Aulario Plus

[Español más abajo](#política-de-seguridad-de-aulario-plus-español).

Aulario Plus is a browser extension for MiAulario, the virtual campus of the Universidad Pública de Navarra (UPNA). The UPNA did not make this extension and does not support it.

## Supported versions

Only the newest version gets security fixes. The Chrome Web Store and Firefox Add-ons update the extension automatically.

| Version | Supported |
|---|---|
| 1.6.x | Yes |
| Older than 1.6 | No |

## Report a vulnerability

Do not open a public issue for a security problem.

Report it privately at <https://github.com/chareca/aulario-plus/security/advisories/new> (GitHub, "Report a vulnerability"). Only the maintainer can see the report.

Please include:

- the version of the extension and the browser;
- what an attacker can do, and what they need for it (for example, a post in a forum of a site);
- the steps to reproduce it, or a proof of concept;
- if you know it, the file and the line of the code.

Do not use the data of other people in your tests. Use your own account.

## What happens next

- An answer within 7 days.
- An assessment (severity, affected versions) within 14 days.
- A fix in the next version. A serious problem gets its own version as soon as it is ready.
- A security advisory on GitHub after the fix is in the stores, with your name if you want it.

Please do not publish the problem before the fix is available. There is no reward (bug bounty): this is a free project.

## Scope

In scope: the code of this repository (the extension and its build and release workflows).

Out of scope: MiAulario, SIGMA, MiUPNA, the UPNA login (`sso.unavarra.es`) and the other systems of the UPNA. Report those problems to the UPNA. If a problem of the UPNA makes the extension unsafe, report it here too.

---

# Política de seguridad de Aulario Plus (español)

Aulario Plus es una extensión del navegador para MiAulario, el campus virtual de la Universidad Pública de Navarra (UPNA). La UPNA no ha hecho esta extensión y no le da soporte.

## Versiones con soporte

Solo la versión más nueva recibe correcciones de seguridad. La Chrome Web Store y Firefox Add-ons actualizan la extensión solos.

| Versión | Soporte |
|---|---|
| 1.6.x | Sí |
| Anterior a 1.6 | No |

## Informar de una vulnerabilidad

No abras un issue público para un problema de seguridad.

Infórmalo en privado en <https://github.com/chareca/aulario-plus/security/advisories/new> (GitHub, «Report a vulnerability»). Solo el responsable puede ver el informe.

Incluye, por favor:

- la versión de la extensión y el navegador;
- qué puede hacer un atacante y qué necesita para ello (por ejemplo, un mensaje en un foro de una asignatura);
- los pasos para reproducirlo o una prueba de concepto;
- si lo sabes, el archivo y la línea del código.

No uses datos de otras personas en tus pruebas. Usa tu propia cuenta.

## Qué pasa después

- Una respuesta en 7 días como máximo.
- Una valoración (gravedad, versiones afectadas) en 14 días como máximo.
- Una corrección en la siguiente versión. Un problema grave tiene su propia versión en cuanto está lista.
- Un aviso de seguridad en GitHub cuando la corrección ya está en las tiendas, con tu nombre si quieres.

Por favor, no publiques el problema antes de que la corrección esté disponible. No hay recompensa (bug bounty): es un proyecto gratuito.

## Alcance

Dentro: el código de este repositorio (la extensión y sus workflows de compilación y publicación).

Fuera: MiAulario, SIGMA, MiUPNA, el inicio de sesión de la UPNA (`sso.unavarra.es`) y los demás sistemas de la UPNA. Informa de esos problemas a la UPNA. Si un problema de la UPNA hace insegura la extensión, infórmalo también aquí.
