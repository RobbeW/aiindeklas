import { flockLeader, type FlockBird } from './flock.ts';
import { PHYSICS } from './physics.ts';
import { PIPE_GAP, PIPE_WIDTH, type WorldState } from './world.ts';

const WIDTH = PHYSICS.worldWidth;
const HEIGHT = PHYSICS.worldHeight;
const GROUND_Y = PHYSICS.groundY;
const PURPLE = '#5200FF';
interface FlappyArtwork { pipe: HTMLImageElement; ground: HTMLImageElement; birds: readonly HTMLImageElement[]; }
async function loadArtwork(): Promise<FlappyArtwork> {
  const load = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Flappy-afbeelding kon niet laden: ${name}`));
    image.src = `${import.meta.env.BASE_URL}assets/flappy/${name}.png`;
  });
  const [pipe, ground, ...birds] = await Promise.all(['pipe-green', 'base', 'redbird-upflap', 'redbird-midflap', 'redbird-downflap'].map(load));
  return { pipe: pipe!, ground: ground!, birds };
}

function drawSky(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#70c5ce';
  context.fillRect(0, 0, WIDTH, GROUND_Y);
  // A quiet pixel-style skyline keeps the familiar game field readable.
  context.fillStyle = '#dceba6';
  for (let x = 0; x < WIDTH; x += 32) context.fillRect(x, GROUND_Y - 50 - (x % 3) * 8, 26, 70);
  context.fillStyle = '#f5fbdc';
  for (let x = -12; x < WIDTH; x += 48) {
    context.fillRect(x, GROUND_Y - 82, 48, 14);
    context.fillRect(x + 8, GROUND_Y - 92, 28, 20);
  }
  context.fillStyle = '#9dde74';
  context.fillRect(0, GROUND_Y - 25, WIDTH, 25);
}

/** Crop the body rather than stretching its recognizable rim; preserve collision rectangles. */
function drawPipe(context: CanvasRenderingContext2D, art: FlappyArtwork, x: number, y: number, height: number, upsideDown = false): void {
  if (height <= 0) return;
  context.save();
  context.beginPath();context.rect(x, y, PIPE_WIDTH, height);context.clip();
  if (upsideDown) { context.translate(x, y + height); context.scale(1, -1); }
  else context.translate(x, y);
  context.drawImage(art.pipe, 0, 0);
  for (let offset = art.pipe.height; offset < height; offset += art.pipe.height - 26) {
    context.drawImage(art.pipe, 0, 26, PIPE_WIDTH, art.pipe.height - 26, 0, offset, PIPE_WIDTH, art.pipe.height - 26);
  }
  context.restore();
}

function drawGround(context: CanvasRenderingContext2D, art: FlappyArtwork): void {
  for (let x = 0; x < WIDTH; x += art.ground.width) {
    context.drawImage(art.ground, 0, 0, art.ground.width, HEIGHT - GROUND_Y, x, GROUND_Y, art.ground.width, HEIGHT - GROUND_Y);
  }
}

/** Retain the existing 20×14 bird placement and all simulation physics. */
function drawBird(context: CanvasRenderingContext2D, art: FlappyArtwork, x: number, y: number, flapPhase: number): void {
  context.drawImage(art.birds[flapPhase]!, x, y, 20, 14);
}

function drawWorldPipes(context: CanvasRenderingContext2D, world: WorldState, art: FlappyArtwork): void {
  for (const item of world.pipes) {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.gapCenter)) {
      throw new RangeError('world pipe position and gap center must be finite numbers');
    }
    const gapTop = item.gapCenter - PIPE_GAP / 2;
    const gapBottom = item.gapCenter + PIPE_GAP / 2;
    drawPipe(context, art, item.x, 0, gapTop, true);
    drawPipe(context, art, item.x, gapBottom, GROUND_Y - gapBottom);
  }
}

function drawBackdrop(context: CanvasRenderingContext2D, world: WorldState, art: FlappyArtwork): void {
  drawSky(context);
  drawWorldPipes(context, world, art);
  drawGround(context, art);
}

/** Create a pure renderer for immutable Flappy world snapshots on a fixed 360×480 canvas. */
export async function createFlappyRenderer(
  canvas: HTMLCanvasElement,
): Promise<{ render(world: WorldState): void; dispose(): void }> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Flappy renderer needs a canvas with a 2D rendering context.');

  const art = await loadArtwork();
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  canvas.style.width = 'min(100%, 360px)';
  canvas.style.height = 'auto';
  canvas.style.aspectRatio = `${WIDTH} / ${HEIGHT}`;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Speelveld van Flappy Bird');

  let disposed = false;
  return {
    render(world: WorldState): void {
      if (disposed) throw new Error('Flappy renderer has been disposed.');
      if (!Number.isFinite(world.bird.y) || !Number.isFinite(world.bird.velocityY)) {
        throw new RangeError('world bird position and velocity must be finite numbers');
      }

      drawBackdrop(context, world, art);
      const flapPhase = Math.floor(world.steps / 6) % 3;
      drawBird(context, art, PHYSICS.birdX - 10, world.bird.y - 7, flapPhase);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      context.clearRect(0, 0, WIDTH, HEIGHT);
    },
  };
}

/** Shared field with genuinely live birds; no positional offsets or prerecorded trajectories. */
export async function createFlappyFlockRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas2D unavailable');
  const art = await loadArtwork();
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  context.imageSmoothingEnabled = false;
  canvas.style.width = 'min(100%, 360px)';
  canvas.style.height = 'auto';

  return {
    render(birds: readonly FlockBird[]) {
      if (!birds.length) return;
      const field = [...birds].sort((a, b) => b.world.steps - a.world.steps)[0]!.world;
      const leader = flockLeader(birds)!;
      drawBackdrop(context, field, art);

      const ordered = [...birds.filter((bird) => bird.id !== leader.id), leader];
      for (const bird of ordered) {
        context.save();
        context.globalAlpha = bird.done ? 0.18 : bird.id === leader.id ? 1 : 0.32;
        drawBird(
          context,
          art,
          PHYSICS.birdX - 10,
          bird.world.bird.y - 7,
          Math.floor(bird.world.steps / 6) % 3,
        );
        context.globalAlpha = 1;
        if (bird.id === leader.id) {
          context.strokeStyle = PURPLE;
          context.lineWidth = 2;
          context.beginPath();
          context.ellipse(PHYSICS.birdX, bird.world.bird.y, 14, 11, 0, 0, Math.PI * 2);
          context.stroke();
        }
        if (bird.done) {
          context.strokeStyle = '#625B70';
          context.lineWidth = 1.5;
          context.beginPath();
          context.moveTo(PHYSICS.birdX - 4, bird.world.bird.y - 4);
          context.lineTo(PHYSICS.birdX + 4, bird.world.bird.y + 4);
          context.moveTo(PHYSICS.birdX + 4, bird.world.bird.y - 4);
          context.lineTo(PHYSICS.birdX - 4, bird.world.bird.y + 4);
          context.stroke();
        }
        context.restore();
      }
    },
    dispose() {
      context.clearRect(0, 0, WIDTH, HEIGHT);
    },
  };
}
