<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NTabs,
  NTabPane,
  NDivider,
  NAlert,
  NSpace,
  useMessage,
} from 'naive-ui';
import { Icon as IconifyIcon } from '@iconify/vue';
import { useAuthStore } from '@renderer/stores/auth';

type Mode = 'login' | 'register';

const props = withDefaults(defineProps<{ show: boolean }>(), {
  show: false,
});

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void;
  (event: 'success'): void;
}>();

const authStore = useAuthStore();
const message = useMessage();

const mode = ref<Mode>('login');
const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
});
const localError = ref<string | null>(null);
const emailSubmitting = ref(false);
const oauthLoading = reactive<Record<'google' | 'github', boolean>>({
  google: false,
  github: false,
});

const isLoginMode = computed(() => mode.value === 'login');
const mergedError = computed(() => localError.value || authStore.errorMessage);
const maskClosable = computed(() => isLoginMode.value && !emailSubmitting.value && !oauthLoading.google && !oauthLoading.github);

function resetForm() {
  form.email = '';
  form.password = '';
  form.confirmPassword = '';
  localError.value = null;
  authStore.clearError();
  mode.value = 'login';
  emailSubmitting.value = false;
  oauthLoading.google = false;
  oauthLoading.github = false;
}

function close() {
  emit('update:show', false);
  resetForm();
}

async function handleSubmit() {
  localError.value = null;
  authStore.clearError();

  if (!form.email || !form.password) {
    localError.value = 'Email and password are required.';
    return;
  }

  if (!/\S+@\S+\.\S+/.test(form.email)) {
    localError.value = 'Invalid email address.';
    return;
  }

  if (!isLoginMode.value && form.password !== form.confirmPassword) {
    localError.value = 'Passwords do not match.';
    return;
  }

  try {
    emailSubmitting.value = true;
    if (isLoginMode.value) {
      await authStore.signInWithPassword(form.email, form.password);
      message.success('Signed in successfully.');
    } else {
      await authStore.signUpWithPassword(form.email, form.password);
      message.success('Sign up successful. Please check your email to confirm your account.');
    }
    emit('success');
    close();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Authentication failed, please try again.';
    message.error(errMsg);
  } finally {
    emailSubmitting.value = false;
  }
}

async function handleOAuth(provider: 'google' | 'github') {
  localError.value = null;
  authStore.clearError();
  try {
    oauthLoading[provider] = true;
    await authStore.signInWithOAuth(provider);
    message.success(`Continuing with ${provider === 'google' ? 'Google' : 'GitHub'}...`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'OAuth sign-in failed, please retry.';
    message.error(errMsg);
  } finally {
    oauthLoading[provider] = false;
  }
}

function handleTabChange(value: string) {
  mode.value = value as Mode;
  localError.value = null;
  authStore.clearError();
  if (value === 'register') {
    message.info('Sign up requires email verification. Please check your inbox after submitting.');
  }
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      resetForm();
    }
  },
);
</script>

<template>
  <n-modal
    :show="props.show"
    transform-origin="center"
    :mask-closable="maskClosable"
    class="auth-modal"
    @update:show="(val) => (val ? emit('update:show', val) : close())"
    @after-leave="resetForm"
  >
    <div class="auth-card relative px-8 py-6">
      <button type="button" class="auth-close" @click="close">
        <iconify-icon icon="lucide:x" width="18" height="18" />
      </button>

      <header class="auth-header mb-3 pr-8">
        <h3 class="auth-title text-base font-medium leading-6">
          {{ isLoginMode ? 'Sign In' : 'Create Account' }}
        </h3>
        <p class="auth-subtitle mt-2 text-xs leading-5">
          Use email/password or third-party providers to continue.
        </p>
      </header>

      <n-tabs type="line" size="small" :value="mode" animated @update:value="handleTabChange">
        <n-tab-pane name="login" tab="Sign In" />
        <n-tab-pane name="register" tab="Sign Up" />
      </n-tabs>

      <n-alert v-if="!isLoginMode" type="info" class="auth-info" :show-icon="false">
        A verification email will be sent after sign up. Please confirm it to activate your account.
      </n-alert>

      <n-form class="auth-form" @submit.prevent="handleSubmit">
        <n-form-item label="Email">
          <n-input v-model:value="form.email" placeholder="Enter email" type="text" />
        </n-form-item>
        <n-form-item label="Password">
          <n-input
            v-model:value="form.password"
            placeholder="Enter password"
            type="password"
            show-password-on="mousedown"
          />
        </n-form-item>
        <n-form-item
          label="Confirm Password"
          :class="['auth-confirm', { 'auth-confirm--hidden': isLoginMode }]"
        >
          <n-input
            v-model:value="form.confirmPassword"
            placeholder="Re-enter password"
            type="password"
            show-password-on="mousedown"
            :disabled="isLoginMode"
          />
        </n-form-item>

        <n-alert v-if="mergedError" type="error" :show-icon="false" class="auth-error">
          {{ mergedError }}
        </n-alert>

        <n-button type="primary" block class="auth-submit" :loading="emailSubmitting" @click="handleSubmit">
          {{ isLoginMode ? 'Sign In' : 'Sign Up' }}
        </n-button>
      </n-form>

      <n-divider dashed class="auth-divider">Or continue with</n-divider>

      <n-space vertical size="small">
        <n-button block secondary class="auth-social" :loading="oauthLoading.google" @click="handleOAuth('google')">
          <span class="auth-social__content">
            <iconify-icon icon="logos:google-icon" width="18" height="18" />
            <span>Continue with Google</span>
          </span>
        </n-button>
        <n-button block secondary class="auth-social" :loading="oauthLoading.github" @click="handleOAuth('github')">
          <span class="auth-social__content">
            <iconify-icon icon="mdi:github" width="18" height="18" />
            <span>Continue with GitHub</span>
          </span>
        </n-button>
      </n-space>

      <n-button tertiary block class="auth-cancel" @click="close">
        Cancel
      </n-button>
    </div>
  </n-modal>
</template>

<style scoped>
.auth-modal {
  width: 520px;
  max-width: calc(100vw - 32px);
}

.auth-card {
  position: relative;
  border-radius: 16px;
  background-color: var(--bg-color);
  color: var(--text-primary);
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
}

:global(.dark) .auth-card {
  background-color: var(--bg-secondary);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
}

.auth-close {
  position: absolute;
  right: 16px;
  top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  transition: background 0.2s ease, color 0.2s ease;
  cursor: pointer;
}

.auth-close:hover {
  color: var(--text-primary);
  background: rgba(0, 0, 0, 0.08);
}

:global(.dark) .auth-close:hover {
  background: rgba(255, 255, 255, 0.12);
}

.auth-title {
  color: var(--text-primary);
}

.auth-subtitle {
  color: var(--text-secondary);
}

.auth-form {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 260px;
}

.auth-info {
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-primary);
  background-color: rgba(15, 23, 42, 0.06);
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(15, 23, 42, 0.1);
}

:global(.dark) .auth-info {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-secondary);
}

.auth-confirm {
  transition: opacity 0.2s ease;
}

.auth-confirm--hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.auth-error {
  font-size: 12px;
}

.auth-submit {
  margin-top: 8px;
}

.auth-divider {
  margin: 16px 0 !important;
  color: var(--text-secondary);
}

.auth-social__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-primary);
}

.auth-cancel {
  margin-top: 20px;
  color: var(--text-secondary);
}
</style>
