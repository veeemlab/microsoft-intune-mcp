export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  handler: (args: Record<string, string>) => Promise<ToolResponse>;
}

export interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface TokenData {
  access_token: string;
  expires_in: number;
  obtained_at: number;
}

export interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
    innerError?: {
      'request-id'?: string;
      date?: string;
      [key: string]: unknown;
    };
  };
}
