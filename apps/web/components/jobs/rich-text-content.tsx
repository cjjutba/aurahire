interface RichTextContentProps {
  html: string;
  className?: string;
}

export function RichTextContent({ html, className }: RichTextContentProps) {
  const base =
    "text-sm leading-relaxed text-[var(--color-body)] " +
    // headings
    "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-[var(--color-ink)] " +
    "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--color-ink)] " +
    "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--color-ink)] " +
    "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wider [&_h4]:text-[var(--color-muted)] " +
    "[&_:where(h1,h2,h3,h4):first-child]:mt-0 " +
    // paragraphs and inline
    "[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 " +
    "[&_strong]:font-semibold [&_strong]:text-[var(--color-ink)] " +
    "[&_em]:italic " +
    "[&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[var(--color-primary-active)] " +
    // lists
    "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ul]:marker:text-[var(--color-muted)] " +
    "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_ol]:marker:text-[var(--color-muted)] " +
    "[&_li]:pl-1 " +
    // code
    "[&_code]:rounded-[var(--radius-xs)] [&_code]:bg-[var(--color-surface-strong)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:font-mono [&_code]:text-[var(--color-ink)] " +
    "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-[var(--color-surface-soft)] [&_pre]:p-4 [&_pre]:text-[13px] [&_pre]:font-mono " +
    "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
    // blockquote
    "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-primary-soft)] [&_blockquote]:bg-[var(--color-surface-soft)] [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:italic [&_blockquote]:text-[var(--color-body)] " +
    // hr
    "[&_hr]:my-6 [&_hr]:border-[var(--color-hairline)]";

  return (
    <div
      className={[base, className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
