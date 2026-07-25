#!/usr/bin/env python3
"""ES モジュールを依存順に連結し、単一 HTML を生成する簡易バンドラ。

file:// で直接開けるようにするためのもの。
import / export 行を機械的に除去するだけなので、
・named export のみ
・モジュール間で識別子が衝突しない
という前提で使用する。
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 依存の浅い順（循環参照が無いことを前提に手動で定義）
ORDER = [
    "src/config/NtscConstants.js",
    "src/config/DefaultParams.js",
    "src/shaders/QuadVertex.js",
    "src/shaders/NoiseFragment.js",
    "src/shaders/DetectorFragment.js",
    "src/shaders/EncoderFragment.js",
    "src/shaders/RiceDetectorFragment.js",
    "src/shaders/DecoderFragment.js",
    "src/shaders/DisplayFragment.js",
    "src/shaders/PresentFragment.js",
    "src/gl/GLContext.js",
    "src/gl/ShaderProgram.js",
    "src/gl/RenderTarget.js",
    "src/gl/ArrayRenderTarget.js",
    "src/gl/QuadRenderer.js",
    "src/capture/ScreenCapture.js",
    "src/capture/VideoTexture.js",
    "src/capture/CaptureCoordinator.js",
    "src/pipeline/FieldScheduler.js",
    "src/pipeline/FieldRenderer.js",
    "src/pipeline/PowerEnvelope.js",
    "src/pipeline/NtscPipeline.js",
    "src/audio/NoiseSourceBuilder.js",
    "src/audio/AudioEngine.js",
    "src/ui/ParameterStore.js",
    "src/ui/ControlPanel.js",
    "src/core/AppController.js",
    "src/main.js",
]

IMPORT_RE = re.compile(r"^\s*import\s.*?;\s*$", re.MULTILINE | re.DOTALL)
EXPORT_RE = re.compile(r"^export\s+", re.MULTILINE)


def strip_module_syntax(source: str) -> str:
    source = IMPORT_RE.sub("", source)
    source = EXPORT_RE.sub("", source)
    return source.strip()


def build() -> Path:
    parts = []
    for rel in ORDER:
        path = ROOT / rel
        if not path.exists():
            raise SystemExit(f"見つかりません: {rel}")
        parts.append(f"/* ===== {rel} ===== */\n" + strip_module_syntax(path.read_text(encoding="utf-8")))

    bundle = "\n\n".join(parts)
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    marker = '<script type="module" src="./src/main.js"></script>'
    if marker not in html:
        raise SystemExit("index.html にスクリプトタグが見つかりません。")
    html = html.replace(marker, "<script>\n" + bundle + "\n</script>")

    out = ROOT / "ntsc_snow_standalone.html"
    out.write_text(html, encoding="utf-8")
    return out


if __name__ == "__main__":
    target = build()
    print(f"生成しました: {target} ({target.stat().st_size} bytes)", file=sys.stderr)
