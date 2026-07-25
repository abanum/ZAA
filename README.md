# NTSC Snow Simulator

NTSC 方式のテレビ受像機が無信号状態のときに現れる「砂嵐」を、乱数テクスチャの貼り付けではなく **受信機の信号処理系をモデル化して** 再現する WebGL2 アプリケーションです。さらに画面キャプチャした映像を NTSC エンコードしてから同じデコーダに通すことで、ブラウン管越しに映像を見たときの色にじみ・ドットクロール・走査線までを実時間で再現します。

単一の HTML ファイルで動作し、ビルドやインストールは不要です。

## できること

- **物理ベースの砂嵐** — IF 帯の複素ガウス雑音を帯域制限して包絡線検波するため、輝度は単なる一様乱数ではなく**レイリー分布**になります。NTSC は負変調なので振幅が大きいほど暗く、映像 LPF により粒は横長になります。
- **画面キャプチャの NTSC 化** — `getDisplayMedia()` で取り込んだタブ・ウィンドウ・画面を、RGB→YIQ→帯域制限→3.58MHz 変調でコンポジット信号にエンコードし、デコーダに通します。
- **電界強度による連続遷移** — ライス検波により、クリアな映像から弱電界のざらつき、完全な砂嵐まで 1 本のスライダーで連続的に行き来できます（砂嵐は電界強度ゼロの極限として統合されています）。
- **Y/C 分離方式の切り替え** — バンドパス（安物 TV 相当）／2 ラインコム／3 ラインコムを切り替えられ、クロスカラー（レインボー）やドットクロールの増減を確認できます。
- **CRT 表示** — インターレース走査、ビームスポット径、蛍光体残光、走査線、画面曲率、周辺光量落ち。電源投入時のウォームアップと、電源切断時に横線へつぶれて輝点に収束する消え方も再現します。
- **音声** — 無信号時の FM ノイズ（三角雑音 + 75µs デエンファシス）。映像入力時はノイズを下げ、弱いインターキャリア音に切り替わります。

## 使い方

`ntsc_snow.html`（単一 HTML 版）をブラウザで開くだけです。

1. **電源を入れる** を押すと砂嵐の受信が始まります。
2. **映像を取り込む** を押すとブラウザのダイアログが開き、共有するタブ・ウィンドウ・画面を選べます。
3. 右のサービスパネルで各パラメータを調整できます。

> **画面キャプチャについて**
> 画面キャプチャは Secure Context でのみ有効です。`file://` で開くとブラウザによってはキャプチャが無効化されるため、その場合は簡易サーバー経由で開いてください。
> ```
> python -m http.server 8000
> # http://localhost:8000/ntsc_snow.html
> ```

## 試すと分かりやすい設定

- **Y/C 分離を 0（バンドパス）に** すると色の縦エッジにレインボーが出て、**1（2 ラインコム）** で消えます。安物 TV と高級機の差です。
- **電界強度をゆっくり下げる** と、カラー映像 → ざらつき → 白黒の砂嵐へ連続的に遷移します。
- **描画解像度を上げて全画面にする** と 1 走査線あたりの画素数が増え、走査線がはっきり見えるようになります。

## 動作環境

WebGL2 と WebAudio に対応したブラウザ（Chrome / Edge / Firefox / Safari 16 以降）。ハードウェアアクセラレーションが有効であることを推奨します（サービスパネル上部に使用中の GPU 名が表示されます）。

## 実装メモ

- 4fsc（14.318MHz）サンプリングで、副搬送波の位相が 1 サンプルあたり π/2 進む性質を利用し、色の同期検波を乗算テーブルなしで実装しています。
- 副搬送波位相を絶対サンプル位置と 4 フィールドシーケンスから積算しているため、ドットクロールとクロスカラーがアーティファクトとして自然に発生します。
- エンコード→デコードのチェーンはカラーバーで検証済みで、2 ラインコムでは色誤差ゼロ、バンドパスでは飽和色にクロストークが出ることを確認しています。

## 構成

一方向依存・1 ファイル 1 クラスで構成しています。処理チェーンは 6 つのフラグメントシェーダ（雑音生成 → エンコード → ライス検波 → デコード → CRT 表示 → 転送）を段階的に適用しています。詳細は `docs/` の要件定義書を参照してください。

---

# NTSC Snow Simulator (English)

A WebGL2 app that recreates the "snow" (static) shown by an NTSC television with no signal — not by pasting a random-noise texture, but by **modeling the receiver's signal chain**. It also NTSC-encodes a screen capture and runs it back through the same decoder, so you can watch any window through a simulated CRT in real time, complete with color bleeding, dot crawl, and scanlines.

Runs from a single HTML file. No build, no install.

## Features

- **Physics-based snow** — Band-limited complex Gaussian IF noise is envelope-detected, so luminance follows a **Rayleigh distribution** rather than uniform noise. Negative modulation makes larger amplitudes darker, and the video LPF makes the grain horizontally elongated.
- **NTSC-encoded screen capture** — A tab, window, or screen grabbed via `getDisplayMedia()` is encoded to a composite signal (RGB→YIQ→band-limit→3.58MHz modulation) and fed to the decoder.
- **Continuous field-strength transition** — Rician detection lets a single slider move continuously from a clean picture, through weak-signal graininess, to full snow (snow is the zero-field-strength limit).
- **Selectable Y/C separation** — Bandpass (cheap TV), 2-line comb, or 3-line comb, so you can watch cross-color (rainbow) and dot crawl grow or vanish.
- **CRT display** — Interlaced scanning, beam spot size, phosphor persistence, scanlines, screen curvature, vignetting, plus a warm-up on power-on and the classic collapse-to-a-line-then-a-dot on power-off.
- **Audio** — FM no-signal noise (triangular noise + 75µs de-emphasis); switches to reduced noise with a faint intercarrier tone when a video source is present.

## Usage

Just open `ntsc_snow.html` in a browser.

1. Press **電源を入れる (Power on)** to start receiving snow.
2. Press **映像を取り込む (Capture)** to pick a tab, window, or screen to share.
3. Adjust parameters in the service panel on the right.

> **Screen capture** requires a secure context. If opening via `file://` disables capture, serve it locally instead:
> ```
> python -m http.server 8000
> # http://localhost:8000/ntsc_snow.html
> ```

## Requirements

A browser with WebGL2 and WebAudio (Chrome / Edge / Firefox / Safari 16+). Hardware acceleration recommended — the active GPU name is shown at the top of the service panel.

## Notes

- Uses 4fsc (14.318 MHz) sampling; the subcarrier advances π/2 per sample, so chroma synchronous detection needs no lookup table.
- Subcarrier phase is accumulated from absolute sample position and the 4-field sequence, so dot crawl and cross-color emerge naturally as artifacts.
- The encode→decode chain is verified against color bars: zero color error with the 2-line comb, and expected crosstalk on saturated colors with bandpass.
