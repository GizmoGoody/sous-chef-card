// The styles: each a grill's finish, drawn behind the whole card in CSS.
// Stainless steel is brushed (Bull, Napoleon, Lynx, Blaze, Recteq); black
// porcelain is enamel (Weber kettles, Traeger Ironwood and Timberline);
// bronze is Traeger Pro's powder coat; the ceramics are glazed and speckled
// (Big Green Egg, Kamado Joe).

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
}

const SPECKLE = "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.6px) 0 0 / 7px 7px, "
  + "radial-gradient(rgba(0,0,0,.16) 1px, transparent 1.6px) 3px 4px / 9px 9px, ";

export const FINISHES: Record<string, Finish> = {
  stainless: {
    surface: "repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, rgba(0,0,0,.035) 1px 2px, transparent 2px 4px), "
      + "linear-gradient(165deg, #e6e9ec 0%, #aab1b7 35%, #d5d9dd 62%, #959ca3 100%)",
    tone: "light", base: "#c9ced3", border: "rgba(0,0,0,.25)",
    screen: { background: "rgba(240,242,245,.88)", solid: "#f0f2f5", text: "rgba(0,0,0,.85)", secondary: "rgba(40,40,48,.7)", grid: "rgba(0,0,0,.14)" },
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
  green: {
    surface: `${SPECKLE}linear-gradient(165deg, #2d7040 0%, #174a28 55%, #1e5a33 100%)`,
    tone: "dark", base: "#143f22", border: "rgba(255,255,255,.14)",
    screen: { background: "rgba(6,28,14,.85)", solid: "#061c0e", text: "rgba(235,255,240,.92)", secondary: "rgba(200,235,210,.65)", grid: "rgba(200,255,220,.14)" },
  },
  red: {
    surface: `${SPECKLE}linear-gradient(165deg, #b8291f 0%, #7c1612 55%, #981e19 100%)`,
    tone: "dark", base: "#6a130f", border: "rgba(255,255,255,.16)",
    screen: { background: "rgba(36,6,4,.85)", solid: "#240604", text: "rgba(255,235,232,.92)", secondary: "rgba(255,205,200,.65)", grid: "rgba(255,210,205,.14)" },
  },
};

/** A style's finish; undefined for None (the theme). */
export const finishOf = (style?: string): Finish | undefined => (style ? FINISHES[style] : undefined);
