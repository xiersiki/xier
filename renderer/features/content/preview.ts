// Development-only fixture entry: no Electron, authentication, model or persistence.
import '../../index.css';
import { createApp } from 'vue';
import ContentWorkspace from './ContentWorkspace.vue';
import { FixtureAgentPort } from '../../platform/content/fixture-agent';
import { browserFiles } from '../../platform/content/browser-files';
createApp(ContentWorkspace, { files: browserFiles, port: new FixtureAgentPort(), scopeId: 'preview-guest' }).mount('#app');
