/**
 * conversation-optimizer.js
 * Optimiza conversaciones manteniendo estructura y contexto
 * Versión global para usar con <script defer>
 */

window.ConversationOptimizer = class ConversationOptimizer {
    constructor({
                    tokenLimit = 28000,
                    summaryModel = 'mistral-small-24',
                    maxTokens = 5000,
                    $f7,
                    config,
                    cleanSimbaDocuments = null
                } = {}) {
        // Usar el tokenizer global disponible
        this.tokenizer = mistralTokenizer;
        this.TOKEN_LIMIT = tokenLimit;
        this.SUMMARY_MODEL = summaryModel;
        this.MAX_TOKENS = maxTokens;
        this.$f7 = $f7;
        this.config = config || window.config;
        this.cleanSimbaDocuments = cleanSimbaDocuments;
    }

    // Contar tokens de un mensaje
    getMessageTokens(message) {
        const messageText = JSON.stringify(message);
        const tokens = this.tokenizer.encode(messageText);
        return tokens.length;
    }

    // Contar tokens total del historial
    countTotalTokens(messagesHistory) {
        return messagesHistory.reduce((sum, msg) => sum + this.getMessageTokens(msg), 0);
    }

    // Verificar si necesita optimización
    needsOptimization(messagesHistory) {
        return this.countTotalTokens(messagesHistory) >= this.TOKEN_LIMIT;
    }

    // Función principal de optimización
    async optimizeConversation(messagesHistory) {
        console.log("🔧 Starting conversation optimization");

        const currentTokens = this.countTotalTokens(messagesHistory);
        console.log(`📊 Current tokens: ${currentTokens}/${this.TOKEN_LIMIT}`);

        // Si no supera el límite, devolver tal como está
        if (currentTokens < this.TOKEN_LIMIT) {
            console.log("✅ No optimization needed - under token limit");
            return {
                messages: messagesHistory,
                optimized: false,
                originalTokens: currentTokens,
                finalTokens: currentTokens
            };
        }

        console.log("⚠️ Token limit exceeded, starting optimization...");

        // Separar mensajes por tipo
        const systemMessages = messagesHistory.filter(m => m.role === 'system');
        const conversationMessages = messagesHistory.filter(m => m.role !== 'system');

        // Mantener siempre los mensajes system
        let optimizedMessages = [...systemMessages];
        let usedTokens = this.countTotalTokens(optimizedMessages);

        // Determinar cuántos mensajes recientes mantener (70% del límite)
        const recentMessages = [];
        const targetTokensForRecent = this.TOKEN_LIMIT * 0.7;

        for (let i = conversationMessages.length - 1; i >= 0; i--) {
            const testMessage = conversationMessages[i];
            const testTokens = this.getMessageTokens(testMessage);

            if (usedTokens + this.countTotalTokens(recentMessages) + testTokens < targetTokensForRecent) {
                recentMessages.unshift(testMessage);
            } else {
                break;
            }
        }

        // Mensajes a resumir (los más antiguos)
        const messagesToSummarize = conversationMessages.slice(0, conversationMessages.length - recentMessages.length);

        if (messagesToSummarize.length > 0) {
            console.log(`📝 Summarizing ${messagesToSummarize.length} old messages, keeping ${recentMessages.length} recent ones`);

            try {
                // Resumir mensajes manteniendo estructura
                const summarizedMessages = await this.summarizeMessagesStructured(messagesToSummarize);

                // Combinar: system + resumidos + recientes
                optimizedMessages = [
                    ...systemMessages,
                    ...summarizedMessages,
                    ...recentMessages
                ];

                console.log(`✂️ Summary complete: ${messagesToSummarize.length} → ${summarizedMessages.length} messages`);

            } catch (error) {
                console.error("❌ Error during summarization:", error);
                // Fallback: solo mantener mensajes recientes
                optimizedMessages = [...systemMessages, ...recentMessages];
            }
        } else {
            optimizedMessages = [...systemMessages, ...recentMessages];
        }

        // Paso 2: Limpiar simba_documents si aún es necesario
        const tokensAfterSummary = this.countTotalTokens(optimizedMessages);
        console.log(`📊 Tokens after summarization: ${tokensAfterSummary}`);

        if (tokensAfterSummary >= this.TOKEN_LIMIT * 0.9) {
            console.log("🧹 Still above limit, cleaning simba_documents...");
            optimizedMessages = this.cleanSimbaDocumentsInternal(optimizedMessages);
        }

        const finalTokens = this.countTotalTokens(optimizedMessages);

        return {
            messages: optimizedMessages,
            optimized: true,
            originalTokens: currentTokens,
            finalTokens: finalTokens,
            summarizedCount: messagesToSummarize.length,
            keptRecentCount: recentMessages.length,
            tokenReduction: currentTokens - finalTokens,
            reductionPercentage: Math.round(((currentTokens - finalTokens) / currentTokens) * 100)
        };
    }

    // Resumir mensajes manteniendo estructura conversacional
    async summarizeMessagesStructured(messagesToSummarize) {
        // Calcular tokens del input para ajustar max_tokens apropiadamente
        const inputTokens = this.countTotalTokens([
            {role: "system", content: "Tu tarea es resumir una conversación..."},
            {role: "user", content: JSON.stringify(messagesToSummarize)}
        ]);

        // Ajustar max_tokens según el tamaño del input (mínimo 2000, máximo this.MAX_TOKENS)
        const adjustedMaxTokens = Math.min(
            this.MAX_TOKENS,
            Math.max(2000, Math.floor(messagesToSummarize.length * 200))
        );

        console.log(`📏 Input tokens: ${inputTokens}, Max tokens for summary: ${adjustedMaxTokens}`);

        const summarizationPrompt = {
            role: "system",
            content: `Tu tarea es resumir una conversación manteniendo la estructura JSON de mensajes.

REGLAS ESTRICTAS:
1. **Devuelve un array JSON** de mensajes con formato: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]
2. **Mantén la alternancia** user → assistant → user → assistant
3. **Condensa múltiples intercambios** en menos mensajes, pero preserva información clave
4. **Para <simba_document>**: Reemplaza el contenido por resumen conciso con drId y causa/resolución
5. **El resto del contenido** manténlo íntegro pero condensado
6. **Unifica mensajes consecutivos** del mismo rol si es necesario
7. **Respuesta debe ser JSON válido** sin markdown

Ejemplo de transformación:
Input: 4 mensajes user/assistant/user/assistant largos
Output: 2 mensajes user/assistant resumidos que capturen lo esencial

Tu respuesta debe ser SOLO el array JSON, sin explicaciones adicionales.`
        };

        // Formatear mensajes para resumir
        const conversationText = JSON.stringify(messagesToSummarize);

        const payload = {
            stream: false,
            model: this.SUMMARY_MODEL,
            messages: [
                summarizationPrompt,
                {
                    role: "user",
                    content: `Resume esta conversación manteniendo la estructura de mensajes:\n\n${conversationText}`
                }
            ],
            temperature: 0.3,
            max_tokens: adjustedMaxTokens  // ← Ahora usa el max_tokens apropiado
        };

        console.log("📡 Making API request for structured summarization...");

        const response = await this.$f7.request({
            url: this.config.completion.url,
            method: 'POST',
            data: payload,
            contentType: 'application/json',
            dataType: 'json',
            headers: {
                'Authorization': `Bearer ${this.config.completion.apiKey}`
            }
        });

        if (!response.data?.choices?.[0]) {
            throw new Error("Invalid summarization response");
        }

        const summarizedContent = response.data.choices[0].message.content;

        // Limpiar y parsear la respuesta JSON
        const jsonString = summarizedContent
            .replace(/^```\s*json\s*/, '')
            .replace(/```$/, '')
            .trim();

        const parsedSummary = JSON.parse(jsonString);

        if (!Array.isArray(parsedSummary)) {
            throw new Error("Summarized content is not a valid message array");
        }

        // Validar que todos los mensajes tienen la estructura correcta
        const validMessages = parsedSummary.filter(msg =>
            msg.role && msg.content &&
            ['user', 'assistant', 'system'].includes(msg.role)
        );

        console.log(`✅ Successfully summarized ${messagesToSummarize.length} → ${validMessages.length} messages`);

        return validMessages;
    }

    // Función interna para limpiar simba_documents
    cleanSimbaDocumentsInternal(messages, maxToClean = 2) {
        if (!this.cleanSimbaDocuments) {
            console.warn("⚠️ cleanSimbaDocuments function not provided, skipping cleanup");
            return messages;
        }

        let cleanedUserMessageCount = 0;

        return messages.map(msg => {
            if (msg.role !== 'user' || !msg.content?.includes('<simba_document') || cleanedUserMessageCount >= maxToClean) {
                return { ...msg };
            }

            cleanedUserMessageCount++;
            const cleanedMsg = { ...msg };
            cleanedMsg.content = this.cleanSimbaDocuments(msg.content);

            console.log(`🧹 Cleaned user message ${cleanedUserMessageCount} of ${maxToClean}`);
            return cleanedMsg;
        });
    }

    // Método helper para obtener estadísticas
    getStats(messagesHistory) {
        const totalTokens = this.countTotalTokens(messagesHistory);
        const systemMessages = messagesHistory.filter(m => m.role === 'system').length;
        const userMessages = messagesHistory.filter(m => m.role === 'user').length;
        const assistantMessages = messagesHistory.filter(m => m.role === 'assistant').length;

        return {
            totalMessages: messagesHistory.length,
            totalTokens,
            tokenUtilization: Math.round((totalTokens / this.TOKEN_LIMIT) * 100),
            needsOptimization: totalTokens >= this.TOKEN_LIMIT,
            breakdown: {
                system: systemMessages,
                user: userMessages,
                assistant: assistantMessages
            }
        };
    }
};

// Función helper global para uso directo en Framework7
window.optimizeConversationInBackground = async function(messagesHistory, options = {}) {
    try {
        console.log("🚀 Running conversation optimization in background...");

        const optimizer = new window.ConversationOptimizer(options);
        const messagesCopy = JSON.parse(JSON.stringify(messagesHistory));

        // Optimizar usando el nuevo enfoque
        const result = await optimizer.optimizeConversation(messagesCopy);

        if (!result.messages || result.messages.length === 0) {
            console.error("❌ Optimization failed - no messages returned");
            return false;
        }

        if (result.optimized) {
            console.log(`✂️ Optimized: ${result.originalTokens} → ${result.finalTokens} tokens (${result.reductionPercentage}% reduction)`);
            console.log(`📄 Summarized: ${result.summarizedCount} messages`);
            console.log(`💾 Kept recent: ${result.keptRecentCount} messages`);
        }

        // Reemplazar el historial original (manteniendo la referencia)
        messagesHistory.length = 0;
        result.messages.forEach(msg => messagesHistory.push(msg));

        console.log("%c✅ Conversation optimized successfully", "color: green; font-weight: bold");
        return result;

    } catch (error) {
        console.error("❌ Error during conversation optimization:", error);
        return false;
    }
};