import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import supabase from './client';
import { logger } from '../utils/logger';

/**
 * 认证会话的抽象，供业务层统一消费。
 * - user：Supabase 返回的用户信息；未登录时为 null。
 * - session：包含 access token 等凭据；未登录时为 null。
 */
export interface AuthSession {
  user: User | null;
  session: Session | null;
}

/**
 * 读取当前会话（应用启动或刷新页面后用于恢复登录态）。
 * @returns 当前登录用户和会话。如果未登录，两者为 null。
 * @throws Supabase 底层返回错误时向外抛出，交由调用方处理。
 */
export const getCurrentSession = async (): Promise<AuthSession> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    logger.error('Failed to get Supabase session:', error);
    throw error;
  }
  return {
    user: data.session?.user ?? null,
    session: data.session ?? null,
  };
};

/**
 * 触发邮箱 OTP（一次性验证码）登录。
 * Supabase 会向指定邮箱发送 Magic Link，用户点击后自动完成登录。
 * @param email 用户邮箱
 */
export const signInWithOtp = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    logger.error('Failed to send login OTP email:', error);
    throw error;
  }
};

/**
 * 使用邮箱 + 密码登录。
 * 典型账号密码登录场景，成功后返回最新会话信息。
 * @param email 登录邮箱
 * @param password 登录密码
 */
export const signInWithPassword = async (
  email: string,
  password: string,
): Promise<AuthSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    logger.error('Failed to sign in with password:', error);
    throw error;
  }
  return {
    user: data.user ?? null,
    session: data.session ?? null,
  };
};

/**
 * 使用邮箱 + 密码注册新账号。
 * 根据 Supabase 设置，可能需要邮箱验证后才能正式登录。
 * @param email 注册邮箱
 * @param password 注册密码
 */
export const signUpWithPassword = async (
  email: string,
  password: string,
): Promise<AuthSession> => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    logger.error('Failed to sign up with password:', error);
    throw error;
  }
  return {
    user: data.user ?? null,
    session: data.session ?? null,
  };
};

/**
 * 主动登出，清理本地缓存的会话信息。
 * 调用成功后应重置前端状态为未登录。
 */
export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.error('Failed to sign out:', error);
    throw error;
  }
};

/**
 * 订阅认证状态变化（登录、刷新 token、登出等事件）。
 * 典型用法：在应用入口处注册监听，维护全局用户状态。
 * @param callback 状态变化时触发的回调
 * @returns 取消订阅函数，组件销毁或不再需要监听时调用
 */
export const onAuthStateChange = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): (() => void) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    try {
      callback(event, session);
    } catch (err) {
      logger.error('Error in auth state change callback:', err);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};
