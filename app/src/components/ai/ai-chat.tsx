"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ChatMessage,
  streamChatMessage,
  checkAgentHealth,
} from "@/lib/ai/client";

interface AIChatProps {
  organizationId: string;
}

export function AIChat({ organizationId }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState<"online" | "offline" | "checking">("checking");
  const [streamingContent, setStreamingContent] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check agent health on mount
  useEffect(() => {
    const checkHealth = async () => {
      setAgentStatus("checking");
      const health = await checkAgentHealth();
      setAgentStatus(health.status === "healthy" ? "online" : "offline");
    };
    checkHealth();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading || agentStatus !== "online") return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingContent("");

    try {
      let fullResponse = "";

      await streamChatMessage(
        userMessage.content,
        organizationId,
        messages,
        (chunk) => {
          if (chunk.type === "text" && chunk.content) {
            fullResponse += chunk.content;
            setStreamingContent(fullResponse);
          } else if (chunk.type === "done") {
            setIsStreaming(false);
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: fullResponse },
            ]);
            setStreamingContent("");
          } else if (chunk.type === "error") {
            setIsStreaming(false);
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: `Sorry, an error occurred: ${chunk.error}`,
              },
            ]);
            setStreamingContent("");
          }
        }
      );
    } catch (error) {
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I couldn't process your request. ${error instanceof Error ? error.message : "Please try again."}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, agentStatus, organizationId, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingContent("");
  };

  const retryConnection = async () => {
    setAgentStatus("checking");
    const health = await checkAgentHealth();
    setAgentStatus(health.status === "healthy" ? "online" : "offline");
  };

  const suggestedQuestions = [
    "What trucks are available today?",
    "Show me overdue invoices",
    "How many trips are scheduled this week?",
    "Which drivers have expiring licenses?",
    "What's the revenue summary for this month?",
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">WD Logistics Assistant</h2>
            <div className="flex items-center gap-2">
              <Badge
                variant={agentStatus === "online" ? "default" : "secondary"}
                className={cn(
                  "text-xs",
                  agentStatus === "online" && "bg-green-500 hover:bg-green-500"
                )}
              >
                {agentStatus === "checking" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                {agentStatus === "online"
                  ? "Online"
                  : agentStatus === "checking"
                    ? "Connecting..."
                    : "Offline"}
              </Badge>
              {agentStatus === "offline" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={retryConnection}
                  className="h-6 px-2"
                >
                  <RefreshCcw className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat}>
            <Trash2 className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        {messages.length === 0 && !isStreaming ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">
              How can I help you today?
            </h3>
            <p className="mb-6 max-w-md text-sm text-muted-foreground">
              I can help you with trucks, trips, drivers, invoices, and more.
              Ask me anything about your logistics operations!
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedQuestions.map((question, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(question)}
                  disabled={agentStatus !== "online"}
                >
                  {question}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, i) => (
              <MessageBubble key={i} message={message} />
            ))}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{ role: "assistant", content: streamingContent }}
                isStreaming
              />
            )}
            {isLoading && !streamingContent && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <Card className="max-w-[80%] p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              agentStatus === "online"
                ? "Ask me anything..."
                : "Agent is offline"
            }
            disabled={agentStatus !== "online" || isLoading}
            className="min-h-[44px] max-h-[150px] resize-none"
            rows={1}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading || agentStatus !== "online"}
            size="icon"
            className="h-[44px] w-[44px] shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback
          className={cn(isUser ? "bg-secondary" : "bg-primary/10")}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4 text-primary" />
          )}
        </AvatarFallback>
      </Avatar>
      <Card
        className={cn(
          "max-w-[80%] p-3",
          isUser && "bg-primary text-primary-foreground"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.content}
            {isStreaming && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}
