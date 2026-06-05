// src/render/draw-arena.ts
// Route-B arena background — verbatim port of poc/art-routes.html drawArena('B',...).

/**
 * Draw the route-B diorama arena.
 * w, h = canvas logical size; groundY = Y coordinate of the floor line.
 */
export function drawArenaB(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  groundY: number,
): void {
  // Background gradient (verbatim prototype lines 250–251)
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c2336');
  g.addColorStop(0.55, '#181a22');
  g.addColorStop(1, '#0e0f14');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft warm light pool (verbatim prototype lines 252–255)
  const hp = ctx.createRadialGradient(
    w * 0.42, groundY - h * 0.25, 10,
    w * 0.42, groundY - h * 0.25, w * 0.55,
  );
  hp.addColorStop(0, 'rgba(255,200,130,0.16)');
  hp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hp;
  ctx.fillRect(0, 0, w, h);

  // Floor plane (verbatim prototype lines 256–257)
  ctx.fillStyle = 'rgba(20,24,18,0.5)';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}
