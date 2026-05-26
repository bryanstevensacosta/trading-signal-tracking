# TG Trading Bot - Requirements

## Objective

Telegram bot that parses trades, saves them to SQLite and notifies via Telegram when price hits entry, TP or SL.

## Architecture

See `architecture.md`

## Features

### Trade Ingestion
See `trade-ingestion.md`

### Trade Parsing
See `trade-parsing.md`

### Trade Repository
See `trade-repository.md`

### Trade State
See `trade-state.md`

### Trade Engine
See `trade-engine.md`

### Trade Shared
See `trade-shared.md`

### Telegram Command
See `telegram-command.md`

### Notifications
See `telegram-notification-single-trade.md`, `telegram-notification-trade-list.md`

### Price Stream
See `price-stream.md`

### Price Cache
See `price-cache.md`

### Price Exchange
See `exchange-binance.md`, `price-exchange.md`

## Tech Stack

See `tech-stack.md`, `tech-stack-nestjs.md`, `nestjs-modules.md`, `nestjs-cqrs.md`, `nestjs-components.md`, `nestjs-lifecycle.md`, `nestjs-testing.md`, `nestjs-websocket.md`

## MVP Scope

- Binance only
- Single user
- Crypto only (perpetual futures and spot)