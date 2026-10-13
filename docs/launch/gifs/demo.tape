# Vídeo demo de terminal (D7-01, versión sin voz para X, LinkedIn y el README). Generar: vhs demo.tape
# Todo ocurre en una carpeta temporal: HOME, instalación y telemetría aisladas (no cuenta como instalación).
Output demo.mp4
Output demo.gif
Set Shell "bash"
Set FontSize 22
Set Width 1600
Set Height 900
Set Padding 36
Set Theme { "name": "genpm-light", "background": "#ffffff", "foreground": "#0b0d11", "cursor": "#549800", "black": "#0b0d11", "red": "#d1242f", "green": "#549800", "yellow": "#9a6700", "blue": "#3b5bdb", "magenta": "#7048e8", "cyan": "#1b7c83", "white": "#6a7180", "brightBlack": "#6a7180", "brightRed": "#d1242f", "brightGreen": "#549800", "brightYellow": "#9a6700", "brightBlue": "#3b5bdb", "brightMagenta": "#7048e8", "brightCyan": "#1b7c83", "brightWhite": "#0b0d11", "selection": "#e8ebef" }
Set TypingSpeed 40ms
Hide
Type "export PS1='$ ' D=$(mktemp -d) && export HOME=$D/home GENPM_TELEMETRY=0 GENPM_INSTALL_DIR=$D/bin GENPM_NO_MODIFY_PATH=1 PATH=$D/bin:$PATH && mkdir -p $HOME $D/my-saas && cd $D/my-saas && git init -q && echo '{}' > package.json && clear"
Enter
Show
Type "# New SaaS, empty folder. I'm not writing auth or payments by hand."
Enter
Sleep 1.2s
Type "curl -fsSL https://genpm.net/install.sh | sh"
Enter
Sleep 6s
Type "clear && genpm search billing"
Enter
Sleep 3s
Type "genpm add @core/billing"
Enter
Sleep 4.5s
# Inyectar: sí
Type "y"
Sleep 3s
# MCP de Stripe: consentimiento explícito (no)
Type "n"
Sleep 1.5s
# npm install: luego, a mano
Type "n"
Wait+Screen /Injected/
Sleep 3.5s
Type "clear && find src -maxdepth 3 -type d"
Enter
Sleep 2.5s
Type "# Real source code in my repo, pinned to a commit SHA:"
Enter
Type "genpm list"
Enter
Sleep 3.5s
Type "clear && head -n 18 src/lib/billing/AGENTS.md"
Enter
Sleep 4.5s
Type "clear"
Enter
Type "# ...and rules my AI agent loads when it works in that folder."
Enter
Type "# Or let the agent do it all:  genpm mcp setup"
Enter
Type "# https://genpm.net  -  Install architectures, not dependencies."
Enter
Sleep 3.5s
