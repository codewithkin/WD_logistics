"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Send,
    Bot,
    User,
    Loader2,
    ArrowUp,
    Truck,
    Route,
    Receipt,
    Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    ChatMessage,
    streamChatMessage,
    checkAgentHealth,
} from "@/lib/ai/client";

interface AIChatPageProps {
    organizationId: string;
    userEmail: string;
    userName: string;
}

const quickActions = [
    {
        icon: Truck,
        label: "Fleet Status",
        prompt: "What's the current status of our fleet?",
    },
    {
        icon: Route,
        label: "Today's Trips",
        prompt: "What trips are scheduled for today?",
    },
    {
        icon: Receipt,
        label: "Overdue Invoices",
        prompt: "Show me all overdue invoices",
    },
    {
        icon: Users,
        label: "Available Drivers",
        prompt: "Which drivers are available right now?",
    },
];

export function AIChatPage({ organizationId, userEmail, userName }: AIChatPageProps) {
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

    const handleSubmit = useCallback(async (messageContent?: string) => {
        const content = messageContent || input.trim();
        if (!content || isLoading || agentStatus !== "online") return;

        const userMessage: ChatMessage = { role: "user", content };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        setIsStreaming(true);
        setStreamingContent("");

        try {
            let fullResponse = "";

            await streamChatMessage(
                content,
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
                    content: "Sorry, I encountered an error. Please try again.",
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

    const hasMessages = messages.length > 0;

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col relative overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />

            {/* Status indicator */}
            <div className="relative flex items-center justify-center gap-2 border-b bg-background/80 py-2 backdrop-blur-sm">
                <div
                    className={cn(
                        "h-2 w-2 rounded-full transition-colors duration-500",
                        agentStatus === "online" && "bg-green-500 shadow-lg shadow-green-500/50",
                        agentStatus === "offline" && "bg-red-500",
                        agentStatus === "checking" && "bg-yellow-500 animate-pulse"
                    )}
                />
                <span className="text-sm text-muted-foreground">
                    {agentStatus === "online" && "AI Assistant Online"}
                    {agentStatus === "offline" && "AI Assistant Offline"}
                    {agentStatus === "checking" && "Connecting..."}
                </span>
            </div>

            {/* Chat area */}
            <div className="relative flex-1 overflow-hidden">
                {!hasMessages ? (
                    /* Welcome screen */
                    <div className="flex h-full flex-col items-center justify-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="w-full max-w-2xl space-y-8">
                            {/* Greeting */}
                            <div className="text-center">
                                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-2xl shadow-purple-500/25 animate-in zoom-in duration-700">
                                    <Bot className="h-8 w-8 text-white animate-pulse" />
                                </div>
                                <h1 className="text-3xl font-semibold tracking-tight">
                                    Hello, {userEmail}
                                </h1>
                                <p className="mt-2 text-lg text-muted-foreground">
                                    How can I help you today?
                                </p>
                            </div>

                            {/* Quick actions */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {quickActions.map((action, i) => (
                                    <button
                                        key={action.label}
                                        onClick={() => handleSubmit(action.prompt)}
                                        disabled={agentStatus !== "online" || isLoading}
                                        className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all duration-300 hover:bg-accent hover:text-accent-foreground hover:scale-105 hover:shadow-lg hover:border-primary/50 disabled:opacity-50 disabled:hover:scale-100 animate-in fade-in slide-in-from-bottom-2"
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        <action.icon className="h-6 w-6 text-muted-foreground transition-transform duration-300 group-hover:scale-110 group-hover:text-primary" />
                                        <span className="text-sm font-medium">{action.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Input area for welcome screen */}
                            <div className="relative group">
                                <Textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything about your logistics..."
                                    className="min-h-[56px] resize-none rounded-2xl border-2 py-4 pl-4 pr-14 text-base focus-visible:ring-1 transition-shadow duration-300 group-hover:shadow-md"
                                    disabled={agentStatus !== "online" || isLoading}
                                    rows={1}
                                />
                                <Button
                                    size="icon"
                                    onClick={() => handleSubmit()}
                                    disabled={!input.trim() || agentStatus !== "online" || isLoading}
                                    className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <ArrowUp className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Messages view */
                    <div className="flex h-full flex-col">
                        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                            <div className="mx-auto max-w-2xl space-y-6">
                                {messages.map((message, index) => (
                                    <div
                                        key={index}
                                        className={cn(
                                            "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500",
                                            message.role === "user" && "justify-end"
                                        )}
                                    >
                                        {message.role === "assistant" && (
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                                                    <Bot className="h-4 w-4 text-white" />
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                        <div
                                            className={cn(
                                                "max-w-[80%] rounded-2xl px-4 py-3 transition-all duration-300 hover:shadow-md",
                                                message.role === "user"
                                                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                                                    : "bg-muted"
                                            )}
                                        >
                                            <p className="whitespace-pre-wrap text-sm">
                                                {message.content}
                                            </p>
                                        </div>
                                        {message.role === "user" && (
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarFallback>
                                                    <User className="h-4 w-4" />
                                                </AvatarFallback>
                                            </Avatar>
                                        )}
                                    </div>
                                ))}

                                {/* Streaming message */}
                                {isStreaming && streamingContent && (
                                    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                                                <Bot className="h-4 w-4 text-white" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-3">
                                            <p className="whitespace-pre-wrap text-sm">
                                                {streamingContent}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Loading indicator */}
                                {isLoading && !streamingContent && (
                                    <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <Avatar className="h-8 w-8 shrink-0">
                                            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                                                <Bot className="h-4 w-4 text-white" />
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
                                            <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input area for chat view */}
                        <div className="border-t p-4 bg-background/80 backdrop-blur-sm">
                            <div className="mx-auto max-w-2xl">
                                <div className="relative group">
                                    <Textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask anything about your logistics..."
                                        className="min-h-[56px] resize-none rounded-2xl border-2 py-4 pl-4 pr-14 text-base focus-visible:ring-1 transition-shadow duration-300 group-hover:shadow-md"
                                        disabled={agentStatus !== "online" || isLoading}
                                        rows={1}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={() => handleSubmit()}
                                        disabled={!input.trim() || agentStatus !== "online" || isLoading}
                                        className="absolute bottom-2 right-2 h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {isLoading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <ArrowUp className="h-5 w-5" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
