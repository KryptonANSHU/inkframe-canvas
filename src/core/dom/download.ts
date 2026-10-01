/** How long a download's object URL is kept; revoking it at once can cancel the download. */
const REVOKE_AFTER_MS = 60_000;

/** Saves `blob` through the browser's normal download flow. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_AFTER_MS);
}
