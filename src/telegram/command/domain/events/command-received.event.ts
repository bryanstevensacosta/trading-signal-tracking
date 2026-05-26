export interface CommandExecutedEvent {
  command: string;
  userId: number;
  args: string[];
  result: string;
  timestamp: Date;
}

export interface CommandErrorEvent {
  command: string;
  userId: number;
  args: string[];
  error: string;
  timestamp: Date;
}