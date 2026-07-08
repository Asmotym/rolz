import type { DiscordAuth, DiscordUser } from "netlify/core/types/discord.types";
import { getApiUrl, getRedirectUri } from "modules/discord-auth/utils/urls.utils";
import { ref, type Ref } from 'vue';
import { fetchUserTheme, getInitialTheme } from 'core/services/theme.service';
import type { AppTheme } from 'netlify/core/types/theme.types';
import { appStorage } from 'core/services/app-storage.service';

export class DiscordService {
    private static readonly DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;
    private static readonly DISCORD_API_URL = 'https://discord.com/api/v10';
    public user: Ref<DiscordUser | null> = ref(null);
    private static instance: DiscordService | null = null;

    public static getInstance(): DiscordService {
        if (!DiscordService.instance) {
            DiscordService.instance = new DiscordService();
        }
        return DiscordService.instance;
    }

    public async handleLogin(): Promise<DiscordUser | null> {
        const savedUser = this.getUser();
        if (savedUser !== null) {
            this.storeUser(savedUser);
            try {
                const theme = await fetchUserTheme(savedUser.id);
                this.updateStoredUserTheme(theme);
            } catch (error) {
                console.error('[DiscordAuth] Failed to refresh user preferences', error);
            }
        } else {
            const auth = this.getAuth();
            if (auth && auth.accessToken) {
                await this.fetchUserInfo(auth);
            }
        }
        
        // Handle OAuth callback
        if (window.location.hash.includes('token_type=')) {
            await this.handleAuthCallback();
        }

        return this.user.value;
    }

    public login() {
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
        this.removeAuth();
        this.removeUser();
        this.removeOauthState();
    }

    public async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.hash.slice(1));

        // retrieve url params from the discord redirect login
        const tokenType = urlParams.get('token_type') || '';
        const accessToken = urlParams.get('access_token') || '';
        const expiresIn = Number(urlParams.get('expires_in') || 0);
        const scope = urlParams.get('scope') || '';
        const state = urlParams.get('state') || '';
        const auth = {
            tokenType,
            accessToken,
            expiresIn,
            scope,
            state,
        }

        // retrieve saved state
        const savedState = this.getOauthState();

        if (auth.state === savedState) {
            // save auth to local storage
            this.storeAuth(auth);

            // clean up url
            window.history.replaceState({}, document.title, window.location.pathname);

            // retrieve user info
            await this.fetchUserInfo(auth);
        }
    }

    public async fetchUserInfo(auth: DiscordAuth): Promise<DiscordUser> {
        const userInfo = await fetch(getApiUrl('/discord'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...auth, queryType: 'user', theme: getInitialTheme() }),
        });
        const data = await userInfo.json();
        if (!data || !data.success) {
            throw new Error('[DiscordAuth] Failed to fetch user info');
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

    public getUser(): DiscordUser | null {
        return appStorage.getDiscordUser();
    }

    public isLoggedIn(): boolean {
        return this.getUser() !== null;
    }

    public getAuth(): DiscordAuth | null {
        return appStorage.getDiscordAuth();
    }

    public getOauthState(): string | null {
        return appStorage.getDiscordOauthState();
    }
}
