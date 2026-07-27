"use client";

import { Bold, Code2, Eye, Italic, Link as LinkIcon, List, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { MAX_ANNOUNCEMENT_CONTENT_LENGTH } from "@/constants/announcement";
import { MarkdownContent } from "./markdown-content";

export function MarkdownEditor({ initialContent = "" }: { initialContent?: string }) {
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const wrapSelection = (before: string, after = before, placeholder = "텍스트") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    if (next.length > MAX_ANNOUNCEMENT_CONTENT_LENGTH) return;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">내용</span>
        <div className="flex rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800">
          <button className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-3 ${!preview ? "bg-white font-semibold shadow-sm dark:bg-slate-700" : ""}`} onClick={() => setPreview(false)} type="button"><Pencil size={15} /> 편집</button>
          <button className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-3 ${preview ? "bg-white font-semibold shadow-sm dark:bg-slate-700" : ""}`} onClick={() => setPreview(true)} type="button"><Eye size={15} /> 미리보기</button>
        </div>
      </div>
      {!preview && (
        <>
          <div className="mt-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
            <button aria-label="굵게" className="rounded-lg p-2 hover:bg-white dark:hover:bg-slate-700" onClick={() => wrapSelection("**")} type="button"><Bold size={17} /></button>
            <button aria-label="기울임" className="rounded-lg p-2 hover:bg-white dark:hover:bg-slate-700" onClick={() => wrapSelection("_")} type="button"><Italic size={17} /></button>
            <button aria-label="링크" className="rounded-lg p-2 hover:bg-white dark:hover:bg-slate-700" onClick={() => wrapSelection("[", "](https://)", "링크 이름")} type="button"><LinkIcon size={17} /></button>
            <button aria-label="목록" className="rounded-lg p-2 hover:bg-white dark:hover:bg-slate-700" onClick={() => wrapSelection("- ", "", "목록 항목")} type="button"><List size={17} /></button>
            <button aria-label="코드" className="rounded-lg p-2 hover:bg-white dark:hover:bg-slate-700" onClick={() => wrapSelection("`", "`", "코드")} type="button"><Code2 size={17} /></button>
          </div>
          <textarea
            className="min-h-72 w-full rounded-b-xl border border-slate-200 bg-white p-3 font-mono text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            maxLength={MAX_ANNOUNCEMENT_CONTENT_LENGTH}
            name="content"
            onChange={(event) => setContent(event.target.value)}
            placeholder={'## 활동 안내\n\n- 준비물\n- 일정\n\n[관련 링크](https://example.com)'}
            ref={textareaRef}
            required
            value={content}
          />
          <p className="mt-1 text-right text-xs text-slate-400">{content.length.toLocaleString()} / {MAX_ANNOUNCEMENT_CONTENT_LENGTH.toLocaleString()}</p>
        </>
      )}
      {preview && <div className="mt-2 min-h-72 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">{content ? <MarkdownContent content={content} /> : <p className="text-sm text-slate-400">내용을 입력하면 여기에 미리보기가 표시됩니다.</p>}<textarea className="sr-only" name="content" readOnly required value={content} /></div>}
      <p className="mt-2 text-xs text-slate-500">Markdown 지원: 제목(##), 굵게(**), 목록(-), 링크, 인용(&gt;), 코드(`)</p>
    </div>
  );
}
