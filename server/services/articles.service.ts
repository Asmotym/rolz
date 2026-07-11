import { randomUUID } from 'crypto';
import { Renderer, marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { hljs } from '../core/utils/markdown-highlight';
import {
    articleSlugExists,
    deleteArticleTag,
    deleteDraft,
    getArticleById,
    getArticleBySlug,
    getArticleTagBySlug,
    insertArticle,
    insertArticleTag,
    listArticles,
    listArticleTags,
    listDrafts,
    listTagsForArticles,
    replaceArticleTags,
    setArticleArchived,
    updateArticleRecord,
    updateArticleTag,
    upsertDraft
} from '../core/database/tables/articles.table';
import type { DatabaseArticle, DatabaseArticleDraft, DatabaseArticleTag } from '../core/types/database.types';
import type { ArticleDetails, ArticleDraft, ArticleStatus, ArticleSummary, ArticleTag } from '../core/types/data.types';
import { BadRequestError, NotFoundError } from '../core/errors/http-errors';
import { requireAdmin, requireOwner } from './roles.service';

const ARTICLE_TITLE_MAX = 191;
const ARTICLE_INTRODUCTION_MAX = 1200;
const ARTICLE_MARKDOWN_MAX = 250_000;
const ARTICLE_EXCERPT_MAX = 260;
const TAG_NAME_MAX = 80;
const DEFAULT_PUBLIC_LIMIT = 5;
const SAFE_COLOR_STYLE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$|^rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\)$/;

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const renderer = new Renderer();
renderer.code = ({ text, lang }) => {
    const language = (lang ?? '').trim().split(/\s+/)[0];
    const highlighted = language && hljs.getLanguage(language)
        ? hljs.highlight(text, { language }).value
        : escapeHtml(text);
    const className = language ? ` class="language-${escapeHtml(language)}"` : '';
    return `<pre><code${className}>${highlighted}</code></pre>\n`;
};

marked.use({
    gfm: true,
    breaks: true,
    renderer
});

function slugify(value: string): string {
    const slug = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 96);
    return slug || randomUUID().slice(0, 8);
}

async function uniqueArticleSlug(title: string, articleId?: string): Promise<string> {
    const base = slugify(title).slice(0, 80);
    let candidate = base;
    let index = 2;
    while (await articleSlugExists(candidate, articleId)) {
        candidate = `${base}-${index}`.slice(0, 96);
        index += 1;
    }
    return candidate;
}

function sanitizeRenderedHtml(html: string): string {
    return sanitizeHtml(html, {
        allowedTags: [
            'p', 'br', 'strong', 'em', 's', 'blockquote', 'code', 'pre',
            'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'img', 'input', 'span'
        ],
        allowedAttributes: {
            a: ['href', 'name', 'target', 'rel'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            input: ['type', 'checked', 'disabled'],
            th: ['align'],
            td: ['align'],
            code: ['class'],
            span: ['class', 'style']
        },
        allowedStyles: {
            span: {
                color: [SAFE_COLOR_STYLE]
            }
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        transformTags: {
            a: sanitizeHtml.simpleTransform('a', { rel: 'noreferrer noopener', target: '_blank' }),
            input: (_tagName, attribs) => ({
                tagName: 'input',
                attribs: {
                    type: 'checkbox',
                    disabled: '',
                    ...(Object.prototype.hasOwnProperty.call(attribs, 'checked') ? { checked: '' } : {})
                }
            })
        }
    });
}

function renderMarkdown(markdown: string): string {
    const rendered = marked.parse(markdown, { async: false }) as string;
    return sanitizeRenderedHtml(rendered);
}

function excerptFromHtml(html: string): string {
    const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
        .replace(/\s+/g, ' ')
        .trim();
    return text.slice(0, ARTICLE_EXCERPT_MAX);
}

function parseTagIds(value: DatabaseArticleDraft['selected_tag_ids']): string[] {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
        return [];
    }
}

function mapTag(row: DatabaseArticleTag): ArticleTag {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function attachTags(rows: DatabaseArticle[]): Promise<ArticleSummary[]> {
    const tagRows = await listTagsForArticles(rows.map((row) => row.id));
    const tagsByArticle = new Map<string, ArticleTag[]>();
    for (const tag of tagRows) {
        const list = tagsByArticle.get(tag.article_id) ?? [];
        list.push(mapTag(tag));
        tagsByArticle.set(tag.article_id, list);
    }

    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        introduction: row.introduction,
        excerpt: row.excerpt,
        status: row.status,
        authorId: row.author_id,
        authorName: row.author_name,
        publishedAt: row.published_at,
        archivedAt: row.archived_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: tagsByArticle.get(row.id) ?? []
    }));
}

async function mapArticleDetails(row: DatabaseArticle, includeMarkdown: boolean): Promise<ArticleDetails> {
    const [summary] = await attachTags([row]);
    return {
        ...summary,
        sanitizedHtml: renderMarkdown(row.markdown_source),
        markdownSource: includeMarkdown ? row.markdown_source : undefined
    };
}

function normalizeTitle(title: unknown): string {
    if (typeof title !== 'string') throw new BadRequestError('Title is required');
    const trimmed = title.trim();
    if (!trimmed) throw new BadRequestError('Title is required');
    if (trimmed.length > ARTICLE_TITLE_MAX) throw new BadRequestError(`Title is too long (max ${ARTICLE_TITLE_MAX} characters)`);
    return trimmed;
}

function normalizeIntroduction(introduction: unknown): string {
    if (typeof introduction !== 'string') throw new BadRequestError('Introduction is required');
    const trimmed = introduction.trim();
    if (!trimmed) throw new BadRequestError('Introduction is required');
    if (trimmed.length > ARTICLE_INTRODUCTION_MAX) {
        throw new BadRequestError(`Introduction is too long (max ${ARTICLE_INTRODUCTION_MAX} characters)`);
    }
    return trimmed;
}

function normalizeMarkdown(markdown: unknown): string {
    if (typeof markdown !== 'string') throw new BadRequestError('Markdown content is required');
    if (markdown.length > ARTICLE_MARKDOWN_MAX) throw new BadRequestError('Article content is too long');
    return markdown;
}

function normalizeStatus(status: unknown): ArticleStatus {
    if (status === 'published' || status === 'unpublished' || status === 'draft') return status;
    throw new BadRequestError('Invalid article status');
}

function normalizePublishedAt(value: unknown): string | null {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestError('Invalid publication date');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid publication date');
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizeLimit(value: unknown, fallback = DEFAULT_PUBLIC_LIMIT): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), 1), 50);
}

function normalizeOffset(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(Math.floor(parsed), 0);
}

function normalizeTags(value: unknown): string[] {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return raw.map((tag) => slugify(String(tag))).filter(Boolean);
}

async function ensureTagIdsExist(tagIds: string[]): Promise<string[]> {
    const existing = await listArticleTags();
    const allowed = new Set(existing.map((tag) => tag.id));
    return [...new Set(tagIds)].filter((tagId) => allowed.has(tagId));
}

export async function listPublicArticles(params: { search?: unknown; tags?: unknown; limit?: unknown; offset?: unknown }) {
    const articles = await listArticles({
        publicOnly: true,
        search: typeof params.search === 'string' ? params.search : undefined,
        tags: normalizeTags(params.tags),
        limit: normalizeLimit(params.limit),
        offset: normalizeOffset(params.offset)
    });
    return attachTags(articles);
}

export async function listNewsArticles(limit: unknown) {
    const articles = await listArticles({
        publicOnly: true,
        newsOnly: true,
        limit: normalizeLimit(limit, 3),
        offset: 0
    });
    return attachTags(articles);
}

export async function getPublicArticle(slug: string): Promise<ArticleDetails> {
    const article = await getArticleBySlug(slug, true);
    if (!article) throw new NotFoundError('Article not found');
    return mapArticleDetails(article, false);
}

export async function listAdminArticles(userId: string, params: { search?: unknown; tags?: unknown; statuses?: unknown; archived?: unknown; limit?: unknown; offset?: unknown }) {
    await requireAdmin(userId);
    const statuses = Array.isArray(params.statuses)
        ? params.statuses.map(normalizeStatus)
        : typeof params.statuses === 'string' && params.statuses
            ? params.statuses.split(',').map(normalizeStatus)
            : undefined;
    const archived = params.archived === 'true' || params.archived === true
        ? true
        : params.archived === 'false' || params.archived === false
            ? false
            : null;

    const articles = await listArticles({
        search: typeof params.search === 'string' ? params.search : undefined,
        tags: normalizeTags(params.tags),
        statuses,
        archived,
        limit: normalizeLimit(params.limit, 20),
        offset: normalizeOffset(params.offset)
    });
    return attachTags(articles);
}

export async function getAdminArticle(userId: string, articleId: string): Promise<ArticleDetails> {
    await requireAdmin(userId);
    const article = await getArticleById(articleId);
    if (!article) throw new NotFoundError('Article not found');
    return mapArticleDetails(article, true);
}

export async function createArticle(userId: string, payload: { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown; status?: unknown; publishedAt?: unknown }) {
    await requireOwner(userId);
    const title = normalizeTitle(payload.title);
    const introduction = normalizeIntroduction(payload.introduction);
    const markdown = normalizeMarkdown(payload.markdownSource);
    const status = payload.status ? normalizeStatus(payload.status) : 'unpublished';
    if (status === 'draft') throw new BadRequestError('Use drafts endpoint for drafts');
    const sanitizedHtml = renderMarkdown(markdown);
    const tagIds = await ensureTagIdsExist(Array.isArray(payload.tagIds) ? payload.tagIds.map(String) : []);
    const publishedAt = status === 'published' ? normalizePublishedAt(payload.publishedAt) ?? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    const article = await insertArticle({
        id: randomUUID(),
        slug: await uniqueArticleSlug(title),
        title,
        introduction,
        markdown_source: markdown,
        sanitized_html: sanitizedHtml,
        excerpt: excerptFromHtml(sanitizedHtml),
        author_id: userId,
        status,
        published_at: publishedAt,
        archived_at: null
    });
    await replaceArticleTags(article.id, tagIds);
    return getAdminArticle(userId, article.id);
}

export async function updateArticle(userId: string, articleId: string, payload: { title?: unknown; introduction?: unknown; markdownSource?: unknown; tagIds?: unknown }) {
    await requireAdmin(userId);
    const existing = await getArticleById(articleId);
    if (!existing) throw new NotFoundError('Article not found');
    const title = typeof payload.title === 'undefined' ? existing.title : normalizeTitle(payload.title);
    const introduction = typeof payload.introduction === 'undefined' ? existing.introduction : normalizeIntroduction(payload.introduction);
    const markdown = typeof payload.markdownSource === 'undefined' ? existing.markdown_source : normalizeMarkdown(payload.markdownSource);
    const sanitizedHtml = renderMarkdown(markdown);

    const article = await updateArticleRecord(articleId, {
        title,
        slug: title === existing.title ? existing.slug : await uniqueArticleSlug(title, articleId),
        introduction,
        markdown_source: markdown,
        sanitized_html: sanitizedHtml,
        excerpt: excerptFromHtml(sanitizedHtml)
    });
    if (!article) throw new NotFoundError('Article not found');

    if (Array.isArray(payload.tagIds)) {
        await replaceArticleTags(articleId, await ensureTagIdsExist(payload.tagIds.map(String)));
    }

    return getAdminArticle(userId, articleId);
}

export async function setArticlePublication(userId: string, articleId: string, payload: { published: boolean; publishedAt?: unknown }) {
    await requireAdmin(userId);
    const existing = await getArticleById(articleId);
    if (!existing) throw new NotFoundError('Article not found');
    const publishedAt = payload.published ? normalizePublishedAt(payload.publishedAt) ?? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const updated = await updateArticleRecord(articleId, {
        status: payload.published ? 'published' : 'unpublished',
        published_at: publishedAt
    });
    if (!updated) throw new NotFoundError('Article not found');
    return getAdminArticle(userId, articleId);
}

export async function archiveArticle(userId: string, articleId: string) {
    await requireOwner(userId);
    const updated = await setArticleArchived(articleId);
    if (!updated) throw new NotFoundError('Article not found');
    return getAdminArticle(userId, articleId);
}

export async function listTags(): Promise<ArticleTag[]> {
    return (await listArticleTags()).map(mapTag);
}

export async function createTag(userId: string, name: unknown): Promise<ArticleTag> {
    await requireOwner(userId);
    if (typeof name !== 'string' || !name.trim()) throw new BadRequestError('Tag name is required');
    const trimmed = name.trim().slice(0, TAG_NAME_MAX);
    const slug = slugify(trimmed);
    const existing = await getArticleTagBySlug(slug);
    if (existing) return mapTag(existing);
    return mapTag(await insertArticleTag({ id: randomUUID(), name: trimmed, slug, created_by: userId }));
}

export async function renameTag(userId: string, tagId: string, name: unknown): Promise<ArticleTag> {
    await requireOwner(userId);
    if (typeof name !== 'string' || !name.trim()) throw new BadRequestError('Tag name is required');
    const trimmed = name.trim().slice(0, TAG_NAME_MAX);
    const updated = await updateArticleTag(tagId, trimmed, slugify(trimmed));
    if (!updated) throw new NotFoundError('Tag not found');
    return mapTag(updated);
}

export async function removeTag(userId: string, tagId: string): Promise<void> {
    await requireOwner(userId);
    await deleteArticleTag(tagId);
}

export async function listOwnerDrafts(userId: string): Promise<ArticleDraft[]> {
    await requireOwner(userId);
    return (await listDrafts(userId)).map((draft) => ({
        id: draft.id,
        ownerId: draft.owner_id,
        title: draft.title,
        introduction: draft.introduction,
        markdownSource: draft.markdown_source,
        selectedTagIds: parseTagIds(draft.selected_tag_ids),
        createdAt: draft.created_at,
        updatedAt: draft.updated_at
    }));
}

export async function saveDraft(userId: string, payload: { id?: unknown; title?: unknown; introduction?: unknown; markdownSource?: unknown; selectedTagIds?: unknown }): Promise<ArticleDraft> {
    await requireOwner(userId);
    const markdown = typeof payload.markdownSource === 'string' ? payload.markdownSource.slice(0, ARTICLE_MARKDOWN_MAX) : '';
    const draft = await upsertDraft({
        id: typeof payload.id === 'string' && payload.id ? payload.id : randomUUID(),
        owner_id: userId,
        title: typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim().slice(0, ARTICLE_TITLE_MAX) : null,
        introduction: typeof payload.introduction === 'string' && payload.introduction.trim() ? payload.introduction.trim().slice(0, ARTICLE_INTRODUCTION_MAX) : null,
        markdown_source: markdown,
        selected_tag_ids: JSON.stringify(Array.isArray(payload.selectedTagIds) ? payload.selectedTagIds.map(String) : [])
    });
    return {
        id: draft.id,
        ownerId: draft.owner_id,
        title: draft.title,
        introduction: draft.introduction,
        markdownSource: draft.markdown_source,
        selectedTagIds: parseTagIds(draft.selected_tag_ids),
        createdAt: draft.created_at,
        updatedAt: draft.updated_at
    };
}

export async function removeDraft(userId: string, draftId: string): Promise<void> {
    await requireOwner(userId);
    await deleteDraft(userId, draftId);
}

export function previewMarkdown(markdown: unknown): { sanitizedHtml: string; excerpt: string } {
    const source = normalizeMarkdown(markdown);
    const sanitizedHtml = renderMarkdown(source);
    return { sanitizedHtml, excerpt: excerptFromHtml(sanitizedHtml) };
}
