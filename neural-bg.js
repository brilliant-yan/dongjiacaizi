/**
 * MoyuOS.NeuralBg — 神经网络粒子背景系统
 * - 离屏 Canvas 渲染发光节点 + 连线
 * - 鼠标/触摸引力吸附
 * - 时间段变色（晨蓝/午橙/暮紫/夜红）
 * - 形状聚合（成就/Konami 触发）
 * - 金色模式（Konami 10秒）
 * - 低端设备自动降级
 */
;(function(global) {
  'use strict';

  const MoyuOS = global.MoyuOS = global.MoyuOS || {};

  // 配色方案
  const TIME_PALETTES = {
    dawn:    { node: '#4a90d9', line: 'rgba(74,144,217,', bg: 'rgba(74,144,217,' },   // 5-9
    day:     { node: '#f5a623', line: 'rgba(245,166,35,', bg: 'rgba(245,166,35,' },   // 9-14
    evening: { node: '#9b59b6', line: 'rgba(155,89,182,', bg: 'rgba(155,89,182,' },   // 14-20
    night:   { node: '#e74c6f', line: 'rgba(231,76,111,', bg: 'rgba(231,76,111,' },   // 20-5
    gold:    { node: '#ffd700', line: 'rgba(255,215,0,', bg: 'rgba(255,215,0,' },      // Konami
  };

  function getTimePalette() {
    const h = new Date().getHours();
    if (h >= 5 && h < 9) return TIME_PALETTES.dawn;
    if (h >= 9 && h < 14) return TIME_PALETTES.day;
    if (h >= 14 && h < 20) return TIME_PALETTES.evening;
    return TIME_PALETTES.night;
  }

  const NeuralBg = {
    canvas: null,
    ctx: null,
    offscreen: null,
    offCtx: null,
    particles: [],
    mouse: { x: -999, y: -999, active: false },
    goldMode: false,
    goldEnd: 0,
    aggregating: false,
    aggregateTargets: [],
    aggregateTimer: null,
    degraded: false,
    particleCount: 50,
    connectDist: 120,
    fpsSamples: [],
    fpsCheckDone: false,
    rafId: null,
    running: false,

    init() {
      // 只在首页初始化
      if (!document.querySelector('.particle-bg')) return;

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'neural-canvas';
      const container = document.querySelector('.particle-bg');
      container.innerHTML = '';
      container.appendChild(this.canvas);

      this.ctx = this.canvas.getContext('2d');
      this.offscreen = document.createElement('canvas');
      this.offCtx = this.offscreen.getContext('2d');

      this._resize();
      window.addEventListener('resize', () => this._resize());

      // 鼠标/触摸
      document.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.active = true;
      });
      document.addEventListener('mouseleave', () => { this.mouse.active = false; });
      document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          this.mouse.x = e.touches[0].clientX;
          this.mouse.y = e.touches[0].clientY;
          this.mouse.active = true;
        }
      }, { passive: true });
      document.addEventListener('touchend', () => { this.mouse.active = false; });

      this._initParticles();
      this.running = true;
      this._loop();
    },

    _resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.canvas.width = w;
      this.canvas.height = h;
      this.offscreen.width = w;
      this.offscreen.height = h;
    },

    _initParticles() {
      this.particles = [];
      for (let i = 0; i < this.particleCount; i++) {
        this.particles.push(this._createParticle());
      }
    },

    _createParticle() {
      return {
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2 + 1.5,
        targetX: null,
        targetY: null,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    },

    _loop() {
      if (!this.running) return;
      const startTime = performance.now();

      this._update();
      this._draw();

      // FPS 监控（前120帧）
      const elapsed = performance.now() - startTime;
      if (!this.fpsCheckDone) {
        this.fpsSamples.push(elapsed);
        if (this.fpsSamples.length >= 60) {
          const avgFrame = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
          const fps = 1000 / (avgFrame + 16.67); // 16.67ms 为基础帧时间
          if (fps < 25) {
            this._degrade();
          }
          this.fpsCheckDone = true;
        }
      }

      this.rafId = requestAnimationFrame(() => this._loop());
    },

    _degrade() {
      this.degraded = true;
      this.particleCount = 20;
      this.connectDist = 80;
      this.particles.length = this.particleCount;
    },

    _update() {
      const W = this.canvas.width;
      const H = this.canvas.height;
      const now = Date.now();

      // 金色模式超时
      if (this.goldMode && now > this.goldEnd) {
        this.goldMode = false;
      }

      this.particles.forEach(p => {
        // 聚合目标（成就/Konami 时）
        if (p.targetX !== null) {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          p.vx += dx * 0.02;
          p.vy += dy * 0.02;
          p.vx *= 0.9;
          p.vy *= 0.9;
        } else {
          // 鼠标引力
          if (this.mouse.active) {
            const dx = this.mouse.x - p.x;
            const dy = this.mouse.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200 && dist > 1) {
              const force = 0.3 / dist;
              p.vx += dx * force;
              p.vy += dy * force;
            }
          }

          // 阻尼
          p.vx *= 0.98;
          p.vy *= 0.98;

          // 限制最大速度
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (speed > 2) {
            p.vx = (p.vx / speed) * 2;
            p.vy = (p.vy / speed) * 2;
          }
        }

        p.x += p.vx;
        p.y += p.vy;

        // 边界回弹
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > W) { p.x = W; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > H) { p.y = H; p.vy *= -1; }

        p.pulsePhase += 0.03;
      });
    },

    _draw() {
      const ctx = this.offCtx;
      const W = this.canvas.width;
      const H = this.canvas.height;

      ctx.clearRect(0, 0, W, H);

      const palette = this.goldMode ? TIME_PALETTES.gold : getTimePalette();

      // 连线（低端模式跳过）
      if (!this.degraded || this.particleCount > 20) {
        for (let i = 0; i < this.particles.length; i++) {
          for (let j = i + 1; j < this.particles.length; j++) {
            const a = this.particles[i];
            const b = this.particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.connectDist) {
              const alpha = (1 - dist / this.connectDist) * 0.3;
              ctx.strokeStyle = palette.line + alpha + ')';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      // 节点
      this.particles.forEach(p => {
        const pulse = 1 + Math.sin(p.pulsePhase) * 0.3;
        const r = p.radius * pulse;

        // 发光效果
        ctx.shadowColor = palette.node;
        ctx.shadowBlur = 12;
        ctx.fillStyle = palette.node;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // 内核心
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // 复制到主 canvas
      this.ctx.clearRect(0, 0, W, H);
      this.ctx.drawImage(this.offscreen, 0, 0);
    },

    /* 聚合粒子为指定形状 */
    aggregateShape(emoji) {
      if (this.aggregating) return;
      this.aggregating = true;

      const cx = this.canvas.width / 2;
      const cy = this.canvas.height / 2;

      // 生成目标坐标（圆形排列）
      this.particles.forEach((p, i) => {
        const angle = (i / this.particles.length) * Math.PI * 2;
        const radius = 80 + Math.random() * 30;
        p.targetX = cx + Math.cos(angle) * radius;
        p.targetY = cy + Math.sin(angle) * radius;
      });

      // 3秒后散开
      clearTimeout(this.aggregateTimer);
      this.aggregateTimer = setTimeout(() => {
        this.particles.forEach(p => {
          p.targetX = null;
          p.targetY = null;
          p.vx = (Math.random() - 0.5) * 3;
          p.vy = (Math.random() - 0.5) * 3;
        });
        this.aggregating = false;
      }, 3000);
    },

    /* 金色模式（Konami 触发） */
    setGoldMode(on) {
      this.goldMode = on;
      if (on) {
        this.goldEnd = Date.now() + 10000;
      }
    }
  };

  MoyuOS.NeuralBg = NeuralBg;

  // 首页初始化
  document.addEventListener('DOMContentLoaded', () => {
    NeuralBg.init();
  });

})(window);
