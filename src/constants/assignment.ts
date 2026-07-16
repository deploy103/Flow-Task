export const DEFAULT_ASSIGNMENT_DEADLINE_DAYS = 7;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const KOREAN_TIME_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1000;
export const MAX_ASSIGNMENT_TITLE_LENGTH = 100;
export const MAX_ASSIGNMENT_DESCRIPTION_LENGTH = 20_000;
export const MAX_ASSIGNMENT_TARGET_COUNT = 500;
export const MAX_SUBMISSION_TEXT_LENGTH = 50_000;
export const MAX_SUBMISSION_LINK_LENGTH = 2_048;
export const BYTES_PER_MEBIBYTE = 1024 * 1024;
export const MAX_SUBMISSION_FILE_SIZE_BYTES = 100 * BYTES_PER_MEBIBYTE;
export const MAX_SUBMISSION_FILE_COUNT = 5;
export const MAX_SUBMISSION_TOTAL_FILE_SIZE_BYTES = 300 * BYTES_PER_MEBIBYTE;
export const MAX_SUBMISSION_FILENAME_LENGTH = 255;
export const SUBMISSION_UPLOAD_GRANT_TTL_MINUTES = 15;
export const SUBMISSION_SIGNED_UPLOAD_TOKEN_TTL_MINUTES = 120;
export const SUBMISSION_UPLOAD_CLEANUP_GRACE_MINUTES = 10;
export const SUBMISSION_UPLOAD_CLEANUP_RETRY_MINUTES = 15;
export const SUBMISSION_UPLOAD_CLEANUP_BATCH_SIZE = 100;
export const SUBMISSION_UPLOAD_CLEANUP_MAX_BATCHES = 10;
export const SUBMISSION_UPLOAD_RATE_WINDOW_MINUTES = 10;
export const MAX_SUBMISSION_UPLOAD_REQUEST_BODY_BYTES = 4 * 1024;
export const MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW = 10;
export const SUBMISSION_UPLOAD_RESERVED_BYTES = MAX_SUBMISSION_FILE_SIZE_BYTES;
export const MAX_SUBMISSION_UPLOAD_BYTES_PER_WINDOW =
  MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW * SUBMISSION_UPLOAD_RESERVED_BYTES;
export const MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_USER =
  MAX_SUBMISSION_UPLOAD_GRANTS_PER_WINDOW * SUBMISSION_UPLOAD_RESERVED_BYTES;
export const MAX_PENDING_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION =
  15 * 1024 * BYTES_PER_MEBIBYTE;
export const MAX_SUBMISSION_UPLOAD_BYTES_PER_ORGANIZATION_WINDOW =
  30 * 1024 * BYTES_PER_MEBIBYTE;

export const SUBMISSION_FILE_MIME_TYPES = {
  pdf: ["application/pdf"],
  hwp: ["application/x-hwp", "application/haansofthwp", "application/octet-stream"],
  hwpx: ["application/vnd.hancom.hwpx", "application/zip", "application/octet-stream"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
} as const;

export const ASSIGNMENT_FIELD_LABELS = {
  TEXT: "제출 내용",
  FILE: "결과 파일",
  LINK: "관련 링크",
} as const;
