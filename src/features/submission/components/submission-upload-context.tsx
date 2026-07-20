"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const SubmissionUploadContext = createContext<{
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
} | null>(null);

export function SubmissionUploadProvider({ children }: { children: ReactNode }) {
  const [uploading, setUploading] = useState(false);
  const value = useMemo(() => ({ uploading, setUploading }), [uploading]);
  return <SubmissionUploadContext.Provider value={value}>{children}</SubmissionUploadContext.Provider>;
}

export function useSubmissionUpload() {
  const value = useContext(SubmissionUploadContext);
  if (!value) throw new Error("SubmissionUploadProvider is required");
  return value;
}
