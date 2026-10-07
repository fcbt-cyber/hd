/**
 * HUD - 对战内完整 UI 与装备商店管理器
 */
export class HUD {
  constructor(soundManager) {
    this.sound = soundManager;

    // 经典 6 神装列表
    this.shopItems = [
      { id: 'boots', name: '抵抗之靴', cost: 710, icon: '👢', desc: '移速 +1.2，法抗 +35', speed: 1.2, magicResist: 35 },
      { id: 'axe', name: '暗影战斧', cost: 2090, icon: '🪓', desc: '物理攻击 +85，生命 +500', attack: 85, hp: 500 },
      { id: 'blade', name: '无尽战刃', cost: 2140, icon: '🗡️', desc: '物理攻击 +110，暴击强化', attack: 110 },
      { id: 'echo', name: '回响之杖', cost: 2100, icon: '🪄', desc: '法术攻击 +100，移速 +0.8', attack: 100, speed: 0.8 },
      { id: 'hat', name: '博学者之怒', cost: 2300, icon: '🎩', desc: '法术攻击 +140，全法强增幅', attack: 140 },
      { id: 'armor', name: '不祥征兆', cost: 2180, icon: '🛡️', desc: '最大生命 +1200，护甲 +90', hp: 1200, armor: 90 }
    ];

    // DOM 引用
    this.avatarEl = document.getElementById('hud-avatar');
    this.levelEl = document.getElementById('hud-level-badge');
    this.hpBarEl = document.getElementById('hud-hp-bar');
    this.hpTextEl = document.getElementById('hud-hp-text');
    this.mpBarEl = document.getElementById('hud-mp-bar');
    this.mpTextEl = document.getElementById('hud-mp-text');
    this.goldTextEl = document.getElementById('hud-gold-text');
    this.timerEl = document.getElementById('match-timer');
    this.scoreBlueEl = document.getElementById('score-blue');
    this.scoreRedEl = document.getElementById('score-red');

    // 快捷购买
    this.quickPanel = document.getElementById('quick-buy-panel');
    this.quickIcon = document.getElementById('quick-item-icon');
    this.quickName = document.getElementById('quick-item-name');
    this.quickPrice = document.getElementById('quick-item-price');
    this.quickBuyBtn = document.getElementById('btn-quick-buy');
    this.currentQuickItem = null;

    // 横幅
    this.bannerBox = document.getElementById('banner-notice');
    this.bannerTitle = document.getElementById('banner-title');
    this.bannerDesc = document.getElementById('banner-desc');
    this.bannerTimeout = null;

    // 商店
    this.shopModal = document.getElementById('shop-modal');
    this.shopCurrentGold = document.getElementById('shop-current-gold');
    this.shopItemsContainer = document.getElementById('shop-items-container');
    this.inventoryContainer = document.getElementById('inventory-slots-container');

    this.initShopEvents();
  }

  initShopEvents() {
    const btnOpenShop = document.getElementById('btn-open-shop');
    if (btnOpenShop) {
      btnOpenShop.addEventListener('click', () => this.openShop());
    }

    const btnCloseShop = document.getElementById('btn-close-shop');
    if (btnCloseShop) {
      btnCloseShop.addEventListener('click', () => this.closeShop());
    }

    if (this.quickBuyBtn) {
      this.quickBuyBtn.addEventListener('click', () => {
        if (this.currentQuickItem && this.onBuyItemCallback) {
          const success = this.onBuyItemCallback(this.currentQuickItem);
          if (success && this.sound) this.sound.playBuyItem();
        }
      });
    }
  }

  bindHero(hero, onBuyItemCallback) {
    this.hero = hero;
    this.onBuyItemCallback = onBuyItemCallback;

    // 头像更新
    const icons = { arthur: '🛡️', daji: '🦊', houyi: '🏹' };
    if (this.avatarEl) {
      this.avatarEl.innerText = icons[hero.heroType] || '🛡️';
    }

    // 技能图标更新
    const skillIcons = {
      arthur: ['⚔️', '🛡️', '⚡'],
      daji: ['🌊', '💖', '🔥'],
      houyi: ['🏹', '☀️', '🦅']
    };
    const sIcons = skillIcons[hero.heroType] || ['1', '2', '3'];
    [1, 2, 3].forEach(id => {
      const el = document.getElementById(`icon-skill-${id}`);
      if (el) el.innerText = sIcons[id - 1];
    });
  }

  update(hero, matchTimeSec, scoreBlue, scoreRed) {
    if (!hero) return;

    // 血量与蓝量
    const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
    const mpPct = Math.max(0, Math.min(100, (hero.mp / hero.maxMp) * 100));
    if (this.hpBarEl) this.hpBarEl.style.width = `${hpPct}%`;
    if (this.hpTextEl) this.hpTextEl.innerText = `${Math.ceil(hero.hp)} / ${hero.maxHp}`;
    if (this.mpBarEl) this.mpBarEl.style.width = `${mpPct}%`;
    if (this.mpTextEl) this.mpTextEl.innerText = `${Math.ceil(hero.mp)} / ${hero.maxMp}`;

    // 等级与金币
    if (this.levelEl) this.levelEl.innerText = hero.level;
    if (this.goldTextEl) this.goldTextEl.innerText = hero.gold;

    // 比分与计时
    if (this.scoreBlueEl) this.scoreBlueEl.innerText = scoreBlue;
    if (this.scoreRedEl) this.scoreRedEl.innerText = scoreRed;
    if (this.timerEl) {
      const m = Math.floor(matchTimeSec / 60).toString().padStart(2, '0');
      const s = Math.floor(matchTimeSec % 60).toString().padStart(2, '0');
      this.timerEl.innerText = `${m}:${s}`;
    }

    // 技能冷却与加点更新
    [1, 2, 3].forEach(id => {
      const cdKey = `s${id}`;
      const cdVal = hero.cds[cdKey];
      const maxCd = hero.cds[`${cdKey}Max`];
      const overlay = document.getElementById(`cd-skill-${id}`);
      const num = document.getElementById(`num-skill-${id}`);
      const upBtn = document.getElementById(`btn-up-${id}`);

      if (cdVal > 0) {
        overlay.style.display = 'block';
        num.style.display = 'block';
        num.innerText = Math.ceil(cdVal);
      } else {
        overlay.style.display = 'none';
        num.style.display = 'none';
      }

      // 加点升级按钮
      if (hero.skillPoints > 0) {
        upBtn.classList.add('show');
      } else {
        upBtn.classList.remove('show');
      }
    });

    // 辅助技能 CD
    ['spell', 'heal'].forEach(k => {
      const cdVal = hero.cds[k];
      const overlay = document.getElementById(`cd-${k}`);
      if (overlay) {
        overlay.style.display = cdVal > 0 ? 'block' : 'none';
      }
    });

    // 快捷推荐装备检测
    this.checkQuickBuy(hero);
  }

  checkQuickBuy(hero) {
    // 找出玩家尚未购买且买得起的第一件装备
    const affordableItem = this.shopItems.find(it => {
      const alreadyBought = hero.items.some(owned => owned.id === it.id);
      return !alreadyBought && hero.gold >= it.cost;
    });

    if (affordableItem && hero.items.length < 6) {
      this.currentQuickItem = affordableItem;
      this.quickIcon.innerText = affordableItem.icon;
      this.quickName.innerText = affordableItem.name;
      this.quickPrice.innerText = `🪙 ${affordableItem.cost}`;
      this.quickPanel.style.display = 'flex';
    } else {
      this.currentQuickItem = null;
      this.quickPanel.style.display = 'none';
    }
  }

  openShop() {
    if (!this.hero) return;
    this.shopCurrentGold.innerText = this.hero.gold;
    this.renderShopGrid();
    this.renderInventory();
    this.shopModal.classList.add('active');
  }

  closeShop() {
    this.shopModal.classList.remove('active');
  }

  renderShopGrid() {
    if (!this.shopItemsContainer) return;
    this.shopItemsContainer.innerHTML = '';

    this.shopItems.forEach(item => {
      const card = document.createElement('div');
      const alreadyBought = this.hero.items.some(owned => owned.id === item.id);
      const canAfford = this.hero.gold >= item.cost && !alreadyBought && this.hero.items.length < 6;

      card.className = `shop-item-card ${canAfford ? 'can-afford' : ''}`;
      card.innerHTML = `
        <div class="item-icon">${item.icon}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-stats">${item.desc}</div>
          <div class="item-cost">${alreadyBought ? '已购买' : '🪙 ' + item.cost}</div>
        </div>
      `;

      if (canAfford) {
        card.addEventListener('click', () => {
          if (this.onBuyItemCallback) {
            const success = this.onBuyItemCallback(item);
            if (success) {
              if (this.sound) this.sound.playBuyItem();
              this.openShop(); // 刷新界面
            }
          }
        });
      }
      this.shopItemsContainer.appendChild(card);
    });
  }

  renderInventory() {
    if (!this.inventoryContainer) return;
    this.inventoryContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      if (this.hero && this.hero.items[i]) {
        slot.innerText = this.hero.items[i].icon;
        slot.title = this.hero.items[i].name;
      }
      this.inventoryContainer.appendChild(slot);
    }
  }

  showBanner(title, desc) {
    if (!this.bannerBox) return;
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);

    this.bannerTitle.innerText = title;
    this.bannerDesc.innerText = desc;
    this.bannerBox.classList.add('show');

    this.bannerTimeout = setTimeout(() => {
      this.bannerBox.classList.remove('show');
    }, 2800);
  }
}
