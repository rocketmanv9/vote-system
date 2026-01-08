// Celebration effects utilities

export type CelebrationType = 'success' | 'epic' | 'simple';

const colors = {
  success: ['#16a34a', '#22c55e', '#86efac', '#dcfce7'],
  epic: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  simple: ['#3b82f6', '#60a5fa', '#93c5fd'],
};

/**
 * Create a single celebration particle
 */
function createParticle(
  x: number,
  y: number,
  color: string,
  angle: number,
  velocity: number
): HTMLElement {
  const particle = document.createElement('div');
  particle.className = 'celebration-particle';
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  particle.style.background = color;

  // Calculate trajectory
  const radians = (angle * Math.PI) / 180;
  const vx = Math.cos(radians) * velocity;
  const vy = Math.sin(radians) * velocity;

  particle.style.setProperty('--vx', `${vx}px`);
  particle.style.setProperty('--vy', `${vy}px`);

  return particle;
}

/**
 * Trigger a celebration effect at a specific position
 * @param type - Type of celebration
 * @param element - Optional element to celebrate from (uses center if not provided)
 * @param particleCount - Number of particles to create
 */
export function celebrate(
  type: CelebrationType = 'success',
  element?: HTMLElement | null,
  particleCount: number = 30
): void {
  if (typeof window === 'undefined') return;

  // Get or create particles container
  let container = document.getElementById('celebration-particles');
  if (!container) {
    container = document.createElement('div');
    container.id = 'celebration-particles';
    document.body.appendChild(container);
  }

  // Determine origin point
  let x: number;
  let y: number;

  if (element) {
    const rect = element.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  } else {
    x = window.innerWidth / 2;
    y = window.innerHeight / 2;
  }

  const colorPalette = colors[type];

  // Create particles
  const particles: HTMLElement[] = [];
  for (let i = 0; i < particleCount; i++) {
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    const angle = (360 / particleCount) * i + Math.random() * (360 / particleCount);
    const velocity = 3 + Math.random() * 4;

    const particle = createParticle(x, y, color, angle, velocity);
    particles.push(particle);
    container.appendChild(particle);
  }

  // Clean up particles after animation
  setTimeout(() => {
    particles.forEach((particle) => {
      particle.remove();
    });
  }, 2000);
}

/**
 * Trigger a celebration effect from an event's position
 */
export function celebrateFromEvent(
  event: MouseEvent | TouchEvent,
  type: CelebrationType = 'success',
  particleCount: number = 20
): void {
  if (typeof window === 'undefined') return;

  let x: number;
  let y: number;

  if ('touches' in event && event.touches.length > 0) {
    x = event.touches[0].clientX;
    y = event.touches[0].clientY;
  } else if ('clientX' in event) {
    x = event.clientX;
    y = event.clientY;
  } else {
    return;
  }

  // Get or create particles container
  let container = document.getElementById('celebration-particles');
  if (!container) {
    container = document.createElement('div');
    container.id = 'celebration-particles';
    document.body.appendChild(container);
  }

  const colorPalette = colors[type];

  // Create particles
  const particles: HTMLElement[] = [];
  for (let i = 0; i < particleCount; i++) {
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    const angle = (360 / particleCount) * i + Math.random() * (360 / particleCount);
    const velocity = 2 + Math.random() * 3;

    const particle = createParticle(x, y, color, angle, velocity);
    particles.push(particle);
    container.appendChild(particle);
  }

  // Clean up particles after animation
  setTimeout(() => {
    particles.forEach((particle) => {
      particle.remove();
    });
  }, 2000);
}

/**
 * Create a burst of confetti from the top of the screen
 */
export function confettiBurst(particleCount: number = 50): void {
  if (typeof window === 'undefined') return;

  let container = document.getElementById('celebration-particles');
  if (!container) {
    container = document.createElement('div');
    container.id = 'celebration-particles';
    document.body.appendChild(container);
  }

  const colorPalette = colors.epic;
  const particles: HTMLElement[] = [];

  for (let i = 0; i < particleCount; i++) {
    const x = Math.random() * window.innerWidth;
    const y = -20;
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];

    const particle = document.createElement('div');
    particle.className = 'celebration-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.background = color;
    particle.style.width = `${8 + Math.random() * 8}px`;
    particle.style.height = particle.style.width;

    // Random falling animation
    particle.style.animation = `celebrationFloat ${2 + Math.random() * 2}s ease-out forwards`;
    particle.style.animationDelay = `${Math.random() * 0.5}s`;

    particles.push(particle);
    container.appendChild(particle);
  }

  // Clean up particles after animation
  setTimeout(() => {
    particles.forEach((particle) => {
      particle.remove();
    });
  }, 4500);
}
