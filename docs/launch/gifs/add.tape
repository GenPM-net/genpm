# GIF del README: buscar e inyectar billing (+ auth + db). Generar: vhs add.tape (necesita genpm en el PATH).
Output add.gif
Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 640
Set Padding 24
Set Theme { "name": "genpm-light", "background": "#ffffff", "foreground": "#0b0d11", "cursor": "#549800", "black": "#0b0d11", "red": "#d1242f", "green": "#549800", "yellow": "#9a6700", "blue": "#3b5bdb", "magenta": "#7048e8", "cyan": "#1b7c83", "white": "#6a7180", "brightBlack": "#6a7180", "brightRed": "#d1242f", "brightGreen": "#549800", "brightYellow": "#9a6700", "brightBlue": "#3b5bdb", "brightMagenta": "#7048e8", "brightCyan": "#1b7c83", "brightWhite": "#0b0d11", "selection": "#e8ebef" }
Set TypingSpeed 45ms
Hide
Type "export PS1='$ ' && D=$(mktemp -d) && cd $D && git init -q && echo '{}' > package.json && clear"
Enter
Show
Type "genpm search stripe"
Enter
Sleep 2s
Type "genpm add @core/billing"
Enter
Sleep 4s
# Inyectar: sí
Type "y"
Sleep 2.5s
# MCP de Stripe: no (consentimiento explícito)
Type "n"
Sleep 1.5s
# npm install: luego, a mano
Type "n"
Sleep 3s
Type "genpm list"
Enter
Sleep 3s
