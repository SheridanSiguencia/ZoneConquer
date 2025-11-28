// app/data/routes.ts
// demo routes in XY meters, centered around (0,0)

export type XY = { x: number; y: number }

// each route is a polyline (will be densified into ~10m hops)
export const ROUTES_XY: Record<string, XY[]> = {
  campusSquare: [
    { x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: -120 }, { x: 0, y: -120 }, { x: 0, y: 0 }
  ],
  bigLoop: [
    { x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: -250 }, { x: -100, y: -250 },
    { x: -100, y: 50 }, { x: 0, y: 0 }
  ],
  triangle: [
    { x: 0, y: 0 }, { x: 240, y: 0 }, { x: 120, y: -208 }, { x: 0, y: 0 } // ~equilateral
  ],
  nearGate: [
    // like a square but we stop ~15 m short of the start to test the “gate near start”
    { x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: -160 }, { x: 0, y: -160 }, { x: 15, y: 0 }
  ],
  figure8: [
    // two loops crossing near origin
    { x: 0, y: 0 }, { x: 90, y: 0 }, { x: 90, y: -90 }, { x: 0, y: -90 },
    { x: 0, y: 0 }, { x: -90, y: 0 }, { x: -90, y: 90 }, { x: 0, y: 90 }, { x: 0, y: 0 }
  ],
  skinnyRibbon: [
    // intentionally “too skinny” (long and 10m wide) — should fail area test
    { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: -10 }, { x: 0, y: -10 }, { x: 0, y: 0 }
  ],
}
