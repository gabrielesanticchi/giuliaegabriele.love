export const designTokens = {
  ivory: "#f4efe7",
  paper: "#fbf8f2",
  forest: "#20342c",
  deep: "#14231d",
  sage: "#748476",
  clay: "#b6754e",
  clayText: "#8a4e2e",
  onClay: "#101d18"
} as const;

function channelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) {
    throw new TypeError("Il colore deve essere espresso come #RRGGBB");
  }
  const channels = [1, 3, 5].map((offset) =>
    channelToLinear(Number.parseInt(hex.slice(offset, offset + 2), 16))
  );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    relativeLuminance(first),
    relativeLuminance(second)
  ].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}
