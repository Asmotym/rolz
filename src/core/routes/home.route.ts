import type { RouteRecordRaw } from "vue-router";

export enum HomeRoutes {
    Base = 'Base',
    Room = 'Room',
    Settings = 'Settings',
}

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: HomeRoutes.Base,
        component: () => import("core/layouts/Home.layout.vue"),
    },
    {
        path: '/rooms/:roomId',
        name: HomeRoutes.Room,
        component: () => import("core/layouts/Home.layout.vue"),
    },
    {
        path: '/settings',
        name: HomeRoutes.Settings,
        component: () => import("core/layouts/Settings.layout.vue"),
    },
];
