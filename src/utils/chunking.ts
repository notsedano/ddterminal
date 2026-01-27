/**
 * Text Chunking Utilities
 * 
 * Splits text into semantically meaningful chunks for embedding and RAG.
 * Preserves paragraph and sentence boundaries where possible.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ChunkOptions {
  /** Maximum characters per chunk (default: 1000) */
  maxChunkSize: number;
  /** Character overlap between consecutive chunks (default: 200) */
  chunkOverlap: number;
  /** Minimum chunk size to keep - smaller chunks are merged or discarded (default: 100) */
  minChunkSize: number;
}

export interface ChunkResult {
  /** The chunked text content */
  content: string;
  /** Zero-based index of this chunk */
  index: number;
  /** Character offset in original text where this chunk starts */
  startOffset: number;
  /** Character offset in original text where this chunk ends */
  endOffset: number;
}

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 1000,
  chunkOverlap: 200,
  minChunkSize: 100,
};

// ============================================================================
// MAIN CHUNKING FUNCTION
// ============================================================================

/**
 * Splits text into chunks, respecting paragraph and sentence boundaries.
 * 
 * Algorithm:
 * 1. Split by paragraphs (double newlines)
 * 2. Accumulate paragraphs into chunks up to maxChunkSize
 * 3. If a paragraph is too long, split by sentences
 * 4. If a sentence is too long, force-split at maxChunkSize with overlap
 * 5. Add overlap from previous chunk to maintain context
 */
export function chunkText(text: string, options: Partial<ChunkOptions> = {}): string[] {
  const { maxChunkSize, chunkOverlap, minChunkSize } = { ...DEFAULT_OPTIONS, ...options };
  
  // Normalize whitespace and trim
  const normalizedText = text.replace(/\r\n/g, '\n').trim();
  
  if (normalizedText.length === 0) {
    return [];
  }
  
  // If text fits in one chunk, return it
  if (normalizedText.length <= maxChunkSize) {
    return [normalizedText];
  }
  
  const chunks: string[] = [];
  
  // Split by paragraphs (two or more newlines)
  const paragraphs = normalizedText.split(/\n\n+/);
  
  let currentChunk = '';
  let previousChunkEnd = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // Calculate size if we add this paragraph
    const separator = currentChunk ? '\n\n' : '';
    const potentialSize = currentChunk.length + separator.length + trimmedParagraph.length;
    
    if (potentialSize <= maxChunkSize) {
      // Paragraph fits, add it
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedParagraph}` : trimmedParagraph;
    } else {
      // Paragraph doesn't fit
      
      // Save current chunk if it meets minimum size
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());
        previousChunkEnd = getOverlapText(currentChunk, chunkOverlap);
      }
      
      // Check if the paragraph itself is too long
      if (trimmedParagraph.length > maxChunkSize) {
        // Split long paragraph by sentences
        const sentenceChunks = chunkLongParagraph(
          trimmedParagraph,
          maxChunkSize,
          chunkOverlap,
          minChunkSize,
          previousChunkEnd
        );
        
        if (sentenceChunks.length > 0) {
          chunks.push(...sentenceChunks.slice(0, -1));
          // Use the last sentence chunk as the start of next chunk
          currentChunk = sentenceChunks[sentenceChunks.length - 1];
          previousChunkEnd = getOverlapText(currentChunk, chunkOverlap);
        } else {
          currentChunk = '';
        }
      } else {
        // Start new chunk with overlap from previous
        currentChunk = previousChunkEnd + trimmedParagraph;
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    // Merge small final chunk with previous if possible
    const lastChunk = chunks[chunks.length - 1];
    const merged = `${lastChunk}\n\n${currentChunk}`;
    if (merged.length <= maxChunkSize * 1.2) {
      chunks[chunks.length - 1] = merged.trim();
    } else {
      // Keep it separate even if small
      chunks.push(currentChunk.trim());
    }
  } else if (currentChunk.length > 0) {
    // Only chunk, keep it even if small
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Splits text into chunks with detailed offset information.
 * Useful for highlighting or linking back to source positions.
 */
export function chunkTextWithOffsets(
  text: string,
  options: Partial<ChunkOptions> = {}
): ChunkResult[] {
  const chunks = chunkText(text, options);
  const results: ChunkResult[] = [];
  
  let searchStart = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    // Find this chunk in the original text (accounting for overlap, we search forward)
    const startOffset = text.indexOf(chunk.substring(0, Math.min(50, chunk.length)), searchStart);
    const endOffset = startOffset + chunk.length;
    
    results.push({
      content: chunk,
      index: i,
      startOffset: startOffset >= 0 ? startOffset : searchStart,
      endOffset: startOffset >= 0 ? endOffset : searchStart + chunk.length,
    });
    
    // Move search start forward (but account for overlap)
    searchStart = Math.max(searchStart, (startOffset >= 0 ? startOffset : searchStart) + chunk.length / 2);
  }
  
  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Splits a long paragraph by sentences when it exceeds maxChunkSize.
 */
function chunkLongParagraph(
  paragraph: string,
  maxChunkSize: number,
  chunkOverlap: number,
  minChunkSize: number,
  previousOverlap: string
): string[] {
  const chunks: string[] = [];
  
  // Split by sentence-ending punctuation followed by space or end of string
  const sentencePattern = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])$/g;
  const sentences = paragraph.split(sentencePattern).filter(s => s.trim());
  
  // If splitting didn't work (no sentences found), fall back to force split
  if (sentences.length <= 1) {
    return forceChunkText(paragraph, maxChunkSize, chunkOverlap, previousOverlap);
  }
  
  let currentChunk = previousOverlap;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const separator = currentChunk && !currentChunk.endsWith(' ') ? ' ' : '';
    const potentialSize = currentChunk.length + separator.length + trimmedSentence.length;
    
    if (potentialSize <= maxChunkSize) {
      currentChunk = currentChunk + separator + trimmedSentence;
    } else {
      // Save current chunk
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk.trim());
      }
      
      // Check if sentence itself is too long
      if (trimmedSentence.length > maxChunkSize) {
        const forceSplit = forceChunkText(
          trimmedSentence,
          maxChunkSize,
          chunkOverlap,
          getOverlapText(currentChunk, chunkOverlap)
        );
        chunks.push(...forceSplit.slice(0, -1));
        currentChunk = forceSplit[forceSplit.length - 1] || '';
      } else {
        const overlap = getOverlapText(currentChunk, chunkOverlap);
        currentChunk = overlap + trimmedSentence;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.length > 0 && chunks.length > 0) {
    // Try to merge with previous
    const lastChunk = chunks[chunks.length - 1];
    const merged = lastChunk + ' ' + currentChunk;
    if (merged.length <= maxChunkSize * 1.2) {
      chunks[chunks.length - 1] = merged.trim();
    } else {
      chunks.push(currentChunk.trim());
    }
  } else if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Force-splits text at exact character boundaries when no semantic breaks exist.
 * Used as a last resort for very long sentences or unstructured text.
 */
function forceChunkText(
  text: string,
  maxChunkSize: number,
  chunkOverlap: number,
  previousOverlap: string
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // First chunk includes previous overlap
  let currentChunk = previousOverlap;
  
  while (start < text.length) {
    const remaining = text.length - start;
    const spaceForNew = maxChunkSize - currentChunk.length;
    
    if (remaining <= spaceForNew) {
      // Remaining text fits
      currentChunk += text.slice(start);
      chunks.push(currentChunk.trim());
      break;
    }
    
    // Find a good break point (prefer word boundaries)
    let breakPoint = start + spaceForNew;
    
    // Look backwards for a space
    const searchStart = Math.max(start, breakPoint - 50);
    const lastSpace = text.lastIndexOf(' ', breakPoint);
    
    if (lastSpace > searchStart) {
      breakPoint = lastSpace;
    }
    
    currentChunk += text.slice(start, breakPoint);
    chunks.push(currentChunk.trim());
    
    // Start next chunk with overlap
    const overlapStart = Math.max(start, breakPoint - chunkOverlap);
    currentChunk = text.slice(overlapStart, breakPoint);
    start = breakPoint;
    
    // Skip the space if we broke on one
    if (text[start] === ' ') {
      start++;
    }
  }
  
  return chunks;
}

/**
 * Extracts text from the end of a chunk for overlap with the next chunk.
 * Attempts to break at word boundaries.
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (!text || text.length === 0) {
    return '';
  }
  
  if (text.length <= overlapSize) {
    return text + ' ';
  }
  
  // Get the last overlapSize characters
  const overlapStart = text.length - overlapSize;
  let overlapText = text.slice(overlapStart);
  
  // Try to start at a word boundary
  const firstSpace = overlapText.indexOf(' ');
  if (firstSpace !== -1 && firstSpace < overlapSize / 2) {
    overlapText = overlapText.slice(firstSpace + 1);
  }
  
  return overlapText + ' ';
}

// ============================================================================
// TEXT UTILITY FUNCTIONS
// ============================================================================

/**
 * Counts words in text.
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Extracts the domain from a URL.
 * Examples:
 *   "https://www.espn.com/nba/story" -> "espn.com"
 *   "http://bleacherreport.com/articles" -> "bleacherreport.com"
 */
export function extractDomain(url: string): string {
  const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/i);
  if (!match) return url;
  
  // Remove common subdomains like 'www', 'm', 'mobile'
  const domain = match[1];
  return domain.replace(/^(www\.|m\.|mobile\.)/i, '');
}

/**
 * Validates a URL for the knowledge system.
 * Returns null if valid, or an error message if invalid.
 */
export function validateKnowledgeUrl(url: string): string | null {
  // Check if empty
  if (!url || url.trim().length === 0) {
    return 'URL is required';
  }
  
  // Check URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return 'Invalid URL format';
  }
  
  // Only allow http and https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return 'Only HTTP and HTTPS URLs are supported';
  }
  
  // Block localhost and private IPs
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.16.') ||
    hostname.endsWith('.local')
  ) {
    return 'Local and private URLs are not supported';
  }
  
  return null;
}

/**
 * Cleans extracted article content.
 * Removes common noise patterns from scraped text.
 */
export function cleanArticleContent(content: string): string {
  let cleaned = content;
  
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Remove common noise patterns
  const noisePatterns = [
    /^Advertisement\s*$/gim,
    /^Skip to (?:main )?content\s*$/gim,
    /^Share this article\s*$/gim,
    /^Read more:?\s*$/gim,
    /^Related:?\s*$/gim,
    /^Also read:?\s*$/gim,
    /^ADVERTISEMENT\s*$/gim,
    /^\d+ Comments?\s*$/gim,
    /^Loading\.\.\.\s*$/gim,
    /^Please wait\.\.\.\s*$/gim,
    /^Subscribe (?:to|for).*$/gim,
    /^Sign up (?:to|for).*$/gim,
    /^Follow us on.*$/gim,
    /^Share on (?:Facebook|Twitter|LinkedIn|Email).*$/gim,
  ];
  
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Remove empty lines that may have been created
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}
