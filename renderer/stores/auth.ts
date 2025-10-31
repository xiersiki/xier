import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Session, User } from '@supabase/supabase-js';
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithOtp as repoSignInWithOtp,
  signInWithPassword as repoSignInWithPassword,
  signUpWithPassword as repoSignUpWithPassword,
  signOut as repoSignOut,
  type AuthSession,
} from '@renderer/services/authRepo';
import { logger } from '@renderer/utils/logger';

/**
 * Supabase 认证状态的 Pinia Store。
 * 维护当前 session/user，提供登录登出方法，衔接 authRepo 与界面层。
 */
export const useAuthStore = defineStore('auth', () => {
  // --- 响应式状态 ------------------------------------------------------------

  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  let unsubscribeAuthListener: (() => void) | null = null;

  // --- 内部工具函数 ----------------------------------------------------------

  const setAuthState = (_session: Session | null) => {
    session.value = _session;
    user.value = _session?.user ?? null;
  };

  const setError = (err: unknown) => {
    if (err instanceof Error) {
      errorMessage.value = err.message;
      return;
    }
    if (typeof err === 'string') {
      errorMessage.value = err;
      return;
    }
    errorMessage.value = 'Unexpected authentication error';
  };

  const clearError = () => {
    errorMessage.value = null;
  };

  // --- 生命周期 --------------------------------------------------------------

  /**
   * 初始化认证状态（仅执行一次）。
   * 1. 恢复已有会话。
   * 2. 监听认证状态变化，保持 store 同步。
   */
  const initialize = async () => {
    if (unsubscribeAuthListener) return;

    loading.value = true;
    clearError();
    try {
      const current = await getCurrentSession();
      setAuthState(current.session);
    } catch (err) {
      logger.error('Auth initialization failed:', err);
      setError(err);
    } finally {
      loading.value = false;
    }

    unsubscribeAuthListener = onAuthStateChange((_event, nextSession) => {
      setAuthState(nextSession);
    });
  };

  /**
   * 移除认证状态监听，通常在应用卸载或无需再监听时调用。
   */
  const dispose = () => {
    unsubscribeAuthListener?.();
    unsubscribeAuthListener = null;
  };

  // --- 动作 -----------------------------------------------------------------

  const signInWithOtp = async (email: string): Promise<void> => {
    loading.value = true;
    clearError();
    try {
      await repoSignInWithOtp(email);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const signInWithPassword = async (
    email: string,
    password: string,
  ): Promise<AuthSession> => {
    loading.value = true;
    clearError();
    try {
      const authSession = await repoSignInWithPassword(email, password);
      setAuthState(authSession.session);
      return authSession;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const signUpWithPassword = async (
    email: string,
    password: string,
  ): Promise<AuthSession> => {
    loading.value = true;
    clearError();
    try {
      const authSession = await repoSignUpWithPassword(email, password);
      setAuthState(authSession.session);
      return authSession;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const signOut = async (): Promise<void> => {
    loading.value = true;
    clearError();
    try {
      await repoSignOut();
      setAuthState(null);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // --- 计算属性 --------------------------------------------------------------

  const userId = computed(() => user.value?.id ?? null);
  const isAuthenticated = computed(() => Boolean(userId.value));

  // --- 对外暴露 --------------------------------------------------------------

  return {
    // 状态
    user,
    session,
    userId,
    loading,
    errorMessage,
    isAuthenticated,
    // 方法
    initialize,
    signInWithOtp,
    signInWithPassword,
    signUpWithPassword,
    signOut,
    clearError,
    dispose,
  };
});
