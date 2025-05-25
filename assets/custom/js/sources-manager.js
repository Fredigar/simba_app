/**
 * SourcesManager - Gestor centralizado para tempSources
 * Archivo: sources-manager.js
 * Versión: 1.0
 */

(function(global) {
    'use strict';

    /**
     * Gestor centralizado para guardar tempSources en localStorage
     */
    class SourcesManager {

        /**
         * Guarda tempSources en múltiples ubicaciones de localStorage
         * @param {string} messageId - ID del mensaje para la clave sources_
         * @param {Array} tempSources - Array de sources a guardar (opcional, usa window.tempSources si no se pasa)
         * @param {Object} params - Parámetros adicionales
         * @param {Object} options - Opciones de configuración
         */
        static saveTempSources(messageId, tempSources = null, params = {}, options = {}) {
            const defaultOptions = {
                saveToSourcesKey: true,      // Guardar en sources_{messageId}
                saveToSimbaKey: true,        // Guardar en simba_sources por GUID
                saveToGlobalKey: false,      // Guardar en global_sources
                addTimestamp: true,          // Añadir timestamp a cada source
                validateGuids: true,         // Validar que todos los sources tengan GUID
                logActivity: true            // Mostrar logs de la actividad
            };

            const config = { ...defaultOptions, ...options };

            // Determinar qué sources usar
            const sourcesToUse = tempSources || global.tempSources;

            if (config.logActivity) {
                console.log('🔄 Iniciando guardado de tempSources...', {
                    messageId,
                    sourcesCount: sourcesToUse?.length || 0,
                    usingPassedSources: !!tempSources,
                    config
                });
            }

            // Validaciones iniciales
            if (!messageId) {
                console.error('❌ MessageId requerido para guardar sources');
                return false;
            }

            if (!sourcesToUse || !Array.isArray(sourcesToUse)) {
                console.warn('⚠️ tempSources no es válido:', sourcesToUse);
                return false;
            }

            if (sourcesToUse.length === 0) {
                console.warn('⚠️ tempSources está vacío');
                return false;
            }

            try {
                // Procesar sources (añadir timestamp si está habilitado)
                const processedSources = sourcesToUse.map(source => {
                    const processedSource = { ...source };

                    if (config.addTimestamp) {
                        processedSource.savedAt = Date.now();
                        processedSource.savedDate = new Date().toISOString();
                    }

                    return processedSource;
                });

                // Validar GUIDs si está habilitado
                if (config.validateGuids) {
                    const sourcesWithoutGuid = processedSources.filter(source => !source.guid);
                    if (sourcesWithoutGuid.length > 0) {
                        console.warn('⚠️ Sources sin GUID encontrados:', sourcesWithoutGuid.length);
                        if (config.logActivity) {
                            console.warn('Sources sin GUID:', sourcesWithoutGuid);
                        }
                    }
                }

                let savedCount = 0;

                // 1. Guardar en sources_{messageId}
                if (config.saveToSourcesKey) {
                    const sourceArray = {
                        sources: processedSources,
                        params: params,
                        savedAt: Date.now(),
                        messageId: messageId
                    };

                    localStorage.setItem(`sources_${messageId}`, JSON.stringify(sourceArray));
                    savedCount++;

                    if (config.logActivity) {
                        console.log(`✅ Guardado en sources_${messageId}`);
                    }
                }

                // 2. Guardar en simba_sources (por GUID)
                if (config.saveToSimbaKey) {
                    this.saveToSimbaKey(processedSources, config.logActivity);
                    savedCount++;
                }

                // 3. Guardar en global_sources (opcional)
                if (config.saveToGlobalKey) {
                    this.saveToGlobalKey(processedSources, messageId, params, config.logActivity);
                    savedCount++;
                }

                if (config.logActivity) {
                    console.log(`🎉 tempSources guardado exitosamente en ${savedCount} ubicaciones`);
                }

                return true;

            } catch (error) {
                console.error('❌ Error al guardar tempSources:', error);
                return false;
            }
        }

        /**
         * Guarda sources en simba_sources indexados por GUID
         */
        static saveToSimbaKey(sources, logActivity = true) {
            try {
                // Leer datos existentes
                let simbaSourcesData = {};
                const existingData = localStorage.getItem('simba_sources');

                if (existingData) {
                    try {
                        simbaSourcesData = JSON.parse(existingData);
                    } catch (error) {
                        console.error('Error al parsear simba_sources existente:', error);
                        simbaSourcesData = {};
                    }
                }

                // Añadir nuevos sources
                let addedCount = 0;
                let updatedCount = 0;

                sources.forEach(source => {
                    if (source.guid) {
                        const existed = simbaSourcesData[source.guid] !== undefined;
                        simbaSourcesData[source.guid] = source;

                        if (existed) {
                            updatedCount++;
                        } else {
                            addedCount++;
                        }
                    }
                });

                // Guardar
                localStorage.setItem('simba_sources', JSON.stringify(simbaSourcesData));

                if (logActivity) {
                    console.log(`✅ Simba sources: ${addedCount} añadidos, ${updatedCount} actualizados`);
                }

            } catch (error) {
                console.error('❌ Error al guardar en simba_sources:', error);
            }
        }

        /**
         * Guarda sources en global_sources (historial completo)
         */
        static saveToGlobalKey(sources, messageId, params, logActivity = true) {
            try {
                let globalSources = [];
                const existingData = localStorage.getItem('global_sources');

                if (existingData) {
                    try {
                        globalSources = JSON.parse(existingData);
                        if (!Array.isArray(globalSources)) {
                            globalSources = [];
                        }
                    } catch (error) {
                        console.error('Error al parsear global_sources:', error);
                        globalSources = [];
                    }
                }

                // Añadir nuevo registro
                const globalEntry = {
                    messageId: messageId,
                    sources: sources,
                    params: params,
                    savedAt: Date.now(),
                    savedDate: new Date().toISOString()
                };

                globalSources.push(globalEntry);

                // Limitar historial (opcional - mantener últimos 100 registros)
                if (globalSources.length > 100) {
                    globalSources = globalSources.slice(-100);
                }

                localStorage.setItem('global_sources', JSON.stringify(globalSources));

                if (logActivity) {
                    console.log(`✅ Global sources: registro añadido (total: ${globalSources.length})`);
                }

            } catch (error) {
                console.error('❌ Error al guardar en global_sources:', error);
            }
        }

        /**
         * Función de conveniencia - uso simple (usa window.tempSources automáticamente)
         */
        static save(messageId, params = {}) {
            return this.saveTempSources(messageId, null, params);
        }

        /**
         * Función de conveniencia - con sources específicos
         */
        static saveCustom(messageId, tempSources, params = {}) {
            return this.saveTempSources(messageId, tempSources, params);
        }

        /**
         * Obtener sources por messageId
         */
        static getSourcesByMessageId(messageId) {
            try {
                const data = localStorage.getItem(`sources_${messageId}`);
                return data ? JSON.parse(data) : null;
            } catch (error) {
                console.error('Error al obtener sources por messageId:', error);
                return null;
            }
        }

        /**
         * Obtener source por GUID
         */
        static getSourceByGuid(guid) {
            try {
                const data = localStorage.getItem('simba_sources');
                if (data) {
                    const sources = JSON.parse(data);
                    return sources[guid] || null;
                }
                return null;
            } catch (error) {
                console.error('Error al obtener source por GUID:', error);
                return null;
            }
        }

        /**
         * Obtener todos los sources de simba_sources
         */
        static getAllSimbaSources() {
            try {
                const data = localStorage.getItem('simba_sources');
                return data ? JSON.parse(data) : {};
            } catch (error) {
                console.error('Error al obtener todos los simba sources:', error);
                return {};
            }
        }

        /**
         * Obtener estadísticas de almacenamiento
         */
        static getStats() {
            try {
                const simbaData = localStorage.getItem('simba_sources');
                const globalData = localStorage.getItem('global_sources');

                const simbaCount = simbaData ? Object.keys(JSON.parse(simbaData)).length : 0;
                const globalCount = globalData ? JSON.parse(globalData).length : 0;

                // Contar sources_ keys
                let sourcesKeys = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('sources_')) {
                        sourcesKeys++;
                    }
                }

                return {
                    simbaSourcesCount: simbaCount,
                    globalSourcesCount: globalCount,
                    sourcesKeysCount: sourcesKeys,
                    totalStorageUsed: this.calculateStorageSize()
                };
            } catch (error) {
                console.error('Error al obtener estadísticas:', error);
                return null;
            }
        }

        /**
         * Calcular tamaño del almacenamiento
         */
        static calculateStorageSize() {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            return totalSize; // bytes
        }

        /**
         * Limpiar datos antiguos
         */
        static cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 días por defecto
            const now = Date.now();
            let cleaned = 0;

            // Limpiar simba_sources
            try {
                const simbaData = localStorage.getItem('simba_sources');
                if (simbaData) {
                    const sources = JSON.parse(simbaData);
                    const cleanedSources = {};

                    Object.keys(sources).forEach(guid => {
                        const source = sources[guid];
                        if (!source.savedAt || (now - source.savedAt < maxAge)) {
                            cleanedSources[guid] = source;
                        } else {
                            cleaned++;
                        }
                    });

                    localStorage.setItem('simba_sources', JSON.stringify(cleanedSources));
                }
            } catch (error) {
                console.error('Error en cleanup de simba_sources:', error);
            }

            console.log(`🧹 Limpieza completada: ${cleaned} sources eliminados`);
            return cleaned;
        }
    }

    // Exponer la clase al ámbito global
    global.SourcesManager = SourcesManager;

    // Funciones de conveniencia globales
    global.saveTempSources = (messageId, tempSources, params, options) => {
        // Si tempSources es un objeto (params), ajustar parámetros
        if (tempSources && !Array.isArray(tempSources) && typeof tempSources === 'object') {
            return SourcesManager.saveTempSources(messageId, null, tempSources, params);
        }
        return SourcesManager.saveTempSources(messageId, tempSources, params, options);
    };
    global.saveCustomSources = (messageId, tempSources, params, options) => SourcesManager.saveTempSources(messageId, tempSources, params, options);
    global.getSourceByGuid = (guid) => SourcesManager.getSourceByGuid(guid);
    global.getSourcesByMessageId = (messageId) => SourcesManager.getSourcesByMessageId(messageId);
    global.getAllSimbaSources = () => SourcesManager.getAllSimbaSources();

})(window);