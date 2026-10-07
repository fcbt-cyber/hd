/**
 * TouchControls - 王者荣耀经典双轮盘触控系统
 * 支持左手浮动摇杆走位、右手普攻、技能拖拽瞄准（3D地面指示器）、滑至红区取消施法、智能锁敌、键盘回退
 */
export class TouchControls {
  constructor(options = {}) {
    this.options = options;
    this.moveVector = { x: 0, z: 0 }; // 归一化移动向量 (X: 左右, Z: 上下/前后)
    this.isMoving = false;

    // 技能瞄准状态
    this.activeSkill = null; // null | 1 | 2 | 3
    this.skillAimVector = { x: 0, z: 0 }; // 技能瞄准世界方向向量
    this.isAiming = false;
    this.isHoveringCancel = false;

    // 回调事件
    this.onMove = options.onMove || (() => {});
    this.onAttack = options.onAttack || (() => {});
    this.onSkillStartAim = options.onSkillStartAim || (() => {});
    this.onSkillUpdateAim = options.onSkillUpdateAim || (() => {});
    this.onSkillCast = options.onSkillCast || (() => {});
    this.onSkillCancel = options.onSkillCancel || (() => {});
    this.onRecall = options.onRecall || (() => {});
    this.onHeal = options.onHeal || (() => {});
    this.onSpell = options.onSpell || (() => {});
    this.onUpgradeSkill = options.onUpgradeSkill || (() => {});

    // DOM 元素引用
    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickThumb = document.getElementById('joystick-thumb');
    this.cancelArea = document.getElementById('cancel-cast-area');

    this.joystickTouchId = null;
    this.skillTouchId = null;
    this.joystickCenter = { x: 0, y: 0 };
    this.maxJoystickRadius = 55;

    this.initTouchListeners();
    this.initKeyboardFallback();
  }

  initTouchListeners() {
    // 1. 左侧移动摇杆触控
    if (this.joystickZone) {
      this.joystickZone.addEventListener('touchstart', (e) => this.handleJoystickStart(e), { passive: false });
      this.joystickZone.addEventListener('touchmove', (e) => this.handleJoystickMove(e), { passive: false });
      this.joystickZone.addEventListener('touchend', (e) => this.handleJoystickEnd(e), { passive: false });
      this.joystickZone.addEventListener('touchcancel', (e) => this.handleJoystickEnd(e), { passive: false });
    }

    // 2. 普攻按钮
    const btnAttack = document.getElementById('btn-attack');
    if (btnAttack) {
      btnAttack.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.onAttack();
      }, { passive: false });
      btnAttack.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.onAttack();
      });
    }

    // 3. 技能 1/2/3 轮盘
    [1, 2, 3].forEach(skillId => {
      const btn = document.getElementById(`btn-skill-${skillId}`);
      if (!btn) return;

      btn.addEventListener('touchstart', (e) => this.handleSkillTouchStart(e, skillId), { passive: false });
      btn.addEventListener('touchmove', (e) => this.handleSkillTouchMove(e, skillId), { passive: false });
      btn.addEventListener('touchend', (e) => this.handleSkillTouchEnd(e, skillId), { passive: false });
      btn.addEventListener('touchcancel', (e) => this.handleSkillTouchEnd(e, skillId), { passive: false });

      // 技能加点
      const upBtn = document.getElementById(`btn-up-${skillId}`);
      if (upBtn) {
        upBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.onUpgradeSkill(skillId);
        });
        upBtn.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          this.onUpgradeSkill(skillId);
        });
      }
    });

    // 4. 回城、恢复、终结
    const btnRecall = document.getElementById('btn-recall');
    if (btnRecall) {
      btnRecall.addEventListener('click', () => this.onRecall());
      btnRecall.addEventListener('touchstart', (e) => { e.preventDefault(); this.onRecall(); }, { passive: false });
    }

    const btnHeal = document.getElementById('btn-heal');
    if (btnHeal) {
      btnHeal.addEventListener('click', () => this.onHeal());
      btnHeal.addEventListener('touchstart', (e) => { e.preventDefault(); this.onHeal(); }, { passive: false });
    }

    const btnSpell = document.getElementById('btn-spell');
    if (btnSpell) {
      btnSpell.addEventListener('click', () => this.onSpell());
      btnSpell.addEventListener('touchstart', (e) => { e.preventDefault(); this.onSpell(); }, { passive: false });
    }
  }

  // === 摇杆逻辑 ===
  handleJoystickStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.joystickTouchId === null) {
        this.joystickTouchId = touch.identifier;

        // 计算相对 touchZone 的局部坐标
        const zoneRect = this.joystickZone.getBoundingClientRect();
        const relX = touch.clientX - zoneRect.left;
        const relY = touch.clientY - zoneRect.top;

        this.joystickCenter = { x: touch.clientX, y: touch.clientY };

        // 将摇杆底盘动态吸附到触摸起始点
        this.joystickBase.style.left = `${relX}px`;
        this.joystickBase.style.top = `${relY}px`;
        this.joystickBase.style.bottom = 'auto';
        this.joystickBase.style.transform = 'translate(-50%, -50%)';
        this.joystickThumb.style.transform = 'translate(0, 0)';

        this.isMoving = true;
        break;
      }
    }
  }

  handleJoystickMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystickTouchId) {
        const dx = touch.clientX - this.joystickCenter.x;
        const dy = touch.clientY - this.joystickCenter.y;
        const dist = Math.hypot(dx, dy);

        const clampedDist = Math.min(dist, this.maxJoystickRadius);
        const angle = Math.atan2(dy, dx);

        const thumbX = Math.cos(angle) * clampedDist;
        const thumbY = Math.sin(angle) * clampedDist;

        this.joystickThumb.style.transform = `translate(${thumbX}px, ${thumbY}px)`;

        // 映射到游戏世界坐标系：
        // 屏幕向右 dx > 0 -> 游戏 X > 0
        // 屏幕向下 dy > 0 -> 游戏 Z > 0 (俯视微斜镜头)
        const strength = clampedDist / this.maxJoystickRadius;
        this.moveVector.x = (dx / (dist || 1)) * strength;
        this.moveVector.z = (dy / (dist || 1)) * strength;
        this.isMoving = strength > 0.08;

        this.onMove(this.moveVector);
        break;
      }
    }
  }

  handleJoystickEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.isMoving = false;
        this.moveVector.x = 0;
        this.moveVector.z = 0;
        this.joystickThumb.style.transform = 'translate(0, 0)';
        // 恢复默认左下角停靠
        this.joystickBase.style.left = '60px';
        this.joystickBase.style.top = 'auto';
        this.joystickBase.style.bottom = '40px';
        this.joystickBase.style.transform = 'translate(-50%, 50%)';
        this.onMove(this.moveVector);
        break;
      }
    }
  }

  // === 技能轮盘拖拽瞄准逻辑 ===
  handleSkillTouchStart(e, skillId) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.skillTouchId === null) {
        this.skillTouchId = touch.identifier;
        this.activeSkill = skillId;
        this.skillTouchOrigin = { x: touch.clientX, y: touch.clientY };
        this.isAiming = true;
        this.isHoveringCancel = false;

        // 唤醒取消施法红区与 3D 地面瞄准指示器
        if (this.cancelArea) {
          this.cancelArea.classList.add('active');
          this.cancelArea.classList.remove('hover');
        }

        this.onSkillStartAim(skillId);
        break;
      }
    }
  }

  handleSkillTouchMove(e, skillId) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.skillTouchId) {
        const dx = touch.clientX - this.skillTouchOrigin.x;
        const dy = touch.clientY - this.skillTouchOrigin.y;
        const dist = Math.hypot(dx, dy);

        // 检测是否滑动到了取消区域
        if (this.cancelArea) {
          const cancelRect = this.cancelArea.getBoundingClientRect();
          const inCancel = (
            touch.clientX >= cancelRect.left &&
            touch.clientX <= cancelRect.right &&
            touch.clientY >= cancelRect.top &&
            touch.clientY <= cancelRect.bottom
          );
          if (inCancel !== this.isHoveringCancel) {
            this.isHoveringCancel = inCancel;
            if (inCancel) {
              this.cancelArea.classList.add('hover');
            } else {
              this.cancelArea.classList.remove('hover');
            }
          }
        }

        // 技能拖拽瞄准向量转换
        // 手指向右拖 -> dx > 0 -> 游戏 X+
        // 手指向下拖 -> dy > 0 -> 游戏 Z+
        // 手指向上拖 -> dy < 0 -> 游戏 Z-
        if (dist > 8) {
          this.skillAimVector.x = dx / dist;
          this.skillAimVector.z = dy / dist;
          this.onSkillUpdateAim(skillId, this.skillAimVector, dist, this.isHoveringCancel);
        }
        break;
      }
    }
  }

  handleSkillTouchEnd(e, skillId) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.skillTouchId) {
        const dx = touch.clientX - this.skillTouchOrigin.x;
        const dy = touch.clientY - this.skillTouchOrigin.y;
        const dist = Math.hypot(dx, dy);

        if (this.cancelArea) {
          this.cancelArea.classList.remove('active');
          this.cancelArea.classList.remove('hover');
        }

        if (this.isHoveringCancel) {
          // 取消施法
          this.onSkillCancel(skillId);
        } else {
          // 判定：若拖拽距离很短(<15px)，视为智能锁定点击释放(Smart Cast)
          const isSmartCast = dist < 15;
          this.onSkillCast(skillId, this.skillAimVector, isSmartCast);
        }

        this.skillTouchId = null;
        this.activeSkill = null;
        this.isAiming = false;
        this.isHoveringCancel = false;
        break;
      }
    }
  }

  // === 键盘/桌面调试回退支持 (WASD / JKL) ===
  initKeyboardFallback() {
    this.keys = {};

    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      // 普攻快捷键 J 或 空格
      if (key === 'j' || key === ' ') {
        this.onAttack();
      }
      // 技能 1/2/3: U / I / O
      if (key === 'u' || key === '1') {
        this.onSkillCast(1, { x: 0, z: -1 }, true);
      }
      if (key === 'i' || key === '2') {
        this.onSkillCast(2, { x: 0, z: -1 }, true);
      }
      if (key === 'o' || key === '3') {
        this.onSkillCast(3, { x: 0, z: -1 }, true);
      }
      // 回城 B
      if (key === 'b') this.onRecall();
      // 恢复 F
      if (key === 'f') this.onHeal();
      // 召唤师终结 D
      if (key === 'd') this.onSpell();

      this.updateKeyboardMovement();
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = false;
      this.updateKeyboardMovement();
    });
  }

  updateKeyboardMovement() {
    let x = 0;
    let z = 0;
    if (this.keys['w'] || this.keys['arrowup']) z -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) z += 1;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      this.moveVector.x = x / len;
      this.moveVector.z = z / len;
      this.isMoving = true;
    } else {
      this.moveVector.x = 0;
      this.moveVector.z = 0;
      this.isMoving = false;
    }
    this.onMove(this.moveVector);
  }
}
