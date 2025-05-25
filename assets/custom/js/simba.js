/**
 * SIMBA.js - Clases utilitarias para la aplicación de chat
 * Versión: 1.0.0
 */

window.SIMBA = window.SIMBA || {};

/**
 * Gestiona la configuración de la aplicación
 */
SIMBA.ConfigManager = class {
    constructor() {
        this.config = {
            completionsApiUrl: window.config?.completion?.url || '',
            completionsApiKey: window.config?.completion?.apiKey || '',
            assistantApiUrl: window.config?.api_url || '',
            assistantAuthToken: window.config?.token || ''
        };
        this.loadFromStorage();
    }

    loadFromStorage() {
        const stored = {
            completionsApiUrl: localStorage.getItem('completionsApiUrl'),
            completionsApiKey: localStorage.getItem('completionsApiKey'),
            assistantApiUrl: localStorage.getItem('assistantApiUrl'),
            assistantAuthToken: localStorage.getItem('assistantAuthToken')
        };

        // Solo sobrescribir si existe en localStorage
        Object.keys(stored).forEach(key => {
            if (stored[key]) {
                this.config[key] = stored[key];
            }
        });
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.saveToStorage();
        this.updateGlobalConfig();
    }

    saveToStorage() {
        Object.keys(this.config).forEach(key => {
            localStorage.setItem(key, this.config[key]);
        });
    }

    updateGlobalConfig() {
        if (window.config) {
            window.config.api_url = this.config.assistantApiUrl;
            window.config.token = this.config.assistantAuthToken;
            window.config.completion.url = this.config.completionsApiUrl;
            window.config.completion.apiKey = this.config.completionsApiKey;
        }
    }

    getConfig() {
        return { ...this.config };
    }

    isValid() {
        return Object.values(this.config).every(value => value && value.trim().length > 0);
    }
};

/**
 * Gestiona el historial de mensajes y optimización de tokens
 */
SIMBA.MessageManager = class {
    constructor() {
        this.messagesHistory = [{
            role: "system",
            content: ""
        }];
        this.TOKEN_LIMIT = 32000;
        this.MAX_TOKENS = 10000;
        this.SUMMARY_MODEL = "mistral-small-24B-instruct-2501";
    }

    addMessage(role, content, toolCalls = null) {
        const message = { role, content };
        if (toolCalls) message.tool_calls = toolCalls;
        this.messagesHistory.push(message);
        return message;
    }

    updateSystemMessage(content) {
        this.messagesHistory[0].content = content;
    }

    getHistory() {
        return [...this.messagesHistory];
    }

    clearHistory() {
        this.messagesHistory = [{
            role: "system",
            content: this.messagesHistory[0]?.content || ""
        }];
    }

    estimateTokens(message) {
        if (!message || !message.content) return 0;
        return Math.ceil(message.content.length / 4);
    }

    getTotalTokens() {
        return this.messagesHistory.reduce((total, msg) => total + this.estimateTokens(msg), 0);
    }

    cleanSimbaDocuments(messageContent) {
        if (!messageContent) return messageContent;
        return messageContent.replace(/<simba_document[^>]*>[\s\S]*?<\/simba_document>/g, '');
    }

    needsOptimization() {
        return this.getTotalTokens() > this.TOKEN_LIMIT;
    }

    async optimizeIfNeeded($f7, config) {
        if (!this.needsOptimization()) return { optimized: false };

        try {
            const result = await this.optimizeConversation($f7, config);
            console.log(`🎉 Optimized: Saved ${result.tokenReduction} tokens!`);
            return result;
        } catch (error) {
            console.error("Optimization failed:", error);
            return { optimized: false, error };
        }
    }

    async optimizeConversation($f7, config) {
        // Implementar lógica de optimización aquí
        // Por ahora, retornar un resultado mock
        return { optimized: true, tokenReduction: 1000 };
    }
};

/**
 * Gestiona las fuentes y referencias
 */
SIMBA.SourceManager = class {
    constructor() {
        this.tempSources = [];
        this.storagePrefix = 'sources_';
    }

    setTempSources(sources) {
        this.tempSources = sources || [];
    }

    getTempSources() {
        return [...this.tempSources];
    }

    clearTempSources() {
        this.tempSources = [];
    }

    saveToStorage(messageId, sources, params = null) {
        const sourceArray = {
            sources: sources || [],
            params: params || {},
            timestamp: Date.now()
        };
        localStorage.setItem(this.storagePrefix + messageId, JSON.stringify(sourceArray));
    }

    getByMessageId(messageId) {
        try {
            const sourcesJson = localStorage.getItem(this.storagePrefix + messageId);
            return sourcesJson ? JSON.parse(sourcesJson).sources : null;
        } catch (error) {
            console.error('Error parsing sources from localStorage:', error);
            return null;
        }
    }

    removeByMessageId(messageId) {
        localStorage.removeItem(this.storagePrefix + messageId);
    }

    buildSimbaPrompt(sources) {
        if (!Array.isArray(sources)) return '';

        const blocks = [];
        for (const source of sources) {
            if (Array.isArray(source.references) && source.references.length > 0) {
                this.buildReferencesBlocks(source, blocks);
            } else if (source.text) {
                this.buildTextBlock(source, blocks);
            }
        }
        return blocks.join("\n\n");
    }

    buildReferencesBlocks(source, blocks) {
        const name = source.id || source.name || 'Unknown';
        const guid = source.guid || "";
        const icon = source.icon || "";

        for (const ref of source.references) {
            const page = ref.page ?? "";
            const section = ref.section ?? "";
            const text = (ref.text || "").trim();

            if (text) {
                const block = `<simba_document data-icon="${icon}" data-filename="${name}" data-guid="${guid}" data-page="${page}" data-section="${section}">\n${text}\n</simba_document>`;
                blocks.push(block);
            }
        }
    }

    buildTextBlock(source, blocks) {
        const name = source.id || source.name || 'Unknown';
        const guid = source.guid || "";
        const text = source.text.trim();
        const icon = source.icon || "";

        if (text) {
            const block = `<simba_document data-icon="${icon}" data-filename="${name}" data-guid="${guid}">\n${text}\n</simba_document>`;
            blocks.push(block);
        }
    }

    getAllStoredSources() {
        const sources = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.storagePrefix)) {
                const messageId = key.substring(this.storagePrefix.length);
                sources[messageId] = this.getByMessageId(messageId);
            }
        }
        return sources;
    }

    cleanupOldSources(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 días por defecto
        const now = Date.now();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.storagePrefix)) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.timestamp && (now - data.timestamp) > maxAge) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    // Si no se puede parsear, eliminar
                    localStorage.removeItem(key);
                }
            }
        }
    }
};

/**
 * Gestiona los highlights del texto
 */
SIMBA.HighlightManager = class {
    constructor() {
        this.highlights = {};
        this.popupHighlights = null;
        this.storageKey = 'chat_highlights';
        this.loadFromStorage();
    }

    add(id, text) {
        console.log(text)
        this.highlights[id] = {
            text: text,
            timestamp: Date.now(),
            id: id
        };
        this.saveToStorage();
    }

    remove(id) {
        delete this.highlights[id];
        this.saveToStorage();
    }

    get(id) {
        return this.highlights[id];
    }

    getAll() {
        return { ...this.highlights };
    }

    getAllTexts() {
        return Object.values(this.highlights).map(h => h.text);
    }

    count() {
        return Object.keys(this.highlights).length;
    }

    clear() {
        this.highlights = {};
        this.saveToStorage();
    }

    updateOrder(orderedIds) {
        const newHighlights = {};
        orderedIds.forEach(id => {
            if (this.highlights[id]) {
                newHighlights[id] = this.highlights[id];
            }
        });
        this.highlights = newHighlights;
        this.saveToStorage();
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.highlights));
        } catch (error) {
            console.error('Error saving highlights to storage:', error);
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.highlights = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Error loading highlights from storage:', error);
            this.highlights = {};
        }
    }

    export() {
        return {
            highlights: this.getAll(),
            count: this.count(),
            texts: this.getAllTexts(),
            exportDate: new Date().toISOString()
        };
    }

    import(data) {
        if (data && data.highlights) {
            this.highlights = { ...data.highlights };
            this.saveToStorage();
            return true;
        }
        return false;
    }
};

/**
 * Gestiona las llamadas a herramientas
 */
SIMBA.ToolManager = class {
    constructor(chat, config) {
        this.chat = chat;
        this.config = config;
        this.processingToolResponse = false;
        this.activeRequests = new Map();
    }

    updateChat(chat) {
        this.chat = chat;
    }

    updateConfig(config) {
        this.config = config;
    }

    isProcessing() {
        return this.processingToolResponse;
    }

    setProcessing(processing) {
        this.processingToolResponse = processing;
    }

    async callTool(name, params, device) {
        if (this.processingToolResponse) {
            console.warn('Tool call already in progress');
            return { status: 'busy', message: 'Another tool call is in progress' };
        }

        const requestId = this.generateRequestId();
        params = { ...params, device };

        const toolSetup = this.chat.tools_setup?.[name] || {};
        const inProgressMessage = toolSetup.in_progress_message || 'Calling tool';
        const askForExecution = toolSetup.ask_for_execution || false;
        const toolIcon = toolSetup.icon || "fa-database";

        const payload = {
            name: name,
            params: params,
            chat: this.chat.guid,
            requestId: requestId
        };

        this.processingToolResponse = true;

        try {
            const result = await this.executeToolCall(payload, askForExecution);
            return result;
        } catch (error) {
            console.error('Tool call failed:', error);
            return { status: 'error', error, message: 'Tool call failed' };
        } finally {
            this.processingToolResponse = false;
            this.activeRequests.delete(requestId);
        }
    }

    async executeToolCall(payload, askForExecution) {
        return new Promise((resolve, reject) => {
            const request = {
                url: window.config.api_methods.call_tool,
                method: 'POST',
                data: payload,
                contentType: 'application/json',
                dataType: 'json',
                headers: {
                    'x-auth-token': window.config.token
                },
                success: (data) => {
                    resolve({
                        status: 'success',
                        data: data,
                        sourcesAdded: data?.data?.sources?.length > 0
                    });
                },
                error: (xhr, status, error) => {
                    reject({
                        status: 'error',
                        error: error,
                        statusCode: xhr.status,
                        message: 'Failed to call tool'
                    });
                }
            };

            // Si tienes acceso a $f7, usar $f7.request, sino usar fetch
            if (window.$f7) {
                this.activeRequests.set(payload.requestId, window.$f7.request(request));
            } else {
                // Fallback a fetch si no hay $f7 disponible
                this.executeWithFetch(payload, askForExecution).then(resolve).catch(reject);
            }
        });
    }

    async executeWithFetch(payload, askForExecution) {
        const response = await fetch(window.config.api_methods.call_tool, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': window.config.token
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            status: 'success',
            data: data,
            sourcesAdded: data?.data?.sources?.length > 0
        };
    }

    generateRequestId() {
        return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    cancelAllRequests() {
        this.activeRequests.forEach((request, id) => {
            if (request && typeof request.abort === 'function') {
                request.abort();
            }
        });
        this.activeRequests.clear();
        this.processingToolResponse = false;
    }

    getActiveRequestsCount() {
        return this.activeRequests.size;
    }
};

/**
 * Gestiona las menciones de asistentes (@mentions)
 */
SIMBA.AssistantMentionManager = class {
    constructor(assistants, switchAssistantCallback) {
        this.assistants = assistants || [];
        this.switchAssistantCallback = switchAssistantCallback;
        this.isSuggestionsVisible = false;
        this.currentMentionPosition = null;
        this.selectedSuggestionIndex = -1;
        this.filteredAssistants = [];
        this.suggestionsContainer = null;
        this.textarea = null;
    }

    updateAssistants(assistants) {
        this.assistants = assistants || [];
    }

    init() {
        this.textarea = document.getElementById('prompt');
        if (!this.textarea) {
            console.warn('Textarea with id "prompt" not found');
            return false;
        }

        this.createSuggestionsContainer();
        this.attachEventListeners();
        return true;
    }

    createSuggestionsContainer() {
        this.suggestionsContainer = document.getElementById('assistants-suggestions');

        if (!this.suggestionsContainer) {
            this.suggestionsContainer = document.createElement('div');
            this.suggestionsContainer.id = 'assistants-suggestions';
            this.suggestionsContainer.className = 'assistants-suggestions';
            this.suggestionsContainer.style.display = 'none';
            this.suggestionsContainer.innerHTML = `
                <div class="assistants-suggestions-title">Available Assistants</div>
                <div class="assistants-suggestions-list"></div>
            `;
            document.body.appendChild(this.suggestionsContainer);
        }
    }

    attachEventListeners() {
        this.textarea.addEventListener('input', this.handleTextareaInput.bind(this));
        this.textarea.addEventListener('keydown', this.handleTextareaKeydown.bind(this));

        document.addEventListener('click', (e) => {
            if (this.suggestionsContainer &&
                !this.suggestionsContainer.contains(e.target) &&
                e.target !== this.textarea) {
                this.hideSuggestions();
            }
        });
    }

    handleTextareaInput(e) {
        const textarea = e.target;
        const text = textarea.value;
        const caretPosition = textarea.selectionStart;
        const mentionPosition = this.findMentionPosition(text, caretPosition);

        if (mentionPosition !== null) {
            this.currentMentionPosition = mentionPosition;
            const query = text.substring(mentionPosition + 1, caretPosition).toLowerCase();
            this.filterAssistants(query);
            this.showSuggestions();
        } else {
            this.hideSuggestions();
        }
    }

    handleTextareaKeydown(e) {
        if (!this.isSuggestionsVisible) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.moveSelection(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.moveSelection(-1);
                break;
            case 'Enter':
                if (this.selectedSuggestionIndex >= 0 &&
                    this.selectedSuggestionIndex < this.filteredAssistants.length) {
                    e.preventDefault();
                    this.insertAssistantMention(this.filteredAssistants[this.selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                break;
        }
    }

    findMentionPosition(text, caretPosition) {
        for (let i = caretPosition - 1; i >= 0; i--) {
            if (text[i] === '@') {
                if (i === 0 || /\s/.test(text[i - 1])) {
                    return i;
                }
            } else if (/\s/.test(text[i])) {
                return null;
            }
        }
        return null;
    }

    filterAssistants(query) {
        this.filteredAssistants = this.assistants.filter(assistant =>
            assistant.name.toLowerCase().includes(query) ||
            (assistant.description && assistant.description.toLowerCase().includes(query))
        );
        this.selectedSuggestionIndex = this.filteredAssistants.length > 0 ? 0 : -1;
        this.renderSuggestionsList();
    }

    moveSelection(direction) {
        const newIndex = this.selectedSuggestionIndex + direction;
        if (newIndex >= 0 && newIndex < this.filteredAssistants.length) {
            this.selectedSuggestionIndex = newIndex;
            this.renderSuggestionsList();
        }
    }

    renderSuggestionsList() {
        const suggestionsList = this.suggestionsContainer?.querySelector('.assistants-suggestions-list');
        if (!suggestionsList) return;

        suggestionsList.innerHTML = '';

        if (this.filteredAssistants.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'assistant-suggestion-item';
            noResults.textContent = 'No assistants found';
            suggestionsList.appendChild(noResults);
            return;
        }

        this.filteredAssistants.forEach((assistant, index) => {
            const item = document.createElement('div');
            item.className = 'assistant-suggestion-item';
            item.title = assistant.description || '';

            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <div class="assistant-suggestion-avatar">
                    <img src="${assistant.avatar}" alt="${assistant.name}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTIwIDEwQzE2LjY4NjMgMTAgMTQgMTIuNjg2MyAxNCAxNkMxNCAxOS4zMTM3IDE2LjY4NjMgMjIgMjAgMjJDMjMuMzEzNyAyMiAyNiAxOS4zMTM3IDI2IDE2QzI2IDEyLjY4NjMgMjMuMzEzNyAxMCAyMCAxMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTEwIDI4QzEwIDIzLjU4MTcgMTMuNTgxNyAyMCAxOCAyMEgyMkMyNi40MTgzIDIwIDMwIDIzLjU4MTcgMzAgMjhWMzBIOTAwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'">
                </div>
                <div class="assistant-suggestion-info">
                    <div class="assistant-suggestion-name">${assistant.name}</div>
                    <div class="assistant-suggestion-description">${assistant.description || 'Assistant'}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                this.insertAssistantMention(assistant);
            });

            suggestionsList.appendChild(item);
        });
    }

    showSuggestions() {
        if (!this.textarea || !this.suggestionsContainer) return;

        const textareaRect = this.textarea.getBoundingClientRect();
        const lineHeight = parseInt(window.getComputedStyle(this.textarea).lineHeight) || 20;
        const isInFooter = this.isTextareaInFooter();

        if (isInFooter) {
            this.suggestionsContainer.style.bottom = `${window.innerHeight - textareaRect.top + 10}px`;
            this.suggestionsContainer.style.top = 'auto';
            this.suggestionsContainer.style.maxHeight = `${Math.min(300, textareaRect.top - 50)}px`;
        } else {
            this.suggestionsContainer.style.top = `${textareaRect.bottom + 10}px`;
            this.suggestionsContainer.style.bottom = 'auto';
            this.suggestionsContainer.style.maxHeight = '300px';
        }

        this.suggestionsContainer.style.left = `${Math.max(10, textareaRect.left)}px`;
        this.suggestionsContainer.style.right = '10px';
        this.suggestionsContainer.style.display = 'block';
        this.suggestionsContainer.style.zIndex = '10000';

        this.isSuggestionsVisible = true;
    }

    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.style.display = 'none';
        }
        this.isSuggestionsVisible = false;
        this.currentMentionPosition = null;
        this.selectedSuggestionIndex = -1;
    }

    isTextareaInFooter() {
        let parent = this.textarea;
        while (parent && parent !== document.body) {
            if (parent.classList.contains('messagebar') ||
                parent.classList.contains('toolbar') ||
                parent.classList.contains('messagebar-chat')) {
                return true;
            }
            parent = parent.parentElement;
        }

        const rect = this.textarea.getBoundingClientRect();
        return rect.top > window.innerHeight / 2;
    }

    insertAssistantMention(assistant) {
        if (!this.textarea || this.currentMentionPosition === null) return;

        // En lugar de insertar texto, llamar directamente al switchAssistant
        if (this.switchAssistantCallback) {
            this.switchAssistantCallback(assistant.guid);
        }

        // Limpiar el textarea
        this.textarea.value = '';

        // Disparar evento para actualizar el estado
        const inputEvent = new Event('input', { bubbles: true });
        this.textarea.dispatchEvent(inputEvent);

        this.hideSuggestions();

        setTimeout(() => {
            this.textarea.focus();
        }, 50);
    }

    destroy() {
        if (this.suggestionsContainer && this.suggestionsContainer.parentNode) {
            this.suggestionsContainer.parentNode.removeChild(this.suggestionsContainer);
        }
        this.textarea = null;
        this.suggestionsContainer = null;
    }
};

/**
 * Utilidades generales
 */
SIMBA.Utils = class {
    static preprocessMarkdown(text) {
        if (!text || !text.includes('<reference')) return text;

        return text.replace(/<reference\s+([^>]*)>([^<]+)<\/reference>/g, function (match, attributesStr, content) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = `<reference ${attributesStr}></reference>`;
            const tempElement = tempDiv.firstChild;

            const filename = tempElement.getAttribute('data-filename') || '';
            const page = tempElement.getAttribute('data-page') || '';
            const section = tempElement.getAttribute('data-section') || '';
            const guid = tempElement.getAttribute('data-guid') || '';
            const icon = tempElement.getAttribute('data-icon') || '';

            let spanHtml = '<span class="reference cursor-pointer badge badge-round bg-color-bluegray"';
            spanHtml += ` data-filename="${filename}" data-content="${content}" data-page="${page}" data-section="${section}"`;
            if (guid) spanHtml += ` data-guid="${guid}"`;
            spanHtml += `><i class="${icon} margin-right-half"></i>${filename}</span>`;

            return spanHtml;
        });
    }

    static generateUniqueId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    static copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        } else {
            return this.fallbackCopyToClipboard(text);
        }
    }

    static fallbackCopyToClipboard(text) {
        return new Promise((resolve, reject) => {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        });
    }

    static formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };

        return new Date(date).toLocaleString('en-US', { ...defaultOptions, ...options });
    }

    static sanitizeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }

    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
};

// Inicialización automática si está en el navegador
if (typeof window !== 'undefined') {
    console.log('SIMBA.js loaded successfully');

    // Event para cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('SIMBA.js ready');
        });
    } else {
        console.log('SIMBA.js ready');
    }
}

// Export para Node.js si está disponible
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SIMBA;
}