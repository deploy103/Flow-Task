import { MembershipRole, MembershipStatus, MentoringRole, QuestionBoardType, QuestionStatus, SystemRole } from "@prisma/client";

type Context = { userId: string; systemRole: SystemRole; membership: { role: MembershipRole; mentoringRole: MentoringRole; status: MembershipStatus } | null; authorId?: string; assignedMentorId?: string | null };
const active = (context: Context) => context.membership?.status === MembershipStatus.ACTIVE;
const admin = (context: Context) => context.systemRole === SystemRole.SYSTEM_ADMIN || (active(context) && context.membership?.role === MembershipRole.ORG_ADMIN);
const mentor = (context: Context) => active(context) && context.membership?.mentoringRole === MentoringRole.MENTOR;

export function canViewQuestion(boardType: QuestionBoardType, context: Context) {
  if (admin(context)) return true;
  if (!active(context)) return false;
  if (boardType === QuestionBoardType.PUBLIC_QNA) return true;
  if (context.authorId === context.userId) return true;
  if (boardType === QuestionBoardType.MENTOR_QNA) return mentor(context);
  return context.assignedMentorId === context.userId;
}

export function canCreateQuestion(boardType: QuestionBoardType, context: Context, hasPrimaryMentor: boolean) {
  if (!active(context) && context.systemRole !== SystemRole.SYSTEM_ADMIN) return false;
  if (boardType === QuestionBoardType.PRIVATE_MENTOR) return hasPrimaryMentor;
  if (boardType === QuestionBoardType.MENTOR_QNA) return context.membership?.mentoringRole === MentoringRole.MENTEE || admin(context);
  return true;
}

export function canAnswerQuestion(boardType: QuestionBoardType, context: Context) {
  if (admin(context)) return true;
  if (!active(context)) return false;
  if (boardType === QuestionBoardType.PUBLIC_QNA) return true;
  if (boardType === QuestionBoardType.MENTOR_QNA) return mentor(context);
  return context.authorId === context.userId || context.assignedMentorId === context.userId;
}

export function canModerateQuestion(boardType: QuestionBoardType, context: Context) {
  if (admin(context) || context.authorId === context.userId) return true;
  if (boardType === QuestionBoardType.MENTOR_QNA) return mentor(context);
  return boardType === QuestionBoardType.PRIVATE_MENTOR && context.assignedMentorId === context.userId;
}

export function canEditQuestion(context: Context) {
  return admin(context) || (active(context) && context.authorId === context.userId);
}

export function canSetQuestionStatus(boardType: QuestionBoardType, status: QuestionStatus, context: Context) {
  if (admin(context)) return true;
  if (context.authorId === context.userId) return status === QuestionStatus.WAITING || status === QuestionStatus.RESOLVED || status === QuestionStatus.CLOSED;
  if (!canModerateQuestion(boardType, context)) return false;
  return status === QuestionStatus.IN_PROGRESS || status === QuestionStatus.NEEDS_INFO || status === QuestionStatus.CLOSED;
}
