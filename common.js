/* === Achievements === */
const ACHIEVEMENTS = {
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
};

function getStats() {
  return JSON.parse(localStorage.getItem('moyu_stats') || '{}');
}

function saveStats(s) {
  localStorage.setItem('moyu_stats', JSON.stringify(s));
}

function unlockAchievement(id) {
  const stats = getStats();
  if (!stats.achievements) stats.achievements = [];
  if (stats.achievements.includes(id)) return;
  stats.achievements.push(id);
  saveStats(stats);
  showAchievementToast(id);
}

function showAchievementToast(id) {
  const a = ACHIEVEMENTS[id];
  if (!a) return;
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <span class="achievement-icon">${a.icon}</span>
    <div class="achievement-info">
      <div class="achievement-label">成就解锁！</div>
      <div class="achievement-title">${a.title}</div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function incrementGameCount() {
  const stats = getStats();
  stats.totalGames = (stats.totalGames || 0) + 1;
  if (!stats.gamesPlayed) stats.gamesPlayed = {};
  saveStats(stats);

  unlockAchievement('first_game');
  if (stats.totalGames >= 10) unlockAchievement('game_10');
  if (stats.totalGames >= 50) unlockAchievement('game_50');
}

function trackGamePlayed(gameName) {
  const stats = getStats();
  if (!stats.gamesPlayed) stats.gamesPlayed = {};
  stats.gamesPlayed[gameName] = true;
  saveStats(stats);
  const allGames = ['game','block','type','memory','2048','pet','gallery'];
  if (allGames.every(g => stats.gamesPlayed[g])) unlockAchievement('all_games');
}

/* === Streak Tracking === */
function updateStreak() {
  const stats = getStats();
  const today = new Date().toDateString();
  const lastVisit = stats.lastVisitDate;

  if (lastVisit === today) return;

  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastVisit === yesterday) {
    stats.streak = (stats.streak || 0) + 1;
  } else {
    stats.streak = 1;
  }
  stats.lastVisitDate = today;
  saveStats(stats);

  if (stats.streak >= 3) unlockAchievement('streak_3');
  if (stats.streak >= 7) unlockAchievement('streak_7');
}

/* === Boss Key === */
function initBossKey() {
  let bossActive = false;
  let bossEl = null;

  const fakeData = [
    ['项目', 'Q1 完成度', 'Q2 目标', '状态', '负责人', '备注'],
    ['用户增长', '112%', '150万DAU', '进行中', '董家才子', '按计划推进'],
    ['营收指标', '98%', '2.3亿', '进行中', '董家才子', '略低于预期，已调整策略'],
    ['新功能上线', '100%', '5个核心功能', '已完成', '董家才子', '全部按时交付'],
    ['客户满意度', '4.6/5', '4.8/5', '进行中', '董家才子', '持续优化中'],
    ['技术升级', '85%', '微服务迁移', '进行中', '董家才子', 'Phase 2 启动'],
    ['市场拓展', '107%', '3个新城市', '超额完成', '董家才子', '已签约4个城市'],
    ['团队培训', '100%', '12场', '已完成', '董家才子', '全员通过考核'],
    ['数据合规', '95%', 'ISO认证', '进行中', '董家才子', '审计中'],
    ['成本优化', '110%', '降本15%', '超额完成', '董家才子', '实际降本18%'],
    ['品牌建设', '92%', 'NPS 60+', '进行中', '董家才子', '当前NPS 58'],
    ['', '', '', '', '', ''],
    ['周报摘要：本周各项KPI稳步推进，用户增长超额完成，市场拓展签约4城，', '', '', '', '', ''],
    ['技术侧微服务迁移进入Phase 2。下周重点：客户满意度提升方案落地。', '', '', '', '', ''],
  ];

  function createBossScreen() {
    const el = document.createElement('div');
    el.className = 'boss-screen';
    el.innerHTML = `
      <div class="boss-titlebar">
        <span class="boss-logo">📊</span>
        <span class="boss-filename">2026年度工作总结 - Excel</span>
        <span class="boss-window-btns">
          <span class="boss-btn">─</span>
          <span class="boss-btn">□</span>
          <span class="boss-btn">✕</span>
        </span>
      </div>
      <div class="boss-toolbar">
        <span>文件</span><span>开始</span><span>插入</span><span>页面布局</span>
        <span>公式</span><span>数据</span><span>审阅</span><span>视图</span>
      </div>
      <div class="boss-formula-bar">
        <span class="boss-cell-ref">A1</span>
        <span class="boss-formula">=SUM(B2:B11)</span>
      </div>
      <div class="boss-sheet">
        <table class="boss-table">
          ${fakeData.map((row, ri) => `
            <tr>
              <td class="boss-row-num">${ri + 1}</td>
              ${row.map((cell, ci) => `<td class="${ri === 0 ? 'boss-header-cell' : ''}">${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </table>
      </div>
      <div class="boss-statusbar">
        <span>就绪</span>
        <span>平均值: 101.2 计数: 10 求和: 1012</span>
      </div>
    `;
    return el;
  }

  function toggleBoss() {
    if (bossActive && bossEl) {
      bossEl.classList.add('slide-out');
      setTimeout(() => { bossEl.remove(); bossEl = null; }, 300);
      bossActive = false;
    } else {
      bossEl = createBossScreen();
      document.body.appendChild(bossEl);
      requestAnimationFrame(() => bossEl.classList.add('show'));
      bossActive = true;
    }
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.querySelector('.lightbox.show') && !document.querySelector('.mem-overlay:not(.hidden)') && !document.querySelector('.g2048-overlay:not(.hidden)') && !document.querySelector('.blk-overlay:not(.hidden)')) {
      // Only trigger boss key if not closing an in-game overlay
      if (e.shiftKey || bossActive) {
        toggleBoss();
      }
    }
  });

  // Double-tap ESC for boss key
  let lastEsc = 0;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - lastEsc < 400) {
        toggleBoss();
        e.preventDefault();
      }
      lastEsc = now;
    }
  });
}

/* === Konami Code === */
function initKonami() {
  const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let pos = 0;

  document.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === code[pos]) {
      pos++;
      if (pos === code.length) {
        pos = 0;
        triggerKonami();
      }
    } else {
      pos = 0;
    }
  });
}

function triggerKonami() {
  unlockAchievement('konami');
  launchConfetti();
}

function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const particles = [];
  const emojis = ['🎉','🎊','✨','⭐','🌟','💫','🎆','🎇','🐟','✈','🧱','⌨','🃏'];
  const colors = ['#ff6b6b','#ffd43b','#51cf66','#2563eb','#e91e63','#ff9800','#9c27b0'];

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
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.rotSpeed;
      p.vx *= 0.99;

      if (p.y > canvas.height + 50) {
        p.life -= 0.02;
      }

      if (p.life > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation * Math.PI / 180);

        if (p.type === 'emoji') {
          ctx.font = p.size + 'px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
    });

    frame++;
    if (alive && frame < 300) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  animate();
}

/* === Screen Shake === */
function screenShake(intensity = 8, duration = 300) {
  const el = document.querySelector('.game-canvas-wrapper, .blk-canvas-wrap, .type-arena, .g2048-board, .mem-grid');
  if (!el) return;

  const startTime = Date.now();
  function shake() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      el.style.transform = '';
      return;
    }
    const progress = 1 - elapsed / duration;
    const x = (Math.random() - 0.5) * intensity * progress;
    const y = (Math.random() - 0.5) * intensity * progress;
    el.style.transform = `translate(${x}px, ${y}px)`;
    requestAnimationFrame(shake);
  }
  shake();
}

/* === Init === */
document.addEventListener('DOMContentLoaded', () => {
  initBossKey();
  initKonami();
  updateStreak();
  trackGamePlayed(getCurrentGame());
});

function getCurrentGame() {
  const path = location.pathname.split('/').pop() || 'index.html';
  return path.replace('.html', '');
}
