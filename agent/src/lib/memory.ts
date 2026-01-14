/**
 * Agent Memory System
 * 
 * This module provides memory management for the AI agent including:
 * - Conversation history tracking
 * - User context and preferences
 * - Organization context
 * - Rate limiting and usage tracking
 */

import { api } from "./api-client";

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export interface UserContext {
  userId: string;
  organizationId: string;
  role: string;
  preferences: {
    reportFormat?: "pdf" | "csv" | "json";
    dateFormat?: string;
    currencySymbol?: string;
  };
}

export interface AgentMemory {
  conversationId: string;
  messages: ConversationMessage[];
  userContext: UserContext;
  createdAt: Date;
  lastInteractionAt: Date;
  metadata: {
    totalMessages: number;
    totalToolCalls: number;
    conversationDuration: number; // in seconds
  };
}

/**
 * Memory manager for tracking conversations and user context
 */
export class MemoryManager {
  private conversations: Map<string, AgentMemory> = new Map();
  private userContextCache: Map<string, UserContext> = new Map();
  private readonly MAX_MEMORY_SIZE = 50; // Keep last 50 messages per conversation
  private readonly MESSAGE_RETENTION_HOURS = 24;

  /**
   * Create or get a conversation memory
   */
  async getOrCreateConversation(
    conversationId: string,
    organizationId: string,
    userId: string
  ): Promise<AgentMemory> {
    // Check memory cache first
    if (this.conversations.has(conversationId)) {
      const memory = this.conversations.get(conversationId)!;
      memory.lastInteractionAt = new Date();
      return memory;
    }

    // Create new memory
    const memory: AgentMemory = {
      conversationId,
      messages: [],
      userContext: {
        userId,
        organizationId,
        role: "staff", // Default role
        preferences: {
          reportFormat: "pdf",
          dateFormat: "YYYY-MM-DD",
          currencySymbol: "$",
        },
      },
      createdAt: new Date(),
      lastInteractionAt: new Date(),
      metadata: {
        totalMessages: 0,
        totalToolCalls: 0,
        conversationDuration: 0,
      },
    };

    this.conversations.set(conversationId, memory);
    return memory;
  }

  /**
   * Add message to conversation memory
   */
  addMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>
  ): ConversationMessage {
    const memory = this.conversations.get(conversationId);
    if (!memory) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role,
      content,
      timestamp: new Date(),
      toolCalls,
    };

    memory.messages.push(message);
    memory.metadata.totalMessages++;

    if (toolCalls) {
      memory.metadata.totalToolCalls += toolCalls.length;
    }

    // Update last interaction
    memory.lastInteractionAt = new Date();

    // Trim old messages if exceeding max size
    if (memory.messages.length > this.MAX_MEMORY_SIZE) {
      memory.messages = memory.messages.slice(-this.MAX_MEMORY_SIZE);
    }

    return message;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(
    conversationId: string,
    limit: number = 20
  ): ConversationMessage[] {
    const memory = this.conversations.get(conversationId);
    if (!memory) return [];

    return memory.messages.slice(-limit);
  }

  /**
   * Get conversation context for agent
   */
  getConversationContext(conversationId: string): AgentMemory | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Update user context
   */
  updateUserContext(conversationId: string, context: Partial<UserContext>) {
    const memory = this.conversations.get(conversationId);
    if (memory) {
      memory.userContext = { ...memory.userContext, ...context };
    }
  }

  /**
   * Clear old conversations from memory (cleanup)
   */
  cleanupOldConversations(): number {
    let cleaned = 0;
    const now = new Date();
    const retention = this.MESSAGE_RETENTION_HOURS * 60 * 60 * 1000;

    for (const [conversationId, memory] of this.conversations.entries()) {
      if (now.getTime() - memory.lastInteractionAt.getTime() > retention) {
        this.conversations.delete(conversationId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      activeConversations: this.conversations.size,
      totalMessages: Array.from(this.conversations.values()).reduce(
        (sum, mem) => sum + mem.metadata.totalMessages,
        0
      ),
      totalToolCalls: Array.from(this.conversations.values()).reduce(
        (sum, mem) => sum + mem.metadata.totalToolCalls,
        0
      ),
    };
  }
}

/**
 * Rate limiting for safety guardrails
 */
export class RateLimiter {
  private limits: Map<string, { count: number; resetAt: Date }> = new Map();
  private readonly WINDOW_MS = 60 * 1000; // 1 minute
  private readonly MAX_REQUESTS = 30; // Max 30 requests per minute
  private readonly MAX_TOKENS = 100000; // Max tokens per conversation per day

  /**
   * Check if request is allowed
   */
  isAllowed(key: string): boolean {
    const now = new Date();
    const limit = this.limits.get(key);

    if (!limit || now > limit.resetAt) {
      this.limits.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + this.WINDOW_MS),
      });
      return true;
    }

    if (limit.count >= this.MAX_REQUESTS) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Get remaining requests for key
   */
  getRemaining(key: string): number {
    const limit = this.limits.get(key);
    if (!limit || new Date() > limit.resetAt) {
      return this.MAX_REQUESTS;
    }
    return Math.max(0, this.MAX_REQUESTS - limit.count);
  }

  /**
   * Reset limit for key
   */
  reset(key: string) {
    this.limits.delete(key);
  }
}

/**
 * Input validation and sanitization
 */
export class InputGuard {
  private readonly MAX_MESSAGE_LENGTH = 10000;
  private readonly MAX_TOOL_CALLS = 20;
  private readonly PROHIBITED_PATTERNS = [
    /DROP\s+TABLE/gi,
    /DELETE\s+FROM/gi,
    /TRUNCATE/gi,
    /ALTER\s+TABLE/gi,
  ];

  /**
   * Validate and sanitize user input
   */
  validateInput(input: string): { valid: boolean; message: string; cleaned?: string } {
    if (!input || typeof input !== "string") {
      return { valid: false, message: "Input must be a non-empty string" };
    }

    if (input.length > this.MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        message: `Input exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`,
      };
    }

    const trimmed = input.trim();

    // Check for prohibited patterns (SQL injection attempts)
    for (const pattern of this.PROHIBITED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return { valid: false, message: "Input contains prohibited patterns" };
      }
    }

    return { valid: true, message: "OK", cleaned: trimmed };
  }

  /**
   * Validate tool calls
   */
  validateToolCalls(toolCalls: unknown): boolean {
    if (!Array.isArray(toolCalls)) return true; // No tool calls is OK
    if (toolCalls.length > this.MAX_TOOL_CALLS) return false;

    return toolCalls.every(
      (call) =>
        call &&
        typeof call === "object" &&
        "name" in call &&
        "args" in call &&
        typeof call.name === "string" &&
        typeof call.args === "object"
    );
  }

  /**
   * Validate organization access
   */
  async validateOrganizationAccess(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const result = await api.workflows.validateMemberAccess(
        organizationId,
        userId,
        organizationId
      );
      return result.hasAccess;
    } catch {
      return false;
    }
  }
}

// Global singleton instances
let memoryManager: MemoryManager;
let rateLimiter: RateLimiter;
let inputGuard: InputGuard;

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}

export function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

export function getInputGuard(): InputGuard {
  if (!inputGuard) {
    inputGuard = new InputGuard();
  }
  return inputGuard;
}
