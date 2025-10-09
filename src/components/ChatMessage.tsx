import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

export const ChatMessage = ({ role, content, timestamp }: ChatMessageProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (role === "system") return null;

  const isUser = role === "user";

  return (
    <div className={cn("flex w-full gap-3 py-4", isUser && "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 space-y-2",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <div className="space-y-3">
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="leading-relaxed">{children}</p>,
              h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              code: ({ children }) => (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="bg-muted p-3 rounded-lg overflow-x-auto">{children}</pre>
              ),
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {timestamp && (
          <div className={cn("text-xs opacity-70", isUser && "text-right")}>
            {new Date(timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
        {!isUser && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 px-2"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
