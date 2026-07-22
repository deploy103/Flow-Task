import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./components/markdown-content";

const renderMarkdown = (content: string) =>
  renderToStaticMarkup(createElement(MarkdownContent, { content }));

describe("announcement markdown", () => {
  it("renders common markdown and preserves plain text line breaks", () => {
    const html = renderMarkdown('## 제목\n\n- 항목\n\n일반\n줄바꿈');
    expect(html).toContain("<h2");
    expect(html).toContain("<li>항목</li>");
    expect(html).toContain("일반\n줄바꿈");
  });

  it("does not render raw HTML or unsafe javascript links", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n[위험](javascript:alert(1))');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
  });
});
