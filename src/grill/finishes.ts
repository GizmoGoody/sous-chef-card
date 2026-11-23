// The styles: each a grill's finish, drawn behind the whole card in CSS.
// Stainless steel is brushed satin (Napoleon, Lynx, Blaze, Recteq); Bull is
// its warmer satin stainless, with the chrome handle of its hood; black porcelain is
// enamel (Weber kettles, Traeger Ironwood and Timberline); Traeger bronze is
// the Pro's powder coat; Big Green Egg and Kamado Joe are their glazed
// ceramics, Big Green Egg's pebbled.

export interface Finish {
  // The surface, as a CSS background
  surface: string;
  // Light or dark: the text on it
  tone: "light" | "dark";
  // Flat: the plain patch behind each control
  base: string;
  // The edge around the card
  border: string;
  // The history graph's screen: its background (and as a solid color, for the graph's tooltip), text and grid lines
  screen: { background: string; solid: string; text: string; secondary: string; grid: string };
  // A chrome handle under the grill, as on Bull's hood
  handle?: boolean;
}

/** An SVG texture as a CSS image. */
const svg = (body: string, w: number, h: number): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

/**
 * Noise drawn in one color, its alpha from the noise: stretched along x it
 * is the grain of brushed steel; even and fine, a glaze's pebbling.
 */
const noise = (id: string, frequency: string, octaves: number, seed: number, rgb: string, gain: number, cut: number): string =>
  `<filter id='${id}' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${frequency}' `
  + `numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${rgb} 0 0 0 0 ${rgb} 0 0 0 0 ${rgb} ${gain} 0 0 0 ${cut}'/></filter>`
  + `<rect width='100%' height='100%' filter='url(#${id})'/>`;

// Brushed: fine light and dark streaks along the grain
const BRUSHED = svg(noise("l", "0.003 0.7", 3, 4, "1", 0.9, -0.36) + noise("d", "0.004 0.9", 3, 9, "0", 0.75, -0.34), 600, 300);
// Polished: the grain barely there
const POLISHED = svg(noise("l", "0.002 0.8", 2, 4, "1", 0.6, -0.26) + noise("d", "0.003 0.9", 2, 9, "0", 0.45, -0.21), 600, 300);
// Pebbled glaze: small, uneven light and dark flecks, with no pattern to them
const PEBBLED = svg(noise("l", "0.55", 2, 2, "1", 1.6, -1.0) + noise("d", "0.45", 2, 7, "0", 1.8, -0.95), 240, 240);
const GLAZE = svg(noise("l", "0.6", 1, 5, "1", 1.6, -1.1), 240, 240);


const LIGHT_SCREEN = { background: "rgba(240,242,245,.88)", solid: "#f0f2f5", text: "rgba(0,0,0,.85)", secondary: "rgba(40,40,48,.7)", grid: "rgba(0,0,0,.14)" };

export const FINISHES: Record<string, Finish> = {
  stainless: {
    // Satin: soft bands of light across the grain
    surface: `${BRUSHED} 0 0 / 600px 300px, `
      + "linear-gradient(180deg, #d9dde1 0%, #c3c8cd 22%, #dde1e4 40%, #b4bac0 63%, #cfd3d7 82%, #aeb4ba 100%)",
    tone: "light", base: "#c6cbd0", border: "rgba(0,0,0,.25)",
    screen: LIGHT_SCREEN,
  },
  bull: {
    // Bull's satin brushed stainless, warmer and more even than Stainless steel, with its chrome handle
    surface: `${POLISHED} 0 0 / 600px 300px, `
      + "linear-gradient(176deg, #dcdbd7 0%, #cfceca 25%, #d8d7d3 45%, #c3c2be 70%, #cdccc8 100%)",
    tone: "light", base: "#c4c3bf", border: "rgba(0,0,0,.3)",
    screen: LIGHT_SCREEN, handle: true,
  },
  black: {
    surface: "linear-gradient(165deg, #3a3c40 0%, #16171a 36%, #0b0c0e 70%, #26282c 100%)",
    tone: "dark", base: "#101113", border: "rgba(255,255,255,.12)",
    screen: { background: "rgba(6,6,8,.85)", solid: "#0a0a0c", text: "rgba(255,255,255,.9)", secondary: "rgba(235,235,240,.65)", grid: "rgba(255,255,255,.12)" },
  },
  bronze: {
    surface: "linear-gradient(165deg, #82603c 0%, #4f341d 42%, #3b2614 70%, #6a4829 100%)",
    tone: "dark", base: "#3e2915", border: "rgba(255,230,200,.18)",
    screen: { background: "rgba(30,19,9,.85)", solid: "#1e1309", text: "rgba(255,240,225,.92)", secondary: "rgba(240,215,190,.65)", grid: "rgba(255,220,180,.14)" },
  },
  big_green_egg: {
    surface: `${PEBBLED} 0 0 / 240px 240px, linear-gradient(165deg, #2f7442 0%, #1a4f2b 52%, #215e36 100%)`,
    tone: "dark", base: "#143f22", border: "rgba(255,255,255,.14)",
    screen: { background: "rgba(6,28,14,.85)", solid: "#061c0e", text: "rgba(235,255,240,.92)", secondary: "rgba(200,235,210,.65)", grid: "rgba(200,255,220,.14)" },
  },
  kamado_joe: {
    // A smoother, glossier glaze
    surface: `${GLAZE} 0 0 / 240px 240px, radial-gradient(120% 70% at 30% 0%, rgba(255,255,255,.18), transparent 60%), `
      + "linear-gradient(165deg, #bd2c21 0%, #7e1712 55%, #9a1f19 100%)",
    tone: "dark", base: "#6a130f", border: "rgba(255,255,255,.16)",
    screen: { background: "rgba(36,6,4,.85)", solid: "#240604", text: "rgba(255,235,232,.92)", secondary: "rgba(255,205,200,.65)", grid: "rgba(255,210,205,.14)" },
  },
};

/** A style's finish; undefined for None (the theme). */
export const finishOf = (style?: string): Finish | undefined => (style ? FINISHES[style] : undefined);
