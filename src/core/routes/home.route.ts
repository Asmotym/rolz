import type { RouteRecordRaw } from "vue-router";
import HomeLayout from "core/layouts/Home.layout.vue";

export enum HomeRoutes {
    Base = 'Base',
    Room = 'Room',
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
];
