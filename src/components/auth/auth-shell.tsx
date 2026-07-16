import Link from "next/link";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-indigo-100/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
        <Link href="/" className="text-sm font-bold tracking-wide text-indigo-600">
          FLOW TASK
        </Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        {children}
      </section>
    </main>
  );
}
