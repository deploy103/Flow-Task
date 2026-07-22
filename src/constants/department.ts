import { DepartmentRole } from "@prisma/client";

export const MAX_DEPARTMENT_NAME_LENGTH = 80;
export const MAX_DEPARTMENT_DESCRIPTION_LENGTH = 500;
export const MAX_DEPARTMENT_MESSAGE_LENGTH = 2000;
export const DEPARTMENT_MESSAGE_PAGE_SIZE = 100;
export const MAX_DEPARTMENT_MESSAGES_PER_MINUTE = 20;

export const DEPARTMENT_ROLE_LABELS: Record<DepartmentRole, string> = {
  [DepartmentRole.MEMBER]: "부서원",
  [DepartmentRole.LEAD]: "부서장",
};
