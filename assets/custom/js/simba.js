/**
 * SIMBA.js - Clases utilitarias para la aplicación de chat
 * Versión: 1.0.0
 */

window.SIMBA = window.SIMBA || {};

SIMBA.ConfigManager = class {
    constructor() {
        this.config = {
            // API Configuration
            completionsApiUrl: window.config?.completion?.url || '',
            completionsApiKey: window.config?.completion?.apiKey || '',
            assistantApiUrl: window.config?.api_url || '',
            assistantAuthToken: window.config?.token || '',

            // Model Configuration
            model: 'magistral-2509',
            summaryModel: 'mistral-small-24B-instruct-2506',
            visionModel: 'mistral-small-24B-instruct-2506-vision', // ✅ NUEVO
            temperature: 0,
            toolTemperature: 0.1,
            maxTokens: 25000,
            tokenLimit: 45000,

            // Voice Configuration
            voiceEnabled: true,
            voiceLanguage: 'en-US',
            maxRecordingTime: 30,
            voiceAutoSend: false,
            voiceShowButton: false,
            voiceContinuous: false,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,

            // Other
            documentContextLocation: 'user',
            reasoningEnabled:false
        };

        this.loadFromStorage();
    }

    loadFromStorage() {
        console.log('📂 Loading config from localStorage...');

        const configKeys = [
            'completionsApiUrl',
            'completionsApiKey',
            'assistantApiUrl',
            'assistantAuthToken',
            'model',
            'summaryModel',
            'visionModel', // ✅ NUEVO
            'temperature',
            'toolTemperature',
            'maxTokens',
            'tokenLimit',
            'voiceEnabled',
            'voiceLanguage',
            'maxRecordingTime',
            'voiceAutoSend',
            'voiceShowButton',
            'voiceContinuous',
            'echoCancellation',
            'noiseSuppression',
            'autoGainControl',
            'documentContextLocation'
        ];

        configKeys.forEach(key => {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                if (typeof this.config[key] === 'number') {
                    this.config[key] = parseFloat(stored);
                } else if (typeof this.config[key] === 'boolean') {
                    this.config[key] = stored === 'true';
                } else {
                    this.config[key] = stored;
                }
            }
        });

        console.log('✅ Config loaded:', this.config);
        this.updateGlobalConfig();
    }

    updateConfig(newConfig) {
        console.log('💾 Updating config:', newConfig);
        Object.assign(this.config, newConfig);
        this.saveToStorage();
        this.updateGlobalConfig();
        console.log('✅ Config updated and saved');
    }

    saveToStorage() {
        console.log('💾 Saving config to localStorage...');
        Object.keys(this.config).forEach(key => {
            const value = this.config[key];
            localStorage.setItem(key, String(value));
        });
        console.log('✅ Config saved to localStorage');
    }

    updateGlobalConfig() {
        if (!window.config) {
            window.config = { completion: {} };
        }

        window.config.api_url = this.config.assistantApiUrl;
        window.config.token = this.config.assistantAuthToken;
        window.config.completion = window.config.completion || {};
        window.config.completion.url = this.config.completionsApiUrl;
        window.config.completion.apiKey = this.config.completionsApiKey;
        window.config.completion.vision = this.config.visionModel; // ✅ NUEVO

        console.log('✅ Global config updated:', window.config);
    }

    getConfig() {
        return {...this.config};
    }

    isValid() {
        const required = [
            'assistantApiUrl',
            'assistantAuthToken',
            'completionsApiUrl',
            'completionsApiKey',
            'model'
        ];

        return required.every(key =>
            this.config[key] && String(this.config[key]).trim().length > 0
        );
    }

    resetToDefaults() {
        console.log('🔄 Resetting config to defaults...');
        Object.keys(this.config).forEach(key => {
            localStorage.removeItem(key);
        });

        this.config = {
            completionsApiUrl: window.config?.completion?.url || '',
            completionsApiKey: window.config?.completion?.apiKey || '',
            assistantApiUrl: window.config?.api_url || '',
            assistantAuthToken: window.config?.token || '',
            model: 'magistral-2509',
            summaryModel: 'mistral-small-24B-instruct-2506',
            visionModel: 'mistral-small-24B-instruct-2506-vision', // ✅ NUEVO
            temperature: 0,
            toolTemperature: 0.1,
            maxTokens: 25000,
            tokenLimit: 45000,
            voiceEnabled: true,
            voiceLanguage: 'en-US',
            maxRecordingTime: 30,
            voiceAutoSend: false,
            voiceShowButton: false,
            voiceContinuous: false,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            documentContextLocation: 'user'
        };

        console.log('✅ Config reset to defaults');
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
        this.TOKEN_LIMIT = 20000;
        this.MAX_TOKENS = 5000;
        this.backupHistory = null;
        this.SUMMARY_MODEL = "mistral-small-24B-instruct-2501";
        this.optimizationConfig = {
            strategy: 'percentage',
            maxPercentage: 40,
            keepRecentCount: 6
        };
    }


    removeSecondToLastAssistant(messages) {
        // 🔍 PRIMERO: Verificar si hay duplicados antes de procesar
        let hasDuplicates = false;
        for (let i = 0; i < messages.length - 1; i++) {
            if (messages[i].role === 'assistant' && messages[i + 1].role === 'assistant') {
                hasDuplicates = true;
                break; // Salir tan pronto como encontremos el primer duplicado
            }
        }

        // Si no hay duplicados, devolver el array original sin procesarlo
        if (!hasDuplicates) {
            return messages;
        }

        // 🧹 SOLO SI HAY DUPLICADOS: Procesarlos
        console.log('🔍 Duplicate assistant messages detected, cleaning...');

        var result = [];
        var removedCount = 0;

        for (var i = 0; i < messages.length; i++) {
            var current = messages[i];
            var next = messages[i + 1];

            // Si es assistant y el siguiente también es assistant
            if (current.role === 'assistant' && next && next.role === 'assistant') {
                console.log('🗑️ Removing duplicate assistant message:', current.content.substring(0, 50) + '...');
                removedCount++;
                continue; // Saltar este mensaje
            }

            result.push(current);
        }

        console.log(`✅ Cleaned ${removedCount} duplicate assistant messages`);
        return result;
    }

    addMessage(role, content, toolCalls = null, messageId = null) {
        const message = {
            role,
            content,
            id: messageId // NUEVO: Agregar el ID del mensaje
        };
        if (toolCalls) message.tool_calls = toolCalls;
        this.messagesHistory.push(message);
        return message;
    }

    updateSystemMessage(content) {
        this.messagesHistory[0].content = content;
    }

    getHistory() {
        return this.messagesHistory.map(msg => {
            const cleanMsg = {role: msg.role, content: msg.content};
            if (msg.tool_calls) cleanMsg.tool_calls = msg.tool_calls;
            return cleanMsg;
        });
    }

    getFullHistory() {
        return [...this.messagesHistory];
    }

// Restaurar desde backup
    restoreFromBackup() {
        if (this.backupHistory) {
            this.messagesHistory = JSON.parse(JSON.stringify(this.backupHistory));
            console.log('🔄 History restored from backup');
            return true;
        }
        console.warn('⚠️ No backup available to restore');
        return false;
    }

// Verificar si hay backup disponible
    hasBackup() {
        return this.backupHistory !== null;
    }

// Limpiar backup
    clearBackup() {
        this.backupHistory = null;
        console.log('🗑️ Backup cleared');
    }

// Obtener información del backup
    getBackupInfo() {
        if (!this.backupHistory) return null;

        return {
            messageCount: this.backupHistory.length,
            tokens: this.backupHistory.reduce((total, msg) => total + this.estimateTokens(msg), 0),
            timestamp: new Date().toISOString()
        };
    }

    clearHistory() {
        this.messagesHistory = [{
            role: "system",
            content: this.messagesHistory[0]?.content || ""
        }];
        this.clearBackup(); // Limpiar backup también
    }

    estimateTokens(message) {
        if (!message || !message.content) return 0;

        try {
            // Usar mistralTokenizer.encode si está disponible
            if (typeof mistralTokenizer !== 'undefined' && mistralTokenizer.encode) {
                const tokens = mistralTokenizer.encode(message.content);

                return Array.isArray(tokens) ? tokens.length : tokens;
            }
        } catch (error) {
            console.warn('Error using mistralTokenizer.encode, falling back to estimation:', error);
        }

        // Fallback al método anterior si mistralTokenizer no está disponible
        return Math.ceil(message.content.length / 4);
    }

    getTotalTokens() {
        return this.messagesHistory.reduce((total, msg) => total + this.estimateTokens(msg), 0);
    }

    cleanSimbaDocuments(messageContent) {
        if (!messageContent) return messageContent;
        return messageContent.replace(/<simba_document[^>]*>[\s\S]*?<\/simba_document>/g, '');
    }

    cleanAllSimbaDocumentsFromSystem() {
        console.log('🧹 Cleaning ALL simba_document from system prompt...');

        if (this.messagesHistory.length > 0 && this.messagesHistory[0].role === 'system') {
            const systemMessage = this.messagesHistory[0];
            const originalLength = systemMessage.content.length;
            const originalTokens = this.estimateTokens(systemMessage);

            // Limpiar TODOS los simba_document del system prompt
            systemMessage.content = systemMessage.content.replace(/<simba_document[^>]*>[\s\S]*?<\/simba_document>/g, '');

            // Limpiar líneas vacías múltiples que quedan
            systemMessage.content = systemMessage.content.replace(/\n\s*\n\s*\n/g, '\n\n');

            const newLength = systemMessage.content.length;
            const newTokens = this.estimateTokens(systemMessage);
            const removedChars = originalLength - newLength;
            const savedTokens = originalTokens - newTokens;

            console.log(`✅ Cleaned system prompt: ${removedChars} chars, ~${savedTokens} tokens saved`);
            console.log(`📊 System: ${originalTokens} → ${newTokens} tokens`);

            return {
                removedChars,
                savedTokens,
                originalTokens,
                newTokens
            };
        }

        console.log('⚠️ No system message found to clean');
        return {removedChars: 0, savedTokens: 0, originalTokens: 0, newTokens: 0};
    }

    needsSimbaDocumentCleaning() {
        const totalTokens = this.getTotalTokens();
        const systemTokens = this.messagesHistory.length > 0 ?
            this.estimateTokens(this.messagesHistory[0]) : 0;

        // Contar simba_document en el system prompt
        const systemContent = this.messagesHistory[0]?.content || '';
        const simbaDocumentCount = (systemContent.match(/<simba_document[^>]*>/g) || []).length;

        console.log('🔍 Token analysis:', {
            totalTokens,
            systemTokens,
            simbaDocumentCount,
            tokenLimit: this.TOKEN_LIMIT,
            needsCleaning: totalTokens >= this.TOKEN_LIMIT && simbaDocumentCount > 0
        });

        // Necesita limpieza si:
        // 1. Está cerca del límite de tokens
        // 2. Hay simba_document en el system prompt
        return totalTokens >= this.TOKEN_LIMIT && simbaDocumentCount > 0;
    }

    needsOptimization() {
        // 🧹 Limpiar duplicados (solo procesa si los hay)
        this.messagesHistory = this.removeSecondToLastAssistant(this.messagesHistory);
        if (this.needsSimbaDocumentCleaning()) {
            console.log('🧹 Attempting simba_document cleaning before optimization...');
            const result = this.cleanAllSimbaDocumentsFromSystem();

            if (result.savedTokens > 0) {
                console.log(`✅ Simba cleaning saved ${result.savedTokens} tokens`);

                // Verificar si después de la limpieza ya no necesitamos optimización
                const newTotalTokens = this.getTotalTokens();
                if (newTotalTokens < this.TOKEN_LIMIT) {
                    console.log(`🎉 After simba cleaning: ${newTotalTokens} < ${this.TOKEN_LIMIT} - No optimization needed!`);
                    return false;
                } else {
                    console.log(`⚠️ After simba cleaning: ${newTotalTokens} >= ${this.TOKEN_LIMIT} - Still needs optimization`);
                }
            }
        }
        // 📊 Verificar tokens
        let totalTokens = this.getTotalTokens();
        console.log(this.messagesHistory, totalTokens, this.TOKEN_LIMIT);

        return totalTokens >= this.TOKEN_LIMIT;
    }

    async optimizeIfNeeded($f7, config, customPercentage = null, optimizeSystemPrompt = true, systemTokensTarget = 2000) {
        if (!this.needsOptimization()) return {optimized: false};

        try {
            const percentage = customPercentage !== null ? customPercentage : this.optimizationConfig.maxPercentage;
            console.log(`🔄 Starting conversation optimization (${percentage}%)...`);

            const result = await this.optimizeConversation($f7, config, customPercentage, optimizeSystemPrompt, systemTokensTarget);

            if (result.optimized) {
                if (result.onlySystemOptimized) {
                    console.log(`🎉 System-only optimization: Saved ${result.tokenReduction} tokens! (${result.systemOptimization.blocksRemoved} blocks removed)`);
                } else {
                    console.log(`🎉 Full optimization: Saved ${result.tokenReduction} tokens! (${result.messagesOptimized}/${result.messagesBefore} messages optimized, ${result.messagesKept} kept recent)`);
                    if (result.systemOptimization?.optimized) {
                        console.log(`   + System prompt: ${result.systemOptimization.blocksRemoved} blocks removed`);
                    }
                }
            }

            return result;
        } catch (error) {
            console.error("Optimization failed:", error);
            return {optimized: false, error: error.message || error};
        }
    }

    setOptimizationStrategy(strategy) {
        if (!['percentage', 'smart'].includes(strategy)) {
            console.warn('Strategy must be "percentage" or "smart"');
            return false;
        }
        this.optimizationConfig.strategy = strategy;
        console.log(`🧠 Optimization strategy set to ${strategy}`);
        return true;
    }

    // Función para contar tokens usando mistralTokenizer
    countTokens(text) {
        try {
            return mistralTokenizer.encode(text).length;
        } catch (error) {
            console.warn('Error counting tokens with mistralTokenizer, using fallback:', error);
            // Fallback en caso de error
            return Math.ceil(text.length / 4);
        }
    }

    // Nueva función para optimizar el prompt del sistema
    optimizeSystemPrompt(targetTokensToRemove) {
        try {
            const systemMessage = this.messagesHistory[0];
            const originalContent = systemMessage.content;

            console.log('🔧 Starting system prompt optimization');

            // Buscar el bloque sensitive para preservarlo
            const sensitiveRegex = /<sensitive>([\s\S]*?)<\/sensitive>/g;
            const sensitiveMatches = [...originalContent.matchAll(sensitiveRegex)];

            // Buscar todos los bloques simba_document
            const simbaRegex = /<simba_document>([\s\S]*?)<\/simba_document>/g;
            const simbaMatches = [...originalContent.matchAll(simbaRegex)];

            if (simbaMatches.length === 0) {
                return {
                    tokensRemoved: 0,
                    blocksRemoved: 0,
                    optimized: false,
                    error: 'No simba_document blocks found'
                };
            }

            // Filtrar bloques que NO estén dentro de sensitive
            const blocksOutsideSensitive = [];

            for (const simbaMatch of simbaMatches) {
                const simbaStart = simbaMatch.index;
                const simbaEnd = simbaMatch.index + simbaMatch[0].length;

                let isInsideSensitive = false;

                // Verificar si este bloque está dentro de algún bloque sensitive
                for (const sensitiveMatch of sensitiveMatches) {
                    const sensitiveStart = sensitiveMatch.index;
                    const sensitiveEnd = sensitiveMatch.index + sensitiveMatch[0].length;

                    // Un bloque está dentro de sensitive si COMPLETO está contenido
                    if (simbaStart >= sensitiveStart && simbaEnd <= sensitiveEnd) {
                        isInsideSensitive = true;
                        console.log(`🔒 Preserving simba_document block inside sensitive area at position ${simbaStart}-${simbaEnd}`);
                        break;
                    }
                }

                if (!isInsideSensitive) {
                    console.log(`✂️ Found removable simba_document block at position ${simbaStart}-${simbaEnd}`);
                    blocksOutsideSensitive.push({
                        match: simbaMatch,
                        content: simbaMatch[0],
                        tokens: this.countTokens(simbaMatch[0]),
                        position: `${simbaStart}-${simbaEnd}`
                    });
                }
            }

            if (blocksOutsideSensitive.length === 0) {
                return {
                    tokensRemoved: 0,
                    blocksRemoved: 0,
                    optimized: false,
                    error: 'No simba_document blocks found outside sensitive area'
                };
            }

            console.log(`📋 Found ${blocksOutsideSensitive.length} simba_document blocks outside sensitive area`);

            // Eliminar bloques secuencialmente hasta alcanzar el objetivo
            let tokensRemoved = 0;
            let blocksRemoved = 0;
            let optimizedContent = originalContent;

            for (const block of blocksOutsideSensitive) {
                if (tokensRemoved >= targetTokensToRemove) {
                    break;
                }

                // Eliminar este bloque
                optimizedContent = optimizedContent.replace(block.content, '');
                tokensRemoved += block.tokens;
                blocksRemoved++;

                console.log(`🗑️ Removed block ${blocksRemoved}, tokens saved: ${block.tokens}`);
            }

            // Limpiar líneas vacías múltiples que puedan quedar
            optimizedContent = optimizedContent.replace(/\n\s*\n\s*\n/g, '\n\n');

            // Actualizar el mensaje del sistema
            this.messagesHistory[0].content = optimizedContent;

            console.log(`✅ System prompt optimized: ${blocksRemoved} blocks removed, ${tokensRemoved} tokens saved`);

            return {
                tokensRemoved: tokensRemoved,
                blocksRemoved: blocksRemoved,
                optimized: true,
                totalBlocksFound: blocksOutsideSensitive.length
            };

        } catch (error) {
            console.error('System prompt optimization failed:', error);
            return {
                tokensRemoved: 0,
                blocksRemoved: 0,
                optimized: false,
                error: error.message
            };
        }
    }

    // Función modificada optimizeConversation con optimización del sistema
    async optimizeConversation($f7, config, customPercentage = null, optimizeSystemPrompt = false, systemTokensTarget = 1000) {
        try {
            // Crear backup del historial antes de optimizar
            this.backupHistory = JSON.parse(JSON.stringify(this.messagesHistory));
            console.log('📋 Backup created before optimization');

            let systemOptimizationResult = null;
            const tokensBefore = this.getTotalTokens();

            // Optimizar prompt del sistema si se solicita
            if (optimizeSystemPrompt) {
                systemOptimizationResult = this.optimizeSystemPrompt(systemTokensTarget);
                console.log('🔧 System prompt optimization result:', systemOptimizationResult);

                // Verificar si después de optimizar el sistema ya no necesitamos optimizar mensajes
                if (systemOptimizationResult.optimized && !this.needsOptimization()) {
                    console.log('✅ System optimization was enough, no message optimization needed');
                    const tokensAfter = this.getTotalTokens();
                    return {
                        optimized: true,
                        tokenReduction: tokensBefore - tokensAfter,
                        messagesBefore: this.messagesHistory.slice(1).length,
                        messagesOptimized: 0,
                        messagesKept: this.messagesHistory.slice(1).length,
                        messagesAfter: this.messagesHistory.slice(1).length,
                        tokensAfter: tokensAfter,
                        backupAvailable: true,
                        percentageUsed: 0,
                        systemOptimization: systemOptimizationResult,
                        onlySystemOptimized: true
                    };
                }
            }

            // Obtener mensajes sin el sistema
            const allMessagesToOptimize = this.messagesHistory.slice(1);

            if (allMessagesToOptimize.length === 0) {
                return {
                    optimized: systemOptimizationResult?.optimized || false,
                    error: 'No messages to optimize',
                    systemOptimization: systemOptimizationResult
                };
            }

            // Calcular cuántos mensajes optimizar según la estrategia
            let messagesToOptimizeCount;
            let percentage;

            if (customPercentage !== null) {
                // Si se especifica porcentaje personalizado, usar estrategia clásica
                percentage = customPercentage;
                messagesToOptimizeCount = Math.floor(allMessagesToOptimize.length * (percentage / 100));
            } else if (this.optimizationConfig.strategy === 'smart') {
                // Estrategia inteligente
                const recentToKeep = this.optimizationConfig.keepRecentCount;
                const maxToOptimize = Math.floor(allMessagesToOptimize.length * (this.optimizationConfig.maxPercentage / 100));
                messagesToOptimizeCount = Math.max(0, Math.min(maxToOptimize, allMessagesToOptimize.length - recentToKeep));
                percentage = Math.round((messagesToOptimizeCount / allMessagesToOptimize.length) * 100);
            } else {
                // Estrategia por porcentaje (compatible hacia atrás)
                percentage = this.optimizationConfig.maxPercentage;
                messagesToOptimizeCount = Math.floor(allMessagesToOptimize.length * (percentage / 100));
            }

            if (messagesToOptimizeCount === 0) {
                return {
                    optimized: systemOptimizationResult?.optimized || false,
                    error: 'No messages to optimize based on strategy',
                    systemOptimization: systemOptimizationResult
                };
            }

            // Tomar mensajes para optimizar y los que se mantienen
            const messagesToOptimize = allMessagesToOptimize.slice(0, messagesToOptimizeCount);
            const messagesToKeep = allMessagesToOptimize.slice(messagesToOptimizeCount);

            console.log(`🔄 Optimizing ${messagesToOptimizeCount} of ${allMessagesToOptimize.length} messages (${percentage}%)`);

            // Preparar el prompt para la optimización
            const optimizationPrompt = this.buildOptimizationPrompt(messagesToOptimize);

            // Llamar al endpoint de completion
            const payload = {
                model: this.SUMMARY_MODEL,
                messages: [
                    {
                        role: "system",
                        content: "You are a conversation summarizer. Analyze the conversation and return a JSON array with optimized messages. IMPORTANT: Preserve key information, technical details, errors, configurations, and important context. Summarize verbose parts but keep critical information intact. Return only valid JSON with 'role' (user/assistant) and 'content' fields."
                    },
                    {
                        role: "user",
                        content: optimizationPrompt
                    }
                ],
                max_tokens: this.MAX_TOKENS,
                temperature: 0.1
            };

            // Hacer la llamada en background
            const optimizedMessages = await this.callOptimizationEndpoint(payload, config);

            // Reconstruir el historial: sistema + mensajes optimizados + mensajes conservados
            // Nota: this.messagesHistory[0] ya contiene el sistema optimizado si se ejecutó optimizeSystemPrompt
            this.messagesHistory = [
                this.messagesHistory[0], // Mensaje de sistema (optimizado o original según parámetros)
                ...optimizedMessages,    // Mensajes optimizados
                ...messagesToKeep        // Mensajes recientes sin optimizar
            ];

            // Calcular tokens después de la optimización
            const tokensAfter = this.getTotalTokens();
            const tokenReduction = tokensBefore - tokensAfter;

            return {
                optimized: true,
                tokenReduction: tokenReduction,
                messagesBefore: allMessagesToOptimize.length,
                messagesOptimized: messagesToOptimizeCount,
                messagesKept: messagesToKeep.length,
                messagesAfter: optimizedMessages.length + messagesToKeep.length,
                tokensAfter: tokensAfter,
                backupAvailable: true,
                percentageUsed: percentage,
                systemOptimization: systemOptimizationResult
            };

        } catch (error) {
            // Si falla, restaurar desde backup si existe
            if (this.backupHistory) {
                this.messagesHistory = this.backupHistory;
                console.log('🔄 Restored from backup due to optimization failure');
            }
            console.error('Optimization failed:', error);
            return {
                optimized: false,
                error: error.message,
                systemOptimization: null
            };
        }
    }

    buildOptimizationPrompt(messages) {
        const conversationText = messages.map((msg, index) => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            return `${role}: ${msg.content}`;
        }).join('\n\n');

        return `Please summarize the following conversation while preserving the user-assistant flow. Return a JSON array with summarized messages:

${conversationText}

Return only the JSON array in this format:
[
  {"role": "user", "content": "summarized user message"},
  {"role": "assistant", "content": "summarized assistant response"},
  ...
]`;
    }

    async callOptimizationEndpoint(payload, config) {
        const endpoint = config.completionsApiUrl || window.config?.completion?.url;
        const apiKey = config.completionsApiKey || window.config?.completion?.apiKey;

        if (!endpoint || !apiKey) {
            throw new Error('Missing completion API configuration');
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Optimization API call failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Extraer el contenido de la respuesta
        const content = data.choices?.[0]?.message?.content || data.content || '';

        if (!content) {
            throw new Error('No content received from optimization API');
        }

        // Parsear el JSON de mensajes optimizados
        try {
            // Limpiar el contenido para extraer solo el JSON
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No valid JSON array found in response');
            }

            const optimizedMessages = JSON.parse(jsonMatch[0]);

            if (!Array.isArray(optimizedMessages)) {
                throw new Error('Response is not a valid array');
            }

            // Validar que cada mensaje tenga role y content
            const validMessages = optimizedMessages.filter(msg =>
                msg.role && msg.content && (msg.role === 'user' || msg.role === 'assistant')
            );

            if (validMessages.length === 0) {
                throw new Error('No valid messages in optimization response');
            }

            return validMessages;

        } catch (parseError) {
            console.error('Error parsing optimization response:', parseError);
            throw new Error(`Failed to parse optimization response: ${parseError.message}`);
        }
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

        // Guardar datos específicos del mensaje
        localStorage.setItem(this.storagePrefix + messageId, JSON.stringify(sourceArray));

        // Guardar fuentes en clave común "sources"
        if (sources && sources.length > 0) {
            // Obtener fuentes existentes del localStorage
            const existingSources = JSON.parse(localStorage.getItem('sources') || '{}');

            // Procesar cada fuente y agregarla al objeto común
            sources.forEach(source => {
                if (source.guid) {//} && source.extra && source.extra.page && source.extra.section) {
                    const key = `${source.guid}`;//_${source.extra.page}_${source.extra.section}`;
                    existingSources[key] = source;
                }
            });

            // Guardar el objeto actualizado
            localStorage.setItem('sources', JSON.stringify(existingSources));
        }
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
        return {...this.highlights};
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
            this.highlights = {...data.highlights};
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
            return {status: 'busy', message: 'Another tool call is in progress'};
        }

        const requestId = this.generateRequestId();
        params = {...params, device};

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
            return {status: 'error', error, message: 'Tool call failed'};
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
        const inputEvent = new Event('input', {bubbles: true});
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
 * SIMBA Voice Manager
 * Manages speech-to-text functionality with extensible architecture
 */


// Abstract base class for speech-to-text engines
class SpeechToTextEngine {
    constructor(config = {}) {
        this.config = config;
        this.isInitialized = false;
    }

    async initialize() {
        throw new Error('initialize() must be implemented by subclass');
    }

    async transcribe(audioBlob) {
        throw new Error('transcribe() must be implemented by subclass');
    }

    async cleanup() {
        throw new Error('cleanup() must be implemented by subclass');
    }

    isSupported() {
        throw new Error('isSupported() must be implemented by subclass');
    }
}

// Web Speech API Implementation
class WebSpeechEngine extends SpeechToTextEngine {
    constructor(config = {}) {
        super({
            language: 'en-US',
            continuous: false,
            interimResults: true,
            maxAlternatives: 1,
            ...config
        });
        this.recognition = null;
        this.isListening = false;
        this.currentResolve = null;
        this.currentReject = null;
        this.finalTranscript = '';
        this.interimTranscript = '';
    }

    async initialize() {
        if (this.isInitialized) return;

        if (!this.isSupported()) {
            throw new Error('Web Speech API not supported in this browser');
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        // Configure recognition
        this.recognition.lang = this.config.language;
        this.recognition.continuous = this.config.continuous;
        this.recognition.interimResults = this.config.interimResults;
        this.recognition.maxAlternatives = this.config.maxAlternatives;

        // Set up event handlers
        this.setupEventHandlers();

        this.isInitialized = true;
        console.log('✅ Web Speech API initialized');
    }

    setupEventHandlers() {
        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            this.finalTranscript = '';
            this.interimTranscript = '';
        };

        this.recognition.onresult = (event) => {
            this.interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    this.finalTranscript += transcript;
                } else {
                    this.interimTranscript += transcript;
                }
            }

            console.log('🎤 Interim:', this.interimTranscript);
            console.log('🎤 Final so far:', this.finalTranscript);
        };

        this.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            this.isListening = false;

            if (this.currentResolve) {
                const result = {
                    text: this.finalTranscript.trim(),
                    confidence: 0.8, // Web Speech API doesn't always provide confidence
                    language: this.config.language,
                    interim: this.interimTranscript.trim()
                };

                this.currentResolve(result);
                this.currentResolve = null;
                this.currentReject = null;
            }
        };

        this.recognition.onerror = (event) => {
            console.error('🎤 Speech recognition error:', event.error);
            this.isListening = false;

            let errorMessage = 'Speech recognition failed';

            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected';
                    break;
                case 'audio-capture':
                    errorMessage = 'Audio capture failed';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied';
                    break;
                case 'network':
                    errorMessage = 'Network error during speech recognition';
                    break;
                case 'service-not-allowed':
                    errorMessage = 'Speech recognition service not allowed';
                    break;
                default:
                    errorMessage = `Speech recognition error: ${event.error}`;
            }

            if (this.currentReject) {
                this.currentReject(new Error(errorMessage));
                this.currentResolve = null;
                this.currentReject = null;
            }
        };

        this.recognition.onnomatch = () => {
            console.warn('🎤 No speech match found');
            if (this.currentResolve) {
                this.currentResolve({
                    text: '',
                    confidence: 0,
                    language: this.config.language
                });
                this.currentResolve = null;
                this.currentReject = null;
            }
        };
    }

    async startListening() {
        if (!this.isInitialized) {
            throw new Error('Web Speech API not initialized');
        }

        if (this.isListening) {
            throw new Error('Already listening');
        }

        return new Promise((resolve, reject) => {
            this.currentResolve = resolve;
            this.currentReject = reject;

            try {
                this.recognition.start();
            } catch (error) {
                this.currentResolve = null;
                this.currentReject = null;
                reject(error);
            }
        });
    }

    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    async transcribe(audioBlob) {
        // Web Speech API works with live audio, not with blobs
        // This method starts listening instead
        console.log('🎤 Starting live speech recognition...');
        return await this.startListening();
    }

    async cleanup() {
        if (this.recognition) {
            if (this.isListening) {
                this.recognition.stop();
            }
            this.recognition = null;
        }
        this.isListening = false;
        this.currentResolve = null;
        this.currentReject = null;
        this.isInitialized = false;
    }

    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    getState() {
        return {
            isListening: this.isListening,
            isInitialized: this.isInitialized,
            language: this.config.language
        };
    }
}

// Main Voice Manager class
class VoiceManager {
    constructor(config = {}) {
        this.config = {
            engine: 'webspeech', // 'webspeech' is now the default
            maxRecordingTime: 30000, // 30 seconds for Web Speech API
            language: 'en-US', // Can be changed: 'es-ES', 'fr-FR', etc.
            ...config
        };

        // For Web Speech API, we don't use MediaRecorder
        this.engine = null;
        this.isListening = false;
        this.isProcessing = false;
        this.recordingTimeout = null;

        // Events
        this.onRecordingStart = config.onRecordingStart || (() => {
        });
        this.onRecordingStop = config.onRecordingStop || (() => {
        });
        this.onProcessingStart = config.onProcessingStart || (() => {
        });
        this.onProcessingEnd = config.onProcessingEnd || (() => {
        });
        this.onTranscriptionComplete = config.onTranscriptionComplete || (() => {
        });
        this.onError = config.onError || (() => {
        });
    }

    async initialize() {
        try {
            console.log(`🎤 Initializing VoiceManager with Web Speech API`);

            this.engine = new WebSpeechEngine({
                language: this.config.language,
                continuous: false,
                interimResults: true,
                maxAlternatives: 1
            });

            if (!this.engine.isSupported()) {
                throw new Error('Web Speech API is not supported in this browser');
            }

            await this.engine.initialize();
            console.log('✅ VoiceManager initialized successfully');
        } catch (error) {
            console.error('❌ VoiceManager initialization failed:', error);
            throw error;
        }
    }

    createEngine(engineType) {
        switch (engineType) {
            case 'webspeech':
                return new WebSpeechEngine({
                    language: this.config.language,
                    continuous: false,
                    interimResults: true
                });
            default:
                throw new Error(`Unknown engine type: ${engineType}`);
        }
    }

    async startRecording() {
        if (this.isListening || this.isProcessing) {
            console.warn('⚠️ Already listening or processing');
            return;
        }

        try {
            console.log('🎤 Starting speech recognition...');

            this.isListening = true;
            this.onRecordingStart();

            // Set maximum listening time
            this.recordingTimeout = setTimeout(() => {
                this.stopRecording();
            }, this.config.maxRecordingTime);

            // Start listening with Web Speech API
            this.isProcessing = true;
            this.onProcessingStart();

            const result = await this.engine.transcribe();

            // Clear timeout since we got a result
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }

            this.isListening = false;
            this.isProcessing = false;

            this.onRecordingStop();
            this.onProcessingEnd();

            console.log('✅ Speech recognition completed:', result);
            this.onTranscriptionComplete(result);

        } catch (error) {
            console.error('❌ Error in speech recognition:', error);
            this.isListening = false;
            this.isProcessing = false;

            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }

            this.onRecordingStop();
            this.onProcessingEnd();
            this.onError(error);
        }
    }

    async stopRecording() {
        if (!this.isListening) {
            console.warn('⚠️ Not currently listening');
            return;
        }

        console.log('🎤 Stopping speech recognition...');

        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }

        this.isListening = false;

        if (this.engine && this.engine.stopListening) {
            this.engine.stopListening();
        }
    }

    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }

    getState() {
        return {
            isListening: this.isListening,
            isProcessing: this.isProcessing,
            isSupported: this.isSupported(),
            engine: this.config.engine,
            language: this.config.language
        };
    }

    async switchLanguage(language) {
        console.log(`🎤 Switching language to: ${language}`);

        this.config.language = language;

        if (this.engine) {
            this.engine.config.language = language;
            if (this.engine.recognition) {
                this.engine.recognition.lang = language;
            }
        }

        console.log('✅ Language switched successfully');
    }

    getAvailableLanguages() {
        // Common languages supported by Web Speech API
        return [
            {code: 'en-US', name: 'English (US)'},
            {code: 'en-GB', name: 'English (UK)'},
            {code: 'es-ES', name: 'Español (España)'},
            {code: 'es-MX', name: 'Español (México)'},
            {code: 'fr-FR', name: 'Français'},
            {code: 'de-DE', name: 'Deutsch'},
            {code: 'it-IT', name: 'Italiano'},
            {code: 'pt-BR', name: 'Português (Brasil)'},
            {code: 'ru-RU', name: 'Русский'},
            {code: 'ja-JP', name: '日本語'},
            {code: 'ko-KR', name: '한국어'},
            {code: 'zh-CN', name: '中文 (简体)'}
        ];
    }

    async destroy() {
        console.log('🎤 Destroying VoiceManager...');

        if (this.isListening) {
            await this.stopRecording();
        }

        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
        }

        if (this.engine) {
            await this.engine.cleanup();
        }

        this.engine = null;

        console.log('✅ VoiceManager destroyed');
    }
}

// Export for use in other files
window.SIMBA = window.SIMBA || {};
window.SIMBA.VoiceManager = VoiceManager;

/**
 * Gestiona el almacenamiento y recuperación de conversaciones
 */
SIMBA.ConversationManager = class {
    constructor(storageProvider = null, config = {}) {
        this.storage = storageProvider || new SIMBA.LocalStorageProvider();
        this.currentConversationId = null;
        this.autoSaveEnabled = config.autoSave !== false;
        this.autoSaveInterval = config.autoSaveInterval || 30000;
        this.autoSaveTimer = null;
        this.lastSaveTime = 0;
        this.pendingChanges = false;
        if (this.autoSaveEnabled) {
            this.startAutoSave();
        }
    }

    async updateConversationTitle(id, newTitle) {
        const conversation = await this.storage.loadConversation(id);
        if (conversation) {
            conversation.title = newTitle;
            conversation.updatedAt = Date.now();
            await this.storage.saveConversation(conversation);
            return true;
        }
        return false;
    }

    async createConversation(assistant, title = null, device = null) {
        const conversation = {
            id: this.generateId(),
            title: title || `Chat with ${assistant.name}`,
            assistant: {
                guid: assistant.guid,
                name: assistant.name,
                avatar: assistant.avatar,
                mainImage: assistant.mainImage,
                greeting: assistant.greeting,
                placeholder: assistant.placeholder,
                system: assistant.system || '' // Mensaje del sistema
            },
            messages: [], // Historial completo
            messageManager: null, // Se inicializará cuando sea necesario
            sources: {}, // Fuentes por messageId
            highlights: {}, // Highlights preservados
            device: device,
            tools: [], // Herramientas activas
            files: [], // Archivos subidos con metadata
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: {
                totalTokens: 0,
                messageCount: 0,
                lastActivity: Date.now(),
                hasFiles: false
            }
        };

        await this.storage.saveConversation(conversation);
        this.currentConversationId = conversation.id;

        return conversation;
    }

    async saveMessage(messageData, metadata = {}) {
        if (!this.currentConversationId) {
            throw new Error('No active conversation');
        }

        const conversation = await this.storage.loadConversation(this.currentConversationId);
        if (!conversation) {
            throw new Error('Current conversation not found');
        }

        // MENSAJE SIMPLE - solo datos básicos
        const simpleMessage = {
            id: messageData.id,  // ← Sin fallback, debe venir siempre
            role: messageData.role,
            content: messageData.content,
            timestamp: Date.now()
        };

        // Agregar tool_calls si existen
        if (messageData.tool_calls) {
            simpleMessage.tool_calls = messageData.tool_calls;
        }

        // AGREGAR el mensaje simple al historial
        conversation.messages.push(simpleMessage);

        // METADATOS VAN A NIVEL DE CONVERSACIÓN, NO DEL MENSAJE:
        conversation.updatedAt = Date.now();
        conversation.metadata.messageCount = conversation.messages.length;
        conversation.metadata.lastActivity = Date.now();

        // Guardar fuentes a nivel de conversación (asociadas por ID de mensaje)
        if (metadata.sources && metadata.sources.length > 0) {
            if (!conversation.sources) conversation.sources = {};
            conversation.sources[simpleMessage.id] = metadata.sources;
        }

        // Guardar archivos a nivel de conversación
        if (metadata.files && metadata.files.length > 0) {
            if (!conversation.files) conversation.files = [];
            conversation.files = [...conversation.files, ...metadata.files];
            conversation.metadata.hasFiles = true;
        }

        // Device se guarda a nivel de conversación
        if (metadata.device) {
            conversation.device = metadata.device;
        }

        await this.storage.saveConversation(conversation);
        this.pendingChanges = false;
        this.lastSaveTime = Date.now();

        return simpleMessage; // Retornar solo el mensaje simple
    }

    async loadConversation(id) {
        const conversation = await this.storage.loadConversation(id);
        if (conversation) {
            this.currentConversationId = id;
        }
        return conversation;
    }

    async getCurrentConversation() {
        if (!this.currentConversationId) return null;
        return await this.storage.loadConversation(this.currentConversationId);
    }

    async restoreConversationState(conversation, messageManager, sourceManager, highlightManager, fileDropzone) {
        if (!conversation) return false;

        try {
            // Restaurar sistema del asistente
            if (conversation.assistant && conversation.assistant.system) {
                messageManager.updateSystemMessage(conversation.assistant.system);
            }

            // Restaurar historial de mensajes (que ahora son simples)
            messageManager.messagesHistory = conversation.messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                tool_calls: msg.tool_calls || null,
                id: msg.id,
                timestamp: msg.timestamp // Mantener timestamp si existe
            }));

            // Restaurar fuentes (que están a nivel de conversación)
            if (conversation.sources) {
                Object.keys(conversation.sources).forEach(messageId => {
                    sourceManager.saveToStorage(messageId, conversation.sources[messageId]);
                });
            }

            // Restaurar highlights
            if (conversation.highlights) {
                Object.keys(conversation.highlights).forEach(id => {
                    highlightManager.highlights[id] = conversation.highlights[id];
                });
                highlightManager.saveToStorage();
            }

            // Restaurar archivos en FileDropzone
            if (conversation.files && conversation.files.length > 0 && fileDropzone) {
                conversation.files.forEach(fileData => {
                    // Recrear objeto File si es posible
                    const restoredFile = this.restoreFileFromData(fileData);
                    if (restoredFile) {
                        fileDropzone.uploadedFiles.push(restoredFile);
                    }
                });

                // Actualizar UI del dropzone
                this.updateDropzoneUI(fileDropzone, conversation.files);
            }

            this.currentConversationId = conversation.id;
            return true;

        } catch (error) {
            console.error('Error restoring conversation state:', error);
            return false;
        }
    }

    restoreFileFromData(fileData) {
        try {
            // Crear un objeto que simule un File con la metadata guardada
            const mockFile = {
                name: fileData.name,
                size: fileData.size,
                type: fileData.type,
                lastModified: fileData.lastModified,
                extractedText: fileData.extractedText,
                // Agregar propiedades específicas del FileDropzone
                excelData: fileData.excelData || null
            };

            return mockFile;
        } catch (error) {
            console.error('Error restoring file:', error);
            return null;
        }
    }

    updateDropzoneUI(fileDropzone, filesData) {
        if (!fileDropzone || !filesData) return;

        // Mostrar el dropzone si hay archivos
        if (filesData.length > 0) {
            fileDropzone.dropzone.classList.add(fileDropzone.options.hasFilesClass);
        }

        // Recrear la UI de archivos
        const previewArea = fileDropzone.dropzone.querySelector('.' + fileDropzone.options.previewClass);
        if (previewArea) {
            // Limpiar área de preview
            previewArea.innerHTML = '';

            // Recrear cada archivo en la UI
            filesData.forEach(fileData => {
                this.createFileUIElement(fileDropzone, previewArea, fileData);
            });
        }
    }

    createFileUIElement(fileDropzone, container, fileData) {
        const fileType = this.getFileTypeFromName(fileData.name);
        let icon = 'fa-file';

        // Determinar ícono según tipo
        switch (fileType) {
            case 'pdf':
                icon = 'fa-file-pdf';
                break;
            case 'word':
                icon = 'fa-file-word';
                break;
            case 'excel':
                icon = 'fa-file-excel';
                break;
            case 'image':
                icon = 'fa-file-image';
                break;
            case 'text':
                icon = 'fa-file-alt';
                break;
        }

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.setAttribute('data-file-id', fileData.name);

        fileItem.innerHTML = `
            <i class="fa ${icon}"></i>
            <span class="file-name">${fileData.name}</span>
            <div class="file-actions" style="display: inline-flex; margin-left: 5px;">
                <span class="success-indicator" title="File restored">
                    <i class="fa fa-check-circle" style="margin-left: 5px; color: #4caf50;"></i>
                </span>
                <span class="view-file" title="View content">
                    <i class="fa fa-eye" style="margin-left: 5px; color: #2196f3; cursor: pointer;"></i>
                </span>
            </div>
        `;

        // Agregar event listeners
        const viewButton = fileItem.querySelector('.view-file');
        if (viewButton && fileData.extractedText) {
            viewButton.addEventListener('click', () => {
                if (typeof editContent === 'function') {
                    editContent(fileData.extractedText, Date.now(), fileData.name);
                }
            });
        }

        container.appendChild(fileItem);
    }

    getFileTypeFromName(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx'].includes(ext)) return 'word';
        if (['xls', 'xlsx'].includes(ext)) return 'excel';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'image';
        if (['txt', 'json', 'js', 'html'].includes(ext)) return 'text';
        return 'unknown';
    }

    async saveCurrentState(messageManager, sourceManager, highlightManager, fileDropzone, device = null) {
        if (!this.currentConversationId) return false;

        try {
            // Verificar si hay mensajes reales antes de guardar
            const messagesHistory = messageManager.getFullHistory();
            const hasRealMessages = messagesHistory.some(msg =>
                msg.role === 'user' || msg.role === 'assistant'
            );

            if (!hasRealMessages) {
                console.log('No real messages yet, skipping save');
                return false;
            }

            const conversation = await this.storage.loadConversation(this.currentConversationId);
            if (!conversation) return false;

            // SINCRONIZACIÓN COMPLETA: reemplazar completamente los mensajes
            conversation.messages = messagesHistory;
            conversation.sources = sourceManager.getAllStoredSources();
            conversation.highlights = highlightManager.getAll();
            conversation.device = device;
            conversation.updatedAt = Date.now();
            conversation.metadata.lastActivity = Date.now();
            conversation.metadata.messageCount = messagesHistory.filter(msg =>
                msg.role === 'user' || msg.role === 'assistant'
            ).length;

            // Guardar archivos de FileDropzone
            if (fileDropzone && fileDropzone.uploadedFiles) {
                conversation.files = fileDropzone.uploadedFiles.map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    extractedText: file.extractedText || '',
                    excelData: file.excelData || null
                }));
                conversation.metadata.hasFiles = conversation.files.length > 0;
            }

            await this.storage.saveConversation(conversation);
            this.pendingChanges = false;
            this.lastSaveTime = Date.now();

            console.log(`💾 Conversation saved with ${conversation.messages.length} messages`);
            return true;

        } catch (error) {
            console.error('Error saving current state:', error);
            return false;
        }
    }


    async generateTitle(messageManager, maxWords = 5) {
        if (!this.currentConversationId) return 'New Chat';

        const history = messageManager.getHistory();
        const userMessages = history.filter(msg => msg.role === 'user');

        if (userMessages.length === 0) return 'New Chat';

        // Tomar el primer mensaje del usuario
        const firstMessage = userMessages[0].content;

        // Extraer las primeras palabras relevantes
        const words = firstMessage
            .replace(/[^\w\s]/gi, '') // Remover puntuación
            .split(/\s+/)
            .filter(word => word.length > 2) // Palabras de más de 2 caracteres
            .slice(0, maxWords);

        return words.length > 0 ? words.join(' ') : 'Chat';
    }

    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(async () => {
            if (this.currentConversationId) {
                try {
                    // Solo auto-guardar si han pasado al menos 5 segundos desde el último guardado
                    const timeSinceLastSave = Date.now() - this.lastSaveTime;
                    if (timeSinceLastSave < 5000) {
                        console.log('⏭️ Skipping auto-save, too recent');
                        return;
                    }

                    const conversation = await this.storage.loadConversation(this.currentConversationId);
                    if (conversation) {
                        // Solo actualizar timestamp, no los mensajes (para evitar conflictos)
                        const hasRealMessages = conversation.messages &&
                            conversation.messages.some(msg => msg.role === 'user' || msg.role === 'assistant');

                        if (hasRealMessages) {
                            conversation.metadata.lastActivity = Date.now();
                            await this.storage.saveConversation(conversation);
                            this.lastSaveTime = Date.now();
                            console.log('🕐 Auto-save: timestamp updated');
                        }
                    }
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }
        }, this.autoSaveInterval);
    }

    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
    }
};
SIMBA.StorageProvider = class {
    async saveConversation(conversation) {
        throw new Error('saveConversation must be implemented by subclass');
    }

    async loadConversation(id) {
        throw new Error('loadConversation must be implemented by subclass');
    }

    async deleteConversation(id) {
        throw new Error('deleteConversation must be implemented by subclass');
    }

    async listConversations(filters = {}) {
        throw new Error('listConversations must be implemented by subclass');
    }

    async updateConversation(id, updates) {
        throw new Error('updateConversation must be implemented by subclass');
    }
};

// Implementación LocalStorage
SIMBA.LocalStorageProvider = class extends SIMBA.StorageProvider {
    constructor() {
        super();
        this.storageKey = 'simba_conversations';
        this.indexKey = 'simba_conversations_index';
    }


    async saveConversation(conversation) {
        const conversations = this.getAllConversations();
        conversations[conversation.id] = {
            ...conversation,
            updatedAt: Date.now()
        };

        localStorage.setItem(this.storageKey, JSON.stringify(conversations));
        this.updateIndex(conversation);

        return conversation;
    }

    async loadConversation(id) {
        const conversations = this.getAllConversations();
        return conversations[id] || null;
    }

    async deleteConversation(id) {
        const conversations = this.getAllConversations();
        delete conversations[id];
        localStorage.setItem(this.storageKey, JSON.stringify(conversations));
        this.removeFromIndex(id);
        return true;
    }

    async listConversations(filters = {}) {
        const index = this.getIndex();
        let conversations = Object.values(index);

        if (filters.assistantGuid) {
            conversations = conversations.filter(c =>
                c.assistant.guid === filters.assistantGuid
            );
        }

        if (filters.search) {
            conversations = conversations.filter(c =>
                c.title.toLowerCase().includes(filters.search.toLowerCase())
            );
        }

        return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async updateConversationTitle(id, newTitle) {
        const conversation = await this.loadConversation(id);
        if (conversation) {
            conversation.title = newTitle;
            conversation.updatedAt = Date.now();
            await this.saveConversation(conversation);
            return true;
        }
        return false;
    }

    async exportConversation(id, format = 'json') {
        const conversation = await this.storage.loadConversation(id);
        if (!conversation) return null;

        if (format === 'json') {
            return JSON.stringify(conversation, null, 2);
        }

        // Formato texto legible
        let text = `Conversation: ${conversation.title}\n`;
        text += `Assistant: ${conversation.assistant.name}\n`;
        text += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n\n`;

        conversation.messages.forEach(msg => {
            if (msg.role !== 'system') {
                text += `${msg.role.toUpperCase()}: ${msg.content}\n\n`;
            }
        });

        return text;
    }

    getAllConversations() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        } catch (error) {
            console.error('Error loading conversations:', error);
            return {};
        }
    }

    getIndex() {
        try {
            return JSON.parse(localStorage.getItem(this.indexKey) || '{}');
        } catch (error) {
            return {};
        }
    }

    updateIndex(conversation) {
        const index = this.getIndex();
        index[conversation.id] = {
            id: conversation.id,
            title: conversation.title,
            assistant: conversation.assistant,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            messageCount: conversation.messages.length,
            lastMessage: conversation.messages[conversation.messages.length - 1]?.content?.substring(0, 100) || '',
            hasFiles: conversation.metadata?.hasFiles || false
        };
        localStorage.setItem(this.indexKey, JSON.stringify(index));
    }

    removeFromIndex(id) {
        const index = this.getIndex();
        delete index[id];
        localStorage.setItem(this.indexKey, JSON.stringify(index));
    }
};
/**
 * Utilidades generales
 */
SIMBA.Utils = class {

    static preprocessMarkdown(text) {
        if (!text || typeof text !== 'string') return text || '';

        // PASO 1: Procesar simba_message
        text = text.replace(/<simba_message\s+([^>]*)>([\s\S]*?)<\/simba_message>/g, function (match, attributesStr, content) {
            try {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = `<simba_message ${attributesStr}></simba_message>`;
                const tempElement = tempDiv.firstChild;

                const type = tempElement.getAttribute('type') || 'suggestion';
                const id = tempElement.getAttribute('id') || `msg-${Date.now()}`;
                const cleanContent = content.trim();

                // Para suggestions renderizar como marcador temporal
                if (type === 'suggestion') {
                    const spanHtml = `<span class="simba-suggestion cursor-pointer text-color-gray text-size-12 margin-left" data-type="${type}" data-id="${id}" data-content="${cleanContent}"><i class="fa fa-angles-down margin-right-half"></i>${cleanContent}</span>`;
                    return `[[SIMBA_SUGGESTION:${btoa(spanHtml)}]]`;
                }

                // Para otros tipos, devolver como est�
                return match;
            } catch (e) {
                console.error('Error procesando simba_message:', e);
                return match;
            }
        });

        // PASO 1.5: Limpiar simba_message incompletos al final del texto
        text = text.replace(/<simba_message[^>]*$/g, '');

        // PASO 2: Procesar referencias HTML escapadas dentro de bloques <code>
        text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, function (codeMatch, codeContent) {
            const escapedRefPattern = /&lt;span class="reference[^"]*"[^&]*data-filename="([^"]*)"[^&]*data-content="([^"]*)"[^&]*data-page="([^"]*)"[^&]*data-section="([^"]*)"[^&]*data-guid="([^"]*)"[^&]*&gt;([^&]*)&lt;\/span&gt;/g;

            if (escapedRefPattern.test(codeContent)) {
                escapedRefPattern.lastIndex = 0;

                const processedContent = codeContent.replace(escapedRefPattern, function (match, filename, contentData, page, section, guid, innerContent) {
                    const cleanText = innerContent
                        .replace(/&lt;[^&]*&gt;/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .trim();

                    let icon = 'fa-file';
                    const iconMatch = innerContent.match(/&lt;i class="([^"]*)"[^&]*&gt;/);
                    if (iconMatch && iconMatch[1]) {
                        icon = iconMatch[1];

                    } else if (filename) {
                        // Extraer extensión del filename
                        const extension = filename.split('.').pop().toLowerCase();

                        // Mapeo de extensiones a iconos FontAwesome
                        const extensionIcons = {
                            // Documentos
                            'pdf': 'fa-file-pdf',
                            'doc': 'fa-file-word',
                            'docx': 'fa-file-word',
                            'xls': 'fa-file-excel',
                            'xlsx': 'fa-file-excel',
                            'ppt': 'fa-file-powerpoint',
                            'pptx': 'fa-file-powerpoint',
                            'txt': 'fa-file-alt',
                            'rtf': 'fa-file-alt',
                            'odt': 'fa-file-alt',
                            'ods': 'fa-file-excel',
                            'odp': 'fa-file-powerpoint',

                            // Imágenes
                            'jpg': 'fa-file-image',
                            'jpeg': 'fa-file-image',
                            'png': 'fa-file-image',
                            'gif': 'fa-file-image',
                            'bmp': 'fa-file-image',
                            'webp': 'fa-file-image',
                            'svg': 'fa-file-image',
                            'tiff': 'fa-file-image',
                            'tif': 'fa-file-image',

                            // Código
                            'js': 'fa-file-code',
                            'jsx': 'fa-file-code',
                            'ts': 'fa-file-code',
                            'tsx': 'fa-file-code',
                            'json': 'fa-file-code',
                            'html': 'fa-file-code',
                            'htm': 'fa-file-code',
                            'xml': 'fa-file-code',
                            'css': 'fa-file-code',
                            'scss': 'fa-file-code',
                            'less': 'fa-file-code',
                            'php': 'fa-file-code',
                            'py': 'fa-file-code',
                            'java': 'fa-file-code',
                            'c': 'fa-file-code',
                            'cpp': 'fa-file-code',
                            'cs': 'fa-file-code',
                            'rb': 'fa-file-code',
                            'go': 'fa-file-code',
                            'swift': 'fa-file-code',

                            // Archivos comprimidos
                            'zip': 'fa-file-archive',
                            'rar': 'fa-file-archive',
                            '7z': 'fa-file-archive',
                            'tar': 'fa-file-archive',
                            'gz': 'fa-file-archive',

                            // Video
                            'mp4': 'fa-file-video',
                            'avi': 'fa-file-video',
                            'mkv': 'fa-file-video',
                            'mov': 'fa-file-video',
                            'wmv': 'fa-file-video',
                            'flv': 'fa-file-video',
                            'webm': 'fa-file-video',

                            // Audio
                            'mp3': 'fa-file-audio',
                            'wav': 'fa-file-audio',
                            'ogg': 'fa-file-audio',
                            'flac': 'fa-file-audio',
                            'aac': 'fa-file-audio',
                            'wma': 'fa-file-audio',

                            // Otros
                            'csv': 'fa-file-csv',
                            'md': 'fa-file-alt',
                            'markdown': 'fa-file-alt',
                            'stask': 'fa-tasks',
                            'sql': 'fa-database',
                            'db': 'fa-database'
                        };

                        // Usar el icono mapeado o uno genérico
                        icon = extensionIcons[extension] || 'fa-file';
                    }
                    return `<span class="reference cursor-pointer badge badge-round bg-color-bluegray" data-filename="${filename}" data-content="${contentData}" data-page="${page}" data-section="${section}" data-guid="${guid}"><i class="fa ${icon} margin-right-half"></i>${cleanText}</span>`;
                });

                return processedContent;
            }

            return codeMatch;
        });

        // PASO 3: Si no hay referencias en formato XML, devolver el texto
        if (!text.includes('<reference')) return text;

        // PASO 4: Procesar referencias XML incompletas
        const parts = text.split('</reference>');

        if (parts.length === 1) {
            return text.replace(/<[^>]*$/g, '');
        }

        const beforeLastComplete = parts.slice(0, -1).join('</reference>') + '</reference>';
        const afterLastComplete = parts[parts.length - 1];
        const incompleteIndex = afterLastComplete.indexOf('<');
        const cleanAfter = incompleteIndex !== -1 ? afterLastComplete.substring(0, incompleteIndex) : afterLastComplete;
        const cleanText = beforeLastComplete + cleanAfter;

        // PASO 5: Procesar referencias XML completas
        return cleanText.replace(/<reference\s+([^>]*)>([^<]+)<\/reference>/g, function (match, attributesStr, content) {
            try {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = `<reference ${attributesStr}></reference>`;
                const tempElement = tempDiv.firstChild;

                const filename = tempElement.getAttribute('data-filename') || '';
                const page = tempElement.getAttribute('data-page') || '';
                const section = tempElement.getAttribute('data-section') || '';
                const guid = tempElement.getAttribute('data-guid') || '';
                const icon = tempElement.getAttribute('data-icon') || 'fa-exclamation-triangle';

                let spanHtml = '<span class="reference cursor-pointer badge badge-round bg-color-bluegray"';
                spanHtml += ` data-filename="${filename}" data-content="${content}" data-page="${page}" data-section="${section}"`;
                if (guid) spanHtml += ` data-guid="${guid}"`;
                spanHtml += `><i class="${icon} margin-right-half"></i>${filename}</span>`;

                return spanHtml;
            } catch (e) {
                console.error('Error procesando referencia:', e);
                return match;
            }
        });
    }

    static generateUniqueId(prefix = 'id') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function () {
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

        return new Date(date).toLocaleString('en-US', {...defaultOptions, ...options});
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

