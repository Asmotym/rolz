import type { RouteRecordRaw } from "vue-router";
import HomeLayout from "core/layouts/Home.layout.vue";
import SettingsLayout from "core/layouts/Settings.layout.vue";

export enum HomeRoutes {
    Base = 'Base',
    Room = 'Room',
    Settings = 'Settings',
}

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: HomeRoutes.Base,
        component: HomeLayout,
    },
    {
        path: '/rooms/:roomId',
        name: HomeRoutes.Room,
        component: HomeLayout,
    },
    {
        path: '/settings',
        name: HomeRoutes.Settings,
        component: SettingsLayout,
    },
];
