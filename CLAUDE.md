# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AgileIQ — AI Agile Coach Mobile App

## What this app is
AgileIQ is an AI-powered Agile and Scrum coaching app for iOS and Android.
It uses the Anthropic Claude API to answer questions about Agile, Scrum,
SAFe, Lean, and coaching. It's designed for Scrum Masters, Agile Coaches,
Product Owners, and teams learning Agile.

## Tech Stack
- Expo SDK (managed workflow, do NOT eject)
- React Native with TypeScript (strict)
- Expo Router for file-based navigation
- AsyncStorage for chat history
- expo-secure-store for API key storage
- react-native-purchases (RevenueCat) for subscriptions

## App Structure
- Home/Chat screen: Main AI chat interface
- Topics screen: Browse by Scrum, SAFe, Coaching, Ceremonies, Metrics, Lean
- History screen: Past conversations
- Settings screen: Subscription, API key, preferences
- Paywall screen: Free tier (5 questions/day), Pro ($9.99/month, unlimited)

## AI System Prompt
The AI is named AgileIQ and is an expert Agile/Scrum coach trained on:
Coaching Agile Teams (Lyssa Adkins), Agile Software Requirements
(Dean Leffingwell), The 8 Stances of a Scrum Master, Management 3.0
(Jurgen Appelo), Scrum and XP From the Trenches, Agile Product Management
with Scrum (Roman Pichler), The Art of Agile Development, SAFe DevOps
Digital Workbook, and more.

## Design
- Color scheme: Dark navy (#0F172A) with teal accent (#1D9E75)
- Clean, minimal UI — feels like a professional coaching tool
- Large readable text for on-the-go use
- Bottom tab navigation
- Keyboard-aware chat input that stays above keyboard

## Conventions
- All screens in app/ using Expo Router
- Use useColorScheme() for dark mode support
- Always handle offline state gracefully
- Safe area insets on all screens
- Flex layouts only, no hardcoded dimensions
- Never store sensitive data in AsyncStorage (use expo-secure-store)

## Do NOT
- Do not eject from Expo managed workflow
- Do not use class components
- Do not hardcode the Anthropic API key in source code
