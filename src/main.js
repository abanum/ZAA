// エントリポイント。各機能の呼び出しのみを行う。

import { AppController } from './core/AppController.js';

function collectElements() {
  return {
    canvas: document.getElementById('screen'),
    panel: document.getElementById('panel'),
    status: document.getElementById('status'),
    power: document.getElementById('power'),
    reset: document.getElementById('reset'),
    fullscreen: document.getElementById('fullscreen'),
    lamp: document.getElementById('lamp'),
    stage: document.getElementById('stage'),
    renderer: document.getElementById('renderer'),
    capture: document.getElementById('capture'),
  };
}

function bootstrap() {
  const app = new AppController();
  app.initialize(collectElements());
  app.run();
}

document.addEventListener('DOMContentLoaded', bootstrap);
