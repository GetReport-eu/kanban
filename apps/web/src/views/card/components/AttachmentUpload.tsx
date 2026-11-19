import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";
import { HiOutlinePaperClip } from "react-icons/hi";
import { HiCheckBadge, HiOutlinePhoto } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import Button from "~/components/Button";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { useCardCache } from "~/utils/cardCache";
import { invalidateCard } from "~/utils/cardInvalidation";
import { getPastedFiles } from "~/utils/clipboardFiles";
import { uploadFile as postFile } from "~/utils/uploadFile";

export function AttachmentUpload({ cardPublicId }: { cardPublicId: string }) {
  const { openModal } = useModal();
  const { showPopup } = usePopup();
  const cardCache = useCardCache();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    setUploading(true);

    let failedCount = 0;
    for (const file of files) {
      try {
        const response = await postFile(
          `/cards/${encodeURIComponent(cardPublicId)}/attachments`,
          file,
          file.name,
        );
        if (!response.ok) failedCount++;
      } catch {
        failedCount++;
      }
    }

    try {
      await invalidateCard(cardCache, cardPublicId);
    } finally {
      setUploading(false);
    }

    if (failedCount === 0) {
      showPopup({
        header: t`Attachment uploaded`,
        message: t`Your file has been uploaded successfully.`,
        icon: "success",
      });
    } else {
      showPopup({
        header: t`Upload failed`,
        message:
          files.length > 1
            ? t`${failedCount} of ${files.length} attachments could not be uploaded.`
            : t`Failed to upload attachment. Please try again.`,
        icon: "error",
      });
    }
  };

  // Keep the latest uploader for the window paste listener.
  const uploadFilesRef = useRef(uploadFiles);
  useEffect(() => {
    uploadFilesRef.current = uploadFiles;
  });

  // Paste a screenshot (Ctrl+V) anywhere on the card page.
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Leave pastes inside open modals alone.
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]')
      ) {
        return;
      }
      const files = getPastedFiles(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      void uploadFilesRef.current(files);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    // Reset input
    event.target.value = "";
    await uploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Ignore leaving into a child element of the drop zone.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    await uploadFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="mb-6">
      <input
        ref={inputRef}
        type="file"
        id="attachment-upload"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      <div className="flex items-center justify-between p-2">
        <Button
          type="button"
          variant="ghost"
          aria-label={t`Add checklist`}
          iconLeft={
            <HiCheckBadge className="h-4 w-4 text-light-950 dark:text-dark-950" />
          }
          iconOnly
          size="sm"
          onClick={() => openModal("ADD_CHECKLIST")}
        />
        <Button
          type="button"
          variant="ghost"
          aria-label={t`Attach files`}
          iconLeft={
            <HiOutlinePaperClip className="h-4 w-4 text-light-950 dark:text-dark-950" />
          }
          isLoading={uploading}
          disabled={uploading}
          iconOnly
          size="sm"
          onClick={() => inputRef.current?.click()}
        />
      </div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={twMerge(
          "mt-1 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed px-3 py-4 text-xs transition-colors focus-visible:outline-hidden disabled:cursor-wait disabled:opacity-60",
          isDragging
            ? "border-light-800 bg-light-200 text-light-900 dark:border-dark-800 dark:bg-dark-300 dark:text-dark-1000"
            : "border-light-600 text-light-800 hover:bg-light-200 dark:border-dark-600 dark:text-dark-800 dark:hover:bg-dark-300",
        )}
      >
        <HiOutlinePhoto size={16} />
        {uploading
          ? t`Uploading...`
          : t`Drop files here, paste a screenshot (Ctrl+V) or click to choose`}
      </button>
    </div>
  );
}
