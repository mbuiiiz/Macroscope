// Synthetic sparkline data generator.
// Used by the EventDetailPage to render a small "trend" chart next to each
// asset prediction. Backend doesn't supply real price history yet, so we
// generate plausible-looking random walks biased by the predicted direction.
//
// trend: +1 (up), -1 (down), 0 (flat)
// n:     number of points to generate (chart resolution)
export function genSpark(trend = 0, n = 20) {
  const d = [50];
  for (let i = 1; i < n; i++) {
    d.push(Math.max(2, d[i - 1] + (Math.random() - 0.5 + trend * 0.1) * 8));
  }
  return d;
}
