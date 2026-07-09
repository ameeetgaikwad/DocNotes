export function downloadBase64File(
  base64: string,
  filename: string,
  mimeType: string,
): void {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printBase64Pdf(base64: string): void {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  // Detect touch-primary devices — the hidden-iframe + print()
  // approach silently no-ops on Android Chrome (Manoj msg 2192), so
  // we fall back to opening the PDF in a new tab where the browser's
  // built-in viewer takes over. User taps Share → Print from there.
  const isMobile =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  if (isMobile) {
    // Programmatic <a target="_blank">.click() preserves the enough
    // of the user-gesture context on Android Chrome to bypass popup
    // blocking after the awaits inside the caller's mutation. Falls
    // back gracefully if the tab-open is blocked — the user still
    // has Download PDF as a working alternative.
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Keep the blob URL alive for a while so the new tab can load.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  // Desktop path — hidden iframe + programmatic print.
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.print();
  };
}
