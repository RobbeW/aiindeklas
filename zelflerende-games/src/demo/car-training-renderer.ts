import { drawVehicle, drawCollisionFlame, hasCollision } from '../car/vehicle-art.ts';
import type { PopulationFrame } from '../evolution/live-frame.ts';
import { trackIdentity, validateCircuit, type CircuitDocument } from '../tracks/document.ts';
import { drawTrack } from '../tracks/renderer.ts';
import type { CarTrainingPresentationState } from './car-training-presentation.ts';

const TILE_SIZE = 100;
const MAX_BACKGROUND_PIXELS = 8_000_000;

/** A square backing store and the common world scale for the complete selected set. */
export function trainingViewport(documents: readonly Pick<CircuitDocument, 'width' | 'height'>[], cssSize: number, dpr: number) {
  if (!documents.length || documents.some(d => !Number.isFinite(d.width) || !Number.isFinite(d.height) || d.width <= 0 || d.height <= 0) || !Number.isFinite(cssSize) || cssSize <= 0 || !Number.isFinite(dpr) || dpr <= 0) throw new RangeError('Invalid viewport');
  const pixels = Math.max(1, Math.round(cssSize * dpr));
  const worldExtent = Math.max(...documents.map(d => Math.max(d.width, d.height))) * TILE_SIZE;
  return { pixels, scale: pixels / worldExtent };
}

/** Offsets and scale are in backing-store pixels; world coordinates use 100 units per tile. */
export function trainingProjection(document: Pick<CircuitDocument, 'width' | 'height'>, viewport: { pixels: number; scale: number }) {
  return { scale: viewport.scale, x: (viewport.pixels - document.width * TILE_SIZE * viewport.scale) / 2, y: (viewport.pixels - document.height * TILE_SIZE * viewport.scale) / 2 };
}

/** Each instance owns its backgrounds and last frame, allowing independent split views. */
export function createCarTrainingRenderer(canvas: HTMLCanvasElement, selectedDocuments: readonly CircuitDocument[]) {
  if (!selectedDocuments.length || selectedDocuments.length > 8) throw new RangeError('Expected 1 to 8 circuits');
  const documents = selectedDocuments.map(validateCircuit);
  if (documents.reduce((sum, d) => sum + d.width * d.height * TILE_SIZE ** 2, 0) > MAX_BACKGROUND_PIXELS) throw new RangeError('Circuit backgrounds exceed renderer limit');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas2D unavailable');
  const backgrounds = new Map<string, { document: CircuitDocument; canvas: HTMLCanvasElement }>();
  for (const doc of documents) {
    const id = trackIdentity(doc);
    if (backgrounds.has(id)) throw new Error('Duplicate circuit');
    const background = canvas.ownerDocument.createElement('canvas');
    background.width = doc.width * TILE_SIZE; background.height = doc.height * TILE_SIZE;
    const backgroundContext = background.getContext('2d');
    if (!backgroundContext) throw new Error('Canvas2D unavailable');
    drawTrack(backgroundContext, doc);
    backgrounds.set(id, { document: doc, canvas: background });
  }
  let frame: PopulationFrame | undefined;
  let currentId = trackIdentity(documents[0]!);
  let disposed = false;
  let viewport = trainingViewport(documents, 1, 1);

  function paint() {
    const background = backgrounds.get(currentId)!;
    const p = trainingProjection(background.document, viewport);
    ctx!.setTransform(1, 0, 0, 1, 0, 0);
    ctx!.fillStyle = '#F8F7F3'; ctx!.fillRect(0, 0, viewport.pixels, viewport.pixels);
    ctx!.save(); ctx!.translate(p.x, p.y); ctx!.scale(p.scale, p.scale);
    ctx!.drawImage(background.canvas, 0, 0);
    if (frame?.trackId === currentId) {
      for (const agent of frame.agents) {
        const car = agent.world.car;
        drawVehicle(ctx!, car.x, car.y, car.heading, agent.done ? .8 : 1);
      }
      for (const agent of frame.agents) if (hasCollision(agent.result)) drawCollisionFlame(ctx!, agent.world.car.x, agent.world.car.y);
    }
    ctx!.restore();
  }
  /** Call on layout/DPR changes; identical sizes do not reset the canvas. */
  function resize(cssSize: number, dpr = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1) {
    if (disposed) return;
    viewport = trainingViewport(documents, cssSize, dpr);
    if (canvas.width !== viewport.pixels) canvas.width = viewport.pixels;
    if (canvas.height !== viewport.pixels) canvas.height = viewport.pixels;
    paint();
  }
  function update(state: Pick<CarTrainingPresentationState, 'frame'>) {
    if (disposed) return;
    if (state.frame) {
      if (!backgrounds.has(state.frame.trackId)) throw new Error('Frame circuit is not selected');
      frame = state.frame; currentId = frame.trackId;
    }
    paint();
  }
  // The embedding view owns layout. It may also call resize explicitly when DPR changes.
  const measure = () => { const rect = canvas.getBoundingClientRect(); const size = Math.min(rect.width, rect.height); if (size > 0) resize(size); };
  const view = canvas.ownerDocument.defaultView;
  const observer = view?.ResizeObserver ? new view.ResizeObserver(measure) : undefined;
  observer?.observe(canvas);
  view?.addEventListener('resize', measure);
  measure();
  return { update, resize, dispose() { if (disposed) return; disposed = true; observer?.disconnect(); view?.removeEventListener('resize', measure); backgrounds.clear(); } };
}
