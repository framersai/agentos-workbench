# Search Tool Setup Guide

## Overview

AgentOS now includes built-in web search capabilities that allow agents to search the internet, aggregate research, and fact-check information. This guide will help you set up a free search API provider.

## Recommended Free Search Providers

### 1. **Serper.dev** (⭐ Recommended)
- **Free Credits**: 2,500 queries free
- **Sign Up**: [https://serper.dev/signup](https://serper.dev/signup)
- **Documentation**: [https://serper.dev/docs](https://serper.dev/docs)
- **Setup**:
  1. Sign up for a free account
  2. Get your API key from the dashboard
  3. Add to your `.env` file: `SERPER_API_KEY=your_api_key_here`

### 2. **SerpAPI** (⭐ Recommended)
- **Free Credits**: 100 searches per month
- **Sign Up**: [https://serpapi.com/users/sign_up](https://serpapi.com/users/sign_up)
- **Documentation**: [https://serpapi.com/search-api](https://serpapi.com/search-api)
- **Setup**:
  1. Create a free account
  2. Copy your API key from Account → API Key
  3. Add to your `.env` file: `SERPAPI_API_KEY=your_api_key_here`

### 3. **Brave Search API**
- **Free Credits**: 2,000 queries per month
- **Sign Up**: [https://brave.com/search/api/](https://brave.com/search/api/)
- **Documentation**: [https://brave.com/search/api/documentation/](https://brave.com/search/api/documentation/)
- **Setup**:
  1. Register for the Brave Search API
  2. Get your API key
  3. Add to your `.env` file: `BRAVE_SEARCH_API_KEY=your_api_key_here`

### 4. **DuckDuckGo** (Fallback)
- **Free Credits**: Unlimited (rate limited)
- **Sign Up**: Not required
- **Documentation**: [https://duckduckgo.com/api](https://duckduckgo.com/api)
- **Note**: Limited functionality, uses instant answer API only

## Environment Configuration

Add one of the following to your backend `.env` file:

```bash
# Option 1: Serper.dev (Recommended - 2,500 free queries)
SERPER_API_KEY=your_serper_api_key_here

# Option 2: SerpAPI (100 free searches/month)
SERPAPI_API_KEY=your_serpapi_key_here

# Option 3: Brave Search (2,000 free queries/month)
BRAVE_SEARCH_API_KEY=your_brave_api_key_here

# Optional: Custom rate limits (requests per second)
SEARCH_RATE_LIMIT=5
```

## Available Search Tools

Once configured, agents will have access to these tools:

### 1. **Web Search** (`webSearch`)
Performs web searches and returns relevant results including titles, snippets, and URLs.

**Parameters**:
- `query`: Search query
- `numResults`: Number of results (max 10)
- `searchType`: Type of search (web, news, images, videos)
- `timeRange`: Time filter (any, day, week, month, year)
- `region`: Region code (us, uk, fr, etc.)

### 2. **Research Aggregator** (`researchAggregator`)
Performs comprehensive research by searching multiple sources and aggregating results.

**Parameters**:
- `topic`: Research topic
- `searchQueries`: Array of specific queries
- `sources`: Types of sources (web, academic, news)
- `maxResultsPerQuery`: Max results per query

### 3. **Fact Checker** (`factCheck`)
Verifies facts or claims by checking multiple reliable sources.

**Parameters**:
- `claim`: The claim to verify
- `context`: Additional context
- `sources`: Specific sources to check

## Testing Your Setup

1. **Check Configuration**:
   ```bash
   # In the backend directory
   npm run dev:backend
   ```
   Look for: `[SearchProvider] Using provider: serper` (or your chosen provider)

2. **Test with an Agent**:
   - Open the AgentOS Client
   - Select "V" or "Nerf" persona (both have search tools enabled)
   - Ask: "Search for the latest news about AI"
   - The agent should use the web search tool

## Troubleshooting

### No API Key Configured
If you see "Search provider not configured" errors, the agent will provide links to sign up for free API keys.

### Rate Limiting
Each provider has rate limits. The system automatically enforces these to prevent exceeding your quota.

### Fallback to DuckDuckGo
If no API key is configured, the system falls back to DuckDuckGo's limited instant answer API.

## Usage Examples

Ask agents questions like:
- "Search for information about quantum computing"
- "Research the latest developments in renewable energy"
- "Fact check: Is coffee the world's second most traded commodity?"
- "Find recent news about space exploration"

## Monitoring Usage

You can monitor your API usage:
- **Serper.dev**: Dashboard at [https://serper.dev/dashboard](https://serper.dev/dashboard)
- **SerpAPI**: Account page at [https://serpapi.com/account](https://serpapi.com/account)
- **Brave**: API dashboard in your account

## Support

For issues or questions:
1. Check the provider's documentation
2. Review the search tool implementation in `backend/src/tools/search.tools.ts`
3. Check logs in the AgentOS Client's Session Inspector

## Privacy Note

Search queries are sent to your chosen provider's API. Review each provider's privacy policy:
- [Serper.dev Privacy](https://serper.dev/privacy)
- [SerpAPI Privacy](https://serpapi.com/privacy)
- [Brave Privacy](https://brave.com/privacy/)
