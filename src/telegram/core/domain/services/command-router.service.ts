import { Injectable } from '@nestjs/common';

export interface ParsedCommand {
  name: string;
  args: string[];
}

@Injectable()
export class CommandRouterService {
  parse(text: string): ParsedCommand | null {
    const trimmed = text.trim();

    if (!trimmed.startsWith('/')) {
      return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    return { name, args };
  }

  route(command: ParsedCommand): { type: 'query' | 'mutation'; name: string; args: string[] } | null {
    const queryCommands = ['start', 'help', 'trades', 'active', 'history', 'stats', 'trade', 'price', 'share_card_position', 'share_card_account'];
    const mutationCommands = ['cancel', 'delete', 'entry', 'sl', 'tp', 'close', 'open', 'be'];

    if (queryCommands.includes(command.name)) {
      return { type: 'query', name: command.name, args: command.args };
    }

    if (mutationCommands.includes(command.name)) {
      return { type: 'mutation', name: command.name, args: command.args };
    }

    return null;
  }
}