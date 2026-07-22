import {
  ASSIGNMENT_SETUP_TYPE,
  type AssignmentSetupType,
} from "@/constants/assignment";

export function getAssignmentSetupPath(
  organizationId: string,
  assignmentId: string,
  setupType: AssignmentSetupType,
) {
  const assignmentPath = `/organizations/${organizationId}/assignments/${assignmentId}`;
  switch (setupType) {
    case ASSIGNMENT_SETUP_TYPE.ONLINE_QUIZ:
      return `${assignmentPath}/quiz/new`;
    case ASSIGNMENT_SETUP_TYPE.STATIC_CTF:
      return `${assignmentPath}/ctf/new`;
    case ASSIGNMENT_SETUP_TYPE.EXTERNAL_CHALLENGE:
      return `${assignmentPath}/challenges/new`;
    default:
      return assignmentPath;
  }
}
