export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ParsedCommand {
  name: string;
  args: string[];
}

export interface CommandPort {
  parseCommand(text: string): ParsedCommand | null;
  executeCommand(parsed: ParsedCommand, chatId: number): Promise<CommandResult>;
}