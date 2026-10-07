/**
 * MiniMap - 2D Canvas 实时雷达小地图
 * 呈现整条单路兵线位置、防御塔血量状态、敌我英雄实时动向
 */
export class MiniMap {
  constructor() {
    this.canvas = document.getElementById('minimap-canvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }
  }

  toCanvasCoords(worldX, worldZ) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    // 地图 X 从 -52 到 +52 -> 映射到画布 X (10 ~ w - 10)
    // 地图 Z 从 -8 到 +8 -> 映射到画布 Y (8 ~ h - 8)
    const normX = (worldX - (-52)) / 104;
    const normZ = (worldZ - (-8)) / 16;
    const cx = Math.max(4, Math.min(w - 4, normX * (w - 16) + 8));
    const cy = Math.max(4, Math.min(h - 4, normZ * (h - 16) + 8));
    return { cx, cy };
  }

  render(gameState) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 清空背景
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // 绘制单路桥道
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 8, h / 2);
    ctx.stroke();

    // 中轴线
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, h / 2);
    ctx.lineTo(w - 8, h / 2);
    ctx.stroke();

    // 绘制水晶
    if (gameState.crystals) {
      gameState.crystals.forEach(c => {
        if (c.isDead) return;
        const { cx, cy } = this.toCanvasCoords(c.mesh.position.x, c.mesh.position.z);
        ctx.fillStyle = c.team === 0 ? '#2563eb' : '#dc2626';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
      });
    }

    // 绘制防御塔
    if (gameState.towers) {
      gameState.towers.forEach(t => {
        if (t.isDead) return;
        const { cx, cy } = this.toCanvasCoords(t.mesh.position.x, t.mesh.position.z);
        ctx.fillStyle = t.team === 0 ? '#60a5fa' : '#f87171';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 绘制小兵
    if (gameState.minions) {
      gameState.minions.forEach(m => {
        if (m.isDead) return;
        const { cx, cy } = this.toCanvasCoords(m.mesh.position.x, m.mesh.position.z);
        ctx.fillStyle = m.team === 0 ? '#38bdf8' : '#f87171';
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 绘制英雄
    if (gameState.heroes) {
      gameState.heroes.forEach(h => {
        if (h.isDead) return;
        const { cx, cy } = this.toCanvasCoords(h.mesh.position.x, h.mesh.position.z);
        // 外圈光环
        ctx.strokeStyle = h.team === 0 ? '#60a5fa' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
        ctx.stroke();

        // 核心实心圆
        ctx.fillStyle = h.team === 0 ? '#3b82f6' : '#dc2626';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}
