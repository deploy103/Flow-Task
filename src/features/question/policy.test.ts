import { MembershipRole, MembershipStatus, MentoringRole, QuestionBoardType, SystemRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canAnswerQuestion, canEditQuestion, canModerateQuestion, canSetQuestionStatus, canViewQuestion } from "./policy";

const member = { userId: "member", systemRole: SystemRole.USER, membership: { role: MembershipRole.MEMBER, mentoringRole: MentoringRole.MENTEE, status: MembershipStatus.ACTIVE } };
const mentor = { userId: "mentor", systemRole: SystemRole.USER, membership: { role: MembershipRole.MENTOR, mentoringRole: MentoringRole.MENTOR, status: MembershipStatus.ACTIVE } };
describe("question access policy", () => {
  it("keeps mentor questions private from other members", () => {
    expect(canViewQuestion(QuestionBoardType.MENTOR_QNA, { ...member, authorId: "other" })).toBe(false);
    expect(canViewQuestion(QuestionBoardType.MENTOR_QNA, { ...mentor, authorId: "other" })).toBe(true);
  });
  it("limits private mentor answers to participants", () => {
    expect(canAnswerQuestion(QuestionBoardType.PRIVATE_MENTOR, { ...mentor, authorId: "member", assignedMentorId: "mentor" })).toBe(true);
    expect(canAnswerQuestion(QuestionBoardType.PRIVATE_MENTOR, { ...mentor, userId: "other", authorId: "member", assignedMentorId: "mentor" })).toBe(false);
  });
  it("does not let an unrelated mentor change a private thread status", () => {
    expect(canModerateQuestion(QuestionBoardType.PRIVATE_MENTOR, { ...mentor, userId: "other", authorId: "member", assignedMentorId: "mentor" })).toBe(false);
    expect(canModerateQuestion(QuestionBoardType.PRIVATE_MENTOR, { ...mentor, authorId: "member", assignedMentorId: "mentor" })).toBe(true);
  });
  it("separates author resolution from mentor information requests", () => {
    expect(canSetQuestionStatus(QuestionBoardType.MENTOR_QNA, "NEEDS_INFO", { ...member, authorId: "member" })).toBe(false);
    expect(canSetQuestionStatus(QuestionBoardType.MENTOR_QNA, "RESOLVED", { ...member, authorId: "member" })).toBe(true);
    expect(canSetQuestionStatus(QuestionBoardType.MENTOR_QNA, "NEEDS_INFO", { ...mentor, authorId: "member" })).toBe(true);
  });
  it("limits edits and deletion to the author or an organization administrator", () => {
    expect(canEditQuestion({ ...member, authorId: "member" })).toBe(true);
    expect(canEditQuestion({ ...mentor, authorId: "member" })).toBe(false);
    expect(canEditQuestion({ ...member, membership: { ...member.membership, status: MembershipStatus.INACTIVE }, authorId: "member" })).toBe(false);
    expect(canEditQuestion({ ...member, userId: "admin", membership: { role: MembershipRole.ORG_ADMIN, mentoringRole: MentoringRole.NONE, status: MembershipStatus.ACTIVE }, authorId: "member" })).toBe(true);
  });

  it("uses the independent mentoring role for mentor access", () => {
    const independentlyClassifiedMentor = { ...mentor, membership: { ...mentor.membership, role: MembershipRole.MEMBER } };
    expect(canViewQuestion(QuestionBoardType.MENTOR_QNA, { ...independentlyClassifiedMentor, authorId: "other" })).toBe(true);
    expect(canAnswerQuestion(QuestionBoardType.MENTOR_QNA, { ...independentlyClassifiedMentor, authorId: "other" })).toBe(true);
  });
});
