export function providerLabelForUrl(destination, explicitProvider = "") {
  const configured = String(explicitProvider).trim();
  if (configured) return configured;
  try {
    const host = new URL(destination).hostname.toLowerCase();
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "YouTube";
  } catch {}
  return "the source platform";
}
