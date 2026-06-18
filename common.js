/**
 * MoyuOS - 2026 摸鱼终端核心系统 v2.0
 * 命名空间封装，零全局污染（仅暴露兼容层函数）
 */
;(function(global) {
  'use strict';

  /* ========================================================
   *  MoyuOS.Storage — 版本化本地存储
   * ======================================================== */
  const STORAGE_KEY = 'moyu_v2';
  const OLD_KEY = 'moyu_stats';

  const DEFAULT_V2 = {
    version: 2,
    achievements: [],
    totalGames: 0,
    gamesPlayed: {},
    streak: { count: 0, lastDate: '' },
    highScores: { game: 0, block: 0, type: 0, memory: 0, g2048: 0 },
    historyScores: { game: [], block: [], type: [], memory: [], g2048: [] },
    aiClicks: 0,
    quantumStart: null,
    quantumDone: false,
  };

  const Storage = {
    _cache: null,

    load() {
      if (this._cache) return this._cache;
      // 尝试读 v2
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { this._cache = JSON.parse(raw); return this._cache; } catch(e) {}
      }
      // 迁移 v1
      this._cache = this._migrate();
      this.save(this._cache);
      return this._cache;
    },

    _migrate() {
      const v1raw = localStorage.getItem(OLD_KEY);
      if (!v1raw) return JSON.parse(JSON.stringify(DEFAULT_V2));
      try {
        const v1 = JSON.parse(v1raw);
        const v2 = JSON.parse(JSON.stringify(DEFAULT_V2));
        v2.achievements = v1.achievements || [];
        v2.totalGames = v1.totalGames || 0;
        v2.gamesPlayed = v1.gamesPlayed || {};
        v2.streak.count = v1.streak || 0;
        v2.streak.lastDate = v1.lastVisitDate || '';
        return v2;
      } catch(e) {
        return JSON.parse(JSON.stringify(DEFAULT_V2));
      }
    },

    save(data) {
      this._cache = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    get() { return this.load(); },

    update(fn) {
      const data = this.load();
      fn(data);
      this.save(data);
    }
  };

  // 兼容旧接口
  function getStats() {
    const d = Storage.get();
    return {
      achievements: d.achievements,
      totalGames: d.totalGames,
      gamesPlayed: d.gamesPlayed,
      streak: d.streak.count,
      lastVisitDate: d.streak.lastDate,
    };
  }
  function saveStats() { /* v2 自动保存，此函数为空兼容 */ }

  /* ========================================================
   *  MoyuOS.ScreenShake — 屏幕震动 + 色差偏移
   * ======================================================== */
  const ScreenShake = {
    trigger(intensity, duration) {
      intensity = intensity || 8;
      duration = duration || 300;
      const el = document.querySelector(
        '.game-canvas-wrapper, .blk-canvas-wrap, .type-arena, .g2048-board, .mem-grid, .home-container'
      );
      if (!el) return;
      const start = Date.now();
      const shake = () => {
        const elapsed = Date.now() - start;
        if (elapsed > duration) {
          el.style.transform = '';
          el.style.filter = '';
          return;
        }
        const p = 1 - elapsed / duration;
        const x = (Math.random() - 0.5) * intensity * p;
        const y = (Math.random() - 0.5) * intensity * p;
        el.style.transform = `translate(${x}px, ${y}px)`;
        if (elapsed < 100) {
          el.style.filter = `drop-shadow(${x*0.5}px 0 0 rgba(255,0,0,0.4)) drop-shadow(-${x*0.5}px 0 0 rgba(0,100,255,0.4))`;
        } else {
          el.style.filter = '';
        }
        requestAnimationFrame(shake);
      };
      shake();
    }
  };
  function screenShake(i, d) { ScreenShake.trigger(i, d); }

  /* ========================================================
   *  MoyuOS.Achievements — 成就系统（全息弹窗 + 芯片徽章）
   * ======================================================== */
  const ACHIEVEMENT_DEFS = {
    first_game:    { icon: '🎮', title: '初次摸鱼', desc: '第一次打开游戏' },
    game_10:       { icon: '🐟', title: '摸鱼新手', desc: '累计玩游戏10局' },
    game_50:       { icon: '🏆', title: '摸鱼达人', desc: '累计玩游戏50局' },
    streak_3:      { icon: '🔥', title: '连续摸鱼3天', desc: '连续3天访问' },
    streak_7:      { icon: '💎', title: '摸鱼一周', desc: '连续7天访问' },
    block_clear:   { icon: '🧱', title: '砖块克星', desc: '打砖块通关' },
    block_perfect: { icon: '⭐', title: '完美通关', desc: '打砖块满血通关' },
    type_100:      { icon: '⌨', title: '键盘侠', desc: '打字大作战得分超过100' },
    type_200:      { icon: '🔥', title: '手速逆天', desc: '打字大作战得分超过200' },
    mem_hard:      { icon: '🧠', title: '记忆大师', desc: '记忆翻牌困难通关' },
    g2048_win:     { icon: '🎯', title: '2048达成', desc: '合成2048' },
    g2048_4096:    { icon: '👑', title: '超越极限', desc: '2048合成4096' },
    shooter_50:    { icon: '✈', title: '空中王牌', desc: '摸鱼大作战得分超过50' },
    pet_happy:     { icon: '🐱', title: '铲屎官', desc: '云养猫全部满状态' },
    all_games:     { icon: '🌟', title: '全都玩了', desc: '尝试过所有游戏' },
    konami:        { icon: '🕹', title: '秘籍大师', desc: '发现隐藏彩蛋' },
    turing:        { icon: '🤖', title: '图灵测试员', desc: '在AI助手面板连续点击10次' },
    overflow:      { icon: '⚡', title: '算力溢出', desc: '单局得分超过历史均值200%' },
    quantum:       { icon: '🌙', title: '量子摸鱼', desc: '凌晨2-4点访问并停留超10分钟' },
  };

  const Achievements = {
    defs: ACHIEVEMENT_DEFS,

    unlock(id) {
      const data = Storage.get();
      if (!data.achievements) data.achievements = [];
      if (data.achievements.includes(id)) return;
      data.achievements.push(id);
      Storage.save(data);
      this._showHolographic(id);
      if (global.MoyuOS && global.MoyuOS.NeuralBg && global.MoyuOS.NeuralBg.aggregateShape) {
        global.MoyuOS.NeuralBg.aggregateShape('🏆');
      }
    },

    isUnlocked(id) {
      return (Storage.get().achievements || []).includes(id);
    },

    _showHolographic(id) {
      const a = this.defs[id];
      if (!a) return;
      const overlay = document.createElement('div');
      overlay.className = 'holo-overlay';
      overlay.innerHTML = `
        <div class="holo-card">
          <div class="holo-scanline"></div>
          <div class="holo-badge">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <rect x="4" y="4" width="72" height="72" rx="8" fill="none" stroke="#00d4aa" stroke-width="1.5" opacity="0.6"/>
              <line x1="4" y1="25" x2="76" y2="25" stroke="#00d4aa" stroke-width="0.5" opacity="0.3"/>
              <line x1="4" y1="55" x2="76" y2="55" stroke="#00d4aa" stroke-width="0.5" opacity="0.3"/>
              <line x1="25" y1="4" x2="25" y2="76" stroke="#00d4aa" stroke-width="0.5" opacity="0.3"/>
              <line x1="55" y1="4" x2="55" y2="76" stroke="#00d4aa" stroke-width="0.5" opacity="0.3"/>
              <circle cx="25" cy="25" r="2" fill="#00d4aa" opacity="0.5"/>
              <circle cx="55" cy="25" r="2" fill="#00d4aa" opacity="0.5"/>
              <circle cx="25" cy="55" r="2" fill="#00d4aa" opacity="0.5"/>
              <circle cx="55" cy="55" r="2" fill="#00d4aa" opacity="0.5"/>
              <text x="40" y="46" text-anchor="middle" font-size="28">${a.icon}</text>
            </svg>
          </div>
          <div class="holo-label">[ AI 认证通过 ]</div>
          <div class="holo-title">${a.title}</div>
          <div class="holo-desc">${a.desc}</div>
        </div>
      `;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      setTimeout(() => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 500);
      }, 3000);
    },

    renderPanel(container) {
      const data = Storage.get();
      const unlocked = data.achievements || [];
      container.innerHTML = '';
      Object.entries(this.defs).forEach(([id, a]) => {
        const isUnlocked = unlocked.includes(id);
        const item = document.createElement('div');
        item.className = 'chip-badge' + (isUnlocked ? ' unlocked' : ' locked');
        item.innerHTML = `
          <svg viewBox="0 0 70 80" width="70" height="80">
            <rect x="2" y="2" width="66" height="76" rx="6"
              fill="${isUnlocked ? '#0d1b2a' : '#1a1a1a'}"
              stroke="${isUnlocked ? '#00d4aa' : '#333'}" stroke-width="1.5"/>
            ${isUnlocked ? `
              <line x1="2" y1="20" x2="68" y2="20" stroke="#00d4aa" stroke-width="0.4" opacity="0.4"/>
              <line x1="2" y1="60" x2="68" y2="60" stroke="#00d4aa" stroke-width="0.4" opacity="0.4"/>
              <circle cx="15" cy="20" r="1.5" fill="#00d4aa" opacity="0.6"/>
              <circle cx="55" cy="20" r="1.5" fill="#00d4aa" opacity="0.6"/>
              <circle cx="15" cy="60" r="1.5" fill="#00d4aa" opacity="0.6"/>
              <circle cx="55" cy="60" r="1.5" fill="#00d4aa" opacity="0.6"/>
            ` : ''}
            <text x="35" y="44" text-anchor="middle" font-size="22"
              ${isUnlocked ? '' : 'opacity="0.2"'}>${isUnlocked ? a.icon : '🔒'}</text>
            ${isUnlocked ? '<circle cx="35" cy="40" r="18" fill="none" stroke="#00d4aa" stroke-width="0.5" opacity="0.3" class="chip-glow"/>' : ''}
          </svg>
          <div class="chip-title">${isUnlocked ? a.title : '???'}</div>
          <div class="chip-desc">${a.desc}</div>
        `;
        container.appendChild(item);
      });
    }
  };

  function unlockAchievement(id) { Achievements.unlock(id); }

  /* ========================================================
   *  MoyuOS.ScoreTracker — 分数追踪 + 算力溢出检测
   * ======================================================== */
  const ScoreTracker = {
    report(gameName, score) {
      Storage.update(data => {
        if (!data.highScores) data.highScores = {};
        if (!data.historyScores) data.historyScores = {};
        if (!data.historyScores[gameName]) data.historyScores[gameName] = [];

        const hist = data.historyScores[gameName];
        if (hist.length > 0) {
          const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
          if (score > avg * 2) {
            Achievements.unlock('overflow');
          }
        }
        hist.push(score);
        if (hist.length > 50) hist.shift(); // 保留最近50局

        if (!data.highScores[gameName] || score > data.highScores[gameName]) {
          data.highScores[gameName] = score;
        }
      });
    }
  };

  function reportScore(game, score) { ScoreTracker.report(game, score); }

  /* ========================================================
   *  MoyuOS.Streak — 连续签到
   * ======================================================== */
  const Streak = {
    update() {
      Storage.update(data => {
        const today = new Date().toDateString();
        const last = data.streak.lastDate;
        if (last === today) return;
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (last === yesterday) {
          data.streak.count = (data.streak.count || 0) + 1;
        } else if (last !== today) {
          data.streak.count = 1;
        }
        data.streak.lastDate = today;
        if (data.streak.count >= 3) Achievements.unlock('streak_3');
        if (data.streak.count >= 7) Achievements.unlock('streak_7');
      });
    },

    get() {
      return Storage.get().streak.count || 0;
    }
  };

  /* ========================================================
   *  MoyuOS.Quantum — 量子摸鱼检测（凌晨2-4点）
   * ======================================================== */
  const Quantum = {
    _timer: null,

    start() {
      const hour = new Date().getHours();
      if (hour < 2 || hour >= 4) return;
      const data = Storage.get();
      if (data.quantumDone) return;
      if (!data.quantumStart) {
        Storage.update(d => { d.quantumStart = Date.now(); });
      }
      this._timer = setInterval(() => this._check(), 30000);
    },

    _check() {
      const data = Storage.get();
      if (!data.quantumStart || data.quantumDone) {
        clearInterval(this._timer);
        return;
      }
      const elapsed = Date.now() - data.quantumStart;
      if (elapsed >= 600000) { // 10 分钟
        Achievements.unlock('quantum');
        Storage.update(d => { d.quantumDone = true; });
        clearInterval(this._timer);
      }
    }
  };

  /* ========================================================
   *  MoyuOS.BossKey — 老板键 2.0：AI 数据分析看板
   * ======================================================== */
  const BossKey = {
    _active: false,
    _el: null,
    _chartAnim: null,

    _hashSeed() {
      const d = new Date();
      return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate() + d.getHours();
    },

    _pseudoRandom(seed) {
      let s = seed;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s & 0x7fffffff) / 2147483647;
      };
    },

    _generateData() {
      const rng = this._pseudoRandom(this._hashSeed());
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const chartData = months.map(() => Math.floor(rng() * 80 + 20));
      const kpis = {
        gpu: (rng() * 40 + 60).toFixed(1),
        tokens: Math.floor(rng() * 500 + 200),
        accuracy: (rng() * 5 + 94).toFixed(2),
        latency: Math.floor(rng() * 30 + 10),
      };
      const progress = Math.floor(rng() * 60 + 30);
      return { months, chartData, kpis, progress };
    },

    _drawChart(canvas, data) {
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      let progress = 0;

      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        const pad = { l: 40, r: 20, t: 20, b: 30 };
        const cw = W - pad.l - pad.r;
        const ch = H - pad.t - pad.b;

        // 网格线
        ctx.strokeStyle = 'rgba(0, 212, 170, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
          const y = pad.t + (ch / 5) * i;
          ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        }

        // 数据折线
        const pts = data.chartData;
        const step = cw / (pts.length - 1);
        const maxVal = 100;
        const visibleCount = Math.min(pts.length, Math.floor(progress));

        ctx.strokeStyle = '#00d4aa';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00d4aa';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (let i = 0; i < visibleCount; i++) {
          const x = pad.l + step * i;
          const y = pad.t + ch - (pts[i] / maxVal) * ch;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 数据点
        for (let i = 0; i < visibleCount; i++) {
          const x = pad.l + step * i;
          const y = pad.t + ch - (pts[i] / maxVal) * ch;
          ctx.fillStyle = '#00d4aa';
          ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        }

        // X 轴标签
        ctx.fillStyle = 'rgba(0, 212, 170, 0.5)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        data.months.forEach((m, i) => {
          ctx.fillText(m, pad.l + step * i, H - 8);
        });

        // Y 轴标签
        ctx.textAlign = 'right';
        for (let i = 0; i <= 5; i++) {
          const val = (maxVal / 5) * (5 - i);
          ctx.fillText(val.toFixed(0), pad.l - 8, pad.t + (ch / 5) * i + 4);
        }

        if (progress < pts.length) {
          progress += 0.3;
          this._chartAnim = requestAnimationFrame(draw);
        }
      };
      draw();
    },

    toggle() {
      if (this._active) {
        this._deactivate();
      } else {
        this._activate();
      }
    },

    _activate() {
      if (this._chartAnim) cancelAnimationFrame(this._chartAnim);
      const d = this._generateData();
      const el = document.createElement('div');
      el.className = 'boss2-screen';
      el.innerHTML = `
        <div class="boss2-header">
          <span class="boss2-logo">◈</span>
          <span class="boss2-title">MoyuOS AI Analytics — Q${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()} 算力调度报告</span>
          <span class="boss2-time" id="boss2Time"></span>
        </div>
        <div class="boss2-body">
          <div class="boss2-kpis">
            <div class="boss2-kpi">
              <div class="boss2-kpi-label">GPU 利用率</div>
              <div class="boss2-kpi-val" id="b2gpu">${d.kpis.gpu}%</div>
            </div>
            <div class="boss2-kpi">
              <div class="boss2-kpi-label">Token 吞吐 (K/s)</div>
              <div class="boss2-kpi-val" id="b2tokens">${d.kpis.tokens}</div>
            </div>
            <div class="boss2-kpi">
              <div class="boss2-kpi-label">模型准确率</div>
              <div class="boss2-kpi-val" id="b2acc">${d.kpis.accuracy}%</div>
            </div>
            <div class="boss2-kpi">
              <div class="boss2-kpi-label">推理延迟 (ms)</div>
              <div class="boss2-kpi-val" id="b2lat">${d.kpis.latency}</div>
            </div>
          </div>
          <div class="boss2-chart-wrap">
            <div class="boss2-chart-title">▸ 月度 AI 算力消耗趋势 (TFLOPs)</div>
            <canvas id="boss2Chart" width="520" height="200"></canvas>
          </div>
          <div class="boss2-progress-wrap">
            <div class="boss2-progress-label">模型训练进度 — GPT-Moyu v3.14</div>
            <div class="boss2-progress-bar">
              <div class="boss2-progress-fill" id="b2prog" style="width:0%"></div>
            </div>
            <div class="boss2-progress-val" id="b2progVal">0%</div>
          </div>
          <div class="boss2-table-wrap">
            <table class="boss2-table">
              <tr><th>任务ID</th><th>模型</th><th>状态</th><th>耗时</th><th>GPU节点</th></tr>
              <tr><td>T-${Math.floor(Math.random()*9000+1000)}</td><td>GPT-Moyu-7B</td><td style="color:#00d4aa">运行中</td><td>${Math.floor(Math.random()*50+10)}min</td><td>node-${Math.floor(Math.random()*8+1)}</td></tr>
              <tr><td>T-${Math.floor(Math.random()*9000+1000)}</td><td>LLaMA-Slacker</td><td style="color:#ffd43b">队列中</td><td>—</td><td>node-${Math.floor(Math.random()*8+1)}</td></tr>
              <tr><td>T-${Math.floor(Math.random()*9000+1000)}</td><td>Claude-Fish-4</td><td style="color:#00d4aa">运行中</td><td>${Math.floor(Math.random()*120+30)}min</td><td>node-${Math.floor(Math.random()*8+1)}</td></tr>
              <tr><td>T-${Math.floor(Math.random()*9000+1000)}</td><td>DeepSeek-Idle</td><td style="color:#888">已完成</td><td>${Math.floor(Math.random()*200+60)}min</td><td>node-${Math.floor(Math.random()*8+1)}</td></tr>
            </table>
          </div>
        </div>
      `;
      document.body.appendChild(el);
      this._el = el;
      this._active = true;

      requestAnimationFrame(() => el.classList.add('show'));

      // 图表动画
      setTimeout(() => {
        const chart = document.getElementById('boss2Chart');
        if (chart) this._drawChart(chart, d);
      }, 400);

      // 进度条动画
      setTimeout(() => {
        const prog = document.getElementById('b2prog');
        const progVal = document.getElementById('b2progVal');
        if (prog) {
          prog.style.width = d.progress + '%';
          progVal.textContent = d.progress + '%';
        }
      }, 500);

      // 时间更新
      this._timeInterval = setInterval(() => {
        const t = document.getElementById('boss2Time');
        if (t) t.textContent = new Date().toLocaleTimeString();
      }, 1000);
      const t = document.getElementById('boss2Time');
      if (t) t.textContent = new Date().toLocaleTimeString();

      // KPI 数字跳动
      this._kpiInterval = setInterval(() => {
        const rng = this._pseudoRandom(Date.now());
        const gpu = document.getElementById('b2gpu');
        const tok = document.getElementById('b2tokens');
        const lat = document.getElementById('b2lat');
        if (gpu) gpu.textContent = (parseFloat(d.kpis.gpu) + (rng() - 0.5) * 2).toFixed(1) + '%';
        if (tok) tok.textContent = Math.floor(parseFloat(d.kpis.tokens) + (rng() - 0.5) * 20);
        if (lat) lat.textContent = Math.floor(parseFloat(d.kpis.latency) + (rng() - 0.5) * 4);
      }, 2000);

      // 防穿帮
      this._contextHandler = (e) => e.preventDefault();
      document.addEventListener('contextmenu', this._contextHandler);
    },

    _deactivate() {
      if (this._chartAnim) cancelAnimationFrame(this._chartAnim);
      if (this._timeInterval) clearInterval(this._timeInterval);
      if (this._kpiInterval) clearInterval(this._kpiInterval);
      document.removeEventListener('contextmenu', this._contextHandler);
      if (this._el) {
        this._el.classList.add('glitch-out');
        setTimeout(() => {
          this._el.remove();
          this._el = null;
        }, 300);
      }
      this._active = false;
    },

    isActive() { return this._active; }
  };

  // Boss Key 双击ESC
  let lastEsc = 0;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - lastEsc < 400) {
        e.preventDefault();
        BossKey.toggle();
      }
      lastEsc = now;
    }
    // F12 在伪装模式下震动警告
    if (e.key === 'F12' && (BossKey.isActive() || ExcelBoss.isActive())) {
      e.preventDefault();
      if (navigator.vibrate) navigator.vibrate(200);
      ScreenShake.trigger(12, 400);
    }
    // Alt+E — Excel 伪装表格（用 e.code 判断物理按键：macOS 上 Option+E 是重音死键，e.key 会变成 'Dead'）
    // !e.ctrlKey：排除欧洲键盘 AltGr(=Ctrl+Alt) 误触发，如 AltGr+E 在部分布局是 €
    if (e.altKey && !e.ctrlKey && e.code === 'KeyE') {
      e.preventDefault();
      ExcelBoss.toggle();
    }
    // 两种伪装模式下按 Esc 关闭
    if (e.key === 'Escape') {
      if (ExcelBoss.isActive()) ExcelBoss.toggle();
    }
  });

  /* ========================================================
   *  MoyuOS.ExcelBoss — 老板键 B：Excel 工作表伪装
   *  触发：Alt+E
   * ======================================================== */
  const ExcelBoss = {
    _active: false,
    _el: null,
    _selCell: null,
    _data: {},

    _seedData() {
      const cols = ['A','B','C','D','E','F','G','H'];
      const headers = ['会计科目','本月发生额','上月发生额','本年累计','年度预算','预算完成率','同比增减','备注'];
      const rows = [
        ['一、营业收入','2,850,000','2,610,000','13,200,000','14,000,000','94.3%','+9.2%','达标'],
        ['　主营业务收入','2,720,000','2,480,000','12,500,000','13,200,000','94.7%','+9.7%',''],
        ['　其他业务收入','130,000','130,000','700,000','800,000','87.5%','+3.1%',''],
        ['二、营业成本','1,680,000','1,560,000','7,800,000','8,200,000','95.1%','+7.7%','原料上涨'],
        ['三、税金及附加','85,000','78,000','395,000','420,000','94.0%','+9.0%',''],
        ['四、销售费用','220,000','205,000','1,050,000','1,150,000','91.3%','+7.3%',''],
        ['五、管理费用','310,000','298,000','1,480,000','1,560,000','94.9%','+4.0%',''],
        ['六、研发费用','180,000','165,000','820,000','900,000','91.1%','+9.1%','加大投入'],
        ['七、财务费用','45,000','48,000','268,000','300,000','89.3%','-6.3%','利息下降'],
        ['八、营业利润','330,000','258,000','1,387,000','1,470,000','94.4%','+27.9%',''],
        ['九、营业外收入','25,000','12,000','98,000','100,000','98.0%','+108.3%','政府补贴'],
        ['十、营业外支出','12,000','8,000','45,000','60,000','75.0%','+50.0%',''],
        ['十一、利润总额','343,000','262,000','1,440,000','1,510,000','95.4%','+30.9%',''],
        ['十二、所得税费用','85,750','65,500','360,000','377,500','95.4%','+30.9%','税率25%'],
        ['十三、净利润','257,250','196,500','1,080,000','1,132,500','95.4%','+30.9%','环比+30.9%'],
      ];
      const d = {};
      headers.forEach((h, i) => { d[cols[i] + '1'] = h; });
      rows.forEach((row, r) => {
        row.forEach((cell, c) => { d[cols[c] + (r + 2)] = cell; });
      });
      return { cols, headers, rows, data: d };
    },

    toggle() {
      if (this._active) this._deactivate();
      else this._activate();
    },

    _activate() {
      const seed = this._seedData();
      this._data = seed.data;

      const el = document.createElement('div');
      el.className = 'excel-screen';

      const formulaBar = `
        <div class="excel-formula">
          <div class="excel-formula-cell" id="excelCellRef">A1</div>
          <span class="excel-formula-fx">fx</span>
          <input class="excel-formula-input" id="excelFormulaInput" value="">
        </div>`;

      let gridHTML = '<table class="excel-grid"><thead><tr><th class="excel-rowhead"></th>';
      seed.cols.forEach(c => { gridHTML += `<th class="excel-colhead">${c}</th>`; });
      gridHTML += '</tr></thead><tbody>';

      for (let r = 1; r <= 16; r++) {
        gridHTML += `<tr><td class="excel-rowhead">${r}</td>`;
        seed.cols.forEach(c => {
          const key = c + r;
          const val = seed.data[key] || '';
          const cls = val ? '' : 'excel-empty';
          gridHTML += `<td class="excel-cell ${cls}" data-key="${key}">${this._esc(val)}</td>`;
        });
        gridHTML += '</tr>';
      }
      gridHTML += '</tbody></table>';

      el.innerHTML = `
        <div class="excel-titlebar">
          <span class="excel-icon">📊</span>
          <span class="excel-title-text">月度财务结算表_2026.05.xlsx - Excel</span>
          <div class="excel-titlebar-btns">
            <span class="excel-btn-min">—</span>
            <span class="excel-btn-max">☐</span>
            <span class="excel-btn-close" id="excelClose">✕</span>
          </div>
        </div>
        <div class="excel-ribbon">
          <div class="excel-tabs">
            <span class="excel-tab active">开始</span>
            <span class="excel-tab">插入</span>
            <span class="excel-tab">页面布局</span>
            <span class="excel-tab">公式</span>
            <span class="excel-tab">数据</span>
            <span class="excel-tab">审阅</span>
            <span class="excel-tab">视图</span>
          </div>
          <div class="excel-toolbar">
            <button class="excel-tool">B</button>
            <button class="excel-tool" style="font-style:italic">I</button>
            <button class="excel-tool" style="text-decoration:underline">U</button>
            <span class="excel-tool-sep"></span>
            <select class="excel-tool-select"><option>微软雅黑</option><option>Arial</option></select>
            <select class="excel-tool-select sm"><option>11</option><option>12</option><option>14</option></select>
            <span class="excel-tool-sep"></span>
            <button class="excel-tool">🎨</button>
            <button class="excel-tool">📋</button>
            <button class="excel-tool">Σ</button>
            <button class="excel-tool">📊</button>
          </div>
        </div>
        ${formulaBar}
        <div class="excel-grid-wrap">${gridHTML}</div>
        <div class="excel-statusbar">
          <span>就绪</span>
          <span class="excel-status-right">Sheet1</span>
          <span class="excel-status-right">平均值: ¥618,200</span>
          <span class="excel-status-right">计数: 15</span>
          <span class="excel-status-right">求和: ¥9,273,000</span>
        </div>
      `;

      document.body.appendChild(el);
      this._el = el;
      this._active = true;
      requestAnimationFrame(() => el.classList.add('show'));

      // 关闭按钮
      const closeBtn = document.getElementById('excelClose');
      if (closeBtn) closeBtn.onclick = () => this._deactivate();

      // 单元格点击
      el.querySelectorAll('.excel-cell').forEach(cell => {
        cell.addEventListener('click', () => this._selectCell(cell));
        cell.addEventListener('dblclick', () => this._editCell(cell));
      });

      // 公式栏输入
      const input = document.getElementById('excelFormulaInput');
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && this._selCell) {
            const key = this._selCell.dataset.key;
            this._data[key] = input.value;
            this._selCell.textContent = input.value;
            input.blur();
          }
        });
      }

      // 阻止右键菜单
      this._ctxHandler = (e) => e.preventDefault();
      document.addEventListener('contextmenu', this._ctxHandler);
    },

    _esc(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },

    _selectCell(cell) {
      if (this._selCell) this._selCell.classList.remove('selected');
      cell.classList.add('selected');
      this._selCell = cell;
      const ref = document.getElementById('excelCellRef');
      const input = document.getElementById('excelFormulaInput');
      if (ref) ref.textContent = cell.dataset.key;
      if (input) input.value = cell.textContent;
    },

    _editCell(cell) {
      this._selectCell(cell);
      const input = document.getElementById('excelFormulaInput');
      if (input) { input.focus(); input.select(); }
    },

    _deactivate() {
      document.removeEventListener('contextmenu', this._ctxHandler);
      if (this._el) {
        this._el.classList.add('excel-hide');
        setTimeout(() => { this._el.remove(); this._el = null; }, 200);
      }
      this._active = false;
    },

    isActive() { return this._active; }
  };

  /* ========================================================
   *  MoyuOS.Konami — Konami 秘籍（升级版）
   * ======================================================== */
  const Konami = {
    code: ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'],
    pos: 0,

    init() {
      document.addEventListener('keydown', (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (key === this.code[this.pos]) {
          this.pos++;
          if (this.pos === this.code.length) {
            this.pos = 0;
            this.trigger();
          }
        } else {
          this.pos = 0;
        }
      });
    },

    trigger() {
      Achievements.unlock('konami');
      launchConfetti();
      // 通知粒子系统变金色
      if (global.MoyuOS.NeuralBg && global.MoyuOS.NeuralBg.setGoldMode) {
        global.MoyuOS.NeuralBg.setGoldMode(true);
        setTimeout(() => global.MoyuOS.NeuralBg.setGoldMode(false), 10000);
      }
      // 通知 AI 助手弹出消息
      if (global.MoyuOS.AiAssistant && global.MoyuOS.AiAssistant.showAuto) {
        global.MoyuOS.AiAssistant.showAuto('[协议激活] 隐藏开发者协议已激活 🕹 所有算力已解锁', 10000);
      }
    }
  };

  /* ========================================================
   *  Confetti — 全屏烟花
   * ======================================================== */
  function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const particles = [];
    const emojis = ['🎉','🎊','✨','⭐','🌟','💫','🎆','🎇','🐟','✈','🧱','⌨','🃏'];
    const colors = ['#ff6b6b','#ffd43b','#51cf66','#2563eb','#e91e63','#ff9800','#9c27b0','#00d4aa'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        size: Math.random() * 12 + 8,
        type: Math.random() > 0.5 ? 'emoji' : 'rect',
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }

    let frame = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rotation += p.rotSpeed; p.vx *= 0.99;
        if (p.y > canvas.height + 50) p.life -= 0.02;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.min(1, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          if (p.type === 'emoji') {
            ctx.font = p.size + 'px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.emoji, 0, 0);
          } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
          }
          ctx.restore();
        }
      });
      frame++;
      if (alive && frame < 300) requestAnimationFrame(animate);
      else canvas.remove();
    }
    animate();
  }

  /* ========================================================
   *  游戏计数 + 追踪（兼容层）
   * ======================================================== */
  function incrementGameCount() {
    Storage.update(data => {
      data.totalGames = (data.totalGames || 0) + 1;
      if (data.totalGames >= 1) Achievements.unlock('first_game');
      if (data.totalGames >= 10) Achievements.unlock('game_10');
      if (data.totalGames >= 50) Achievements.unlock('game_50');
    });
  }

  function trackGamePlayed(name) {
    Storage.update(data => {
      if (!data.gamesPlayed) data.gamesPlayed = {};
      data.gamesPlayed[name] = true;
      const allGames = ['game','block','type','memory','2048','pet','gallery'];
      if (allGames.every(g => data.gamesPlayed[g])) {
        Achievements.unlock('all_games');
      }
    });
  }

  /* ========================================================
   *  初始化
   * ======================================================== */
  function getCurrentGame() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path.replace('.html', '');
  }

  function init() {
    Storage.load();
    Streak.update();
    Konami.init();
    Quantum.start();
    trackGamePlayed(getCurrentGame());
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ========================================================
   *  暴露 MoyuOS 命名空间 + 兼容函数
   * ======================================================== */
  global.MoyuOS = {
    Storage,
    Achievements,
    BossKey,
    ExcelBoss,
    Konami,
    Streak,
    Quantum,
    ScreenShake,
    ScoreTracker,
    launchConfetti,
  };

  // 向后兼容的全局函数
  global.getStats = getStats;
  global.saveStats = saveStats;
  global.unlockAchievement = unlockAchievement;
  global.incrementGameCount = incrementGameCount;
  global.trackGamePlayed = trackGamePlayed;
  global.screenShake = screenShake;
  global.reportScore = reportScore;
  global.ACHIEVEMENTS = ACHIEVEMENT_DEFS;

})(window);
