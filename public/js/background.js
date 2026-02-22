(function() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  let mouse = { x: -1000, y: -1000 };
  
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  
  document.addEventListener('mouseleave', () => {
    mouse.x = -1000;
    mouse.y = -1000;
  });
  
  class Particle {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.size = Math.random() * 30 + 15;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.25 + 0.08;
      this.rotation = Math.random() * Math.PI * 2;
      this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }
    
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.rotation += this.rotationSpeed;
      
      if (this.x < -50) this.x = width + 50;
      if (this.x > width + 50) this.x = -50;
      if (this.y < -50) this.y = height + 50;
      if (this.y > height + 50) this.y = -50;
    }
    
    draw() {
      const dx = mouse.x - this.x;
      const dy = mouse.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const lightRadius = 200;
      
      let brightness = 0;
      if (dist < lightRadius) {
        brightness = Math.pow(1 - dist / lightRadius, 2) * 0.25;
      }
      
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      
      const baseAlpha = this.opacity;
      const glowAlpha = baseAlpha + brightness * 0.5;
      ctx.globalAlpha = glowAlpha;
      
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fillStyle = brightness > 0.1 ? '#4ae88a' : '#2ecc71';
      ctx.fill();
      
      ctx.strokeStyle = brightness > 0.1 ? '#ffd700' : '#27ae60';
      ctx.lineWidth = 1 + brightness * 2;
      ctx.stroke();
      
      this.drawPattern(brightness);
      
      ctx.restore();
    }
    
    drawPattern(brightness) {
      const patternAlpha = 0.3 + brightness * 0.5;
      ctx.strokeStyle = brightness > 0.1 
        ? `rgba(255, 215, 0, ${patternAlpha})` 
        : 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1 + brightness;
      
      const r = this.size;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      
      for (let i = 0; i < 5; i++) {
        const angle = (i * Math.PI * 2) / 5;
        const x1 = Math.cos(angle) * r * 0.4;
        const y1 = Math.sin(angle) * 0.4;
        const x2 = Math.cos(angle) * r;
        const y2 = Math.sin(angle) * r;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
  }
  
  function drawCandleLight() {
    if (mouse.x < 0 || mouse.y < 0) return;
    
    const gradient = ctx.createRadialGradient(
      mouse.x, mouse.y, 0,
      mouse.x, mouse.y, 300
    );
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.03)');
    gradient.addColorStop(0.25, 'rgba(255, 180, 0, 0.015)');
    gradient.addColorStop(0.5, 'rgba(255, 150, 0, 0.005)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  function drawCandleGlow() {
    if (mouse.x < 0 || mouse.y < 0) return;
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    
    const gradient = ctx.createRadialGradient(
      mouse.x, mouse.y, 0,
      mouse.x, mouse.y, 120
    );
    gradient.addColorStop(0, 'rgba(255, 245, 200, 0.125)');
    gradient.addColorStop(0.15, 'rgba(255, 215, 0, 0.09)');
    gradient.addColorStop(0.4, 'rgba(255, 180, 0, 0.04)');
    gradient.addColorStop(0.7, 'rgba(255, 150, 0, 0.015)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 120, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 240, 0.25)';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
    
    ctx.restore();
  }
  
  function init() {
    resize();
    const particleCount = Math.min(Math.floor(width * height / 12000), 40);
    
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }
  
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    drawCandleLight();
    
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    
    drawCandleGlow();
    
    requestAnimationFrame(animate);
  }
  
  window.addEventListener('resize', () => {
    resize();
  });
  
  init();
  animate();
})();
