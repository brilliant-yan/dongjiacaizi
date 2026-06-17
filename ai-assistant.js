/**
 * MoyuOS.AiAssistant — AI 摸鱼助手
 * - 可拖拽悬浮气泡（👾）
 * - 点击展开对话面板，20+ 条 AI 语录
 * - 打字机逐字输出 + Web Audio 机械音效
 * - 每 5 分钟自动弹出轻量提示
 * - 连续点击 10 次解锁「图灵测试员」成就
 */
;(function(global) {
  'use strict';

  const MoyuOS = global.MoyuOS = global.MoyuOS || {};

  // ===== 语录库 =====
  const QUOTES = [
    '检测到您的专注力已降至 {focus}%，建议立即启动 2048 进行认知校准',
    '根据大数据分析，您距离下次被老板发现还有 {safety}% 的安全窗口期',
    'AI 建议：当前摸鱼效率指数为 {eff}，建议切换至打字大作战提升手速',
    '警告：您的代码编译速度已超越摸鱼速度，请立即减速',
    '量子计算表明：您同时处于工作和摸鱼的叠加态 🌙',
    '系统检测到咖啡因浓度不足，建议补充后再继续摸鱼 ☕',
    '今日摸鱼进度：{progress}%，距离完美下班还差一点点',
    'AI 分析：您当前的心率与玩打砖块时高度吻合 🧱',
    '建议执行「战略性厕所时间」以重置老板注意力检测器',
    '检测到老板正在 3 楼开会，安全等级提升至 {safety}% ✨',
    '您的摸鱼姿势已被 AI 评定为「教科书级别」📖',
    '深度学习模型预测：今天适合摸鱼，准确率 99.7%',
    'AI 提醒：距离下班还有 {countdown}，请保持冷静',
    '已为您生成今日摸鱼报告：表现优异，建议加薪',
    '神经网络分析：您的键盘敲击节奏暴露了您在玩打字游戏 ⌨',
    '当前 GPU 负载 0%，建议运行一局摸鱼大作战充分利用算力',
    '检测到您的浏览器标签页数量异常，疑似在工作 🚨',
    'AI 摸鱼助手在线时长已超过您今天的实际工作时长',
    '根据博弈论，现在是最优摸鱼时间窗口',
    '您的摸鱼频率与服务器 CPU 温度呈正相关，请适当降温',
    '系统日志：用户「董家才子」今日第 {n} 次打开摸鱼终端',
    'AI 评估：您的云养猫技术已达专家级，建议转行兽医 🐱',
    '检测到您的表情包使用量已超过工作消息量 300%',
    '建议打开记忆翻牌训练大脑，这可能是你今天唯一有用的活动',
    '摸鱼终端 v2.0 已就绪，所有系统运转正常，除了你的工作态度',
  ];

  // ===== Web Audio 音效 =====
  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) { return null; }
    }
    return audioCtx;
  }

  function playTypeBeep() {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 600 + Math.random() * 600;
    gain.gain.value = 0.015;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  // ===== 辅助函数 =====
  function interpolateQuote(quote) {
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    let countdownStr;
    if (hour >= 18 || hour < 9 || now.getDay() === 0 || now.getDay() === 6) {
      countdownStr = '已下班';
    } else {
      const left = (18 - hour - 1) + 'h' + (60 - min) + 'm';
      countdownStr = left;
    }
    const stats = global.MoyuOS.Storage.get();
    return quote
      .replace('{focus}', Math.floor(Math.random() * 20 + 5))
      .replace('{safety}', Math.floor(Math.random() * 30 + 65))
      .replace('{eff}', (Math.random() * 2 + 1.5).toFixed(1))
      .replace('{progress}', Math.min(100, Math.floor((hour * 60 + min) / (18 * 60) * 100)))
      .replace('{countdown}', countdownStr)
      .replace('{n}', stats.totalGames || 1);
  }

  function getRandomQuote() {
    return interpolateQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }

  // ===== 拖拽逻辑 =====
  function makeDraggable(el, handle) {
    let isDragging = false;
    let startX, startY, origX, origY;

    function onStart(e) {
      const touch = e.touches ? e.touches[0] : e;
      isDragging = false;
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = el.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;

      function onMove(ev) {
        const t = ev.touches ? ev.touches[0] : ev;
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isDragging = true;
          el.style.right = 'auto';
          el.style.bottom = 'auto';
          el.style.left = (origX + dx) + 'px';
          el.style.top = (origY + dy) + 'px';
        }
      }
      function onEnd() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend', onEnd);
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: true });

    return {
      wasDragged() { return isDragging; }
    };
  }

  // ===== AI 助手模块 =====
  const AiAssistant = {
    bubble: null,
    panel: null,
    panelOpen: false,
    clickCount: 0,
    autoTimer: null,
    autoPopup: null,
    typingTimer: null,
    dragTracker: null,

    init() {
      this._createBubble();
      this._createPanel();
      this._startAutoPopup();
    },

    _createBubble() {
      this.bubble = document.createElement('div');
      this.bubble.className = 'ai-bubble';
      this.bubble.innerHTML = '<span class="ai-bubble-icon">👾</span>';
      document.body.appendChild(this.bubble);

      this.dragTracker = makeDraggable(this.bubble, this.bubble);

      this.bubble.addEventListener('click', () => {
        if (this.dragTracker.wasDragged()) return;
        this._togglePanel();
      });
    },

    _createPanel() {
      this.panel = document.createElement('div');
      this.panel.className = 'ai-panel';
      this.panel.innerHTML = `
        <div class="ai-panel-header">
          <span class="ai-panel-title">🤖 MoyuOS AI 助手</span>
          <button class="ai-panel-close">✕</button>
        </div>
        <div class="ai-panel-body" id="aiPanelBody">
          <div class="ai-msg ai-msg-system">[系统] AI 摸鱼助手已就绪，随时为您服务。</div>
        </div>
        <div class="ai-panel-footer">
          <button class="ai-panel-btn" id="aiAskBtn">🎲 问 AI 一个问题</button>
        </div>
      `;
      document.body.appendChild(this.panel);

      this.panel.querySelector('.ai-panel-close').addEventListener('click', () => {
        this._togglePanel(false);
      });

      document.getElementById('aiAskBtn').addEventListener('click', () => {
        this._addMessage(getRandomQuote());
      });

      // 追踪点击次数
      this.panel.addEventListener('click', () => {
        this.clickCount++;
        global.MoyuOS.Storage.update(data => {
          data.aiClicks = this.clickCount;
        });
        if (this.clickCount >= 10) {
          global.MoyuOS.Achievements.unlock('turing');
        }
      });
    },

    _togglePanel(force) {
      this.panelOpen = typeof force === 'boolean' ? force : !this.panelOpen;
      this.panel.classList.toggle('show', this.panelOpen);
      this.bubble.classList.toggle('hidden', this.panelOpen);
      if (this.panelOpen) {
        // 初始化音频上下文（需要用户交互）
        getAudioCtx();
      }
    },

    _addMessage(text) {
      const body = document.getElementById('aiPanelBody');
      const msg = document.createElement('div');
      msg.className = 'ai-msg ai-msg-ai';
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;

      // 打字机效果
      let idx = 0;
      clearInterval(this.typingTimer);
      this.typingTimer = setInterval(() => {
        if (idx < text.length) {
          msg.textContent += text[idx];
          if (idx % 2 === 0) playTypeBeep();
          idx++;
          body.scrollTop = body.scrollHeight;
        } else {
          clearInterval(this.typingTimer);
        }
      }, 40);
    },

    _startAutoPopup() {
      // 每 5 分钟弹一次
      this.autoTimer = setInterval(() => {
        if (this.panelOpen) return;
        this.showAuto(getRandomQuote(), 3000);
      }, 300000);

      // 首次 30 秒后弹一次
      setTimeout(() => {
        if (!this.panelOpen) {
          this.showAuto('AI 助手已就绪，点击 👾 获取摸鱼建议', 3000);
        }
      }, 30000);
    },

    showAuto(text, duration) {
      if (this.autoPopup) {
        this.autoPopup.remove();
        this.autoPopup = null;
      }
      const popup = document.createElement('div');
      popup.className = 'ai-auto-popup';
      popup.innerHTML = `
        <span class="ai-auto-icon">🤖</span>
        <span class="ai-auto-text" id="aiAutoText"></span>
      `;
      document.body.appendChild(popup);
      this.autoPopup = popup;

      requestAnimationFrame(() => popup.classList.add('show'));

      // 打字机
      const textEl = popup.querySelector('#aiAutoText');
      let idx = 0;
      const typeTimer = setInterval(() => {
        if (idx < text.length) {
          textEl.textContent += text[idx];
          idx++;
        } else {
          clearInterval(typeTimer);
        }
      }, 35);

      // 自动关闭
      setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => { popup.remove(); this.autoPopup = null; }, 400);
      }, duration || 3000);

      // 点击关闭
      popup.addEventListener('click', () => {
        popup.classList.remove('show');
        setTimeout(() => { popup.remove(); this.autoPopup = null; }, 400);
      });
    }
  };

  MoyuOS.AiAssistant = AiAssistant;

  document.addEventListener('DOMContentLoaded', () => {
    AiAssistant.init();
  });

})(window);
