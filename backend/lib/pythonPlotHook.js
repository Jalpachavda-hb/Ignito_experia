/**
 * Python Plot & Graph Interceptor Hook
 * 
 * Automatically captures interactive plots from Plotly, Matplotlib, Seaborn,
 * and HTML file views, outputting them in standard VLab delimiter blocks
 * <!-- VLAB_PLOT_START --> ... <!-- VLAB_PLOT_END -->
 * so they render seamlessly in the web IDE.
 */

export const PYTHON_PLOT_HOOK_CODE = `import sys
import atexit

def _vlab_emit_html(html_str):
    if html_str:
        clean = str(html_str).strip()
        if clean:
            sys.stdout.write("\\n<!-- VLAB_PLOT_START -->\\n" + clean + "\\n<!-- VLAB_PLOT_END -->\\n")
            sys.stdout.flush()

# --- 1. PLOTLY HOOKS ---
def _vlab_format_plotly_html(html):
    if not html:
        return ""
    style = "<style>html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #ffffff; } .plotly-graph-div { width: 100% !important; height: 100% !important; min-height: 100% !important; }</style>"
    if "</head>" in html:
        return html.replace("</head>", style + "</head>")
    return style + html

def _vlab_fig_to_html(fig):
    try:
        raw_html = fig.to_html(include_plotlyjs='cdn', full_html=True, config={'responsive': True}, default_width='100%', default_height='100%')
    except TypeError:
        raw_html = fig.to_html(include_plotlyjs='cdn', full_html=True, config={'responsive': True})
    return _vlab_format_plotly_html(raw_html)

def _vlab_fig_show(self, *args, **kwargs):
    self._vlab_shown = True
    try:
        html = _vlab_fig_to_html(self)
        _vlab_emit_html(html)
    except Exception as _e:
        sys.stderr.write(f"[Plotly Error]: {_e}\\n")

try:
    import plotly.basedatatypes
    plotly.basedatatypes.BaseFigure.show = _vlab_fig_show
except Exception:
    pass

try:
    import plotly.graph_objects as go
    go.Figure.show = _vlab_fig_show
except Exception:
    pass

try:
    import plotly.io as pio
    def _vlab_pio_show(fig, *args, **kwargs):
        if hasattr(fig, '_vlab_shown'):
            fig._vlab_shown = True
        try:
            if hasattr(fig, 'to_html'):
                html = _vlab_fig_to_html(fig)
            else:
                import plotly.graph_objects as go
                html = _vlab_fig_to_html(go.Figure(fig))
            _vlab_emit_html(html)
        except Exception as _e:
            sys.stderr.write(f"[Plotly IO Error]: {_e}\\n")
    pio.show = _vlab_pio_show
    try:
        from plotly.io._base_renderers import BaseRenderer
        class _VLabPlotlyRenderer(BaseRenderer):
            def activate(self): pass
            def render(self, fig_dict, **kw):
                try:
                    import plotly.graph_objects as go
                    fig = go.Figure(fig_dict)
                    _vlab_emit_html(_vlab_fig_to_html(fig))
                except Exception as _e:
                    sys.stderr.write(f"[Plotly Renderer Error]: {_e}\\n")
        pio.renderers["vlab"] = _VLabPlotlyRenderer()
        pio.renderers.default = "vlab"
    except Exception:
        pass
except Exception:
    pass

# --- 2. MATPLOTLIB & SEABORN HOOKS ---
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import io, base64

    def _vlab_plt_show(*args, **kwargs):
        try:
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=150)
            buf.seek(0)
            b64_img = base64.b64encode(buf.read()).decode('utf-8')
            plt.close('all')
            img_html = f'''<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    html, body {{
      margin: 0; padding: 0; width: 100%; height: 100%;
      background: #ffffff; display: flex; justify-content: center; align-items: center; overflow: auto;
    }}
    img {{
      max-width: 95%; max-height: 95%; object-fit: contain; border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }}
  </style>
</head>
<body>
  <img src="data:image/png;base64,{b64_img}" alt="Plot Output" />
</body>
</html>'''
            _vlab_emit_html(img_html)
        except Exception as _e:
            sys.stderr.write(f"[Matplotlib Error]: {_e}\\n")

    plt.show = _vlab_plt_show
except Exception:
    pass

# --- 3. WEBBROWSER HOOK ---
try:
    import webbrowser
    _orig_wb = webbrowser.open
    def _vlab_wb(url, *args, **kwargs):
        if isinstance(url, str):
            fpath = url[7:] if url.startswith("file://") else url
            if fpath.endswith(".html") or fpath.endswith(".htm"):
                try:
                    with open(fpath, "r", encoding="utf-8") as _f:
                        _vlab_emit_html(_f.read())
                    return True
                except Exception:
                    pass
        return _orig_wb(url, *args, **kwargs)
    webbrowser.open = _vlab_wb
except Exception:
    pass

# --- 4. ATEXIT AUTO-CAPTURE ---
def _vlab_atexit_check():
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            plt.show()
    except Exception:
        pass
    try:
        import sys
        main_mod = sys.modules.get('__main__')
        if main_mod:
            import plotly.basedatatypes
            for val in list(vars(main_mod).values()):
                if isinstance(val, plotly.basedatatypes.BaseFigure):
                    if not getattr(val, '_vlab_shown', False):
                        val._vlab_shown = True
                        val.show()
                        break
    except Exception:
        pass

atexit.register(_vlab_atexit_check)
`;

export const getPythonPlotHookB64 = () => {
  return Buffer.from(PYTHON_PLOT_HOOK_CODE).toString("base64");
};
