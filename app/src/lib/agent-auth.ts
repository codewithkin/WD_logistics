import { NextRequest, NextResponse } from "next/server";

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const AGENT_ALLOWED_ORIGIN = process.env.AGENT_URL || "http://localhost:3001";

/**
 * Validates that the request is coming from the agent app
 * Uses API key authentication and CORS validation
 */
export function validateAgentRequest(request: NextRequest): { valid: boolean; error?: string } {
  // Check API key
  const apiKey = request.headers.get("x-api-key");
  
  if (!AGENT_API_KEY) {
    console.warn("AGENT_API_KEY is not configured");
    return { valid: false, error: "Agent API not configured" };
  }

  if (!apiKey || apiKey !== AGENT_API_KEY) {
    return { valid: false, error: "Invalid API key" };
  }

  return { valid: true };
}

/**
 * Creates CORS headers for agent API responses
 */
export function agentCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": AGENT_ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-organization-id",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handles OPTIONS preflight requests for CORS
 */
export function handleCorsPreflightRequest(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: agentCorsHeaders(),
  });
}

/**
 * Creates a JSON response with CORS headers
 */
export function agentJsonResponse(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: agentCorsHeaders(),
  });
}

/**
 * Creates an error response with CORS headers
 */
export function agentErrorResponse(error: string, status = 401): NextResponse {
  return NextResponse.json({ error }, {
    status,
    headers: agentCorsHeaders(),
  });
}

/**
 * Wrapper to validate agent request and handle CORS
 * Returns null if valid, error response if invalid
 */
export function withAgentAuth(request: NextRequest): NextResponse | null {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Validate request
  const validation = validateAgentRequest(request);
  if (!validation.valid) {
    return agentErrorResponse(validation.error || "Unauthorized", 401);
  }

  return null; // Request is valid, continue processing
}

/**
 * Gets the organization ID from the request headers
 */
export function getOrganizationId(request: NextRequest): string | null {
  return request.headers.get("x-organization-id");
}
