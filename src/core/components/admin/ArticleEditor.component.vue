<template>
  <div class="article-editor">
    <v-text-field
      :model-value="title"
      :label="t('articles.fields.title')"
      hide-details
      class="mb-3"
      @update:model-value="emit('update:title', String($event ?? ''))"
    />
    <v-textarea
      :model-value="introduction"
      :label="t('articles.fields.introduction')"
      rows="3"
      auto-grow
      counter="1200"
      hide-details
      class="mb-3"
      @update:model-value="emit('update:introduction', String($event ?? ''))"
    />
    <v-combobox
      v-if="allowCreateTags"
      :model-value="selectedTags"
      :items="tags"
      item-title="name"
      item-value="id"
      :label="t('articles.fields.tags')"
      multiple
      chips
      closable-chips
      clearable
      hide-details
      return-object
      class="mb-3"
      @update:model-value="handleTagSelection"
    />
    <v-autocomplete
      v-else
      :model-value="tagIds"
      :items="tags"
      item-title="name"
      item-value="id"
      :label="t('articles.fields.tags')"
      multiple
      chips
      closable-chips
      clearable
      hide-details
      class="mb-3"
      @update:model-value="emit('update:tagIds', $event as string[])"
    />
    <div class="markdown-toolbar mb-2">
      <template v-for="group in toolbarGroups" :key="group.id">
        <v-divider v-if="group.separator" vertical class="mx-1" />
        <v-tooltip
          v-for="button in group.buttons"
          :key="button.action"
          :text="button.label"
          location="top"
        >
          <template #activator="{ props: tooltipProps }">
            <v-btn
              v-bind="tooltipProps"
              :icon="button.icon"
              :aria-label="button.label"
              :title="button.label"
              size="small"
              variant="text"
              density="comfortable"
              @click="applyMarkdown(button.action)"
            />
          </template>
        </v-tooltip>
      </template>
      <v-divider vertical class="mx-1" />
      <v-menu :close-on-content-click="false" location="bottom">
        <template #activator="{ props: menuProps }">
          <v-tooltip text="Text color" location="top">
            <template #activator="{ props: tooltipProps }">
              <v-btn
                v-bind="{ ...menuProps, ...tooltipProps }"
                icon="mdi-format-color-text"
                aria-label="Text color"
                title="Text color"
                size="small"
                variant="text"
                density="comfortable"
              >
                <v-icon icon="mdi-format-color-text" />
                <span class="color-indicator" :style="{ backgroundColor: selectedTextColor }"></span>
              </v-btn>
            </template>
          </v-tooltip>
        </template>
        <v-card class="color-menu" elevation="6">
          <v-color-picker
            v-model="selectedTextColor"
            mode="hex"
            hide-inputs
            show-swatches
            width="260"
          />
          <v-card-actions class="justify-end">
            <v-btn size="small" variant="text" @click="applyTextColor">
              Apply
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-menu>
      <v-divider vertical class="mx-1" />
      <v-tooltip :text="previewVisible ? 'Hide preview' : 'Show preview'" location="top">
        <template #activator="{ props: tooltipProps }">
          <v-btn
            v-bind="tooltipProps"
            :icon="previewVisible ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            :aria-label="previewVisible ? 'Hide preview' : 'Show preview'"
            :title="previewVisible ? 'Hide preview' : 'Show preview'"
            size="small"
            variant="text"
            density="comfortable"
            @click="previewVisible = !previewVisible"
          />
        </template>
      </v-tooltip>
    </div>
    <v-row dense align="stretch" class="markdown-body-row">
      <v-col cols="12" :md="previewVisible ? 6 : 12" class="markdown-body-col">
        <v-textarea
          ref="markdownTextarea"
          :model-value="markdownSource"
          :label="t('articles.fields.markdown')"
          rows="18"
          auto-grow
          hide-details
          @update:model-value="emit('update:markdownSource', String($event ?? ''))"
        />
      </v-col>
      <v-col v-if="previewVisible" cols="12" md="6" class="markdown-body-col">
        <div class="preview" v-html="previewHtml"></div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { Renderer, marked } from 'marked';
import { hljs } from 'core/utils/markdown-highlight';
import type { ArticleTag } from 'netlify/core/types/data.types';

type MarkdownAction =
  | 'undo'
  | 'redo'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'quote'
  | 'inlineCode'
  | 'codeBlock'
  | 'bulletList'
  | 'numberedList'
  | 'checkList'
  | 'link'
  | 'image'
  | 'table'
  | 'horizontalRule';

interface ToolbarButton {
  action: MarkdownAction;
  icon: string;
  label: string;
}

interface ToolbarGroup {
  id: string;
  separator?: boolean;
  buttons: ToolbarButton[];
}

const props = defineProps<{
  title: string;
  introduction: string;
  markdownSource: string;
  tagIds: string[];
  tags: ArticleTag[];
  allowCreateTags?: boolean;
}>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:introduction': [value: string];
  'update:markdownSource': [value: string];
  'update:tagIds': [value: string[]];
  'createTag': [name: string];
}>();

const { t } = useI18n();
const markdownTextarea = ref<ComponentPublicInstance | null>(null);
const previewVisible = ref(true);
const selectedTextColor = ref('#93c5fd');
const SAFE_COLOR_STYLE = /^color:\s*(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\))\s*;?$/;

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
  renderer,
});

const ALLOWED_TAGS = new Set([
  'P', 'BR', 'STRONG', 'EM', 'S', 'BLOCKQUOTE', 'CODE', 'PRE',
  'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'A', 'HR', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  'IMG', 'INPUT', 'SPAN',
]);
const ALLOWED_ATTRIBUTES = new Map<string, Set<string>>([
  ['A', new Set(['href', 'name', 'target', 'rel'])],
  ['IMG', new Set(['src', 'alt', 'title', 'width', 'height'])],
  ['INPUT', new Set(['type', 'checked', 'disabled'])],
  ['TH', new Set(['align'])],
  ['TD', new Set(['align'])],
  ['CODE', new Set(['class'])],
  ['SPAN', new Set(['class', 'style'])],
]);

const toolbarGroups: ToolbarGroup[] = [
  {
    id: 'history',
    buttons: [
      { action: 'undo', icon: 'mdi-undo', label: 'Undo' },
      { action: 'redo', icon: 'mdi-redo', label: 'Redo' },
    ],
  },
  {
    id: 'headings',
    separator: true,
    buttons: [
      { action: 'heading1', icon: 'mdi-format-header-1', label: 'Heading 1' },
      { action: 'heading2', icon: 'mdi-format-header-2', label: 'Heading 2' },
      { action: 'heading3', icon: 'mdi-format-header-3', label: 'Heading 3' },
    ],
  },
  {
    id: 'format',
    separator: true,
    buttons: [
      { action: 'bold', icon: 'mdi-format-bold', label: 'Bold' },
      { action: 'italic', icon: 'mdi-format-italic', label: 'Italic' },
      { action: 'strike', icon: 'mdi-format-strikethrough', label: 'Strikethrough' },
      { action: 'inlineCode', icon: 'mdi-code-tags', label: 'Inline code' },
    ],
  },
  {
    id: 'blocks',
    separator: true,
    buttons: [
      { action: 'quote', icon: 'mdi-format-quote-close', label: 'Quote' },
      { action: 'codeBlock', icon: 'mdi-code-braces', label: 'Code block' },
      { action: 'horizontalRule', icon: 'mdi-minus', label: 'Horizontal rule' },
    ],
  },
  {
    id: 'lists',
    separator: true,
    buttons: [
      { action: 'bulletList', icon: 'mdi-format-list-bulleted', label: 'Bullet list' },
      { action: 'numberedList', icon: 'mdi-format-list-numbered', label: 'Numbered list' },
      { action: 'checkList', icon: 'mdi-checkbox-marked-outline', label: 'Checklist' },
    ],
  },
  {
    id: 'inserts',
    separator: true,
    buttons: [
      { action: 'link', icon: 'mdi-link-variant', label: 'Link' },
      { action: 'image', icon: 'mdi-image-outline', label: 'Image' },
      { action: 'table', icon: 'mdi-table', label: 'Table' },
    ],
  },
];

const selectedTags = computed(() => props.tagIds
  .map((tagId) => props.tags.find((tag) => tag.id === tagId))
  .filter((tag): tag is ArticleTag => Boolean(tag)));

function isArticleTag(value: unknown): value is ArticleTag {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value;
}

function handleTagSelection(value: unknown[]) {
  const tagIds: string[] = [];
  for (const item of value) {
    if (isArticleTag(item)) {
      tagIds.push(item.id);
      continue;
    }
    const name = String(item ?? '').trim();
    if (name) {
      emit('createTag', name);
    }
  }
  emit('update:tagIds', [...new Set(tagIds)]);
}

function getTextarea(): HTMLTextAreaElement | null {
  return markdownTextarea.value?.$el?.querySelector('textarea') ?? null;
}

function selectionBounds(textarea: HTMLTextAreaElement) {
  return {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
    selected: props.markdownSource.slice(textarea.selectionStart, textarea.selectionEnd),
  };
}

async function replaceSelection(nextValue: string, selectionStart: number, selectionEnd: number) {
  emit('update:markdownSource', nextValue);
  await nextTick();
  const textarea = getTextarea();
  if (!textarea) return;
  textarea.focus();
  textarea.setSelectionRange(selectionStart, selectionEnd);
}

function lineRange(value: string, start: number, end: number) {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  return { lineStart, lineEnd };
}

async function wrapSelection(before: string, after: string, placeholder: string) {
  const textarea = getTextarea();
  if (!textarea) return;
  const { start, end, selected } = selectionBounds(textarea);
  const content = selected || placeholder;
  const inserted = `${before}${content}${after}`;
  const nextValue = `${props.markdownSource.slice(0, start)}${inserted}${props.markdownSource.slice(end)}`;
  const nextStart = selected ? start : start + before.length;
  const nextEnd = selected ? start + inserted.length : nextStart + placeholder.length;
  await replaceSelection(nextValue, nextStart, nextEnd);
}

function normalizeHexColor(value: string): string {
  const color = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(color) || /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color.toLowerCase();
  }
  return '#93c5fd';
}

async function applyTextColor() {
  const color = normalizeHexColor(selectedTextColor.value);
  selectedTextColor.value = color;
  await wrapSelection(`<span style="color: ${color};">`, '</span>', 'colored text');
}

async function insertBlock(block: string, cursorOffset = 0) {
  const textarea = getTextarea();
  if (!textarea) return;
  const { start, end } = selectionBounds(textarea);
  const prefix = start > 0 && props.markdownSource[start - 1] !== '\n' ? '\n' : '';
  const suffix = props.markdownSource[end] && props.markdownSource[end] !== '\n' ? '\n' : '';
  const inserted = `${prefix}${block}${suffix}`;
  const nextValue = `${props.markdownSource.slice(0, start)}${inserted}${props.markdownSource.slice(end)}`;
  const cursor = start + prefix.length + cursorOffset;
  await replaceSelection(nextValue, cursor, cursor);
}

async function prefixLines(prefixForIndex: (index: number) => string) {
  const textarea = getTextarea();
  if (!textarea) return;
  const { start, end } = selectionBounds(textarea);
  const { lineStart, lineEnd } = lineRange(props.markdownSource, start, end);
  const block = props.markdownSource.slice(lineStart, lineEnd) || 'List item';
  const lines = block.split('\n');
  const inserted = lines.map((line, index) => `${prefixForIndex(index)}${line.replace(/^(\s*([-*+]|\d+\.|\[[ xX]\])\s+|>\s+)/, '')}`).join('\n');
  const nextValue = `${props.markdownSource.slice(0, lineStart)}${inserted}${props.markdownSource.slice(lineEnd)}`;
  await replaceSelection(nextValue, lineStart, lineStart + inserted.length);
}

async function setHeading(level: 1 | 2 | 3) {
  const textarea = getTextarea();
  if (!textarea) return;
  const { start, end } = selectionBounds(textarea);
  const { lineStart, lineEnd } = lineRange(props.markdownSource, start, end);
  const line = props.markdownSource.slice(lineStart, lineEnd).replace(/^#{1,6}\s+/, '') || 'Heading';
  const inserted = `${'#'.repeat(level)} ${line}`;
  const nextValue = `${props.markdownSource.slice(0, lineStart)}${inserted}${props.markdownSource.slice(lineEnd)}`;
  await replaceSelection(nextValue, lineStart + level + 1, lineStart + inserted.length);
}

async function applyMarkdown(action: MarkdownAction) {
  if (action === 'undo' || action === 'redo') {
    document.execCommand(action);
    return;
  }

  if (action === 'heading1') return setHeading(1);
  if (action === 'heading2') return setHeading(2);
  if (action === 'heading3') return setHeading(3);
  if (action === 'bold') return wrapSelection('**', '**', 'bold text');
  if (action === 'italic') return wrapSelection('*', '*', 'italic text');
  if (action === 'strike') return wrapSelection('~~', '~~', 'strikethrough text');
  if (action === 'inlineCode') return wrapSelection('`', '`', 'code');
  if (action === 'quote') return prefixLines(() => '> ');
  if (action === 'bulletList') return prefixLines(() => '- ');
  if (action === 'numberedList') return prefixLines((index) => `${index + 1}. `);
  if (action === 'checkList') return prefixLines(() => '- [ ] ');
  if (action === 'codeBlock') return wrapSelection('```typescript\n', '\n```', 'const value = "example";');
  if (action === 'link') return wrapSelection('[', '](https://example.com)', 'link text');
  if (action === 'image') return wrapSelection('![', '](https://example.com/image.png)', 'image alt');
  if (action === 'table') {
    return insertBlock('| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n', 2);
  }
  return insertBlock('---\n');
}

function sanitizePreviewHtml(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;

  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as HTMLElement;
        if (!ALLOWED_TAGS.has(element.tagName)) {
          element.replaceWith(...Array.from(element.childNodes));
          continue;
        }

        const allowedAttributes = ALLOWED_ATTRIBUTES.get(element.tagName) ?? new Set<string>();
        for (const attribute of Array.from(element.attributes)) {
          const name = attribute.name.toLowerCase();
          const value = attribute.value.trim();
          const allowed = allowedAttributes.has(name);
          const safeUrl = !['href', 'src'].includes(name) || /^(https?:|mailto:)/i.test(value);
          const safeStyle = name !== 'style' || (
            element.tagName === 'SPAN'
            && SAFE_COLOR_STYLE.test(value)
          );
          if (!allowed || !safeUrl || !safeStyle || name.startsWith('on')) {
            element.removeAttribute(attribute.name);
          }
        }

        if (element.tagName === 'A') {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noreferrer noopener');
        }
        if (element.tagName === 'INPUT') {
          const checked = element.hasAttribute('checked');
          element.replaceChildren();
          element.setAttribute('type', 'checkbox');
          element.setAttribute('disabled', '');
          if (checked) {
            element.setAttribute('checked', '');
          } else {
            element.removeAttribute('checked');
          }
        }
      }
      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

const previewHtml = computed(() => {
  const rendered = marked.parse(props.markdownSource, { async: false }) as string;
  return sanitizePreviewHtml(rendered);
});
</script>

<style scoped>
.markdown-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}

.color-menu {
  border-radius: 8px;
}

.color-indicator {
  position: absolute;
  right: 6px;
  bottom: 5px;
  width: 14px;
  height: 3px;
  border-radius: 999px;
}

.markdown-body-row {
  align-items: stretch;
}

.markdown-body-col {
  display: flex;
  flex-direction: column;
}

.markdown-body-col :deep(.v-input),
.markdown-body-col :deep(.v-input__control),
.markdown-body-col :deep(.v-field),
.markdown-body-col :deep(.v-field__field),
.markdown-body-col :deep(textarea) {
  flex: 1 1 auto;
}

.preview {
  flex: 1 1 auto;
  height: 100%;
  min-height: 100%;
  padding: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  overflow-wrap: anywhere;
  overflow: auto;
  line-height: 1.6;
}

.preview :deep(p),
.preview :deep(ul),
.preview :deep(ol),
.preview :deep(blockquote),
.preview :deep(pre),
.preview :deep(table) {
  margin-block: 0 14px;
}

.preview :deep(p:last-child),
.preview :deep(ul:last-child),
.preview :deep(ol:last-child),
.preview :deep(blockquote:last-child),
.preview :deep(pre:last-child),
.preview :deep(table:last-child) {
  margin-bottom: 0;
}

.preview :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.32);
  color: rgb(var(--v-theme-primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 0.92em;
}

.preview :deep(pre) {
  padding: 14px 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
  background: #111827;
  overflow: auto;
}

.preview :deep(pre code) {
  display: block;
  padding: 0;
  background: transparent;
  color: #e5e7eb;
  font-size: 0.9rem;
  line-height: 1.55;
}

.preview :deep(blockquote) {
  padding: 8px 14px;
  border-left: 4px solid rgb(var(--v-theme-primary));
  border-radius: 0 6px 6px 0;
  background: rgba(var(--v-theme-primary), 0.08);
  color: rgba(var(--v-theme-on-surface), 0.86);
}

.preview :deep(ul),
.preview :deep(ol) {
  padding-left: 28px;
}

.preview :deep(li) {
  margin: 5px 0;
  padding-left: 4px;
}

.preview :deep(li input[type="checkbox"]) {
  width: 16px;
  height: 16px;
  margin: 0 8px 0 -24px;
  vertical-align: -2px;
  accent-color: rgb(var(--v-theme-primary));
}

.preview :deep(ul:has(input[type="checkbox"])) {
  list-style: none;
  padding-left: 28px;
}

.preview :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px 0;
  border-radius: 8px;
}

.preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}

.preview :deep(th),
.preview :deep(td) {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 8px 10px;
  text-align: left;
}

.preview :deep(th) {
  font-weight: 700;
  background: rgba(var(--v-theme-surface-variant), 0.45);
}

.preview :deep(.hljs-keyword),
.preview :deep(.hljs-selector-tag),
.preview :deep(.hljs-title.function_) {
  color: #93c5fd;
}

.preview :deep(.hljs-string),
.preview :deep(.hljs-attr),
.preview :deep(.hljs-symbol) {
  color: #86efac;
}

.preview :deep(.hljs-number),
.preview :deep(.hljs-literal),
.preview :deep(.hljs-built_in) {
  color: #fbbf24;
}

.preview :deep(.hljs-comment) {
  color: #9ca3af;
  font-style: italic;
}

.preview :deep(.hljs-type),
.preview :deep(.hljs-class),
.preview :deep(.hljs-title.class_) {
  color: #c4b5fd;
}

.preview :deep(.hljs-variable),
.preview :deep(.hljs-property) {
  color: #fca5a5;
}
</style>
