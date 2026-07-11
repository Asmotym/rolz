<template>
  <div>
    <div class="d-flex align-center justify-space-between mb-4">
      <div class="writer-heading">
        <h2 class="text-h5">{{ t('admin.writer.title') }}</h2>
        <div class="article-uid">
          <span>{{ t('admin.writer.uid', { uid: articleUid }) }}</span>
          <v-btn
            icon="mdi-content-copy"
            size="x-small"
            variant="text"
            :title="t('admin.writer.copyUid')"
            :aria-label="t('admin.writer.copyUid')"
            :disabled="!articleUid"
            :loading="copyingUid"
            @click="copyArticleUid"
          />
        </div>
      </div>
      <v-btn variant="text" :to="{ name: HomeRoutes.AdminArticles }">{{ t('admin.writer.back') }}</v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-row>
      <v-col cols="12" lg="8">
        <v-card variant="tonal" class="admin-card">
          <v-card-text>
            <ArticleEditor
              v-model:title="title"
              v-model:introduction="introduction"
              v-model:markdown-source="markdownSource"
              v-model:tag-ids="selectedTagIds"
              :tags="tags"
              allow-create-tags
              @create-tag="createTag"
            />
          </v-card-text>
          <v-card-actions class="justify-end flex-wrap ga-2">
            <v-btn variant="tonal" @click="tagDialog = true">{{ t('admin.writer.manageTags') }}</v-btn>
            <v-btn variant="tonal" @click="saveCurrentDraft">{{ t('admin.writer.saveDraft') }}</v-btn>
            <v-btn variant="tonal" color="primary" @click="saveArticle('unpublished')">{{ t('common.save') }}</v-btn>
            <v-btn color="primary" @click="saveArticle('published')">{{ t('admin.articles.publish') }}</v-btn>
            <v-btn variant="tonal" color="primary" @click="scheduleDialog = true">{{ t('admin.writer.publishOnDate') }}</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="12" lg="4">
        <v-card variant="tonal" class="admin-card">
          <v-card-title>{{ t('admin.writer.drafts') }}</v-card-title>
          <v-card-text>
            <v-list v-if="drafts.length > 0" density="compact">
              <v-list-item v-for="draft in drafts" :key="draft.id" @click="selectDraft(draft)">
                <v-list-item-title>{{ draft.title || '_blank_' }}</v-list-item-title>
                <template #append>
                  <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click.stop="deleteDraft(draft.id)" />
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-medium-emphasis">{{ t('admin.writer.noDrafts') }}</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="scheduleDialog" max-width="420">
      <v-card>
        <v-card-title>{{ t('admin.writer.publishOnDate') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="publishedAt" type="datetime-local" :label="t('admin.writer.publicationDate')" />
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="scheduleDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="saveArticle('published', publishedAt)">{{ t('admin.writer.validateDate') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="tagDialog" max-width="520">
      <v-card>
        <v-card-title>{{ t('admin.writer.manageTags') }}</v-card-title>
        <v-card-text>
          <v-list density="compact">
            <v-list-item v-for="tag in tags" :key="tag.id">
              <v-text-field v-model="tagEdits[tag.id]" density="compact" hide-details />
              <template #append>
                <v-btn icon="mdi-content-save" size="small" variant="text" @click="renameTag(tag.id)" />
                <v-btn icon="mdi-delete" size="small" variant="text" color="error" @click="deleteTag(tag.id)" />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="tagDialog = false">{{ t('common.close') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ArticleDraft, ArticleTag } from 'netlify/core/types/data.types';
import { AdminArticlesService, ArticlesService } from 'core/services/articles.service';
import { HomeRoutes } from 'core/routes';
import { notifications } from 'core/services/notifications.service';
import ArticleEditor from './ArticleEditor.component.vue';

const { t } = useI18n();
const title = ref('');
const introduction = ref('');
const markdownSource = ref('');
const selectedTagIds = ref<string[]>([]);
const tags = ref<ArticleTag[]>([]);
const drafts = ref<ArticleDraft[]>([]);
const currentDraftId = ref<string | undefined>();
const error = ref<string | null>(null);
const scheduleDialog = ref(false);
const tagDialog = ref(false);
const publishedAt = ref('');
const dirty = ref(false);
const articleUid = ref('');
const copyingUid = ref(false);
const tagEdits = reactive<Record<string, string>>({});
let autosave: number | null = null;
let draftCreation: Promise<void> | null = null;

const hasContent = computed(() => title.value.trim() || introduction.value.trim() || markdownSource.value.trim());

function markSaved(text: string) {
  dirty.value = false;
  notifications.success(text);
}

async function loadTags() {
  tags.value = await ArticlesService.listTags();
  for (const tag of tags.value) {
    tagEdits[tag.id] = tag.name;
  }
}

async function loadDrafts() {
  drafts.value = await AdminArticlesService.listDrafts();
}

async function createTag(value: string) {
  const name = String(value ?? '').trim();
  if (!name) return;
  const tag = await AdminArticlesService.createTag(name);
  await loadTags();
  selectedTagIds.value = [...new Set([...selectedTagIds.value, tag.id])];
}

async function renameTag(tagId: string) {
  await AdminArticlesService.renameTag(tagId, tagEdits[tagId]);
  await loadTags();
}

async function deleteTag(tagId: string) {
  await AdminArticlesService.deleteTag(tagId);
  selectedTagIds.value = selectedTagIds.value.filter((id) => id !== tagId);
  await loadTags();
}

async function saveCurrentDraft() {
  const draft = await AdminArticlesService.saveDraft({
    id: currentDraftId.value,
    title: title.value || null,
    introduction: introduction.value || null,
    markdownSource: markdownSource.value,
    selectedTagIds: selectedTagIds.value,
  });
  currentDraftId.value = draft.id;
  articleUid.value = draft.uid;
  await loadDrafts();
  markSaved(t('admin.writer.draftSaved'));
}

async function createInitialDraft() {
  if (currentDraftId.value) return;
  if (!draftCreation) {
    draftCreation = (async () => {
      const draft = await AdminArticlesService.saveDraft({
        title: null,
        introduction: null,
        markdownSource: '',
        selectedTagIds: [],
      });
      currentDraftId.value = draft.id;
      articleUid.value = draft.uid;
      await loadDrafts();
    })().finally(() => {
      draftCreation = null;
    });
  }
  await draftCreation;
}

async function selectDraft(draft: ArticleDraft) {
  if (hasContent.value && dirty.value) {
    const shouldSave = window.confirm(t('admin.writer.saveBeforeSwitch'));
    if (shouldSave) await saveCurrentDraft();
  }
  currentDraftId.value = draft.id;
  articleUid.value = draft.uid;
  title.value = draft.title ?? '';
  introduction.value = draft.introduction ?? '';
  markdownSource.value = draft.markdownSource;
  selectedTagIds.value = draft.selectedTagIds;
  dirty.value = false;
}

async function deleteDraft(draftId: string) {
  await AdminArticlesService.deleteDraft(draftId);
  if (currentDraftId.value === draftId) {
    currentDraftId.value = undefined;
    articleUid.value = '';
  }
  await loadDrafts();
}

async function saveArticle(status: 'unpublished' | 'published', date?: string) {
  try {
    const article = await AdminArticlesService.createArticle({
      title: title.value,
      introduction: introduction.value,
      markdownSource: markdownSource.value,
      tagIds: selectedTagIds.value,
      status,
      publishedAt: date ? new Date(date).toISOString() : null,
      draftId: currentDraftId.value,
    });
    const savedDraftId = currentDraftId.value;
    if (savedDraftId) {
      await AdminArticlesService.deleteDraft(savedDraftId);
      drafts.value = drafts.value.filter((draft) => draft.id !== savedDraftId);
    }
    scheduleDialog.value = false;
    title.value = '';
    introduction.value = '';
    markdownSource.value = '';
    selectedTagIds.value = [];
    currentDraftId.value = undefined;
    articleUid.value = article.uid;
    markSaved(status === 'published' ? t('admin.writer.published') : t('admin.writer.saved'));
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('admin.writer.saveError');
  }
}

async function copyArticleUid() {
  if (!articleUid.value) return;
  copyingUid.value = true;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(articleUid.value);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = articleUid.value;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    notifications.success(t('admin.writer.copyUidSuccess'));
  } catch {
    notifications.error(t('admin.writer.copyUidError'));
  } finally {
    copyingUid.value = false;
  }
}

watch([title, introduction, markdownSource, selectedTagIds], () => {
  if (!currentDraftId.value && hasContent.value) {
    createInitialDraft().catch((caught) => {
      error.value = caught instanceof Error ? caught.message : t('admin.writer.draftError');
    });
  }
  dirty.value = true;
});

onMounted(async () => {
  await Promise.all([loadTags(), loadDrafts()]);
  await createInitialDraft();
  autosave = window.setInterval(() => {
    if (dirty.value && hasContent.value) {
      saveCurrentDraft().catch((caught) => {
        error.value = caught instanceof Error ? caught.message : t('admin.writer.draftError');
      });
    }
  }, 15000);
});

onUnmounted(() => {
  if (autosave) window.clearInterval(autosave);
});
</script>

<style scoped>
.admin-card {
  border-radius: 8px;
}

.writer-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.article-uid {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-family: monospace;
  font-size: 0.875rem;
}
</style>
