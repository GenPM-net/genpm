# GIF: lo instalado queda anclado a un commit, con firma verificable y reglas para la IA por módulo.
Output lock.gif
Set Shell "bash"
Set FontSize 18
Set Width 1200
Set Height 700
Set Padding 24
Set Theme { "name": "genpm-light", "background": "#ffffff", "foreground": "#0b0d11", "cursor": "#549800", "black": "#0b0d11", "red": "#d1242f", "green": "#549800", "yellow": "#9a6700", "blue": "#3b5bdb", "magenta": "#7048e8", "cyan": "#1b7c83", "white": "#6a7180", "brightBlack": "#6a7180", "brightRed": "#d1242f", "brightGreen": "#549800", "brightYellow": "#9a6700", "brightBlue": "#3b5bdb", "brightMagenta": "#7048e8", "brightCyan": "#1b7c83", "brightWhite": "#0b0d11", "selection": "#e8ebef" }
Set TypingSpeed 45ms
Hide
Type "export PS1='$ ' && D=$(mktemp -d) && cd $D && git init -q && echo '{}' > package.json && genpm add @core/auth --yes >/dev/null && clear"
Enter
Sleep 4s
Show
Type "ls src/lib/auth"
Enter
Sleep 1.5s
Type "head -12 src/lib/auth/AGENTS.md"
Enter
Sleep 3s
Type "genpm audit"
Enter
Sleep 3s
