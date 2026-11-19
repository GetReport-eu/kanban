/**
 * Returns the files from a paste event, or an empty array when the paste
 * carries text (so normal text pastes keep working).
 * Clipboard screenshots all arrive as "image.png", so they get a timestamped name.
 */
export const getPastedFiles = (clipboardData: DataTransfer | null): File[] => {
  if (!clipboardData) return [];

  const files = Array.from(clipboardData.files);
  if (files.length === 0 || clipboardData.types.includes("text/plain")) {
    return [];
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  return files.map((file, index) => {
    if (file.name && file.name !== "image.png") return file;
    const extension = file.type.split("/")[1] ?? "png";
    const suffix = files.length > 1 ? `-${index + 1}` : "";
    return new File([file], `screenshot-${stamp}${suffix}.${extension}`, {
      type: file.type,
    });
  });
};
