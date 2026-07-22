import { cn } from "@/lib/utils";

export function NotificationBadge({ count, mobile = false }: { count: number; mobile?: boolean }) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : String(count);
  const accessibleCount = count > 99 ? "99개 이상" : `${count}개`;

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "rounded-full bg-red-500 px-1 text-center text-[10px] text-white",
          mobile ? "absolute ml-5 -mt-7 min-w-5" : "ml-auto px-2 py-0.5 text-xs",
        )}
      >
        {displayCount}
      </span>
      <span className="sr-only">읽지 않은 알림 {accessibleCount}</span>
    </>
  );
}
