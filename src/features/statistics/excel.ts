import type { OrganizationStatistics } from "./queries";

export function safeSpreadsheetText(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function xml(value: unknown) {
  return safeSpreadsheetText(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function row(values: unknown[]) { return `<Row>${values.map((value) => `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`).join("")}</Row>`; }
function sheet(name: string, rows: unknown[][]) { return `<Worksheet ss:Name="${xml(name)}"><Table>${rows.map(row).join("")}</Table></Worksheet>`; }

export function organizationStatisticsExcel(stats: OrganizationStatistics) {
  const summary = [["항목", "값"], ["활성 구성원", stats.memberCount], ["채점 완료 응시", stats.quiz.attempts], ["퀴즈 평균", stats.quiz.average ?? "-"], ["질문", stats.questions.total], ["미답변 질문", stats.questions.unanswered], ["평균 최초 답변(분)", stats.questions.averageFirstResponseMinutes?.toFixed(1) ?? "-"]];
  const assignments = [["과제", "제출", "대상", "제출률"], ...stats.assignmentRows.map((item) => [item.title, item.submitted, item.target, `${(item.rate * 100).toFixed(1)}%`])];
  const quiz = [["문항", "정답", "응답", "정답률"], ...stats.quiz.questions.map((item) => [item.prompt, item.correct, item.total, `${(item.rate * 100).toFixed(1)}%`])];
  const announcements = [["공지", "확인", "대상", "확인률"], ...stats.announcementRows.map((item) => [item.title, item.read, item.target, `${(item.rate * 100).toFixed(1)}%`])];
  return `<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheet("요약", summary)}${sheet("과제", assignments)}${sheet("퀴즈", quiz)}${sheet("공지", announcements)}</Workbook>`;
}
