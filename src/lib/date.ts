const KOREAN_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatKoreanDateTime(date: Date) {
  return KOREAN_DATE_TIME_FORMATTER.format(date);
}
