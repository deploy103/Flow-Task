import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="space-y-4 break-words leading-7">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mt-7 text-2xl font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 text-xl font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-5 text-lg font-bold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
          blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-300 bg-indigo-50 px-4 py-2 text-slate-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-slate-200">{children}</blockquote>,
          a: ({ children, href }) => <a className="text-indigo-600 underline underline-offset-2 dark:text-indigo-300" href={href} rel="noopener noreferrer" target="_blank">{children}</a>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{children}</pre>,
          code: ({ children, className }) => className
            ? <code className={className}>{children}</code>
            : <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm dark:bg-slate-800">{children}</code>,
          hr: () => <hr className="border-slate-200 dark:border-slate-700" />,
          table: ({ children }) => <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-slate-300 bg-slate-50 p-2 text-left dark:border-slate-700 dark:bg-slate-800">{children}</th>,
          td: ({ children }) => <td className="border border-slate-300 p-2 dark:border-slate-700">{children}</td>,
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
