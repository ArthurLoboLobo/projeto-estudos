import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
  isUserMessage?: boolean;
  isMobile?: boolean;
}

export default function Markdown({ children, className, isUserMessage = false, isMobile = false }: MarkdownProps) {
  return (
    <div
      className={cn(
        // Base prose styling
        "prose max-w-none leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        // Responsive sizing
        isMobile ? "prose-sm [&_*]:text-sm" : "prose-sm md:prose-base",
        // User message styling (dark background)
        isUserMessage && "prose-invert",
        // Custom className
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom table styling
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table
                className={cn(
                  "min-w-full border-collapse border border-gray-300 rounded-lg overflow-hidden",
                  isUserMessage ? "border-white/30" : "border-gray-300"
                )}
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead
              className={cn(
                isUserMessage ? "bg-white/10" : "bg-gray-50"
              )}
              {...props}
            >
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="divide-y divide-gray-200" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="hover:bg-gray-50/50" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th
              className={cn(
                "px-4 py-3 text-left text-sm font-semibold border-r border-gray-300 last:border-r-0",
                isUserMessage ? "text-white border-white/30" : "text-gray-900"
              )}
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td
              className={cn(
                "px-4 py-3 text-sm border-r border-gray-300 last:border-r-0",
                isUserMessage ? "text-white border-white/30" : "text-gray-700"
              )}
              {...props}
            >
              {children}
            </td>
          ),
          // Enhanced code block styling
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            return !isInline ? (
              <pre className={cn(
                "rounded-lg p-4 overflow-x-auto my-4 text-sm",
                isUserMessage ? "bg-white/20 text-white" : "bg-gray-900 text-gray-100"
              )}>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code
                className={cn(
                  "px-1.5 py-0.5 rounded text-sm font-mono",
                  isUserMessage ? "bg-white/20 text-white" : "bg-gray-100 text-gray-800"
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          // Enhanced blockquote styling
          blockquote: ({ children, ...props }) => (
            <blockquote
              className={cn(
                "border-l-4 pl-4 my-4 italic",
                isUserMessage ? "border-white/50 text-white/90" : "border-gray-300 text-gray-600"
              )}
              {...props}
            >
              {children}
            </blockquote>
          ),
          // Enhanced list styling
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-4" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-4" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="leading-relaxed" {...props}>
              {children}
            </li>
          ),
          // Enhanced heading styling
          h1: ({ children, ...props }) => (
            <h1
              className={cn(
                "text-xl font-bold mb-4 mt-6 first:mt-0",
                isUserMessage ? "text-white" : "text-gray-900"
              )}
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className={cn(
                "text-lg font-bold mb-3 mt-5 first:mt-0",
                isUserMessage ? "text-white" : "text-gray-900"
              )}
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className={cn(
                "text-base font-semibold mb-2 mt-4 first:mt-0",
                isUserMessage ? "text-white" : "text-gray-900"
              )}
              {...props}
            >
              {children}
            </h3>
          ),
          // Enhanced link styling
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              className={cn(
                "underline font-medium hover:no-underline",
                isUserMessage ? "text-blue-300 hover:text-blue-200" : "text-blue-600 hover:text-blue-800"
              )}
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          ),
          // Enhanced paragraph styling
          p: ({ children, ...props }) => (
            <p className="mb-4 last:mb-0 leading-relaxed" {...props}>
              {children}
            </p>
          ),
          // Enhanced strong/bold styling
          strong: ({ children, ...props }) => (
            <strong
              className={cn(
                "font-semibold",
                isUserMessage ? "text-white" : "text-gray-900"
              )}
              {...props}
            >
              {children}
            </strong>
          ),
          // Enhanced emphasis/italic styling
          em: ({ children, ...props }) => (
            <em
              className={cn(
                "italic",
                isUserMessage ? "text-white/90" : "text-gray-700"
              )}
              {...props}
            >
              {children}
            </em>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
