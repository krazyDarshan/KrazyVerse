import Anthropic from '@anthropic-ai/sdk';
import Replicate from 'replicate';
import { env } from '../config/env';

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
const replicate = env.REPLICATE_API_TOKEN ? new Replicate({ auth: env.REPLICATE_API_TOKEN }) : null;

async function claudeText(prompt: string, system: string) {
  if (!anthropic) {
    return {
      provider: 'local-fallback',
      text: 'AI service is not configured. Add ANTHROPIC_API_KEY to enable generated results.',
    };
  }

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
    max_tokens: 800,
    system,
    messages: [{ role: 'user', content: prompt }],
  });

  const first = message.content[0];
  return {
    provider: 'anthropic',
    text: first?.type === 'text' ? first.text : '',
  };
}

export const ai = {
  caption: (imageDescription: string) =>
    claudeText(
      `Write 5 Instagram-style caption options for this image context: ${imageDescription}`,
      'You create concise, brand-safe social captions.',
    ),
  hashtags: (context: string) =>
    claudeText(
      `Generate up to 30 contextual hashtags for: ${context}. Return a JSON array of strings.`,
      'You generate useful social discovery hashtags without spam.',
    ),
  moderation: (content: string) =>
    claudeText(
      `Classify this content for NSFW, hate, harassment, spam, and self-harm. Return JSON with risk scores and action: ${content}`,
      'You are a strict content moderation classifier.',
    ),
  commentFilter: (comment: string) =>
    claudeText(
      `Should this social comment be hidden for toxicity? Return JSON with hide:boolean and reason:string: ${comment}`,
      'You detect toxic comments while preserving benign disagreement.',
    ),
  friendSuggestions: (userContext: string) =>
    claudeText(
      `Suggest friend recommendation strategy from this graph context: ${userContext}`,
      'You design collaborative-filtering social recommendations.',
    ),
  feedRanking: (feedContext: string) =>
    claudeText(
      `Rank this feed context and explain scoring features: ${feedContext}`,
      'You rank social posts using recency, affinity, interest, and safety.',
    ),
  videoAssistant: (videoContext: string) =>
    claudeText(
      `Suggest trim points, highlights, and reel title for: ${videoContext}`,
      'You are an AI video editing assistant.',
    ),
  chat: (message: string) =>
    claudeText(message, 'You are @ai inside KrazyVerse DMs. Be helpful, concise, and safe.'),
  story: (prompt: string) =>
    claudeText(
      `Create a story storyboard with text overlays and sticker ideas for: ${prompt}`,
      'You create social story concepts.',
    ),
  translate: (text: string, language: string) =>
    claudeText(`Translate to ${language}: ${text}`, 'You translate social chats accurately.'),
  imageGeneration: async (prompt: string) => {
    if (!replicate) {
      return {
        provider: 'local-fallback',
        output: null,
        message: 'Replicate is not configured. Add REPLICATE_API_TOKEN to generate images.',
      };
    }
    const output = await replicate.run('black-forest-labs/flux-schnell', {
      input: { prompt, num_outputs: 1, aspect_ratio: '1:1', output_format: 'webp' },
    });
    return { provider: 'replicate', output };
  },
};
