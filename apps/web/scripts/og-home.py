#!/usr/bin/env python3
"""Imágenes Open Graph de la home por idioma (public/og/home-<locale>.png, 1200×630) con Chrome headless.

  python3 apps/web/scripts/og-home.py        # desde la raíz del repo; necesita Google Chrome instalado (macOS)

Textos: web.meta.title (sin "GenPM — "), web.home.lede y web.home.eyebrow de cada catálogo. Las fuentes latinas son
las de public/fonts; ja/zh-CN/ko usan las del sistema (Hiragino, PingFang, Apple SD Gothic). Las imágenes de cada
paquete se generan en el Worker (src/lib/og.ts, /og/p/@scope/name.png).
"""
import html, json, os, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(ROOT))
FONTS = os.path.join(ROOT, 'public', 'fonts')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
CJK = {'ja': '"Hiragino Sans"', 'zh-CN': '"PingFang SC"', 'ko': '"Apple SD Gothic Neo"'}
COLORS = ['#549800', '#5B4FD9', '#127A86']

for l in ['en', 'es', 'pt-BR', 'fr', 'de', 'ja', 'zh-CN', 'ko']:
    d = json.load(open(os.path.join(REPO, 'packages', 'i18n', 'locales', l, 'web.json')))
    title = d['meta']['title'].split(' — ', 1)[1]
    lede = d['home']['lede']
    chips = [c.strip() for c in d['home']['eyebrow'].split('·')]
    size = 64 if l in CJK else 58 if len(title) > 44 else 66 if len(title) > 30 else 88
    tfont = CJK.get(l, 'JBM')
    pfont = CJK.get(l, 'JBM')
    chips_html = ''.join(f'<span><b style="background:{c}"></b>{html.escape(t)}</span>' for c, t in zip(COLORS, chips))
    page = f'''<!doctype html><meta charset="utf-8"><style>
@font-face{{font-family:JBM;src:url(file://{FONTS}/jetbrains-mono-latin-800.woff2);font-weight:800}}
@font-face{{font-family:JBM;src:url(file://{FONTS}/jetbrains-mono-latin-400.woff2);font-weight:400}}
*{{margin:0;box-sizing:border-box}}html,body{{width:1200px;height:630px;overflow:hidden;background:#fff}}
body{{padding:72px;display:flex;flex-direction:column;border:1px solid #E8EBEF;font-family:JBM,{CJK.get(l, 'monospace')}}}
.w{{font:800 40px JBM;letter-spacing:-2px;color:#0B0D11;display:flex;align-items:center}}
.w i{{display:inline-block;width:18px;height:36px;background:#549800;margin-left:3px}}
main{{flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px}}
h1{{font-family:{tfont};font-weight:800;font-size:{size}px;line-height:1.08;letter-spacing:{'-1px' if l in CJK else '-3px'};color:#0B0D11;max-width:1060px}}
p{{font-family:{pfont};font-size:{28 if l in CJK else 24}px;line-height:1.5;color:#5B6270;max-width:1000px}}
.c{{display:flex;gap:22px}}.c span{{display:flex;align-items:center;gap:14px;padding:12px 20px;border:2px solid #E8EBEF;border-radius:6px;font:22px JBM,{CJK.get(l, 'monospace')};color:#0B0D11}}
.c b{{width:14px;height:14px;display:inline-block}}
</style><div class="w">genpm<i></i></div><main><h1>{html.escape(title)}</h1><p>{html.escape(lede)}</p></main><div class="c">{chips_html}</div>'''
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f:
        f.write(page)
    out = os.path.join(ROOT, 'public', 'og', f'home-{l}.png')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                    '--force-device-scale-factor=1', '--window-size=1200,630', f'--screenshot={out}', f'file://{f.name}'],
                   check=True, capture_output=True)
    os.unlink(f.name)
    print(out)
