/**
 * Jina AI Services
 * 
 * Exports all Jina API functionality:
 * - Article scraping via Jina Reader
 * - Text embeddings via Jina Embeddings v3
 * - Rate limit management
 */

export {
  // Core functions
  scrapeArticle,
  generateEmbeddings,
  generateQueryEmbedding,
  
  // Rate limit management
  getRateLimitStatus,
  isJinaAvailable,
  
  // Error classes
  JinaRateLimitError,
  JinaScrapingError,
  
  // Constants
  EMBEDDING_DIMENSIONS,
  
  // Types
  type ScrapedArticle,
} from './client';
