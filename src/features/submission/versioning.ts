export function getNextSubmissionVersion(latestVersion: number) {
  if (!Number.isSafeInteger(latestVersion) || latestVersion < 0) {
    throw new Error("INVALID_SUBMISSION_VERSION");
  }
  return latestVersion + 1;
}

export function hasSubmissionVersionConflict(persistedVersion: number, loadedVersion: number) {
  return persistedVersion !== loadedVersion;
}
