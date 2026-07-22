import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationBadge } from "./notification-badge";

describe("notification badge", () => {
  it("keeps the visual count decorative and exposes an accurate accessible count", () => {
    const html = renderToStaticMarkup(createElement(NotificationBadge, { count: 7 }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("읽지 않은 알림 7개");
  });

  it("announces counts over the visual limit as 99 or more", () => {
    const html = renderToStaticMarkup(createElement(NotificationBadge, { count: 120 }));
    expect(html).toContain("99+");
    expect(html).toContain("읽지 않은 알림 99개 이상");
    expect(html).not.toContain("읽지 않은 알림 99개</span>");
  });
});
