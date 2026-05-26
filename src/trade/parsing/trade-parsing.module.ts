import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RegexParserAdapter } from './infrastructure/adapters/regex-parser.adapter';
import { TradeValidator } from './domain/services/trade-validator';
import { ParserService } from './domain/services/parser.service';
import { ParseTradeHandler } from './application/commands/parse-trade/handler';
import { PARSER_PORT } from './domain/ports/parser.port';

const CommandHandlers = [ParseTradeHandler];

@Module({
  imports: [CqrsModule],
  providers: [
    { provide: PARSER_PORT, useClass: RegexParserAdapter },
    TradeValidator,
    ParserService,
    ...CommandHandlers,
  ],
  exports: [ParserService],
})
export class TradeParsingModule {}