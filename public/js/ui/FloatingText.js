import * as THREE from '../../libs/three.module.js';

/**
 * FloatingText - 3D 世界到屏幕投影的伤害与治疗飘字系统
 */
export class FloatingText {
  constructor(camera) {
    this.camera = camera;
    this.container = document.getElementById('damage-text-layer');
  }

  show(worldPos, text, type = 'phys') {
    if (!this.container || !this.camera) return;

    // 将 3D 坐标投影到 2D 屏幕视口坐标
    const pos = worldPos.clone();
    pos.y += 2.2; // 悬浮于头顶
    pos.project(this.camera);

    // 判断是否在摄像机视锥内
    if (pos.z > 1) return;

    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

    // 轻微随机偏移，防止连续数字完全重叠
    const offsetX = (Math.random() - 0.5) * 24;
    const offsetY = (Math.random() - 0.5) * 16;

    const el = document.createElement('div');
    el.className = `floating-dmg ${type}`;
    el.innerText = text;
    el.style.left = `${x + offsetX}px`;
    el.style.top = `${y + offsetY}px`;

    this.container.appendChild(el);

    // 0.85 秒后自动移除
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 850);
  }
}
