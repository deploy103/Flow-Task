import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, label = "뒤로가기" }: { href: string; label?: string }) {
  return <Link href={href} className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-indigo-600"><ArrowLeft size={18} />{label}</Link>;
}
