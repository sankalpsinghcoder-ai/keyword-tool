# Global Keyword Research Engine

A lightweight, automated multi-language keyword research tool. It uses Google Gemini models for linguistic localization across 10 global markets and verifies live search volume and organic competition using real-time search engine demand signals.

## Features

- Localized Keyword Extraction: Generates high-intent native language keywords for Brazil, Indonesia, Germany, Mexico, France, Philippines, Japan, Russia, Spain, and Vietnam.
- Live Demand Verification: Validates search volume and competition against Google search suggestion density.
- Plain Markdown Export: Download keyword lists formatted with titles, summaries, and newline-separated keywords without tables.
- Model Resilience: Automatic fallback routing across multiple Gemini models to prevent service interruptions during demand spikes.

## Prerequisites

- Node.js (v18.0.0 or higher recommended)
- npm (bundled with Node.js)
- A Google Gemini API Key (available from Google AI Studio)

## Installation and Setup

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/keyword-tool.git](https://github.com/your-username/keyword-tool.git)
cd keyword-tool
