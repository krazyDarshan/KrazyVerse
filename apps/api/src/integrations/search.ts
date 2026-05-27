import Typesense from 'typesense';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const typesense = new Typesense.Client({
  nodes: [
    {
      host: env.TYPESENSE_HOST,
      port: env.TYPESENSE_PORT,
      protocol: env.TYPESENSE_PROTOCOL,
    },
  ],
  apiKey: env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 2,
});

const elastic = new ElasticClient({ node: env.ELASTICSEARCH_NODE });

export async function indexSearchDocument(collection: string, document: Record<string, unknown>) {
  try {
    await typesense.collections(collection).documents().upsert(document);
  } catch (error) {
    logger.debug('Typesense indexing failed; attempting Elasticsearch fallback', { error, collection });
    await elastic
      .index({ index: collection, id: String(document.id), document })
      .catch((fallbackError) => logger.warn('Search indexing unavailable', { fallbackError, collection }));
  }
}

export async function searchDocuments(collection: string, query: string) {
  try {
    const result = await typesense.collections(collection).documents().search({
      q: query,
      query_by: 'username,displayName,caption,tag,name,title',
      per_page: 20,
    });
    return result.hits?.map((hit) => hit.document) ?? [];
  } catch (error) {
    logger.debug('Typesense search failed; attempting Elasticsearch fallback', { error, collection });
    const result = await elastic
      .search({ index: collection, query: { multi_match: { query, fields: ['*'] } }, size: 20 })
      .catch(() => null);
    return result?.hits.hits.map((hit) => hit._source) ?? [];
  }
}
