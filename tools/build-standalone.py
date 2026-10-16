"""Bundle local assets into one portable HTML file; no extra dependencies."""
from pathlib import Path


def build():
    root = Path(__file__).resolve().parents[1]
    html = (root / "index.html").read_text(encoding="utf-8")
    css = (root / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}\n</style>")
    scripts = []
    for name in ("pixels.js", "app.js"):
        script = (root / name).read_text(encoding="utf-8")
        if "</script" in script.lower():
            raise ValueError(f"Unsafe inline script terminator in {name}")
        scripts.append(f"<script>\n{script}\n</script>")
        html = html.replace(f'<script src="{name}" defer></script>', "")
    # Inline scripts run after the body exists, unlike external deferred scripts.
    html = html.replace("</body>", "\n".join(scripts) + "\n</body>")
    output = root / "dist" / "color-refiner.html"
    output.parent.mkdir(exist_ok=True)
    output.write_text(html, encoding="utf-8")
    print(output)


if __name__ == "__main__":
    build()
