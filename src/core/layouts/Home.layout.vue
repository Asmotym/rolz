<template>
    <HeaderComponent />
    <v-container class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import HeaderComponent from 'core/components/Header.component.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>