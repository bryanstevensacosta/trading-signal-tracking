export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ParsedCommand {
  name: string;
  args: string[];
}