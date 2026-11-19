import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

interface StrikeOverlayProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  completedLines: string[];
  className?: string;
}

/**
 * 在两行文字中间画删除线。
 *
 * <textarea> 不支持给局部文字加样式，所以在 textarea 上方盖一层透明的
 * 「测量 + 画线」层：先用一个隐藏的等宽镜像 div 复刻 textarea 的排版，
 * 用 Range 取出每条已完成行实际占用的矩形，再在矩形竖直中线处画一条 1px 的线。
 * 这样文字本身保持普通文本（可选中、可编辑），只是看起来被划掉了。
 */
export function StrikeOverlay({
  textareaRef,
  content,
  completedLines,
  className = "",
}: StrikeOverlayProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const textarea = textareaRef.current;
    const canvas = canvasRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !canvas || !mirror) return;

    canvas.replaceChildren();

    const completed = new Set<string>();
    for (const line of completedLines) {
      const key = line.trim();
      if (key) completed.add(key);
    }
    if (completed.size === 0 || !content) {
      mirror.textContent = "";
      return;
    }

    const style = window.getComputedStyle(textarea);
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.fontStyle = style.fontStyle;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.style.wordSpacing = style.wordSpacing;
    mirror.style.textTransform = style.textTransform;
    mirror.style.textAlign = style.textAlign;
    mirror.style.textIndent = style.textIndent;
    mirror.style.whiteSpace = style.whiteSpace;
    mirror.style.overflowWrap = style.overflowWrap;
    mirror.style.wordBreak = style.wordBreak;
    mirror.style.padding = style.padding;
    mirror.style.tabSize = style.tabSize;
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.textContent = content;

    const textNode = mirror.firstChild;
    if (!textNode) {
      mirror.textContent = "";
      return;
    }

    const mirrorRect = mirror.getBoundingClientRect();
    let offset = 0;
    for (const line of content.split("\n")) {
      const key = line.trim();
      if (key && completed.has(key) && line.length > 0) {
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset + line.length);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width < 1 || rect.height < 1) continue;
          const bar = document.createElement("span");
          bar.className = "strike-overlay-line";
          bar.style.left = `${rect.left - mirrorRect.left}px`;
          bar.style.top = `${rect.top - mirrorRect.top + rect.height / 2}px`;
          bar.style.width = `${rect.width}px`;
          canvas.appendChild(bar);
        }
      }
      offset += line.length + 1;
    }

    canvas.style.transform = `translateY(${-textarea.scrollTop}px)`;
  }, [completedLines, content, textareaRef]);

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return undefined;

    const syncScroll = () => {
      const canvas = canvasRef.current;
      if (canvas) canvas.style.transform = `translateY(${-textarea.scrollTop}px)`;
    };
    textarea.addEventListener("scroll", syncScroll, { passive: true });

    const observer = new ResizeObserver(() => draw());
    observer.observe(textarea);

    // 字号/字体等样式变化（设置面板调整、主题切换）时重新测量
    const styleObserver = new MutationObserver(() => draw());
    styleObserver.observe(textarea, { attributes: true, attributeFilter: ["style", "class"] });

    let cancelled = false;
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts?.ready) {
      void fonts.ready.then(() => {
        if (!cancelled) draw();
      });
    }

    return () => {
      cancelled = true;
      textarea.removeEventListener("scroll", syncScroll);
      observer.disconnect();
      styleObserver.disconnect();
    };
  }, [draw, textareaRef]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden ${className}`}
    >
      <div ref={canvasRef} className="pointer-events-none absolute inset-0" />
      <div
        ref={mirrorRef}
        aria-hidden="true"
        style={{ visibility: "hidden", position: "absolute", top: 0, left: 0 }}
      />
    </div>
  );
}
