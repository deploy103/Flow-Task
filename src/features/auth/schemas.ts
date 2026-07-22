import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("올바른 이메일을 입력해 주세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128),
});

export const emailRequestSchema = z.object({
  email: z.string().trim().email("올바른 이메일을 입력해 주세요."),
});

export const passwordResetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128),
  passwordConfirmation: z.string().min(8).max(128),
}).refine((value) => value.password === value.passwordConfirmation, {
  message: "비밀번호가 일치하지 않습니다.",
  path: ["passwordConfirmation"],
});

export const signUpSchema = loginSchema.extend({
  name: z.string().trim().min(2, "이름은 2자 이상이어야 합니다.").max(50),
  studentNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9A-Za-z-]*$/, "학번 형식을 확인해 주세요.")
    .optional()
    .transform((value) => value || undefined),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(50),
  studentNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9A-Za-z-]*$/)
    .optional()
    .transform((value) => value || undefined),
});
