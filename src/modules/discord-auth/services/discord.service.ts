import type { DiscordAuth, DiscordUser } from "netlify/core/types/discord.types";
import { getApiUrl, getRedirectUri } from "modules/discord-auth/utils/urls.utils";
import { ref, type Ref } from 'vue';
import { getInitialTheme } from 'core/services/theme.service';
import type { AppTheme } from 'netlify/core/types/theme.types';
import { appStorage } from 'core/services/app-storage.service';
import { createDiscordAuth, isDiscordAuthExpired } from './discord-auth.utils';

class DiscordApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message);
        this.name = 'DiscordApiError';
    }
}

export class DiscordService {
    private static readonly DISCORD_CLIENT_ID = import.meta.env?.VITE_DISCORD_CLIENT_ID ?? '';
    private static readonly DISCORD_API_URL = 'https://discord.com/api/v10';
    public user: Ref<DiscordUser | null> = ref(null);
    private static instance: DiscordService | null = null;
    private loginPromise: Promise<DiscordUser | null> | null = null;
    private initialized = false;

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    public async handleLogin(): Promise<DiscordUser | null> {
        if (this.initialized) {
            return this.user.value;
        }
        if (this.loginPromise) {
            return this.loginPromise;
        }

        this.loginPromise = this.initializeLogin().finally(() => {
            this.initialized = true;
            this.loginPromise = null;
        });
        return this.loginPromise;
    }

    private async initializeLogin(): Promise<DiscordUser | null> {
        if (window.location.hash.includes('access_token=')) {
            try {
                return await this.handleAuthCallback();
            } catch (error) {
                console.error('[DiscordAuth] Failed to process OAuth callback', error);
                return this.user.value;
            }
        }

        const auth = this.getAuth();
        if (!auth) {
            this.removeUser();
            return null;
        }

        const savedUser = this.getUser();
        if (savedUser) this.storeUser(savedUser);

        try {
            return await this.fetchUserInfo(auth);
        } catch (error) {
            console.error('[DiscordAuth] Failed to refresh user info', error);
            return this.user.value;
        }
    }

    public login() {
        this.clearSession();
        this.initialized = false;
        const state = this.generateRandomString(32)
        this.storeOauthState(state)

        const params = new URLSearchParams({
            client_id: DiscordService.DISCORD_CLIENT_ID,
            redirect_uri: getRedirectUri(),
            response_type: 'token',
            scope: 'identify email',
            state: state
        })

        window.location.href = `${DiscordService.DISCORD_API_URL}/oauth2/authorize?${params.toString()}`
    }

    public logout() {
        this.clearSession();
        this.initialized = false;
    }

    public async handleAuthCallback(): Promise<DiscordUser> {
        const urlParams = new URLSearchParams(window.location.hash.slice(1));
        const auth = createDiscordAuth(urlParams);
        const savedState = this.getOauthState();

        this.cleanOAuthFragment();
        this.removeOauthState();

        if (!auth || !savedState || auth.state !== savedState) {
            this.clearSession();
            throw new Error('[DiscordAuth] Invalid OAuth callback');
        }

        this.storeAuth(auth);
        return this.fetchUserInfo(auth);
    }

    public async fetchUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        const userInfo = await fetch(getApiUrl('/discord'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...auth, queryType: 'user', theme: getInitialTheme() }),
        });
        const data = await userInfo.json() as { success?: boolean; data?: DiscordUser; error?: string };
        if (!userInfo.ok || !data?.success || !data.data) {
            if (userInfo.status === 401 || userInfo.status === 403) {
                this.clearSession();
            }
            throw new DiscordApiError(
                data?.error ?? '[DiscordAuth] Failed to fetch user info',
                userInfo.status
            );
        }

        this.storeUser(data.data);
        return data.data;
    }

    private generateRandomString(length: number): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    protected storeUser(user: DiscordUser) {
        appStorage.setDiscordUser(user);
        this.user.value = user;
    }

    public updateStoredUserTheme(theme: AppTheme) {
        const user = this.user.value;
        if (!user) return;
        this.storeUser({ ...user, theme });
    }

    protected storeAuth(auth: DiscordAuth) {
        appStorage.setDiscordAuth(auth);
    }

    protected storeOauthState(state: string) {
        appStorage.setDiscordOauthState(state);
    }

    protected removeUser() {
        appStorage.removeDiscordUser();
        this.user.value = null;
    }

    protected removeAuth() {
        appStorage.removeDiscordAuth();
    }

    protected removeOauthState() {
        appStorage.removeDiscordOauthState();
    }

    private clearSession() {
        this.removeAuth();
        this.removeUser();
        this.removeOauthState();
    }

    private cleanOAuthFragment() {
        window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.search}`
        );
    }

    public getUser(): DiscordUser | null {
        return appStorage.getDiscordUser();
    }

    public isLoggedIn(): boolean {
        return this.getUser() !== null;
    }

    public getAuth(): DiscordAuth | null {
        const auth = appStorage.getDiscordAuth();
        if (!auth) return null;
        if (isDiscordAuthExpired(auth)) {
            console.info('[DiscordAuth] Stored token expired; login is required again');
            this.clearSession();
            return null;
        }
        return auth;
    }

    public getOauthState(): string | null {
        return appStorage.getDiscordOauthState();
    }
}
