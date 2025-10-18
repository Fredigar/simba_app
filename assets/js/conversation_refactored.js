export class ConversationContext {
    constructor(props, frameworkContext) {
        this.props = props;
        Object.assign(this, frameworkContext);
    }
}

export class ConversationManagers {
    constructor() {
        this.configManager = new window.SIMBA.ConfigManager();
        this.messageManager = new window.SIMBA.MessageManager();
        this.sourceManager = new window.SIMBA.SourceManager();
        this.highlightManager = new window.SIMBA.HighlightManager();
        this.toolManager = null;
        this.mentionManager = null;
        this.voiceManager = null;
        this.conversationManager = null;
    }
}

function renderConversation(context, managers) {
    const {$, $el, $f7, $f7route, $f7router, $h, $on, $store, $theme, $update, $render} = context;

    // ===========================================
    // INITIALIZATION OF SIMBA MANAGERS
    // ===========================================

    const configManager = managers.configManager;
    const messageManager = managers.messageManager;
    const sourceManager = managers.sourceManager;
    const highlightManager = managers.highlightManager;
    let toolManager = managers.toolManager; // Will be initialized after chat is loaded
    let mentionManager = managers.mentionManager; // Will be initialized after assistants are loaded
    let voiceManager = managers.voiceManager;
    let conversationManager = managers.conversationManager;
    let isRecording = false;
    let isProcessingVoice = false;
    let voiceSupported = false;
    let autoScrollEnabled = true;
    let isUserScrolling = false;
    let scrollTimeout = null;
    let debouncedAutoScroll = null;
    let autoScrolling = false;
    let originalAssistant = null;      // Asistente original/padre
    let showAssistantChip = false;     // Flag para mostrar/ocultar chip
    // ===========================================
    // ORIGINAL TEMPLATE VARIABLES (NO CHANGES)
    // ===========================================

    let response = '';
    let isResponding = null;
    let notFinishedMessage = '';
    let prompt = null;
    let messages = [];
    let messagebar = null;
    let processingToolResponse = false;
    let sources = [];
    let dialogChoiceChip = null;
    let actionsCustomLayout = null;
    let actionsToolsLayout = null;
    let usageData = null;
    let highlights = {};
    let popupHighlights = null;
    let popupTask = null;
    let popupApiKeys = null;
    let formApiKeysValidator = null;

    // Framework7 specific state
    let scrollToBottomBtn = null;
    let pageContent = null;
    let breakAutoScroll = false;
    let showCenteredBar = messageManager.getHistory().length === 1;
    let showBottomBar = messageManager.getHistory().length > 1;

    // User and Assistant data
    let user = {
        guid: '05F1A0C-54F6-5A83-25E0-13EB149B237'
    };
    let assistant = null;
    let assistants = [];
    let quick_actions = [];

    // Chat data
    let chat = {
        guid: $f7route.params.guid,
        title: 'New conversation',
        instructions: [],
        noSelectionInstructions: []
    };

    // Device and form data
    let devices = [
        "FFS CN235", "FFS C295 TS03", "FFS C295 EA03", "FFS A400M", "FTD A400M",
        "CHT-E", "CMOS A400M", "FFS A330 MRTT", "CPTT", "DT-MRTT", "FMS A400M",
        "LMWS", "MPRS", "GENERAL"
    ];
    let myDevice = null;
    let ticket = {
        device: '',
        problem_title: "",
        problem_description: ""
    };
    let voiceConfig = {
        enabled: false,
        showButton: false,
        autoInit: true
    };

// Luego ya puedes usar:
    const VOICE_FEATURES_ENABLED = true;
    const shouldEnableVoice = VOICE_FEATURES_ENABLED && voiceConfig.enabled;

    // UI Elements
    let activeTools = {}; // Para trackear qu� tools est�n activas
    let popupTicket = null;
    let formTicketValidator = null;
    let popupConfig = null;
    let formConfigValidator = null;
    let popoverSelection = null;
    let popoverTools = null;
    let popoverText = null;
    let myReference = null;
    let selectedText = "";
    let uploadedFiles = [];
    let loadedImages = {}; // Objeto donde la clave es el nombre de la imagen
    let loadedFiles = {};  //

    let isResponseInBackground = false;
    let streamingProgress = 0;
    let fullStreamingResponse = "";
    let currentStreamingRequest = null;

    // Configuration
    let config = configManager.getConfig();
    let extractedContents = "";
    // Constants
    let TOKEN_LIMIT = 45000;
    let MAX_TOKENS = 25000;
    let DEFAULT_TEMPERATURE = 0;
    let DEFAULT_MODEL = "magistral-2509";//mistral-small-24B-instruct-2506";//"mistral-small-24B-instruct-2506";//"mistral-small-24B-instruct-2506";//"phi-4";"magistral-2509"
    let SUMMARY_MODEL = "mistral-small-24B-instruct-2506";
    let VISION_MODEL = "mistral-small-24B-instruct-2506-vision"; // ✅ NUEVO
    const footerTemplate = '<div class="message-footer-content"><div class="sources margin-bottom float-left"></div><div class="actions margin-top-half width-100 text-align-right float-right"></div></div>';
    let availableModels = [];
    let modelsLoadError = false;

    let reasoningEnabled = false; // Por defecto activado
    let currentModelCategory = null; // Para trackear la categoría del modelo actual
    // Después de las constantes como DEFAULT_MODEL, etc.
    const REASONING_INSTRUCTION = `

CRITICAL REASONING PROTOCOL:
When reasoning mode is active, you MUST structure your response in two parts:

1. THINKING SECTION (hidden from user):
   - Wrap your reasoning process in [THINK]...[/THINK] tags
   - Think step by step about the problem
   - Consider multiple approaches
   - Evaluate pros and cons
   - Plan your response strategy
   - This section will NOT be shown to the user

2. FINAL RESPONSE (visible to user):
   - After [/THINK] tag, provide your clear, polished answer
   - Base it on your thinking but make it concise and user-friendly
   - Do not reference or mention your thinking process
   - Respond naturally as if the thinking never happened

Example structure:
[THINK]
Let me break down this problem...
Step 1: Understanding the question...
Step 2: Consider the options...
Step 3: Best approach would be...
Therefore, I should respond with...
[/THINK]

Here is my clear answer to your question: [your response]

MANDATORY: You MUST always start with [THINK] when reasoning mode is active. Never skip the thinking phase.
`;
    /**
     * Verifica si el modelo actual es de razonamiento
     * @param {string} modelName - Nombre del modelo
     * @returns {boolean}
     */
    let isReasoningModel = function(modelName) {
        if (!modelName || !availableModels || availableModels.length === 0) {
            return false;
        }

        const model = availableModels.find(m => m.name === modelName);
        if (!model || !model.category) {
            return false;
        }

        const category = model.category.replace('iaModels_category_', '');
        return category === 'reasoning';
    };

    /**
     * Actualiza la categoría del modelo actual
     */
    let updateCurrentModelCategory = function() {
        const currentConfig = configManager.getConfig();
        const modelName = currentConfig.model || DEFAULT_MODEL;

        if (!availableModels || availableModels.length === 0) {
            currentModelCategory = null;
            return;
        }

        const model = availableModels.find(m => m.name === modelName);
        if (model && model.category) {
            currentModelCategory = model.category.replace('iaModels_category_', '');
            console.log('📊 Current model category:', currentModelCategory);
        } else {
            currentModelCategory = null;
        }
    };
    /**
     * Inicializa el estado de reasoning desde config
     */


    /**
     * Toggle para activar/desactivar razonamiento
     */
    let toggleReasoning = function() {
        const currentConfig = configManager.getConfig();
        const currentState = isReasoningEnabled();
        const newState = !currentState;

        // Guardar nuevo estado
        currentConfig.reasoningEnabled = newState;
        configManager.updateConfig(currentConfig);

        console.log('🔄 Reasoning toggled:', currentState, '→', newState);

        $f7.toast.show({
            text: `Reasoning ${newState ? 'enabled' : 'disabled'}`,
            position: 'center',
            closeTimeout: 1500,
            cssClass: newState ? 'color-blue' : 'color-orange'
        });

        updateTemplate();
    };
    /**
     * Carga la lista de modelos disponibles desde el endpoint
     */
    let loadAvailableModels = async function() {
        const modelsEndpoint = window.config?.models;

        if (!modelsEndpoint) {
            console.warn('⚠️ Models endpoint not configured');
            modelsLoadError = true;
            return [];
        }

        try {
            console.log('📡 Loading available models from:', modelsEndpoint);

            const response = await fetch(modelsEndpoint, {
                method: 'GET',
                headers: {
                    'x-auth-token': `${window.config.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseData = await response.json();

            // ✅ DEBUGGING: Ver la estructura completa
            console.log('📦 Full response:', responseData);
            console.log('📦 Response.data:', responseData.data);
            console.log('📦 Is array?:', Array.isArray(responseData.data));

            // ✅ CORRECCIÓN: Acceder directamente a responseData.data
            if (responseData && responseData.data && Array.isArray(responseData.data)) {
                // Los modelos están en responseData.data, NO en responseData.data.data
                availableModels = responseData.data
                    .filter(model => model.name) // Filtrar los que tienen nombre
                    .sort((a, b) => a.name.localeCompare(b.name)); // Ordenar alfabéticamente

                console.log(`✅ Loaded ${availableModels.length} models:`, availableModels);

                // ✅ DEBUGGING: Mostrar modelos por categoría
                const byCategory = availableModels.reduce((acc, model) => {
                    const cat = model.category?.replace('iaModels_category_', '') || 'unknown';
                    acc[cat] = (acc[cat] || 0) + 1;
                    return acc;
                }, {});
                console.log('📊 Models by category:', byCategory);
                updateCurrentModelCategory()
                modelsLoadError = false;
                return availableModels;
            } else {
                console.error('❌ Invalid response structure:', {
                    hasResponseData: !!responseData,
                    hasData: !!responseData?.data,
                    isArray: Array.isArray(responseData?.data),
                    dataType: typeof responseData?.data
                });
                throw new Error('Invalid response format');
            }

        } catch (error) {
            console.error('❌ Error loading models:', error);
            console.error('❌ Error stack:', error.stack);
            modelsLoadError = true;
            availableModels = [];
            return [];
        }
    };

    /**
     * Renderiza el campo de modelo (select o input según disponibilidad)
     * @param {string} fieldName - Nombre del campo (model, summary_model, vision_model)
     * @param {string} labelText - Texto del label
     * @param {string} currentValue - Valor actual seleccionado
     * @param {string} containerSelector - Selector del contenedor
     * @param {Array<string>} allowedCategories - Array de categorías permitidas (ej: ['chat', 'reasoning'])
     */
    let renderModelField = function(fieldName, labelText, currentValue, containerSelector, allowedCategories = []) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.error(`Container ${containerSelector} not found`);
            return;
        }

        let html = '';

        if (modelsLoadError || availableModels.length === 0) {
            // Fallback: input text
            html = `
        <div class="item-content item-input item-input-outline">
            <div class="item-inner">
                <div class="item-title item-floating-label">${labelText}</div>
                <div class="item-input-wrap">
                    <div class="item-media">
                        <i class="icon material-icons">memory</i>
                    </div>
                    <input type="text" name="${fieldName}" value="${currentValue || ''}"
                           placeholder="Model name" required/>
                    <span class="input-clear-button"></span>
                </div>
            </div>
        </div>
    `;
        } else {
            // ✅ Filtrar modelos por categorías permitidas
            let filteredModels = availableModels;

            if (allowedCategories.length > 0) {
                filteredModels = availableModels.filter(model => {
                    if (!model.category) return false;
                    // Extraer la categoría del formato "iaModels_category_chat"
                    const categoryName = model.category.replace('iaModels_category_', '');
                    return allowedCategories.includes(categoryName);
                });
            }

            console.log(`📋 ${fieldName}: ${filteredModels.length} models (categories: ${allowedCategories.join(', ')})`);

            if (filteredModels.length === 0) {
                // Si no hay modelos después del filtro, mostrar input text
                html = `
            <div class="item-content item-input item-input-outline">
                <div class="item-inner">
                    <div class="item-title item-floating-label">${labelText}</div>
                    <div class="item-input-wrap">
                        <div class="item-media">
                            <i class="icon material-icons">memory</i>
                        </div>
                        <input type="text" name="${fieldName}" value="${currentValue || ''}"
                               placeholder="No models available for this category" required/>
                        <span class="input-clear-button"></span>
                    </div>
                </div>
            </div>
        `;
            } else {
                // ✅ Select con modelos filtrados
                const options = filteredModels.map(model => {
                    const selected = model.name === currentValue ? 'selected' : '';
                    const providerName = model.provider?.name || 'Unknown';
                    const displayName = `${model.name} (${providerName})`;
                    return `<option value="${model.name}" ${selected}>${displayName}</option>`;
                }).join('');

                html = `
            <div class="item-content item-input item-input-outline">
                <div class="item-inner">
                    <div class="item-title item-floating-label">${labelText}</div>
                    <div class="item-input-wrap">
                        <div class="item-media">
                            <i class="icon material-icons">memory</i>
                        </div>
                        <select name="${fieldName}" required>
                            ${options}
                        </select>
                        <span class="input-clear-button"></span>
                    </div>
                </div>
            </div>
        `;
            }
        }

        container.innerHTML = html;
    };
    // Dislike reasons
    const unlikeReasons = [
        {
            value: "no_solution",
            reason: "Doesn't solve the issue",
            description: "I followed the steps but the problem persists."
        },
        {value: "incorrect", reason: "Contains errors", description: "The information or steps are wrong."},
        {value: "incomplete", reason: "Missing information", description: "Key steps or details are omitted."},
        {
            value: "unclear",
            reason: "Hard to understand",
            description: "The instructions are confusing or too technical."
        },
        {
            value: "not_applicable",
            reason: "Not applicable to my setup",
            description: "The steps don't fit my hardware or configuration."
        },
        {value: "other", reason: "Other (please specify)", description: "The issue doesn't match any of the above."}
    ];

    let activateAssistantChip = function() {
        // Si no hay asistente original, guardar el actual como original
        if (!originalAssistant && assistant) {
            originalAssistant = { ...assistant };
            console.log('?? Original assistant set:', originalAssistant.name);
        }

        // Verificar si debemos mostrar el chip
        const shouldShow = assistant && originalAssistant && assistant.guid !== originalAssistant.guid;

        if (shouldShow !== showAssistantChip) {
            showAssistantChip = shouldShow;
            console.log(shouldShow ? '? Showing assistant chip' : '? Hiding assistant chip');
            $update(); // ? USAR $update() en lugar de manipular DOM
        }
    };
    let returnToOriginalAssistant = function() {
        if (originalAssistant) {
            console.log('?? Returning to original assistant:', originalAssistant.name);

            // Cambiar al asistente original usando tu funci�n existente
            switchAssistant(originalAssistant.guid);

            // El chip se ocultar� autom�ticamente por la l�gica de activateAssistantChip
            // que se ejecuta en switchAssistant ? updateTemplate

            // Toast de confirmaci�n
            $f7.toast.show({
                text: `Going back to ${originalAssistant.name}`,
                position: 'center',
                closeTimeout: 2000,
                cssClass: 'color-blue'
            });

            // Enfocar textarea
            textAreaFocus(prompt)
        }
    };
    // ===========================================
    // TEMPLATE DATA SYNC FUNCTION
    // ===========================================

    /**
     * Syncs SIMBA managers data to template variables
     * Call this before every $update()
     */
    function syncTemplateData() {
        highlights = highlightManager.getAll();
        sources = sourceManager.getTempSources();
        showCenteredBar = messageManager.getHistory().length === 1;
        showBottomBar = messageManager.getHistory().length > 1;
        config = configManager.getConfig();
    }

    /**
     * Enhanced update function that syncs data before updating template
     */
    function updateTemplate() {
        syncTemplateData();
        activateAssistantChip();
        $update();
    }

    // ===========================================
    // MARKDOWN SETUP
    // ===========================================

    hljs.registerLanguage('stask', function (hljs) {
        return hljs.getLanguage('json');
    });

    let md = window.markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return '<pre class="no-margin-top hljs" data-lang="' + lang + '"><code class="cod-with-auto">' +
                        hljs.highlight(str.replace('<span class="thinking-icon">' + (assistant?.thinkIcon || '') + '</span>', '').replace('```', ""), {
                            language: lang,
                            ignoreIllegals: true
                        }).value +
                        '</code></pre>';
                } catch (__) {
                }
            }
            return '<pre class="no-margin-top hljs"><code>' + md.utils.escapeHtml(str.replace('<span class="thinking-icon">' + (assistant?.thinkIcon || '') + '</span>', '').replace('```', "")) + '</code></pre>';
        }
    }).use(window.texmath, {engine: window.katex, delimiters: 'brackets'});

    let chartGenerator = null;

// En la funci�n de inicializaci�n, agregar:
    let initializeChartGenerator = function() {
        if (typeof ChartGenerator !== 'undefined') {
            chartGenerator = new ChartGenerator();
            console.log('? ChartGenerator initialized');
        } else {
            console.warn('? ChartGenerator not available. Make sure Chart.js and ChartGenerator.js are loaded.');
        }
    };

// 2. FUNCI�N PARA CREAR GR�FICA DESDE TABLA
// ----------------------------------------------------------------------------

    let createChartFromTable = function(tableId, chartType = 'auto') {
        if (!chartGenerator) {
            $f7.toast.show({
                text: 'Chart generator not available',
                position: 'center',
                closeTimeout: 3000,
                cssClass: 'color-red'
            });
            return;
        }

        try {
            // Encontrar la tabla y su contenedor padre
            const table = document.getElementById(tableId);
            if (!table) {
                throw new Error(`Table with ID '${tableId}' not found`);
            }

            const parentContainer = table.closest('.table-container') || table.parentElement;
            const parentId = parentContainer.id || `chart_container_${Date.now()}`;

            // Asignar ID al contenedor si no lo tiene
            if (!parentContainer.id) {
                parentContainer.id = parentId;
            }

            // Crear la gr�fica en modo append (agregar despu�s de la tabla)
            const chart = chartGenerator.createChart(tableId, parentId, chartType, 'append', 'auto');

            console.log('? Chart created successfully from table:', tableId);

            $f7.toast.show({
                text: 'Chart created successfully!',
                position: 'center',
                closeTimeout: 2000,
                cssClass: 'color-green'
            });

            return chart;

        } catch (error) {
            console.error('? Error creating chart:', error);

            $f7.toast.show({
                text: `Error creating chart: ${error.message}`,
                position: 'center',
                closeTimeout: 4000,
                cssClass: 'color-red'
            });
        }
    };

// 3. FUNCI�N PARA MOSTRAR SELECTOR DE TIPO DE GR�FICA
// ----------------------------------------------------------------------------

    let showChartTypeSelector = function(tableId) {
        const chartTypes = [
            { value: 'auto', label: '?? Auto (Recommended)', description: 'Let the system choose the best chart type' },
            { value: 'bar', label: '?? Bar Chart', description: 'Vertical bars for comparing categories' },
            { value: 'horizontalBar', label: '?? Horizontal Bar', description: 'Horizontal bars for long category names' },
            { value: 'line', label: '?? Line Chart', description: 'Line chart for trends over time' },
            { value: 'pie', label: '?? Pie Chart', description: 'Circular chart for parts of a whole' },
            { value: 'doughnut', label: '?? Doughnut Chart', description: 'Doughnut chart with center space' }
        ];

        const buttons = chartTypes.map(type => ({
            text: `<div style="text-align: left;">
             <div style="font-weight: bold; margin-bottom: 4px;">${type.label}</div>
             <div style="font-size: 12px; color: #666;">${type.description}</div>
           </div>`,
            onClick: () => createChartFromTable(tableId, type.value)
        }));

        buttons.push({
            text: 'Cancel',
            color: 'red'
        });

        $f7.actions.create({
            buttons: [buttons]
        }).open();
    };
    // ===========================================
    // CORE FUNCTIONS USING SIMBA MANAGERS
    // ===========================================

    // Funci�n para guardar mensaje
    let saveMessageToConversation = function(role, content, messageId, metadata = {}) {
        // Solo crear conversaci�n si no existe Y si es un mensaje real (no sistema)
        if (!conversationManager.currentConversationId && (role === 'user' || role === 'assistant')) {
            // Crear conversaci�n en este momento
            conversationManager.createConversation(assistant, chat.title, myDevice).then(() => {
                console.log('Conversation created with first real message');

                // Guardar el mensaje simple
                const messageData = {
                    role,
                    content,
                    id: messageId
                };

                return conversationManager.saveMessage(messageData, {
                    sources: sourceManager.getTempSources(),
                    device: myDevice,
                    files: window.myFileDropzone ? window.myFileDropzone.getFiles() : [],
                    ...metadata
                });
            }).catch(error => {
                console.error('Error creating conversation and saving message:', error);
            });
        } else if (conversationManager.currentConversationId && (role === 'user' || role === 'assistant')) {
            // Ya existe conversaci�n, guardar mensaje simple
            const messageData = {
                role,
                content,
                id: messageId
            };

            conversationManager.saveMessage(messageData, {
                sources: sourceManager.getTempSources(),
                device: myDevice,
                files: window.myFileDropzone ? window.myFileDropzone.getFiles() : [],
                ...metadata
            }).catch(error => {
                console.error('Error saving message:', error);
            });
        }
    };
    /**
     * Creates a new conversation using the chat API
     */
    let createConversation = function (guid) {
        /*if (conversationManager && conversationManager.currentConversationId && chat.guid) {
            console.log('Using existing loaded conversation:', conversationManager.currentConversationId);
            return Promise.resolve({ data: chat });
        }*/
        return new Promise((resolve, reject) => {
            $f7.request({
                url: `${window.config.api_methods.create_chat}?assistant=` + guid,
                method: 'GET',
                headers: {
                    'x-auth-token': window.config.token,
                    'Content-Type': 'application/json'
                },
                dataType: 'json'
            }).then((response) => {
                chat = response.data.data;
                chat.noSelectionInstructions = chat.instructions ? chat.instructions.filter(instruction => !instruction.isSelection) : [];

                // NO crear la conversaci�n aqu� autom�ticamente
                // conversationManager.createConversation(assistant, chat.title, myDevice)

                // Update message manager with system message
                messageManager.updateSystemMessage(chat.mainAssistant.system);

                // Initialize tool manager now that we have chat
                toolManager = new window.SIMBA.ToolManager(chat, configManager.getConfig());

                assistant.name = chat.mainAssistant.name;
                assistant.avatar = window.config.domain + chat.mainAssistant._myMedias.avatars[0].realPath;
                assistant.mainImage = window.config.domain + chat.mainAssistant._myMedias.mainImage[0].realPath;
                assistant.greeting = chat.mainAssistant.greeting;
                assistant.placeholder = chat.mainAssistant.placeholder;
                assistant.thinkIcon = chat.mainAssistant.thinkIcon || '??';
                //assistant.analyzeImage = chat.mainAssistant.analizeImages.command

                updateTemplate();
                updateDropzoneState();
                initializeActiveTools();
                updateChatTools();
                console.log('Conversation created:', response.data);
                resolve(response.data);
            }).catch((error) => {
                console.error('Error creating conversation:', error);
                reject(error);
            });
        });
    };
    let startNewConversation = function() {
        console.log('🆕 Starting new conversation with current assistant');

        if (!assistant || !assistant.guid) {
            console.error('No active assistant');
            $f7.toast.show({
                text: 'No assistant selected',
                cssClass: 'color-red'
            });
            return;
        }

        // Guardar el GUID del asistente actual
        const currentAssistantGuid = assistant.guid;

        // Navegar a nueva conversación pasando el asistente actual
        $f7router.navigate(`/screens/conversation/new?assistant=${currentAssistantGuid}`, {
            reloadCurrent: true,
            clearPreviousHistory: false
        });
    };
    let openTask = function(){
        popupTask.open();
    }
    //FUNCIONES PARA TOOLS
    let initializeActiveTools = function() {
        console.log('Initializing active tools...');

        if (chat && chat.tools && Array.isArray(chat.tools)) {
            activeTools = {};
            chat.tools.forEach((tool, index) => {
                const toolName = tool.function?.name || `tool_${index}`;
                activeTools[toolName] = true;
            });
            console.log('Tools initialized as active:', activeTools);

            // Forzar re-render despu�s de un tick
            setTimeout(() => {
                updateTemplate();
            }, 100);
        } else {
            activeTools = {};
        }
    };

    let isImageUploadAllowed = function() {
        return chat &&
            chat.mainAssistant &&
            chat.mainAssistant.analizeImages.command !== 'iaAssistant_analizeImages_No_allowed';
    };

    let getImageAnalysisType = function() {
        if (!chat || !chat.mainAssistant) return null;

        switch(chat.mainAssistant.analizeImages.command) {
            case 'iaAssistant_analizeImages_OCR':
                return 'OCR';
            case 'iaAssistant_analizeImages_Vision':
                return 'Vision';
            case 'iaAssistant_analizeImages_No_allowed':
                return null;
            default:
                return 'Vision'; // valor por defecto
        }
    };
    let toggleTool = function(toolKey, isActive) {
        activeTools[toolKey] = isActive;
        console.log(`Tool ${toolKey} ${isActive ? 'activated' : 'deactivated'}`);

        // Actualizar el chat.tools para reflejar los cambios
        updateChatTools();
        updateTemplate();
    };
    let updateChatTools = function() {
        if (!chat || !chat.tools) return;

        // Crear nueva array solo con tools activas
        const activeToolsArray = [];
        chat.tools.forEach((tool, index) => {
            const toolName = tool.function?.name || `tool_${index}`;
            if (activeTools[toolName] === true) {
                activeToolsArray.push(tool);
            }
        });

        chat.activeTools = activeToolsArray;
        console.log('Active tools updated:', activeToolsArray);
    };
    //FIN FUNCIONES PARA TOOLS
    /**
     * Loads available assistants
     */
    let loadAssistants = function () {
        return new Promise((resolve, reject) => {
            $f7.request({
                url: window.config.api_methods.load_assistants,
                method: 'GET',
                headers: {
                    'X-AUTH-TOKEN': window.config.token
                },
                success: function (responseText) {
                    var data = JSON.parse(responseText);
                    assistants = data.data.assistants;
                    quick_actions = data.data.quick_actions;

                    // Initialize mention manager with assistants
                    mentionManager = new window.SIMBA.AssistantMentionManager(assistants, switchAssistant);

                    if (assistants.length > 0) {
                        if ('assistant' in $f7route.query) {
                            assistant = assistants.find(assistant => assistant.guid === $f7route.query.assistant);
                        } else {
                            assistant = assistants[0];
                            switchAssistant(assistant.guid);
                        }
                        if (!originalAssistant && assistant) {
                            originalAssistant = { ...assistant };
                            console.log('?? Initial original assistant:', originalAssistant.name);
                        }
                        updateTemplate();
                        resolve({assistant: assistant, quick_actions: quick_actions});
                    } else {
                        console.error("The 'assistants' array is empty.");
                        resolve({assistant: null, quick_actions: quick_actions});
                    }
                },
                error: function (xhr, status, error) {
                    $f7.toast.show({
                        text: 'An error occurred: ' + error,
                        cssClass: 'color-red'
                    });
                    reject(error);
                }
            });
        });
    };

    let switchAssistant = async function (guid) {
        let foundAssistant = assistants.find(item => item.guid === guid);

        if (!foundAssistant) {
            console.error("No assistant found with the specified GUID.");
            return;
        }

        console.log('🔄 Switching assistant to:', foundAssistant.name);

        // 1. Guardar asistente anterior
        assistant = foundAssistant;

        // 2. Activar chip para volver al original (si aplica)
        activateAssistantChip();

        // 3. Cargar configuración completa del nuevo asistente
        try {
            const assistantData = await loadAssistantData(guid);

            if (assistantData) {
                // Actualizar chat con la configuración del nuevo asistente
                chat.mainAssistant = assistantData.mainAssistant;
                chat.tools = assistantData.tools || [];
                chat.tools_setup = assistantData.tools_setup || {};
                chat.activeTools = assistantData.tools || [];
                chat.instructions = assistantData.instructions || [];
                chat.noSelectionInstructions = (assistantData.instructions || []).filter(
                    instruction => !instruction.isSelection
                );

                // Actualizar información del asistente en la UI
                assistant.name = assistantData.mainAssistant.name;
                assistant.avatar = window.config.domain + assistantData.mainAssistant._myMedias.avatars[0].realPath;
                assistant.mainImage = window.config.domain + assistantData.mainAssistant._myMedias.mainImage[0].realPath;
                assistant.greeting = assistantData.mainAssistant.greeting;
                assistant.placeholder = assistantData.mainAssistant.placeholder;
                assistant.thinkIcon = assistantData.mainAssistant.thinkIcon || '🤔';

                // Actualizar system prompt AGREGANDO el del nuevo asistente (no reemplazando)
                if (assistantData.mainAssistant.system) {
                    const currentSystem = messageManager.messagesHistory[0]?.content || '';

                    // Si ya hay historial, agregar contexto del nuevo asistente
                    if (messageManager.getHistory().length > 1) {
                        const additionalContext = `\n\n--- ASSISTANT SWITCH ---\nYou are now ${assistantData.mainAssistant.name}. ${assistantData.mainAssistant.system}\nPlease continue the conversation maintaining context of previous messages.`;
                        messageManager.updateSystemMessage(currentSystem + additionalContext);
                    } else {
                        // Si no hay historial, usar el system prompt del nuevo asistente
                        messageManager.updateSystemMessage(assistantData.mainAssistant.system);
                    }
                }

                // Reinicializar tool manager con la nueva configuración
                toolManager = new window.SIMBA.ToolManager(chat, configManager.getConfig());
                initializeActiveTools();
                updateChatTools();

                // Actualizar dropzone según capacidades del nuevo asistente
                updateDropzoneState();

                console.log('✅ Assistant switched successfully, conversation maintained');
            }
        } catch (error) {
            console.error('Error loading assistant data:', error);
            $f7.toast.show({
                text: 'Error switching assistant',
                cssClass: 'color-red'
            });
            return;
        }

        // 4. Actualizar UI
        updateTemplate();
        textAreaFocus();

        // 5. Mostrar confirmación
        $f7.toast.show({
            text: `Switched to ${foundAssistant.name}`,
            position: 'center',
            closeTimeout: 2000,
            cssClass: 'color-blue'
        });
    };

    /**
     * Calls a tool using the tool manager
     */
    let callTool = async function (name, params) {
        console.log(`Calling tool: ${name} with params:`, params);
        if (params.title) {
            // Actualizar t�tulo local
            chat.title = params.title;

            // Actualizar en ConversationManager
            if (conversationManager && conversationManager.currentConversationId) {
                conversationManager.updateConversationTitle(conversationManager.currentConversationId, chat.title)
                    .then(() => {
                        updateTemplate();
                    })
                    .catch(error => {
                        console.error('Error updating conversation title:', error);
                        updateTemplate();
                    });
            } else {
                updateTemplate();
            }
        }
        if (!toolManager) {
            console.error('Tool manager not initialized');
            return Promise.reject(new Error('Tool manager not initialized'));
        }

        const toolSetup = chat.tools_setup?.[name] || {};
        const inProgressMessage = toolSetup.in_progress_message || 'Calling tool';
        const toolIcon = toolSetup.icon || "fa-database";
        const humanReadableMessage = `<p><div class="call-execution shimmer-text-fast"><i class="fa ${toolIcon} margin-right-half"></i>${inProgressMessage} <strong>${params.text || ''}</strong></div></p>`;

        $el.value.find('.message:last-child .message-text').html(humanReadableMessage);

        if (toolSetup.ask_for_execution && name === "action_open_support_ticket") {
            ticket = params;
            updateTemplate();
            openPopupTicket();
            return Promise.resolve({status: 'awaiting_user_confirmation'});
        }
        if (toolSetup.ask_for_execution && name === 'action_simba_agent_switcher') {
            const agentGuid = params.guid;
            const userPrompt = params.user_prompt || '';

            // Buscar el agente para obtener su informaci�n
            const targetAgent = assistants.find(a => a.guid === agentGuid);

            // CAMBIO: Usar el nombre del agente encontrado, no params.name
            const agentName = targetAgent ? targetAgent.name : (params.name || 'this agent');
            const agentAvatar = targetAgent ? targetAgent.avatar : '';

            // Crear di�logo personalizado con Framework7
            const dialog = $f7.dialog.create({
                title: 'Switch Assistant',
                content: `
        <div style="text-align: center; padding: 20px;">
            ${agentAvatar ? `<img src="${agentAvatar}" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 15px; " />` : ''}
            <p style="font-size: 16px; margin-bottom: 10px;">
                Your question can be better answered by <strong>${agentName}</strong>.
            </p>
            <p style="font-size: 14px; color: #666;">
                Do you want to switch to this assistant?
            </p>
            ${userPrompt ? `
                <div style="padding: 10px; border-radius: 5px; margin-top: 15px; text-align: left;">
                    <small style="color: #999;">Your question:</small>
                    <p style="margin: 5px 0 0 0; font-size: 13px;">"${userPrompt}"</p>
                </div>
            ` : ''}
        </div>
    `,
                buttons: [
                    {
                        text: 'Cancel',
                        onClick: () => {
                            $f7.toast.create({
                                text: 'Switch canceled',
                                closeTimeout: 2000,
                                cssClass: 'color-orange'
                            }).open();
                        }
                    },
                    {
                        text: 'Switch',
                        bold: true,
                        onClick: () => {
                            // Cambiar al nuevo asistente
                            switchAssistant(agentGuid);

                            // Si hay prompt del usuario, ponerlo en el textarea
                            if (userPrompt) {
                                const textarea = document.getElementById('prompt');
                                if (textarea) {
                                    textarea.value = userPrompt;
                                    prompt = userPrompt;

                                    updateTemplate();

                                    setTimeout(() => {
                                        textarea.focus();
                                        textarea.setSelectionRange(userPrompt.length, userPrompt.length);
                                    }, 100);
                                }
                            }

                            $f7.toast.create({
                                text: `Switched to ${agentName}`,
                                closeTimeout: 2000,
                                cssClass: 'color-green'
                            }).open();
                        }
                    }
                ],
                verticalButtons: false
            });

            dialog.open();

            return Promise.resolve({
                status: 'awaiting_user_confirmation',
                agent: agentName,
                userPrompt: userPrompt
            });
        }


        if (toolSetup.ask_for_execution && name === "action_vision_request") {
            // Extraer par�metros
            const imageName = params.image_name;
            const visionPrompt = params.prompt || params.text || "Describe detalladamente la siguiente imagen";

            console.log("Vision request for image:", imageName, "with prompt:", visionPrompt);

            // Buscar la imagen en sentImages
            if (loadedImages[imageName]) {
                const imageData = loadedImages[imageName];
                // Mostrar indicador de procesamiento
                const humanReadableMessage = `<p><div class="call-execution shimmer-text-fast"><i class="fa fa-eye margin-right-half"></i>Analyzing image</div></p>`;
                $el.value.find('.message:last-child .message-text').html(humanReadableMessage);
                // Llamar a la funci�n de an�lisis de imagen del FileDropzone
                if (window.myFileDropzone) {
                    return window.myFileDropzone._analyzeImageWithVision(imageData.file, visionPrompt, false)
                        .then(function(analysisResult) {
                            console.log("Vision re-analysis completed:", analysisResult);
                            // Actualizar en sentImages
                            loadedImages[imageName].extractedText = analysisResult;
                            loadedImages[imageName].lastAnalysis = {
                                prompt: visionPrompt,
                                result: analysisResult,
                                timestamp: Date.now()
                            };

                            // Quitar indicador de procesamiento
                            $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                            // NUEVO: Crear el contenido con formato simba_image
                            const visionAnalysisContent = `<simba_image data-filename="${imageName}">\n${analysisResult}\n</simba_image>`;

                            // NUEVO: Agregar como mensaje de usuario al historial
                            messageManager.addMessage('user', visionAnalysisContent);

                            // NUEVO: Crear un nuevo mensaje del asistente para la respuesta final
                            const finalResponseMsgId = window.SIMBA.Utils.generateUniqueId("assistant-vision-response");

                            messages.addMessage({
                                attrs: {"data-id": finalResponseMsgId, "id": finalResponseMsgId},
                                isTitle: false,
                                text: '<p><span class="thinking-icon">' + (assistant?.thinkIcon || '??') + '</span></p>',
                                name: assistant.name,
                                cssClass: 'card no-margin-top padding-half',
                                textFooter: footerTemplate,
                                avatar: assistant.avatar,
                                type: 'received',
                            }, 'append', true);

                            onMessageAdded($('#' + finalResponseMsgId));

                            // NUEVO: Llamar a callCompletion para que el LLM genere una respuesta final
                            return callCompletion(false, finalResponseMsgId)
                                .then(() => {
                                    console.log("LLM response generated after vision analysis");

                                    return {
                                        status: 'completed',
                                        result: analysisResult,
                                        imageName: imageName,
                                        prompt: visionPrompt,
                                        llmResponseGenerated: true
                                    };
                                })
                                .catch(error => {
                                    console.error("Error generating LLM response:", error);

                                    // En caso de error, mostrar al menos el an�lisis de visi�n
                                    const fallbackMessage = `<p><strong>An�lisis de imagen completado:</strong></p><p><em>Imagen:</em> ${imageName}</p><p><em>Prompt:</em> ${visionPrompt}</p><hr><p>${analysisResult}</p><p><em>Error generando respuesta adicional: ${error.message}</em></p>`;
                                    $('#' + finalResponseMsgId).find('.message-text').html(fallbackMessage);

                                    return {
                                        status: 'completed_with_errors',
                                        result: analysisResult,
                                        imageName: imageName,
                                        prompt: visionPrompt,
                                        error: error.message
                                    };
                                });
                        })
                        .catch(function(error) {
                            console.error("Error in vision re-analysis:", error);

                            $(".shimmer-text-fast").removeClass("shimmer-text-fast");
                            const errorMessage = `<p><strong>Error analizando imagen:</strong> ${error.message}</p>`;
                            $el.value.find('.message:last-child .message-text').html(errorMessage);

                            return {
                                status: 'error',
                                error: error.message,
                                imageName: imageName
                            };
                        });
                } else {
                    console.error("FileDropzone not available");
                    return Promise.resolve({
                        status: 'error',
                        error: 'FileDropzone no disponible'
                    });
                }
            } else {
                console.error("Image not found:", imageName);
                const errorMessage = `Imagen "${imageName}" no encontrada en las im�genes cargadas`;
                $el.value.find('.message:last-child .message-text').html(errorMessage);

                return Promise.resolve({
                    status: 'error',
                    error: 'Imagen no encontrada'
                });
            }
        }
        sourceManager.setTempSources([]);

        return toolManager.callTool(name, params, myDevice)
            .then(toolResponse => {
                console.log("Tool call completed successfully:", toolResponse);

                if (toolResponse.data?.data?.tool_domain === 'action') {
                    console.log("Action tool processed", toolResponse.data);
                    return toolResponse;
                }

                if (toolResponse.data?.data?.sources) {
                    const sourcesData = toolResponse.data.data.sources;
                    sourceManager.setTempSources(sourcesData);

                    if (sourcesData.some(source => source.text)) {
                        const simbaPrompt = sourceManager.buildSimbaPrompt(sourcesData);
                        messageManager.updateSystemMessage(
                            messageManager.getHistory()[0].content +
                            '\n\n\n\nPLEASE USE THIS RETRIEVED CONTEXT FOR ANSWERING:\n\n' +
                            simbaPrompt
                        );

                        $(".shimmer-text-fast").removeClass("shimmer-text-fast");
                        return {...toolResponse, sourcesAdded: true};
                    } else {
                        return handleNoSourcesFound();
                    }
                } else {
                    return handleUnexpectedResponse(toolResponse);
                }
            })
            .catch(error => {
                console.error("Tool call failed:", error);
                return handleToolError(error);
            });
    };

    /**
     * Handles the case when no sources are found
     */
    let handleNoSourcesFound = function () {
        console.log("No relevant sources found");
        const noInfoMsgId = window.SIMBA.Utils.generateUniqueId("assistant-no-info");

        messages.addMessage({
            attrs: {"data-id": noInfoMsgId, "id": noInfoMsgId},
            isTitle: false,
            text: '<p>Sorry, no records were found. Please rephrase your question.</p>',
            name: assistant.name,
            cssClass: 'card no-margin-top padding-half',
            textFooter: footerTemplate,
            avatar: assistant.avatar,
            type: 'received',
        }, 'append', true);

        onMessageAdded($('#' + noInfoMsgId));
        saveSourcesForMessage(noInfoMsgId);

        messageManager.addMessage('assistant', "Sorry, no records were found. Please rephrase your question.",null,noInfoMsgId);
        saveMessageToConversation('assistant', "Sorry, no records were found. Please rephrase your question.", noInfoMsgId);
        return callCompletion(false, noInfoMsgId)
            .then(() => ({sourcesAdded: false, messageId: noInfoMsgId}));
    };

    /**
     * Handles unexpected tool responses
     */
    let handleUnexpectedResponse = function (response) {
        console.log("Unexpected response structure");
        const structureErrorMsgId = window.SIMBA.Utils.generateUniqueId("assistant-structure-error");

        messages.addMessage({
            attrs: {"data-id": structureErrorMsgId, "id": structureErrorMsgId},
            isTitle: false,
            text: '<p>Processing your query...</p>',
            name: assistant.name,
            cssClass: 'card no-margin-top padding-half',
            textFooter: footerTemplate,
            avatar: assistant.avatar,
            type: 'received',
        }, 'append', true);

        onMessageAdded($('#' + structureErrorMsgId));
        saveSourcesForMessage(structureErrorMsgId);

        const lastUserQuestion = getLastUserQuestion();
        messageManager.addMessage('user',
            `Regarding my question: "${lastUserQuestion}", there was a problem trying to find additional information. Please respond based on your general knowledge and mention any limitations in your response.`
        );

        return callCompletion(false, structureErrorMsgId)
            .then(() => ({sourcesAdded: true, messageId: structureErrorMsgId}));
    };

    /**
     * Handles tool execution errors
     */
    let handleToolError = function (error) {
        console.error("Tool execution error:", error);
        const apiErrorMsgId = window.SIMBA.Utils.generateUniqueId("assistant-api-error");

        messages.addMessage({
            attrs: {"data-id": apiErrorMsgId, "id": apiErrorMsgId},
            isTitle: false,
            text: '<p>Processing your query...</p>',
            name: assistant.name,
            cssClass: 'card no-margin-top padding-half',
            textFooter: footerTemplate,
            avatar: assistant.avatar,
            type: 'received',
        }, 'append', true);

        onMessageAdded($('#' + apiErrorMsgId));
        saveSourcesForMessage(apiErrorMsgId);

        const lastUserQuestion = getLastUserQuestion();
        messageManager.addMessage('user',
            `Regarding my question: "${lastUserQuestion}", there was an error trying to connect to the information source. Please respond based on your general knowledge and mention any limitations in your response.`
        );

        return callCompletion(false, apiErrorMsgId)
            .then(() => ({sourcesAdded: true, messageId: apiErrorMsgId}));
    };

    /**
     * Gets the last user question from message history
     */
    let getLastUserQuestion = function () {
        const history = messageManager.getHistory();
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') {
                return history[i].content;
            }
        }
        return "";
    };

    /**
     * Saves sources for a specific message
     */
    let saveSourcesForMessage = function (messageId, params = {}) {
        const tempSources = sourceManager.getTempSources();
        if (tempSources.length > 0) {
            sourceManager.saveToStorage(messageId, tempSources, params);
            console.log('Sources saved for message:', messageId);
        }
    };
    let makeClickableReferences = function() {
        // Primero agrupamos las referencias consecutivas
        groupConsecutiveReferences();

        $(".reference").each(function () {
            $(this).off('click');
            $(this).on("click", function (e) {
                openPopoverText(e);
            });

            const $parentLi = $(this).closest('li');
            if ($parentLi.length) {
                $parentLi.css('list-style-type', 'none');
            }
        });
    }
    let makeClickableSuggestions = function() {
        $(".simba-suggestion").each(function() {
            $(this).off('click'); // Remover listeners anteriores
            $(this).on("click", function(e) {
                e.preventDefault();
                e.stopPropagation();

                const suggestionText = $(this).attr('data-content');
                const suggestionId = $(this).attr('data-id');

                console.log('Suggestion clicked:', suggestionId, suggestionText);

                // Poner el texto en el textarea
                const textarea = document.getElementById('prompt');
                if (textarea) {
                    textarea.value = suggestionText;
                    prompt = suggestionText;

                    // Actualizar template
                    updateTemplate();

                    // Hacer focus y enviar autom�ticamente
                    setTimeout(() => {
                        textarea.focus();

                        // Opcional: enviar autom�ticamente
                         sendPrompt();

                        // O simplemente posicionar el cursor al final para que el usuario revise
                        //textarea.setSelectionRange(suggestionText.length, suggestionText.length);
                    }, 100);
                }

                // Toast de confirmaci�n
                if ($f7) {
                    $f7.toast.show({
                        text: 'Suggestion loaded. Click send to submit.',
                        position: 'center',
                        closeTimeout: 2000,
                        cssClass: 'color-blue'
                    });
                }
            });
        });
    };

// Variable global para manejar el grupo actual
    let currentReferenceGroup = null;
    let currentReferenceIndex = 0;

    function groupConsecutiveReferences() {
        const referenceGroups = [];
        let currentGroup = [];

        $(".reference").each(function(index) {
            const $current = $(this);
            const $next = $current.next('.reference');

            // Si es la primera referencia o la anterior no era una referencia, inicia nuevo grupo
            if (currentGroup.length === 0) {
                currentGroup.push($current);
            } else {
                currentGroup.push($current);
            }

            // Si no hay siguiente referencia o la siguiente no es consecutiva, cierra el grupo
            if ($next.length === 0 || $current.next()[0] !== $next[0]) {
                if (currentGroup.length > 1) {
                    referenceGroups.push([...currentGroup]);
                    processReferenceGroup(currentGroup);
                }
                currentGroup = [];
            }
        });
    }

    function processReferenceGroup(group) {
        // Ocultar todas las referencias del grupo excepto la primera
        for (let i = 1; i < group.length; i++) {
            group[i].hide();
        }

        // A�adir indicador de grupo a la primera referencia
        const $firstRef = group[0];
        $firstRef.addClass('reference-group-main');
        $firstRef.attr('data-group-size', group.length);

        // Modificar el texto para mostrar el n�mero anexado
        const $spans = $firstRef.find('span');
        let originalText, $targetElement;

        if ($spans.length > 0) {
            $targetElement = $spans.last();
            originalText = $targetElement.text();
        } else {
            $targetElement = $firstRef;
            originalText = $firstRef.text();
        }

        const cleanText = originalText.replace(/\s*\+\d+$/, ''); // Remover +n�mero si ya existe
        const newText = `${cleanText} +${group.length}`;

        // Guardar el texto original para poder restaurarlo
        $firstRef.attr('data-original-text', cleanText);

        // Actualizar el texto mostrado
        $targetElement.text(newText);

        // Guardar todas las referencias del grupo en data
        $firstRef.data('referenceGroup', group);
    }

// 1. MANTENER openPopoverText ORIGINAL (sin cambios)
    let openPopoverText = function (event) {
        const targetElement = event.target;
        const $target = $(targetElement);

        // Verificar si es parte de un grupo
        const referenceGroup = $target.data('referenceGroup');

        if (referenceGroup && referenceGroup.length > 1) {
            currentReferenceGroup = referenceGroup;
            currentReferenceIndex = 0;
            openPopoverForGroupedReference();
        } else {
            openPopoverForSingleReference(targetElement);
        }
    };

// 1. openPopoverForSingleReference - SIN isDropzoneFile
    function openPopoverForSingleReference(targetElement) {
        const guid = $(targetElement).attr('data-guid');
        const messageElement = $(targetElement).closest('.message');
        const messageId = messageElement.attr('id');

        const page = parseInt($(targetElement).attr('data-page'), 10) || undefined;
        const section = parseInt($(targetElement).attr('data-section'), 10) || undefined;
        const name = $(targetElement).attr('data-filename') || 'Reference not found';
        const content = $(targetElement).attr('data-content') || 'Could not find reference information.';

        const sources = JSON.parse(localStorage.getItem('sources') || '{}');
        const result = getObjectAndTextByGuid(sources, guid, page, section);

        if (!result) {
            myReference = {
                name,
                page: page || "",
                section: section || "",
                content: "..." + content + "...",
                searchText: content,
                fileName: name
            };
        } else {
            const sourceUrl = result.sourceObject.source;
            const finalSource = (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'))
                ? sourceUrl
                : 'https://itc.simeng.es/' + sourceUrl;

            myReference = {
                name: result.sourceObject.id || result.sourceObject.name || "No name",
                page: page || (result.sourceObject.extra && result.sourceObject.extra.page) || "",
                section: section || (result.sourceObject.extra && result.sourceObject.extra.section) || "",
                content: result.extractedText || "No content",
                source: finalSource + '#phrase=true&page=' + page + '&search=' + result.extractedText,
                searchText: content,
                fileName: name
            };
        }

        popoverText.open(targetElement);
        updateTemplate();
        bindPopoverEvents(messageId, guid);
    }

// 2. openPopoverForGroupedReference - SIN isDropzoneFile
    function openPopoverForGroupedReference() {
        const currentRef = currentReferenceGroup[currentReferenceIndex];
        const targetElement = currentRef[0];

        const guid = currentRef.attr('data-guid');
        const messageElement = currentRef.closest('.message');
        const messageId = messageElement.attr('id');

        const page = parseInt(currentRef.attr('data-page'), 10) || undefined;
        const section = parseInt(currentRef.attr('data-section'), 10) || undefined;
        const name = currentRef.attr('data-filename') || 'Reference not found';
        const content = currentRef.attr('data-content') || 'Could not find reference information.';

        const sources = JSON.parse(localStorage.getItem('sources') || '{}');
        const result = getObjectAndTextByGuid(sources, guid, page, section);

        if (!result) {
            myReference = {
                name,
                page: page || "",
                section: section || "",
                content: "..." + content + "...",
                searchText: content,
                fileName: name
            };
        } else {
            const sourceUrl = result.sourceObject.source;
            const finalSource = (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://'))
                ? sourceUrl
                : 'https://itc.simeng.es/' + sourceUrl;

            myReference = {
                name: result.sourceObject.id || result.sourceObject.name || "No name",
                page: page || (result.sourceObject.extra && result.sourceObject.extra.page) || "",
                section: section || (result.sourceObject.extra && result.sourceObject.extra.section) || "",
                content: result.extractedText || "No content",
                source: finalSource + '#phrase=true&page=' + page + '&search=' + result.extractedText,
                searchText: content,
                fileName: name
            };
        }

        popoverText.open(targetElement);
        updateTemplate();
        bindPopoverEvents(messageId, guid);
    }

// 3. bindPopoverEvents - SIMPLIFICADO, solo chequea loadedFiles
    function bindPopoverEvents(messageId, guid) {
        $update(function () {
            $("#view-source").on('click', function () {
                openSourcePanel(messageId);
                $(".source").parent().removeClass('bg-color-chrome');
                $(".source[id='" + guid + "']").parent().addClass('bg-color-chrome');
            });
            $("#view-document").off('click');
            $("#view-document").on('click', function () {
                const fileName = myReference.fileName;

                // 🎯 SIMPLE: ¿Existe en loadedFiles?
                const fileData = loadedFiles[fileName];

                if (fileData) {
                    // 📁 ES UN ARCHIVO DEL DROPZONE
                    const fileExtension = fileName.split('.').pop().toLowerCase();

                    const searchQuery = myReference.searchText || myReference.content;
                    const pageNumber = myReference.page ? parseInt(myReference.page) : 1;

                    if (fileExtension === 'pdf' || fileData.fileType === 'pdf') {
                        // 📄 ABRIR PDF
                        console.log('📄 Opening PDF from loadedFiles:', {
                            fileName,
                            searchQuery,
                            pageNumber,
                            hasFile: !!fileData.file
                        });

                        if (window.myFileDropzone) {
                            // 🎯 USAR LA NUEVA FUNCIÓN
                            window.myFileDropzone.showPdfInSplitViewFromFile(
                                fileData.file,  // ✅ File object de loadedFiles
                                fileName,
                                searchQuery,
                                pageNumber
                            );
                        }

                        popoverText.close();
                        return;
                    }

                    if (fileExtension === 'docx' || fileExtension === 'doc') {
                        // 📝 ABRIR WORD
                        if (window.myFileDropzone) {
                            window.myFileDropzone.showWordInSplitViewFromFile(fileData.file,fileName,searchQuery,pageNumber);
                        }
                        popoverText.close();
                        return;
                    }

                    if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                        // 📊 ABRIR POWERPOINT
                        if (window.myFileDropzone) {
                            window.myFileDropzone.showPowerPointInSplitViewFromFile(fileData.file,fileName,searchQuery,pageNumber);
                        }
                        popoverText.close();
                        return;
                    }

                    // Tipo no soportado
                    $f7.toast.show({
                        text: 'Preview not available for this file type',
                        position: 'center',
                        closeTimeout: 3000,
                        cssClass: 'color-orange'
                    });

                } else {
                    // 🌐 NO ESTÁ EN loadedFiles = FUENTE EXTERNA
                    console.log('🌐 Opening external source:', myReference.source);
                /*    if (myReference.source && myReference.source.includes('/js/viewer/web/viewer.html?file=')) {
                        var realPdfUrl = myReference.source.replace('/js/viewer/web/viewer.html?file=', '');

                        var searchQuery = myReference.searchText || myReference.content || '';
                        var pageNumber = myReference.page ? parseInt(myReference.page) : 1;
                        var displayName = myReference.fileName || 'Document.pdf';

                        window.myFileDropzone.showPdfInSplitViewFromFile(
                            realPdfUrl,  // ✅ URL limpia del PDF
                            displayName,
                            searchQuery,
                            pageNumber
                        );

                        popoverText.close();
                        return;
                    }*/

                    // Para el resto, usar el viewer original
                    viewDocument(myReference.source, myReference.name, true);
                }
            });

            // 🔄 Navegación de grupos
            $("#prev-reference").on('click', function() {
                if (currentReferenceGroup && currentReferenceIndex > 0) {
                    currentReferenceIndex--;
                    openPopoverForGroupedReference();
                }
            });

            $("#next-reference").on('click', function() {
                if (currentReferenceGroup && currentReferenceIndex < currentReferenceGroup.length - 1) {
                    currentReferenceIndex++;
                    openPopoverForGroupedReference();
                }
            });
        });
    }



    let callCompletion = function (withTool = true, messageId, stream = true, noInBackground=false) {
        messageId = messageId || window.SIMBA.Utils.generateUniqueId("assistant-thinking");
        isResponseInBackground = noInBackground ? false : (assistant && chat.mainAssistant.responseOnBackground === true);
        fullStreamingResponse = "";

        const currentConfig = configManager.getConfig();

        // ✅ PRIMERO: Optimización de tokens CON mensajes originales
        let currentMessages = messageManager.getHistory();
        let totalTokens = currentMessages.reduce((total, msg) => total + messageManager.estimateTokens(msg), 0);
        const tokenThreshold = messageManager.TOKEN_LIMIT * 0.8;
        const tokensToRemove = 2000;

        while (totalTokens > tokenThreshold) {
            const result = messageManager.optimizeSystemPrompt(tokensToRemove);
            if (!result.optimized || result.tokensRemoved === 0) {
                break;
            }
            currentMessages = messageManager.getHistory();
            totalTokens = currentMessages.reduce((total, msg) => total + messageManager.estimateTokens(msg), 0);
        }

        // ✅ SEGUNDO: AHORA añadir reasoning instruction (después de optimización)
        if (isReasoningEnabled() && currentModelCategory === 'reasoning') {
            console.log('🧠 Reasoning mode active - Adding reasoning instruction');

            // Clonar los mensajes OPTIMIZADOS
            currentMessages = JSON.parse(JSON.stringify(currentMessages));

            // Añadir la instrucción al system prompt
            if (currentMessages.length > 0 && currentMessages[0].role === 'system') {
                const originalLength = currentMessages[0].content.length;
                currentMessages[0].content += REASONING_INSTRUCTION;
                const newLength = currentMessages[0].content.length;

                console.log('✅ Reasoning instruction added to system prompt');
                console.log(`📏 System prompt: ${originalLength} → ${newLength} chars`);
                console.log('📋 First 100 chars of instruction:', REASONING_INSTRUCTION.substring(0, 100));
            }
        } else if (!isReasoningEnabled() && currentModelCategory === 'reasoning') {
            console.log('🚫 Reasoning mode disabled - Normal response mode');
        }

        // ✅ TERCERO: Construir payload con los mensajes ya modificados
        let payload = {
            stream: stream,
            model: currentConfig.model || DEFAULT_MODEL,
            messages: currentMessages, // ✅ Estos ya tienen la instrucción si aplica
            max_tokens: currentConfig.maxTokens || MAX_TOKENS
        };

        if (stream) {
            payload['stream_options'] = {'include_usage': true};
        }

        if (chat.tools && withTool) {
            payload['tool_choice'] = "auto";

            const toolsForApi = (chat.activeTools || chat.tools).map(tool => {
                const cleanTool = {
                    type: tool.type,
                    function: {
                        name: tool.function.name,
                        description: tool.function.description,
                        parameters: tool.function.parameters
                    }
                };
                return cleanTool;
            });

            payload['tools'] = toolsForApi;
            payload['temperature'] = currentConfig.toolTemperature || 0.1;
        } else {
            payload['temperature'] = currentConfig.temperature || DEFAULT_TEMPERATURE;
        }

        // ✅ Debug: Ver el payload completo antes de enviar
        console.log('📤 Payload to send:');
        console.log('- Model:', payload.model);
        console.log('- Messages count:', payload.messages.length);
        console.log('- System prompt length:', payload.messages[0]?.content.length);
        console.log('- Has THINK in system:', payload.messages[0]?.content.includes('[THINK]'));

        isResponding = true;
        updateTemplate();

        return new Promise((resolve, reject) => {
            let responseData = [];
            let acumulatedText = "";
            let fullResponse = "";
            let isNoTool = false;
            let extractingContent = false;
            let isFunctionCall = false;
            let newMessageId = "";

            // Variables para el nuevo formato de tool_calls
            let isToolCallsFormat = false;
            let accumulatedToolCalls = [];
            let currentToolCall = null;
            let isThinkingMode = false;
            let thinkingContent = "";
            let thinkingStarted = false;
            // Function to get the message element using the ID
            const getMessageElement = function () {
                return $('#' + messageId);
            };

            if (isResponseInBackground && !isToolCallsFormat) {
                const progressHTML = `
    <div class="background-response-container margin-top padding-top">
        <div class="progressbar" id="response-progress">
            <span></span>
        </div>
        <div class="progress-percentage"></div>
    </div>
    <div class="collapsible-container">
        <div class="toggle-button">
            <a href="#" class="toggle-content">
                <i class="fa fa-chevron-down"></i>
            </a>
        </div>
        <div class="response-content" style="display:none">
            <p>Processing response...</p>
        </div>
    </div>
`;

                getMessageElement().find('.message-text').html(progressHTML);

                // Inicializar la barra de progreso
                const progressBarEl = getMessageElement().find('.progressbar')[0];
                if (progressBarEl) {
                    app.progressbar.set(progressBarEl, 0);
                }

                // Event listener para el bot�n de colapsar
                getMessageElement().find('.toggle-content').on('click', function (e) {
                    e.preventDefault();
                    const container = this.closest('.collapsible-container');
                    const content = container.querySelector('.response-content');
                    const icon = this.querySelector('i');

                    const isVisible = window.getComputedStyle(content).display !== 'none';

                    if (isVisible) {
                        content.style.display = 'none';
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                    } else {
                        content.style.display = 'block';
                        icon.classList.remove('fa-chevron-down');
                        icon.classList.add('fa-chevron-up');
                    }
                });
            }

            function updateProgress(value) {
                if (isResponseInBackground && !isToolCallsFormat) {
                    const progressBarEl = getMessageElement().find('.progressbar')[0];
                    if (progressBarEl) {
                        app.progressbar.set(progressBarEl, value);
                        progressBarEl.setAttribute('data-label', 'Creating step by step guide ' + value + '%');
                    }
                }
            }
            // Variables al inicio de callCompletion
            let toolCallReady = false;  // ✅ Nueva flag

            const processToolCalls = function (delta) {
                if (delta.tool_calls && delta.tool_calls.length > 0) {
                    isToolCallsFormat = true;

                    delta.tool_calls.forEach(toolCallDelta => {
                        const index = toolCallDelta.index;

                        if (!accumulatedToolCalls[index]) {
                            accumulatedToolCalls[index] = {
                                index: index,
                                id: toolCallDelta.id || "",
                                type: toolCallDelta.type || "function",
                                function: {
                                    name: "",
                                    arguments: ""
                                }
                            };
                        }

                        if (toolCallDelta.id) {
                            accumulatedToolCalls[index].id = toolCallDelta.id;
                        }

                        if (toolCallDelta.type) {
                            accumulatedToolCalls[index].type = toolCallDelta.type;
                        }

                        if (toolCallDelta.function) {
                            if (toolCallDelta.function.name !== null && toolCallDelta.function.name !== undefined) {
                                accumulatedToolCalls[index].function.name = toolCallDelta.function.name;
                            }

                            if (toolCallDelta.function.arguments !== null && toolCallDelta.function.arguments !== undefined) {
                                accumulatedToolCalls[index].function.arguments =
                                    (accumulatedToolCalls[index].function.arguments || "") +
                                    (toolCallDelta.function.arguments || "");
                            }
                        }

                        currentToolCall = accumulatedToolCalls[index];
                        isFunctionCall = true;
                    });

                    // ✅ SOLO MARCAR COMO LISTO, NO PROCESAR AÚN
                    if (currentToolCall &&
                        currentToolCall.function &&
                        currentToolCall.function.name &&
                        currentToolCall.function.arguments) {

                        const args = currentToolCall.function.arguments.trim();

                        if (args.endsWith('}') && !toolCallReady) {
                            try {
                                JSON.parse(args);
                                console.log("✅ Tool call JSON complete and valid");
                                toolCallReady = true;  // ✅ Solo marcar como listo
                            } catch (e) {
                                console.log("⏳ Still accumulating arguments...");
                            }
                        }
                    }

                    return true;
                }
                return false;
            };
            // Funci�n para procesar un tool call completo
            const processCompleteToolCall = function () {
                if (!currentToolCall || !currentToolCall.function) {
                    console.warn("Incomplete or invalid tool call:", currentToolCall);
                    return false;
                }

                if (processingToolResponse) {
                    console.log("Already processing a tool call, ignoring duplicate");
                    return false;
                }

                try {
                    const toolName = currentToolCall.function.name || "";
                    if (!toolName) {
                        console.warn("Tool call without function name:", currentToolCall);
                        return false;
                    }

                    let toolParams;

                    try {
                        toolParams = JSON.parse(currentToolCall.function.arguments);
                    } catch (e) {
                        console.warn("Error parsing function arguments, trying to clean:", e);
                        const cleanedArgs = currentToolCall.function.arguments.trim()
                            .replace(/^['"]+|['"]+$/g, '')
                            .replace(/\\"/g, '"');

                        try {
                            if (cleanedArgs.startsWith('{')) {
                                toolParams = JSON.parse(cleanedArgs);
                            } else {
                                toolParams = {text: cleanedArgs};
                            }
                        } catch (e2) {
                            console.error("Could not parse arguments after cleaning:", e2);
                            toolParams = {text: currentToolCall.function.arguments};

                            newMessageId = "assistant-thinking-" + Date.now();
                            callCompletion(true, newMessageId, false)
                                .then(() => {
                                    processingToolResponse = false;
                                    addSourcesToMessage($('#' + newMessageId));
                                    addActionsToMessage($('#' + newMessageId));
                                })
                                .catch(error => {
                                    processingToolResponse = false;
                                    console.error("Error in continuation:", error);
                                });
                            return;
                        }
                    }

                    callTool(toolName, toolParams)
                        .then(toolResponse => {
                            console.log("Tool response processed:", toolResponse);
                            $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                            if (toolResponse.sourcesAdded) {
                                console.log("Continuing conversation with added sources");

                                newMessageId = "assistant-thinking-" + Date.now();

                                messages.addMessage({
                                    attrs: {
                                        "data-id": newMessageId,
                                        "id": newMessageId
                                    },
                                    isTitle: false,
                                    text: '<p>Processing retrieved information...</p>',
                                    textFooter: footerTemplate,
                                    name: assistant.name,
                                    cssClass: 'card no-margin-top padding-half',
                                    avatar: assistant.avatar,
                                    type: 'received',
                                }, 'append', true);

                                saveSourcesForMessage(newMessageId, toolParams);
                                onMessageAdded($('#' + newMessageId));

                                callCompletion(false, newMessageId)
                                    .then(() => {
                                        processingToolResponse = false;
                                        addSourcesToMessage($('#' + newMessageId));
                                        addActionsToMessage($('#' + newMessageId));
                                    })
                                    .catch(error => {
                                        processingToolResponse = false;
                                        console.error("Error in continuation:", error);
                                    });
                            } else {
                                processingToolResponse = false;
                            }
                        })
                        .catch(error => {
                            processingToolResponse = false;
                            console.error("Error calling tool:", error);
                        });

                    return true;
                } catch (error) {
                    console.error("Error processing complete tool call:", error);
                    processingToolResponse = false;
                    return false;
                }
            };

            try {
                const requestConfig = {
                    url: window.config.completion.url,
                    method: 'POST',
                    data: payload,
                    contentType: 'application/json',
                    dataType: 'text',
                    headers: {
                        'Authorization': `Bearer ${window.config.completion.apiKey}`,
                        'Accept': 'text/event-stream'
                    },
                    xhrFields: {
                        onprogress: function (e) {
                            /* if (!isResponding) {
                                 if (currentStreamingRequest &&
                                     currentStreamingRequest.xhr &&
                                     typeof currentStreamingRequest.xhr.abort === 'function') {
                                     currentStreamingRequest.xhr.abort();
                                 }
                                 return;
                             }*/

                            const newText = e.target.responseText.substring(acumulatedText.length);
                            acumulatedText = e.target.responseText;

                            const lines = newText.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const jsonData = line.substring(6);
                                        if (jsonData.trim() === '') continue;

                                        const parsedData = JSON.parse(jsonData);
                                        responseData.push(parsedData);

                                        if (parsedData.choices &&
                                            parsedData.choices.length > 0 &&
                                            parsedData.choices[0].delta) {

                                            const delta = parsedData.choices[0].delta;

                                            if (processToolCalls(delta)) {
                                                continue;
                                            }



                                            if (delta.content) {
                                                const content = delta.content;

                                                // ✅ ACUMULAR TODO primero en un buffer temporal
                                                fullStreamingResponse += content;

                                                const THINK_TAG = '[THINK]';
                                                const isTruncatedThink = fullStreamingResponse.endsWith(']') &&
                                                    THINK_TAG.endsWith(fullStreamingResponse) &&
                                                    !thinkingStarted &&
                                                    isReasoningEnabled() &&
                                                    currentModelCategory === 'reasoning';

                                                if (isTruncatedThink) {
                                                    console.warn(`⚠️ DETECTED TRUNCATED [THINK] - Chunk is '${fullStreamingResponse}'`);
                                                    console.log("🔧 Activating thinking mode proactively");

                                                    // Forzar inicio de thinking mode
                                                    isThinkingMode = true;
                                                    thinkingStarted = true;

                                                    // 🎨 CREAR UI COLAPSIBLE inmediatamente
                                                    const thinkingHTML = `
        <div class="thinking-container">
            <div class="collapsible-container">
                <div class="thinking-header">
                    <span class="thinking-icon"><i class="fa fa-brain"></i></span>
                    <span class="thinking-label">Thinking process...</span>
                    <a href="#" class="toggle-thinking-content float-right">
                        <i class="fa fa-chevron-down"></i>
                    </a>
                </div>
                <div class="thinking-content" style="display:none;">
                    <div class="thinking-text"></div>
                </div>
            </div>
        </div>
        <div class="final-response" style="display:none;">
            <p>Processing final response...</p>
        </div>
    `;

                                                    getMessageElement().find('.message-text').html(thinkingHTML);

                                                    // 🎯 Event listener para el botón de toggle
                                                    getMessageElement().find('.toggle-thinking-content').on('click', function (e) {
                                                        e.preventDefault();
                                                        const container = this.closest('.collapsible-container');
                                                        const content = container.querySelector('.thinking-content');
                                                        const icon = this.querySelector('i');

                                                        const isVisible = window.getComputedStyle(content).display !== 'none';

                                                        if (isVisible) {
                                                            content.style.display = 'none';
                                                            icon.classList.remove('fa-chevron-up');
                                                            icon.classList.add('fa-chevron-down');
                                                        } else {
                                                            content.style.display = 'block';
                                                            icon.classList.remove('fa-chevron-down');
                                                            icon.classList.add('fa-chevron-up');
                                                        }
                                                    });

                                                    // Limpiar el "]" inicial del buffer para que no se muestre
                                                    fullStreamingResponse = '';

                                                    // Salir para esperar más contenido
                                                    if (debouncedAutoScroll) {
                                                        debouncedAutoScroll();
                                                    }
                                                    return;
                                                }

                                                // ⚡ PRIORIDAD 1: Detectar [TOOL_CAL PRIMERO
                                                if (fullStreamingResponse.includes("[TOOL_CAL")) {
                                                    console.log("Detected [TOOL_CAL format, switching to non-streaming mode");
                                                    if (currentStreamingRequest && currentStreamingRequest.xhr) {
                                                        currentStreamingRequest.xhr.abort();
                                                    }
                                                    callCompletion(true, messageId, false)
                                                        .then(() => {
                                                            console.log("Non-streaming completion finished");
                                                        })
                                                        .catch(error => {
                                                            console.error("Error in non-streaming completion:", error);
                                                        });
                                                    return;
                                                }

                                                // 🔍 DETECCIÓN EXPLÍCITA: Solo activar thinking si vemos [THINK] o ya está iniciado
                                                const hasExplicitThinkTag = fullStreamingResponse.includes('[THINK]');
                                                const shouldActivateThinking = hasExplicitThinkTag || isThinkingMode;

                                                // 🧠 MODO PROACTIVO: Solo si detectamos [THINK] explícitamente
                                                if (isReasoningEnabled() &&
                                                    currentModelCategory === 'reasoning' &&
                                                    !thinkingStarted &&
                                                    hasExplicitThinkTag &&
                                                    !fullStreamingResponse.includes('[/THINK]')) {

                                                    // Iniciar thinking mode solo si hay [THINK] explícito
                                                    isThinkingMode = true;
                                                    thinkingStarted = true;
                                                    console.log("🧠 THINKING MODE ACTIVATED - Detected [THINK] tag");

                                                    // 🎨 CREAR UI COLAPSIBLE para el thinking
                                                    const thinkingHTML = `
        <div class="thinking-container">
            <div class="collapsible-container">
                <div class="thinking-header">
                    <span class="thinking-icon"><i class="fa fa-brain"></i></span>
                    <span class="thinking-label">Thinking process...</span>
                    <a href="#" class="toggle-thinking-content float-right">
                        <i class="fa fa-chevron-down"></i>
                    </a>
                </div>
                <div class="thinking-content" style="display:none;">
                    <div class="thinking-text"></div>
                </div>
            </div>
        </div>
        <div class="final-response" style="display:none;">
            <p>Processing final response...</p>
        </div>
    `;

                                                    getMessageElement().find('.message-text').html(thinkingHTML);

                                                    // 🎯 Event listener para el botón de toggle
                                                    getMessageElement().find('.toggle-thinking-content').on('click', function (e) {
                                                        e.preventDefault();
                                                        const container = this.closest('.collapsible-container');
                                                        const content = container.querySelector('.thinking-content');
                                                        const icon = this.querySelector('i');

                                                        const isVisible = window.getComputedStyle(content).display !== 'none';

                                                        if (isVisible) {
                                                            content.style.display = 'none';
                                                            icon.classList.remove('fa-chevron-up');
                                                            icon.classList.add('fa-chevron-down');
                                                        } else {
                                                            content.style.display = 'block';
                                                            icon.classList.remove('fa-chevron-down');
                                                            icon.classList.add('fa-chevron-up');
                                                        }
                                                    });
                                                }

                                                // ✅ ACTUALIZAR THINKING CONTENT EN TIEMPO REAL
                                                if (isThinkingMode && !fullStreamingResponse.includes('[/THINK]')) {
                                                    // TODO el contenido acumulado hasta ahora es thinking
                                                    thinkingContent = fullStreamingResponse.replace('[THINK]', ''); // Limpiar [THINK] si existe

                                                    const thinkingTextEl = getMessageElement().find('.thinking-text');
                                                    if (thinkingTextEl.length) {
                                                        thinkingTextEl.html(md.render(thinkingContent));
                                                    }
                                                }

                                                // ✅ DETECTAR FIN DE [/THINK]
                                                if (thinkingStarted && fullStreamingResponse.includes('[/THINK]')) {
                                                    isThinkingMode = false;
                                                    console.log("✅ THINKING COMPLETE - Switching to final response");

                                                    // Extraer contenido de thinking completo (todo antes de [/THINK])
                                                    const parts = fullStreamingResponse.split('[/THINK]');
                                                    thinkingContent = parts[0].replace('[THINK]', ''); // Remover [THINK] si existe

                                                    // 📝 Actualizar thinking final
                                                    const thinkingTextEl = getMessageElement().find('.thinking-text');
                                                    if (thinkingTextEl.length) {
                                                        thinkingTextEl.html(md.render(thinkingContent));
                                                    }

                                                    // 🎨 Cambiar label a "Thought process"
                                                    getMessageElement().find('.thinking-label').text('Thought process');

                                                    // Extraer solo el contenido DESPUÉS de [/THINK]
                                                    fullResponse = parts[1] || '';

                                                    // 👁️ Mostrar el área de respuesta final
                                                    const finalResponseEl = getMessageElement().find('.final-response');
                                                    finalResponseEl.show();

                                                    if (fullResponse.trim()) {
                                                        finalResponseEl.html(md.render(processAndRenderMarkdown(fullResponse) + '<span class="thinking-icon">' + (assistant?.thinkIcon || '🤔') + '</span>'));
                                                    }
                                                }

                                                // ✅ ACTUALIZAR RESPUESTA FINAL (después del thinking)
                                                if (!isThinkingMode && thinkingStarted && fullStreamingResponse.includes('[/THINK]')) {
                                                    const parts = fullStreamingResponse.split('[/THINK]');
                                                    fullResponse = parts[1] || '';

                                                    const finalResponseEl = getMessageElement().find('.final-response');
                                                    if (finalResponseEl.length && fullResponse.trim()) {
                                                        finalResponseEl.html(md.render(processAndRenderMarkdown(fullResponse) + '<span class="thinking-icon">' + (assistant?.thinkIcon || '🤔') + '</span>'));
                                                    }
                                                }

                                                // ✅ CASO NORMAL (sin thinking activo)
                                                if (!isThinkingMode && !thinkingStarted) {
                                                    fullResponse += content;

                                                    if (isResponseInBackground && !isToolCallsFormat) {
                                                        streamingProgress += 1;
                                                        const percentage = Math.min(Math.round((streamingProgress / 10)), 99);
                                                        updateProgress(percentage);
                                                        getMessageElement().find('.response-content').html(md.render(processAndRenderMarkdown(fullResponse) + '<span class="thinking-icon">' + (assistant?.thinkIcon || '🤔') + '</span>'));
                                                    } else {
                                                        getMessageElement().find('.message-text').html(md.render(processAndRenderMarkdown(fullResponse) + '<span class="thinking-icon">' + (assistant?.thinkIcon || '🤔') + '</span>'));
                                                    }
                                                }

                                                if (debouncedAutoScroll) {
                                                    debouncedAutoScroll();
                                                }
                                            }
                                        }

                                        checkScrollPosition();

                                        if (parsedData.choices &&
                                            parsedData.choices.length > 0 &&
                                            parsedData.choices[0].finish_reason !== null) {

                                            if (isResponseInBackground && !isToolCallsFormat) {
                                                updateProgress(100);
                                            }

                                            if (isToolCallsFormat && currentToolCall) {
                                                processCompleteToolCall();
                                            } else if (!isToolCallsFormat && !withTool) {
                                                if (fullResponse && fullResponse.trim()) {
                                                    messageManager.addMessage('assistant', fullResponse, null, messageId);
                                                    console.log("Adding ASSISTANT with tool");
                                                    saveMessageToConversation('assistant', fullResponse, messageId);
                                                } else {
                                                    console.log("Skipping empty assistant message in streaming");
                                                }
                                            }

                                            if (isResponseInBackground && !isToolCallsFormat) {
                                                const progressBarEl = getMessageElement().find('.progressbar')[0];
                                                if (progressBarEl) {
                                                    $f7.progressbar.set(progressBarEl, 100);
                                                }

                                                getMessageElement().find('.response-content').html(md.render(processAndRenderMarkdown(fullResponse)));

                                                if (chat.mainAssistant.onResponseComplete !== null && chat.mainAssistant.onResponseComplete !== undefined) {
                                                    try {
                                                        eval(chat.mainAssistant.onResponseComplete);
                                                    } catch (error) {
                                                        console.error("Error executing onResponseComplete:", error);
                                                    }
                                                }
                                            }

                                            if (chat.tools && withTool && !isToolCallsFormat) {
                                                if (!processingToolResponse && !isToolCallsFormat && (isFunctionCall || (!isNoTool && !extractingContent))) {
                                                    // ✅ SOLO agregar si fullResponse tiene contenido real
                                                    if (fullResponse && fullResponse.trim()) {
                                                        console.log("Showing tool JSON on finish");
                                                        messageManager.addMessage('assistant', fullResponse, null, messageId);
                                                    } else {
                                                        console.log("Skipping empty assistant message (tool call)");
                                                    }
                                                }
                                            }

                                            const completedId = "message-completed-" + Date.now();

                                            if (isNoTool && !isToolCallsFormat) {
                                                getMessageElement().attr("id", completedId).attr('data-id', completedId);
                                            }

                                            addActionsToMessage($('#' + completedId));
                                            console.log("SSE streaming completed");
                                        }

                                    } catch (error) {
                                        console.error("Error processing SSE line:", error, line);
                                    }
                                }
                            }
                        }
                    },
                    success: function (data) {
                        console.log("Request completed successfully");
                        $(".thinking-icon").remove();
                        currentStreamingRequest = null;
                        isResponding = false;
                        updateTemplate();
                        makeClickableReferences();
                        makeClickableSuggestions();

                        let parsedData;
                        if (typeof data === 'string') {
                            try {
                                parsedData = JSON.parse(data);
                            } catch (e) {
                                console.log("Data is not JSON or is already parsed");
                                parsedData = data;
                            }
                        } else {
                            parsedData = data;
                        }

                        // ✅ PROCESAR TOOL CALL SI ESTÁ LISTA (streaming mode)
                        if (isToolCallsFormat && toolCallReady && currentToolCall && !processingToolResponse) {
                            console.log("✅ Processing tool call after streaming completed");

                            processingToolResponse = true;

                            try {
                                const toolName = currentToolCall.function.name;
                                let toolParams;

                                try {
                                    toolParams = JSON.parse(currentToolCall.function.arguments);
                                } catch (e) {
                                    console.warn("Error parsing function arguments:", e);
                                    const cleanedArgs = currentToolCall.function.arguments.trim()
                                        .replace(/^['"]+|['"]+$/g, '')
                                        .replace(/\\"/g, '"');

                                    try {
                                        toolParams = cleanedArgs.startsWith('{')
                                            ? JSON.parse(cleanedArgs)
                                            : {text: cleanedArgs};
                                    } catch (e2) {
                                        console.error("Could not parse arguments after cleaning:", e2);
                                        toolParams = {text: currentToolCall.function.arguments};
                                    }
                                }

                                console.log("Calling tool:", toolName, "with params:", toolParams);

                                // Extract token usage antes de llamar a la tool
                                if (typeof data === 'string') {
                                    const lines = data.split('\n');
                                    for (const line of lines) {
                                        if (line.startsWith('data: ')) {
                                            try {
                                                const jsonData = line.substring(6).trim();
                                                if (!jsonData || jsonData === '') continue;
                                                const chunkData = JSON.parse(jsonData);
                                                if (chunkData.usage) {
                                                    usageData = chunkData.usage;
                                                }
                                            } catch (e) {
                                                // Ignorar errores
                                            }
                                        }
                                    }
                                } else if (data && data.usage) {
                                    usageData = data.usage;
                                }

                                if (usageData) {
                                    console.log("%c === TOKEN USAGE INFORMATION ===", "color: blue; font-weight: bold");
                                    console.log(`Prompt tokens: ${usageData.prompt_tokens}`);
                                    console.log(`Completion tokens: ${usageData.completion_tokens}`);
                                    console.log(`Total tokens: ${usageData.total_tokens}`);
                                }

                                callTool(toolName, toolParams)
                                    .then(toolResponse => {
                                        console.log("Tool response processed:", toolResponse);
                                        $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                                        if (toolResponse.sourcesAdded) {
                                            console.log("Continuing conversation with added sources");

                                            newMessageId = "assistant-thinking-" + Date.now();

                                            messages.addMessage({
                                                attrs: {
                                                    "data-id": newMessageId,
                                                    "id": newMessageId
                                                },
                                                isTitle: false,
                                                text: '<p>Processing retrieved information...</p>',
                                                textFooter: footerTemplate,
                                                name: assistant.name,
                                                cssClass: 'card no-margin-top padding-half',
                                                avatar: assistant.avatar,
                                                type: 'received',
                                            }, 'append', true);

                                            saveSourcesForMessage(newMessageId, toolParams);
                                            onMessageAdded($('#' + newMessageId));

                                            callCompletion(false, newMessageId)
                                                .then(() => {
                                                    processingToolResponse = false;
                                                    addSourcesToMessage($('#' + newMessageId));
                                                    addActionsToMessage($('#' + newMessageId));
                                                })
                                                .catch(error => {
                                                    processingToolResponse = false;
                                                    console.error("Error in continuation:", error);
                                                });
                                        } else {
                                            processingToolResponse = false;
                                        }
                                    })
                                    .catch(error => {
                                        processingToolResponse = false;
                                        console.error("Error calling tool:", error);
                                    });

                                return; // ✅ Salir después de iniciar el procesamiento de tool call

                            } catch (error) {
                                console.error("Error processing tool call:", error);
                                processingToolResponse = false;
                            }
                        }

                        // Handle non-streaming response with [TOOL_CALLS] format
                        if (parsedData &&
                            parsedData.choices &&
                            parsedData.choices.length > 0 &&
                            parsedData.choices[0].message &&
                            parsedData.choices[0].message.content) {

                            const messageContent = parsedData.choices[0].message.content;

                            if (messageContent.startsWith("[TOOL_CALLS]")) {
                                console.log("Detected [TOOL_CALLS] format in non-streaming response");

                                const toolCallMatch = messageContent.match(/^\[TOOL_CALLS\](\w+)(\{.*\})$/);

                                if (toolCallMatch) {
                                    const toolName = toolCallMatch[1];
                                    const toolParamsStr = toolCallMatch[2];

                                    try {
                                        const toolParams = JSON.parse(toolParamsStr);

                                        console.log("Parsed tool call:", toolName, toolParams);

                                        processingToolResponse = true;

                                        callTool(toolName, toolParams)
                                            .then(toolResponse => {
                                                console.log("Tool response processed:", toolResponse);
                                                $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                                                if (toolResponse.sourcesAdded) {
                                                    console.log("Continuing conversation with added sources");

                                                    newMessageId = "assistant-thinking-" + Date.now();

                                                    messages.addMessage({
                                                        attrs: {
                                                            "data-id": newMessageId,
                                                            "id": newMessageId
                                                        },
                                                        isTitle: false,
                                                        text: '<p>Processing retrieved information...</p>',
                                                        textFooter: footerTemplate,
                                                        name: assistant.name,
                                                        cssClass: 'card no-margin-top padding-half',
                                                        avatar: assistant.avatar,
                                                        type: 'received',
                                                    }, 'append', true);

                                                    saveSourcesForMessage(newMessageId, toolParams);
                                                    onMessageAdded($('#' + newMessageId));

                                                    callCompletion(false, newMessageId)
                                                        .then(() => {
                                                            processingToolResponse = false;
                                                            addSourcesToMessage($('#' + newMessageId));
                                                            addActionsToMessage($('#' + newMessageId));
                                                        })
                                                        .catch(error => {
                                                            processingToolResponse = false;
                                                            console.error("Error in continuation:", error);
                                                        });
                                                } else {
                                                    processingToolResponse = false;
                                                }
                                            })
                                            .catch(error => {
                                                processingToolResponse = false;
                                                console.error("Error calling parsed tool:", error);
                                            });

                                        return;
                                    } catch (parseError) {
                                        console.error("Error parsing tool parameters:", parseError);
                                    }
                                }
                            }
                        }

                        // Extract token usage information
                        if (typeof data === 'string') {
                            const lines = data.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const jsonData = line.substring(6).trim();
                                        if (!jsonData || jsonData === '') continue;

                                        const chunkData = JSON.parse(jsonData);
                                        if (chunkData.usage) {
                                            usageData = chunkData.usage;
                                        }
                                    } catch (e) {
                                        console.error("Error parsing chunk:", e);
                                    }
                                }
                            }
                        } else if (data && data.usage) {
                            usageData = data.usage;
                        } else if (responseData && responseData.length > 0) {
                            const lastChunk = responseData[responseData.length - 1];
                            if (lastChunk && lastChunk.usage) {
                                usageData = lastChunk.usage;
                            }
                        }

                        if (usageData) {
                            console.log("%c === TOKEN USAGE INFORMATION ===", "color: blue; font-weight: bold");
                            console.log(`Prompt tokens: ${usageData.prompt_tokens}`);
                            console.log(`Completion tokens: ${usageData.completion_tokens}`);
                            console.log(`Total tokens: ${usageData.total_tokens}`);

                            setTimeout(async () => {
                                try {
                                    const result = await messageManager.optimizeIfNeeded($f7, configManager.getConfig());
                                    if (result && result.optimized) {
                                        console.log(`Optimized: Saved ${result.tokenReduction} tokens!`);
                                    } else {
                                        console.log("No optimization needed");
                                    }
                                } catch (error) {
                                    console.error("Optimization failed:", error);
                                }
                            }, 1000);
                        }

                        addCodeHeaders();
                        addActionsToMessage(getMessageElement());

                        $('table').each(function (index) {
                            this.classList.add('data-table');
                            const tableId = this.id || 'data-table-' + Date.now();
                            this.id = tableId;

                            if (!document.getElementById('container-' + tableId)) {
                                const container = document.createElement('div');
                                container.className = 'table-container margin-bottom';
                                container.style.overflow = 'overlay';
                                container.id = 'container-' + tableId;

                                const exportButton = document.createElement('span');
                                exportButton.className = 'export-csv-button link float-right margin-bottom-half margin-right-half';
                                exportButton.innerHTML = '<i class="fa fa-download"></i> CSV';
                                exportButton.dataset.table = tableId;
                                exportButton.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const targetTableId = this.dataset.table;
                                    exportTableToCSV(document.getElementById(targetTableId));
                                });

                                const chartButton = document.createElement('span');
                                chartButton.className = 'chart-button link float-right margin-bottom-half margin-right-half';
                                chartButton.innerHTML = '<i class="fa fa-chart-bar"></i> Chart';
                                chartButton.dataset.table = tableId;
                                chartButton.style.marginRight = '10px';
                                chartButton.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const targetTableId = this.dataset.table;
                                    showChartTypeSelector(targetTableId);
                                });

                                const parent = this.parentNode;
                                parent.insertBefore(container, this);
                                container.appendChild(chartButton);
                                container.appendChild(exportButton);
                                container.appendChild(this);
                            }
                        });

                        if (isResponseInBackground && !isToolCallsFormat) {
                            getMessageElement().find('.progress-bar').css('width', '100%');
                            getMessageElement().find('.progress-percentage').text('');

                            if (fullResponse && fullResponse.trim() &&
                                !messageManager.getHistory().some(msg =>
                                    msg.role === 'assistant' && msg.content === fullResponse)) {
                                messageManager.addMessage('assistant', fullResponse);
                                console.log("Adding ASSISTANT in success handler (background mode)");
                                saveMessageToConversation('assistant', fullResponse, messageId);
                            } else {
                                console.log("Skipping empty or duplicate assistant message");
                            }
                        }

                        // Handle full completion format (not streaming) - SOLO si no se procesó ya
                        // Handle full completion format (not streaming) - SOLO si no se procesó ya
                        if (parsedData &&
                            parsedData.choices &&
                            parsedData.choices.length > 0 &&
                            parsedData.choices[0].message &&
                            parsedData.choices[0].message.tool_calls &&
                            parsedData.choices[0].message.tool_calls.length > 0 &&
                            !processingToolResponse) {

                            console.log("✅ Detected full completion with tool_calls (non-streaming)");

                            processingToolResponse = true;
                            const toolCall = parsedData.choices[0].message.tool_calls[0];
                            const toolName = toolCall.function.name;
                            let toolParams;

                            try {
                                toolParams = JSON.parse(toolCall.function.arguments);
                            } catch (e) {
                                console.warn("Error parsing tool arguments:", e);
                                const cleanedArgs = toolCall.function.arguments.trim()
                                    .replace(/^['"]+|['"]+$/g, '')
                                    .replace(/\\"/g, '"');

                                try {
                                    toolParams = JSON.parse(cleanedArgs);
                                } catch (e2) {
                                    console.error("Could not parse arguments after cleaning:", e2);
                                    toolParams = {text: toolCall.function.arguments};
                                }
                            }

                            // ✅ NO agregar mensaje del asistente con tool_calls - solo procesar la tool
                            console.log("🔧 Processing tool call without adding empty assistant message");

                            callTool(toolName, toolParams)
                                .then(toolResponse => {
                                    console.log("Tool response processed:", toolResponse);
                                    $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                                    if (toolResponse.sourcesAdded) {
                                        console.log("Continuing conversation with added sources");

                                        newMessageId = "assistant-thinking-" + Date.now();

                                        messages.addMessage({
                                            attrs: {
                                                "data-id": newMessageId,
                                                "id": newMessageId
                                            },
                                            isTitle: false,
                                            text: '<p>Processing retrieved information...</p>',
                                            textFooter: footerTemplate,
                                            name: assistant.name,
                                            cssClass: 'card no-margin-top padding-half',
                                            avatar: assistant.avatar,
                                            type: 'received',
                                        }, 'append', true);

                                        saveSourcesForMessage(newMessageId, toolParams);
                                        onMessageAdded($('#' + newMessageId));

                                        callCompletion(false, newMessageId)
                                            .then(() => {
                                                processingToolResponse = false;
                                                addSourcesToMessage($('#' + newMessageId));
                                                addActionsToMessage($('#' + newMessageId));
                                            })
                                            .catch(error => {
                                                processingToolResponse = false;
                                                console.error("Error in continuation:", error);
                                            });
                                    } else {
                                        processingToolResponse = false;
                                    }
                                })
                                .catch(error => {
                                    processingToolResponse = false;
                                    console.error("Error calling tool:", error);
                                });
                        } else {
                            let responseContent;

                            if (chat.tools) {
                                if (isToolCallsFormat) {
                                    responseContent = JSON.stringify(accumulatedToolCalls, null, 2);
                                } else {
                                    responseContent = fullResponse;
                                }
                            } else {
                                responseContent = fullResponse;
                            }

                            messageManager.updateSystemMessage(messageManager.getHistory()[0].content);
                            setTimeout(() => {
                                try {
                                    const cleanupResult = cleanSimbaAfterCompletion();

                                    if (cleanupResult.cleaned) {
                                        console.log(`🎉 Post-completion cleanup: ${cleanupResult.savedTokens} tokens saved`);

                                        if (cleanupResult.savedTokens > 1000) {
                                            console.log(`📈 Significant cleanup: ${cleanupResult.efficiencyGain}% efficiency gained`);
                                        }
                                    }
                                } catch (error) {
                                    console.error('Error in post-completion cleanup:', error);
                                }
                            }, 2000);

                            resolve({
                                chunks: responseData,
                                fullResponse: fullResponse,
                                content: responseContent,
                                isNoTool: isNoTool,
                                processingTool: processingToolResponse,
                                toolCalls: isToolCallsFormat ? accumulatedToolCalls : null
                            });
                        }
                    },
                    error: function (xhr, status, error) {
                        if (status === 'abort') {
                            console.log("Request cancelled by user");
                            resolve({
                                status: 'aborted',
                                message: 'Response interrupted by user'
                            });
                        } else {
                            $f7.toast.show({
                                text: 'Unable to connect to completion service.',
                                position: 'center',
                                closeTimeout: 3000,
                                cssClass: 'color-red'
                            });

                            if (isResponseInBackground) {
                                getMessageElement().find('.progress-container').addClass('error');
                                getMessageElement().find('.progress-percentage').text('Error');
                            }
                        }
                        isResponding = false;
                        updateTemplate();
                        setTimeout(() => {
                            try {
                                const cleanupResult = cleanSimbaAfterCompletion();
                                if (cleanupResult.cleaned) {
                                    console.log(`?? Error cleanup: ${cleanupResult.savedTokens} tokens saved`);
                                }
                            } catch (cleanupError) {
                                console.error('Error in error cleanup:', cleanupError);
                            }
                        }, 1000);
                        reject(error);
                    }
                };

                currentStreamingRequest = $f7.request(requestConfig);

                window.addEventListener('completion_stop_requested', function handleStop() {
                    if (currentStreamingRequest &&
                        currentStreamingRequest.xhr &&
                        typeof currentStreamingRequest.xhr.abort === 'function') {
                        currentStreamingRequest.xhr.abort();
                    }
                    window.removeEventListener('completion_stop_requested', handleStop);
                }, {once: true});

            } catch (initError) {
                console.error("Error starting request:", initError);
                isResponding = false;
                updateTemplate();

                $f7.toast.show({
                    text: 'Unable to connect to completion service.',
                    position: 'center',
                    closeTimeout: 3000,
                    cssClass: 'color-red'
                });

                reject(initError);
            }
        });
    };
    let textAreaFocus = function (prompt) {
        prompt = prompt || '';
        const textarea = document.getElementById('prompt');
        if (textarea) {
            textarea.value = prompt;

            setTimeout(() => {
                textarea.focus();
            }, 100);
        }
    }
    /**
     * Sends a prompt using the enhanced message management
     */
    /**
     * Sends a prompt using the enhanced message management
     */
    let sendPrompt = async function () {
        if (!isFileUploadAllowed() && window.myFileDropzone && window.myFileDropzone.hasFiles()) {
            $f7.toast.show({
                text: 'Please remove uploaded files - this assistant doesn\'t support file upload.',
                position: 'center',
                closeTimeout: 5000,
                cssClass: 'color-red'
            });
            return;
        }

        if ((prompt && prompt.length && myDevice) || !chat.mainAssistant.deviceSelector) {
            if (notFinishedMessage === '') {
                // Crear conversaci�n si no existe
                if (!conversationManager || !conversationManager.currentConversationId) {
                    console.log('Creating new conversation with first message...');
                    await conversationManager.createConversation(assistant, chat.title, myDevice);
                    console.log('Conversation saved locally:', conversationManager.currentConversationId);
                } else {
                    console.log('Using existing conversation:', conversationManager.currentConversationId);
                }

                response = '';
                updateTemplate();

                const userMsgId = window.SIMBA.Utils.generateUniqueId("user-msg");

                // Determinar el prompt para visi�n
                let visionPrompt = prompt && prompt.trim() ? prompt.trim() : "What is this?";
                let displayPrompt = prompt && prompt.trim() ? prompt : "What is this?";

                console.log('Vision prompt:', visionPrompt);

                // Crear mensaje del usuario inmediatamente
                messages.addMessage({
                    attrs: {"data-id": userMsgId, "id": userMsgId},
                    isTitle: false,
                    text: '<p class="no-margin-top float-left">' + md.render(displayPrompt) + '</p>',
                    textHeader: '<div class="margin-bottom margin-left-half padding-bottom" id="header-' + userMsgId + '"></div>',
                    cssClass: 'sent card no-margin-top padding-half',
                    type: 'received',
                    avatar: 'https://ui-avatars.com/api/?name=Alfredo%20Garc�a',
                    textFooter: footerTemplate
                }, 'append', true);
                onMessageAdded($('#' + userMsgId));

                updateTemplate();

                // Procesar archivos
                let extractedContents = "";
                let hasImages = false;

                if (window.myFileDropzone) {
                    // 1. EXTRAER TEXTO DE ARCHIVOS NO-IMAGEN PRIMERO
                    try {
                        const analysisType = getImageAnalysisType();
                        extractedContents = window.myFileDropzone.getCombinedExtractedTextSync(analysisType);
                    } catch (error) {
                        console.error('Error processing files:', error);
                        return;
                    }

                    // 2. GUARDAR archivos para procesamiento posterior
                    const currentFiles = window.myFileDropzone.getFiles().slice();

                    // 3. Verificar si hay im�genes
                    hasImages = currentFiles.some(file => window.myFileDropzone._getFileType(file) === 'image');

                    // 4. Guardar im�genes en loadedImages
                    currentFiles.forEach(function(file) {
                        const fileType = window.myFileDropzone._getFileType(file);
                        if (fileType === 'image') {
                            // Mantener lógica existente para imágenes
                            loadedImages[file.name] = {
                                file: file,
                                url: URL.createObjectURL(file),
                                messageId: userMsgId,
                                timestamp: Date.now(),
                                extractedText: file.extractedText || null
                            };
                        } else {
                            // 🆕 NUEVO: Guardar otros archivos (PDF, Word, etc.)
                            loadedFiles[file.name] = {
                                file: file,
                                url: URL.createObjectURL(file),
                                messageId: userMsgId,
                                timestamp: Date.now(),
                                extractedText: file.extractedText || null,
                                fileType: fileType
                            };
                            console.log(loadedFiles);
                        }
                    });

                    // 5. Renderizar en el chat
                    window.myFileDropzone.renderFileItems('header-' + userMsgId);

                    // 6. Limpiar dropzone
                    window.myFileDropzone.clearFiles();
                    console.log('Dropzone cleared after extracting content');
                }

                textAreaFocus();

                // OBTENER CONFIGURACI�N: d�nde colocar documentos
                const currentConfig = configManager.getConfig();
                const contextLocation = currentConfig.documentContextLocation || 'system';
                console.log('Document context location:', contextLocation);

                // ESPERAR A QUE SE PROCESEN LAS IM�GENES
                if (hasImages && window.myFileDropzone) {
                    console.log('Waiting for image analysis with prompt:', visionPrompt);

                    try {
                        const imageFiles = Object.values(loadedImages)
                            .filter(img => img.messageId === userMsgId)
                            .map(img => img.file);

                        const imageResults = await window.myFileDropzone.processImagesInBackground(
                            'header-' + userMsgId,
                            visionPrompt,
                            imageFiles
                        );

                        // Construir contenido final
                        let userMessageContent = '';

                        // **CASO 1: Documentos van al SISTEMA**
                        if (contextLocation === 'system' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                            messageManager.updateSystemMessage(
                                messageManager.getHistory()[0].content +
                                '\n\n--- UPLOADED DOCUMENTS ---\n' +
                                'The user has uploaded the following documents. Use this information to answer their question:\n\n' +
                                extractedContents
                            );
                            console.log('Documents added to SYSTEM context');
                        }

                        // **CASO 2: Documentos van al mensaje de USUARIO**
                        if (contextLocation === 'user' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                            userMessageContent += '=== REFERENCE DOCUMENTS ===\n';
                            userMessageContent += 'Use the following documents to answer the question below.\n\n';
                            userMessageContent += extractedContents + '\n\n';
                            userMessageContent += '=== END OF DOCUMENTS ===\n\n';
                            console.log('Documents added to USER message');
                        }

                        // Agregar descripciones de im�genes
                        imageResults.forEach(function(result) {
                            if (result.success && result.description) {
                                userMessageContent += '<simba_image data-filename="' + result.file.name + '">\n';
                                userMessageContent += result.description + '\n';
                                userMessageContent += '</simba_image>\n\n';
                            }
                        });

                        // Agregar pregunta del usuario
                        if (contextLocation === 'user' && extractedContents) {
                            userMessageContent += '=== QUESTION ===\n';
                        }
                        userMessageContent += displayPrompt;

                        // Agregar al historial
                        messageManager.addMessage('user', userMessageContent, null, userMsgId);
                        saveMessageToConversation('user', userMessageContent, userMsgId);

                        console.log('Images processed with prompt:', visionPrompt);

                    } catch (error) {
                        console.error('Error processing images:', error);

                        // Agregar sin im�genes en caso de error
                        let userMessageContent = '';

                        if (contextLocation === 'system' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                            messageManager.updateSystemMessage(
                                messageManager.getHistory()[0].content +
                                '\n\n--- UPLOADED DOCUMENTS ---\n' +
                                extractedContents
                            );
                        }

                        if (contextLocation === 'user' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                            userMessageContent += '=== REFERENCE DOCUMENTS ===\n';
                            userMessageContent += extractedContents + '\n\n';
                            userMessageContent += '=== END OF DOCUMENTS ===\n\n';
                        }

                        if (contextLocation === 'user' && extractedContents) {
                            userMessageContent += '=== QUESTION ===\n';
                        }
                        userMessageContent += displayPrompt;

                        messageManager.addMessage('user', userMessageContent, null, userMsgId);
                        saveMessageToConversation('user', userMessageContent, userMsgId);
                    }

                } else {
                    // NO HAY IM�GENES - aplicar misma l�gica
                    let userMessageContent = '';

                    // Documentos al sistema
                    if (contextLocation === 'system' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                        messageManager.updateSystemMessage(
                            messageManager.getHistory()[0].content +
                            '\n\n--- UPLOADED DOCUMENTS ---\n' +
                            'The user has uploaded the following documents. Use this information to answer their question:\n\n' +
                            extractedContents
                        );
                        console.log('Documents added to SYSTEM context (no images)');
                    }

                    // Documentos al usuario
                    if (contextLocation === 'user' && extractedContents && !chat.mainAssistant.excludeDropzoneFromHistory) {
                        userMessageContent += '=== REFERENCE DOCUMENTS ===\n';
                        userMessageContent += 'Use the following documents to answer the question below.\n\n';
                        userMessageContent += extractedContents + '\n\n';
                        userMessageContent += '=== END OF DOCUMENTS ===\n\n';
                        console.log('Documents added to USER message (no images)');
                    }

                    // Pregunta
                    if (contextLocation === 'user' && extractedContents) {
                        userMessageContent += '=== QUESTION ===\n';
                    }
                    userMessageContent += displayPrompt;

                    messageManager.addMessage('user', userMessageContent, null, userMsgId);
                    saveMessageToConversation('user', userMessageContent, userMsgId);

                    // Limpiar dropzone
                    if (window.myFileDropzone) {
                        window.myFileDropzone.clearFiles();
                    }
                }

                onMessageAdded($('#' + userMsgId));
                if (debouncedAutoScroll) {
                    debouncedAutoScroll();
                }

                if ($("#"+userMsgId).find('.message-text-header').find('.file-item').length == 0){
                    $("#"+userMsgId).find('.message-text-header').remove();
                }

                // Limpiar prompt
                prompt = null;
                const textarea = document.getElementById('prompt');
                if (textarea) {
                    textarea.value = '';
                    textarea.style.height = 'auto';
                    textarea.style.height = '';
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                }
                updateTemplate();

                if (debouncedAutoScroll) {
                    debouncedAutoScroll();
                }

                autoScrollEnabled = true;

                // Crear mensaje del asistente
                const thinkingMsgId = window.SIMBA.Utils.generateUniqueId("assistant-thinking");

                messages.addMessage({
                    attrs: {"data-id": thinkingMsgId, "id": thinkingMsgId},
                    isTitle: false,
                    text: '<p><span class="thinking-icon">' + (assistant?.thinkIcon || '') + '</span></p>',
                    name: assistant.name,
                    cssClass: 'card no-margin-top padding-half',
                    textFooter: footerTemplate,
                    type: 'received',
                    avatar: assistant.avatar,
                }, 'append', true);

                onMessageAdded($('#' + thinkingMsgId));
                addActionsToMessage($('#' + thinkingMsgId));
                setDynamicHeight();

                // Llamar a completion
                if (navigator.onLine) {
                    callCompletion(true, thinkingMsgId)
                        .then(() => {
                            if (debouncedAutoScroll) {
                                debouncedAutoScroll();
                            }

                            // Generar t�tulo autom�ticamente si es necesario
                            if (conversationManager && conversationManager.currentConversationId) {
                                const history = messageManager.getHistory();
                                const userMessages = history.filter(msg => msg.role === 'user');

                                if (userMessages.length === 1 && (chat.title === 'New conversation' || chat.title === assistant.name)) {
                                    conversationManager.generateTitle(messageManager)
                                        .then(generatedTitle => {
                                            if (generatedTitle && generatedTitle !== 'New conversation') {
                                                chat.title = generatedTitle;
                                                return conversationManager.updateConversationTitle(conversationManager.currentConversationId, generatedTitle);
                                            }
                                        })
                                        .then(() => {
                                            updateTemplate();
                                        })
                                        .catch(error => {
                                            console.log('Could not generate title automatically:', error);
                                        });
                                }
                            }
                        });
                }
            }
        } else {
            $f7.toast.show({
                text: 'Please select a Training Device before submitting a query.',
                position: 'center',
                horizontalPosition: 'center'
            });
        }
    };

    // ===========================================
    // UI HELPER FUNCTIONS
    // ===========================================

    let addSourcesToMessage = function (object) {
        const messageSources = sourceManager.getByMessageId(object.attr('id'));
        if (!messageSources || messageSources.length === 0) return;

        let $footer = object.find('.message-text-footer');
        $footer.appendTo(object.find('.message-text'));

        if ($footer.length === 0) {
            $footer = $('<div class="message-text-footer"></div>');
            object.find('.message-text').append($footer);
            $footer.html(footerTemplate);
        }

        const $leftSection = $footer.find('.sources');

        // Group sources by icon
        const groupedByIcon = {};
        messageSources.forEach(source => {
            const iconClass = source.icon || 'fa-solid fa-question';
            if (!groupedByIcon[iconClass]) {
                groupedByIcon[iconClass] = {icon: iconClass, count: 0, names: []};
            }
            groupedByIcon[iconClass].count++;
            groupedByIcon[iconClass].names.push(source.name);
        });

        const uniqueIcons = Object.values(groupedByIcon);
        const visibleIcons = uniqueIcons.slice(0, 5);

        let sourcesHTML = '<span id="source-' + object.attr('id') + '" class="link font-size-14 badge badge-round badge-outline">';

        visibleIcons.forEach(iconGroup => {
            const tooltipText = iconGroup.names.join(', ');
            sourcesHTML += `<i data-tooltip="${tooltipText}" class="margin-half ${iconGroup.icon} fa-icon"></i>`;
        });

        sourcesHTML += '<span class="margin-left-half">Sources</span></span>';
        $leftSection.html(sourcesHTML);

        $("#source-" + object.attr('id')).on('click', function () {
            openSourcePanel(object.attr('id'));
        });
    };

    let addActionsToMessage = function (object) {
        let $footer = object.find('.message-text-footer');
        $footer.appendTo(object.find('.message-text'));

        if ($footer.length === 0) {
            $footer = $('<div class="message-text-footer"></div>');
            object.find('.message-text').append($footer);
            $footer.html(footerTemplate);
        }

        $footer.find('.message-footer-content').attr('data-message-id', object.attr('id'));
        const $rightSection = $footer.find('.actions');

        const actionsHTML = `
        <a class="link action-button margin-left-half" data-action="edit" data-message-id="${object.attr('id')}">
            <i class="tooltip-init color-gray font-size-16 icon material-icons-outlined" data-tooltip="Edit content">edit</i>
        </a>
        <a class="link action-button margin-left-half" data-action="copy" data-message-id="${object.attr('id')}">
            <i class="tooltip-init color-gray font-size-16 icon material-icons-outlined" data-tooltip="Copy message">content_copy</i>
        </a>
        <a class="link action-button margin-left-half" data-action="like" data-message-id="${object.attr('id')}">
            <i class="tooltip-init color-gray font-size-16 icon material-icons-outlined" data-tooltip="This response is useful">thumb_up</i>
        </a>
        <a class="link action-button margin-left-half" data-action="dislike" data-message-id="${object.attr('id')}">
            <i class="tooltip-init color-gray font-size-16 icon material-icons-outlined" data-tooltip="This response is not useful">thumb_down</i>
        </a>
    `;

        $rightSection.html(actionsHTML);

        $rightSection.find('.action-button').on('click', function () {
            const action = $(this).data('action');
            const messageId = $(this).data('message-id');

            switch (action) {
                case 'copy':
                    const targetElement = document.getElementById(messageId);
                    const text = $(targetElement).find(".message-text").text();
                    window.SIMBA.Utils.copyToClipboard(text)
                        .then(() => {
                            $f7.toast.show({
                                text: 'Message copied to clipboard',
                                position: 'center',
                                closeTimeout: 1500
                            });
                        })
                        .catch(err => console.error('Copy failed:', err));
                    break;
                case 'like':
                    likeMessage(messageId);
                    break;
                case 'dislike':
                    dialogChoiceChip.open();
                    break;
                case 'edit':
                    editContent(extractMessageTextWithoutFooter(messageId), "my_editor", "my_file");
                    break;
                default:
                    console.log('Unknown action:', action);
            }
        });
    };

    function extractMessageTextWithoutFooter(messageId) {
        var targetElement = document.getElementById(messageId);
        if (!targetElement) {
            console.error("Element with ID " + messageId + " not found");
            return null;
        }

        var messageTextElement = targetElement.querySelector(".message-text");
        if (!messageTextElement) {
            console.error("Element with class 'message-text' not found");
            return null;
        }

        var messageTextClone = messageTextElement.cloneNode(true);
        var footers = messageTextClone.querySelectorAll(".message-text-footer");
        footers.forEach(function (footer) {
            footer.parentNode.removeChild(footer);
        });

        return messageTextClone.innerHTML;
    }
    let openPopover2 = function (event) {
        const targetElement = event.target;
        const guid = $(targetElement).attr('data-guid');
        const page = parseInt($(targetElement).attr('data-page'), 10) || "1";
        const section = parseInt($(targetElement).attr('data-section'), 10) || "1";
        const name = $(targetElement).attr('data-filename') || 'Reference not found';
        const content = $(targetElement).attr('data-content') || 'Could not find reference information.';

        const messageElement = $(targetElement).closest('.message');
        const messageId = messageElement.attr('id');
        // Obtener todas las fuentes de localStorage
        const allSources = JSON.parse(localStorage.getItem('sources') || '{}');

        // Crear la clave para buscar la fuente espec�fica
        const sourceKey = `${guid}_${page}_${section}`;
        const sourceObject = allSources[sourceKey];
        console.log(sourceObject,sourceKey)
        let myReference;

        if (!sourceObject) {
            // Si no se encuentra la fuente en localStorage, usar datos por defecto
            myReference = {
                name,
                page: page || "1",
                section: section || "1",
                content: "..." + content + "..."
            };
        } else {
            // Si se encuentra la fuente, usar sus datos
            myReference = {
                name: sourceObject.id || sourceObject.name || sourceObject.title || "No name",
                page: page || (sourceObject.extra && sourceObject.extra.page) || "1",
                section: section || (sourceObject.extra && sourceObject.extra.section) || "1",
                content: sourceObject.content || "No content",
                source: sourceObject.url || ('https://itc.simeng.es/' + sourceObject.source + '#phrase=true&page=' + page + '&search=' + encodeURIComponent(sourceObject.content || ''))
            };
        }

        // Abrir el popover y actualizar template
        popoverText.open(targetElement);
        updateTemplate();

        $update(function () {
            $("#view-source").on('click', function () {
                // Para openPopover2, podr�as necesitar adaptar esto seg�n tu l�gica
                // Ya que no tenemos messageId directamente

                if (messageId) {
                    openSourcePanel(messageId);
                    $(".source").parent().removeClass('bg-color-chrome');
                    $(".source[id='" + guid + "']").parent().addClass('bg-color-chrome');
                }
            });

            $("#view-document").on('click', function () {
                console.log(myReference.source);
                viewDocument(myReference.source, myReference.name, true);
            });
        });
    };

// FUNCI�N ALTERNATIVA si prefieres b�squeda m�s flexible
    let openPopover2Flexible = function (event) {
        const targetElement = event.target;
        const guid = $(targetElement).attr('data-guid');
        const page = parseInt($(targetElement).attr('data-page'), 10) || undefined;
        const section = parseInt($(targetElement).attr('data-section'), 10) || undefined;
        const name = $(targetElement).attr('data-filename') || 'Reference not found';
        const content = $(targetElement).attr('data-content') || 'Could not find reference information.';

        // Obtener todas las fuentes de localStorage
        const allSources = JSON.parse(localStorage.getItem('sources') || '{}');

        // Buscar la fuente de m�ltiples formas
        let sourceObject = null;

        // 1. B�squeda exacta por clave
        if (page && section) {
            const exactKey = `${guid}_${page}_${section}`;
            sourceObject = allSources[exactKey];
        }

        // 2. Si no se encuentra, buscar por guid solamente
        if (!sourceObject) {
            const matchingKeys = Object.keys(allSources).filter(key => key.startsWith(guid + '_'));
            if (matchingKeys.length > 0) {
                sourceObject = allSources[matchingKeys[0]];
            }
        }

        let myReference;

        if (!sourceObject) {
            myReference = {
                name,
                page: page || "",
                section: section || "",
                content: "..." + content + "..."
            };
        } else {
            myReference = {
                name: sourceObject.id || sourceObject.name || sourceObject.title || "No name",
                page: page || (sourceObject.extra && sourceObject.extra.page) || "",
                section: section || (sourceObject.extra && sourceObject.extra.section) || "",
                content: sourceObject.content || "No content",
                source: sourceObject.url || ('https://itc.simeng.es/' + (sourceObject.source || '') + '#phrase=true&page=' + (page || '') + '&search=' + encodeURIComponent(sourceObject.content || ''))
            };
        }

        popoverText.open(targetElement);
        updateTemplate();

        $update(function () {
            $("#view-source").on('click', function () {
                const messageElement = $(targetElement).closest('.message');
                const messageId = messageElement.attr('id');

                if (messageId) {
                    openSourcePanel(messageId);
                    $(".source").parent().removeClass('bg-color-chrome');
                    $(".source[id='" + guid + "']").parent().addClass('bg-color-chrome');
                }
            });

            $("#view-document").on('click', function () {
                console.log(myReference.source);
                viewDocument(myReference.source, myReference.name, true);
            });
        });
    };
    /*let openPopoverText = function (event) {
        const targetElement = event.target;
        const guid = $(targetElement).attr('data-guid');
        const messageElement = $(targetElement).closest('.message');
        const messageId = messageElement.attr('id');

        const page = parseInt($(targetElement).attr('data-page'), 10) || undefined;
        const section = parseInt($(targetElement).attr('data-section'), 10) || undefined;
        const name = $(targetElement).attr('data-filename') || 'Reference not found';
        const content = $(targetElement).attr('data-content') || 'Could not find reference information.';

        const sources = JSON.parse(localStorage.getItem('sources') || '{}');;//sourceManager.getByMessageId(messageId);
        const result = getObjectAndTextByGuid(sources, guid, page, section);

        if (!result) {
            myReference = {name, page: page || "", section: section || "", content: "..." + content + "..."};
        } else {
            myReference = {
                name: result.sourceObject.id || result.sourceObject.name || "No name",
                page: page || (result.sourceObject.extra && result.sourceObject.extra.page) || "",
                section: section || (result.sourceObject.extra && result.sourceObject.extra.section) || "",
                content: result.extractedText || "No content",
                source: 'https://itc.simeng.es/' + result.sourceObject.source + '#phrase=true&page=' + page + '&search=' + result.extractedText
            };
        }

        popoverText.open(targetElement);
        updateTemplate();

        $update(function () {
            $("#view-source").on('click', function () {
                openSourcePanel(messageId);
                $(".source").parent().removeClass('bg-color-chrome');
                $(".source[id='" + guid + "']").parent().addClass('bg-color-chrome');
            });
            $("#view-document").on('click', function () {
                console.log(myReference.source);
                viewDocument(myReference.source, myReference.name, true);
            });
        });
    };*/

    // ===========================================
    // HIGHLIGHT MANAGEMENT FUNCTIONS
    // ===========================================

    let showHighlights = function () {
        updateTemplate();
        if (!popupHighlights) {
            popupHighlights = $f7.popup.create({
                el: $el.value.find('#popup-highlights')[0],
                swipeToClose: false,
                on: {
                    opened: function () {
                        app.on('sortableSort', function (listEl, data) {
                            updateHighlightsOrder();
                        });
                    }
                }
            });
        }
        popupHighlights.open();
    };

    let updateHighlightsOrder = function () {
        const sortableEl = document.getElementById('sortable-highlights-list');
        const listItems = sortableEl.querySelectorAll('li[data-highlight-id]');
        const orderedIds = Array.from(listItems).map(item => item.getAttribute('data-highlight-id'));

        highlightManager.updateOrder(orderedIds);
        updateTemplate();
    };

    let removeHighlightFromPopup = function (e, highlightId) {
        e.preventDefault();

        highlightManager.remove(highlightId);

        const highlightEl = document.getElementById(highlightId);
        if (highlightEl) {
            const parent = highlightEl.parentNode;
            parent.insertBefore(document.createTextNode(highlightEl.textContent), highlightEl);
            parent.removeChild(highlightEl);
        }

        updateTemplate();
    };

    let scrollToHighlight = function (highlightId) {
        const highlightElement = document.getElementById(highlightId);
        if (highlightElement) {
            highlightElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });

            highlightElement.style.transition = 'all 0.3s ease';
            highlightElement.style.transform = 'scale(1.05)';
            highlightElement.style.boxShadow = '0 0 20px rgba(255, 255, 0, 0.8)';

            setTimeout(() => {
                highlightElement.style.transform = 'scale(1)';
                highlightElement.style.boxShadow = 'none';
            }, 1000);

            app.toast.create({
                text: 'Scrolled to highlighted text',
                position: 'center',
                closeTimeout: 1500,
            }).open();
        } else {
            app.toast.create({
                text: 'Highlight not found on page',
                position: 'center',
                closeTimeout: 1500,
            }).open();
        }
    };

    let toggleSortableDisable = function () {
        const sortableEl = document.getElementById('sortable-highlights-list');
        if (sortableEl) {
            $f7.sortable.toggle(sortableEl);
        }
    };

    let generalAction = function () {
        const highlightTexts = highlightManager.getAllTexts();
        const myText = "Please create a technical report using only the following information: '" + highlightTexts.join('\n') + "'";
        isResponseInBackground = true;
        setPrompt(myText);

        setTimeout(() => {
            isResponseInBackground = false;
        }, 1000);
    };

    // ===========================================
    // EVENT HANDLERS
    // ===========================================

    let handlePromptTextArea = function (e) {
        prompt = e.target.value.length > 0 ? e.target.value : null;
        updateTemplate();
    };

    let handleKeyDown = function (e) {
        if (e.key === 'Enter' && e.shiftKey) return;
        if (e.key === 'Enter' && !e.shiftKey && !mentionManager?.isSuggestionsVisible) {
            e.preventDefault();
            sendPrompt();
        }
    };

    let handleDeviceSelection = function (e) {
        myDevice = e.target.value;
        updateTemplate();
        textAreaFocus(prompt)
    };

    let handleOpenDeviceSelection = function (e) {
        myDevice = null;
        prompt = null;
        updateTemplate();
    };

    let setPrompt = function (myPrompt, isSelection = 0) {
        $("#prompt").val(myPrompt);
        prompt = myPrompt;
        if (isSelection) {
            prompt = prompt + ': ' + selectedText;
        }
        sendPrompt();
        popoverSelection.close();
    };

    /**
     * Handles message addition with sources and actions
     */
    let onMessageAdded = function (object) {
        syncTemplateData();

        if (showBottomBar) {
            const pageToolbar = document.getElementById('page-toolbar');
            const promptArea = document.getElementById('prompt-area');
            if (pageToolbar && promptArea) {
                pageToolbar.appendChild(promptArea);
            }
        }

        // Style message elements
        object.find('.message-name').addClass('card-header').remove();

        // Handle tables
        object.find('table').each(function (index) {
            this.classList.add('data-table');
            const tableId = this.id || 'data-table-' + Date.now() + '-' + index;
            this.id = tableId;

            // Verificar si ya existe el container para evitar duplicados
            if (!document.getElementById('container-' + tableId)) {
                const container = document.createElement('div');
                container.className = 'table-container margin-bottom';
                container.id = 'container-' + tableId;

                // BOT�N CSV (existente)
                const exportButton = document.createElement('a');
                exportButton.href = '#';
                exportButton.className = 'export-csv-button float-right margin-bottom-half margin-right-half';
                exportButton.innerHTML = '<i class="fa fa-download"></i> CSV';
                exportButton.dataset.table = tableId;
                exportButton.addEventListener('click', function (e) {
                    e.preventDefault();
                    exportTableToCSV(document.getElementById(tableId));
                });

                // NUEVO BOT�N GR�FICA
                const chartButton = document.createElement('a');
                chartButton.href = '#';
                chartButton.className = 'chart-button float-right margin-bottom-half margin-right-half';
                chartButton.innerHTML = '<i class="fa fa-chart-bar"></i> Chart';
                chartButton.dataset.table = tableId;
                chartButton.style.marginRight = '10px'; // Espacio entre botones
                chartButton.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetTableId = this.dataset.table;
                    showChartTypeSelector(targetTableId);
                });

                const parent = this.parentNode;
                parent.insertBefore(container, this);

                // Agregar botones al contenedor
                container.appendChild(chartButton);  // Bot�n Chart primero
                container.appendChild(exportButton); // Bot�n CSV segundo
                container.appendChild(this);         // Tabla al final
            }
        });

        // Handle code blocks
        object.find('pre').each(function () {
            $(this).addClass('block block-strong inset margin-vertical');
            const codeClass = $(this).find('code').attr('class');
            if (codeClass) {
                const language = codeClass.match(/language-(\w+)/)?.[1];
                if (language) {
                    $(this).prepend('<div class="bg-color-black float-right padding-half small language-name">' + language + '</div>');
                }
            }
        });

        // Add hover effects for message actions
        object.on('mouseenter touchstart', function () {
            $(this).find(".message-footer-content .actions").show();
        }).on('mouseleave touchend', function () {
            $(this).find(".message-footer-content .actions").hide();
        });
    };

    /**
     * Stops streaming response
     */
    let stopStreaming = function () {
        isResponding = false;
        autoScrollEnabled = true;
        isUserScrolling = false;
        updateTemplate();

        try {
            if (currentStreamingRequest) {
                if (typeof currentStreamingRequest.abort === 'function') {
                    currentStreamingRequest.abort();
                } else if (currentStreamingRequest.xhr && typeof currentStreamingRequest.xhr.abort === 'function') {
                    currentStreamingRequest.xhr.abort();
                }
                currentStreamingRequest = null;
            }
        } catch (error) {
            console.error("Error stopping stream:", error);
        }

        const messageElement = $('.message:last-child .message-text');
        if (messageElement.length) {
            messageElement.append('<p><em>Response interrupted by user.</em></p>');
            messageElement.find('.thinking-icon').remove();
        }

        $f7.toast.show({
            text: 'Response interrupted by user',
            position: 'center',
            closeTimeout: 2000,
        });
    };

    /**
     * Scrolls to bottom of chat
     */
    let scrollToBottom = function () {
        if (pageContent) {
            pageContent.scrollTo({
                top: pageContent.scrollHeight,
                behavior: 'smooth'
            });
        }
        autoScrollEnabled = true;
        isUserScrolling = false;
    };

    /**
     * Checks scroll position and shows/hides scroll button
     */
    let checkScrollPosition = function () {
        if (!pageContent) return;

        const isAtBottom = (pageContent.offsetHeight + pageContent.scrollTop) >= pageContent.scrollHeight - 50;

        // Mostrar/ocultar bot�n de scroll
        if (isAtBottom) {
            scrollToBottomBtn.classList.add('hidden');
            // Reactivar auto-scroll cuando el usuario llega al fondo
            autoScrollEnabled = true;
        } else {
            scrollToBottomBtn.classList.remove('hidden');
        }
    }

    let handleUserScroll = function() {
        // Si el asistente est� respondiendo y el usuario hace scroll, desactivar auto-scroll
        if (isResponding) {
            isUserScrolling = true;
            autoScrollEnabled = false;

            // Limpiar timeout anterior
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }

            // Despu�s de 150ms sin scroll, considerar que termin� de hacer scroll
            scrollTimeout = setTimeout(() => {
                isUserScrolling = false;
                checkScrollPosition(); // Verificar si est� al fondo para reactivar
            }, 150);
        }
    };

    let autoScrollToBottom = function() {
        if (!pageContent || !autoScrollEnabled || isUserScrolling) {
            return;
        }

        // Solo hacer scroll si el asistente est� respondiendo
        if (isResponding) {
            // Usar requestAnimationFrame para mejor performance
            requestAnimationFrame(() => {
                autoScrolling = true;
                pageContent.scrollTo({
                    top: pageContent.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    };

    let createDebouncedAutoScroll = function() {
        return window.SIMBA.Utils.debounce(autoScrollToBottom, 50); // 50ms de debounce
    };

    // ===========================================
    // POPUP AND DIALOG INITIALIZATION
    // ===========================================

    let initializeDialogChoiceChip = function () {
        dialogChoiceChip = $f7.dialog.create({
            el: $el.value.find('#dialog-choice-chip'),
            on: {
                close: function (dialog) {
                    dialog.$el.find('form')[0].reset();
                }
            }
        });
    };

    let closeDialogChoiceChip = function () {
        dialogChoiceChip.close();
    };

    let submitFormDialogChoiceChip = function () {
        const form = dialogChoiceChip.$el.find('form');
        const formData = $f7.form.convertToData(form);
        form[0].reset();

        if (formData.interests?.length) {
            $f7.toast.show({
                text: 'Your feedback(s): ' + formData.interests.join(', ')
            });
        }
        dialogChoiceChip.close();
    };

    let initializePopupTicket = function () {
        popupTicket = $f7.popup.create({
            el: $el.value.find('#popup-ticket')
        });
    };

    let openPopupTicket = function () {
        popupTicket.open();
    };

    let closePopupTicket = function (created = false) {
        if (assistant) {
            if (created) {
                formTicketValidator.resetForm();
            } else {
                const newMessageId = window.SIMBA.Utils.generateUniqueId("assistant-thinking");
                $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                const message = "<em class='margin-top-half'>Support ticket creation canceled by user</em>";
                messages.addMessage({
                    attrs: {"data-id": newMessageId, "id": newMessageId},
                    isTitle: false,
                    text: message,
                    textFooter: footerTemplate,
                    cssClass: 'card no-margin-top padding-half',
                    avatar: assistant.avatar,
                    type: 'received',
                }, 'append', true);

                messageManager.addMessage('assistant', message);
            }
            popupTicket.close();
        }
    };

    let initializeFormValidator = function () {
        formTicketValidator = jQuery($el.value.find('form[name=ticket]')).validate({
            rules: {
                problem_title: {required: true},
                problem_description: {required: true},
                device: {required: true}
            },
            messages: {
                problem_title: {required: 'Please enter a quick description of the issue.'},
                problem_description: {required: 'Please enter a full description and details of the issue.'},
                device: {required: 'Please enter the simulator/device.'}
            },
            submitHandler: function (form) {
                const payload = {
                    name: 'action_open_support_ticket',
                    params: $f7.form.convertToData(form),
                    chat: chat.guid
                };

                $f7.request({
                    url: window.config.api_methods.call_tool,
                    method: 'POST',
                    data: payload,
                    contentType: 'application/json',
                    dataType: 'json',
                    headers: {'x-auth-token': window.config.token},
                    success: function (data) {
                        if (data?.data?.tool_domain === 'action') {
                            $f7.toast.show({
                                text: 'Thank you for opening a Service Request. We will get back to you soon.',
                                cssClass: 'color-green'
                            });

                            const newMessageId = window.SIMBA.Utils.generateUniqueId("assistant-thinking");
                            $(".shimmer-text-fast").removeClass("shimmer-text-fast");

                            const message = md.render(buildServiceRequestMessage(data.data));
                            messages.addMessage({
                                attrs: {"data-id": newMessageId, "id": newMessageId},
                                isTitle: false,
                                text: message,
                                textFooter: footerTemplate,
                                cssClass: 'card no-margin-top padding-half',
                                avatar: assistant.avatar,
                                type: 'received',
                            }, 'append', true);

                            messageManager.addMessage('assistant', message);
                            closePopupTicket(true);
                        }
                    }
                });
                setTimeout(() => {
                    if (updatedConfig.voiceEnabled && !voiceManager) {
                        initializeVoiceManager();
                    }
                    updateTemplate();
                }, 100);
            }
        });
    };

    let buildServiceRequestMessage = function (response) {
        const {ticket_id, guid, url, created_at} = response;
        const formattedDate = window.SIMBA.Utils.formatDate(created_at);

        return `
## Service Request Created Successfully

Your service request has been submitted and assigned the following ID:

**${ticket_id}**

Created on: ${formattedDate}

You can <a href="#" onclick="viewDocument('${url}','${ticket_id}')" class="link icon-only" target="_blank">click here to view details</a> or track the progress of your request.

Thank you for your patience. Our support team will review your request shortly.
`;
    };

    let initializeActionsCustomLayout = function () {
        actionsCustomLayout = $f7.actions.create({
            el: $el.value.find('#actions-custom-layout'),
            closeByBackdropClick: false,
            closeByOutsideClick: false,
            closeOnEscape: false
        });
    };
    let initializePopoverTools = function () {
        popoverTools = $f7.popover.create({
            el: $el.value.find('#popover-tools')
        });
    };
    let initPopoverSelection = function () {
        popoverSelection = $f7.popover.create({
            el: $el.value.find('#popover-selection')
        });

        document.addEventListener('contextmenu', function (event) {
            const selection = window.getSelection();
            const selectedTextValue = selection.toString().trim();

            if (selectedTextValue.length > 0) {
                event.preventDefault();
                selectedText = selectedTextValue; // <-- A�ADIR ESTA L�NEA
                handleTextSelection(event, selectedTextValue, selection);
            }
        });
    };

    /**
     * Handles text selection for highlighting
     */
    let handleTextSelection = function (event, selectedText, selection) {
        const targetElement = event.target;
        let isMessageText = false;
        let isAlreadyHighlighted = false;

        // Check if already highlighted
        if (targetElement.classList?.contains('highlighted-text') ||
            targetElement.classList?.contains('reporting-highlight')) {

            const elementId = targetElement.id;
            if (elementId) {
                highlightManager.remove(elementId);

                // Remove from DOM
                const parent = targetElement.parentNode;
                parent.insertBefore(document.createTextNode(targetElement.textContent), targetElement);
                parent.removeChild(targetElement);

                updateTemplate();
                selection.removeAllRanges();
                return;
            }
        }

        // Check if in message text
        let currentElement = targetElement;
        while (currentElement && currentElement !== document.body) {
            if (currentElement.classList?.contains('message-text')) {
                isMessageText = true;
                break;
            }
            currentElement = currentElement.parentElement;
        }

        if (isMessageText && !isAlreadyHighlighted) {
            try {
                const range = selection.getRangeAt(0);
                const highlightSpan = document.createElement('span');
                highlightSpan.style.backgroundColor = '#415c8d';
                highlightSpan.style.color = 'black';
                highlightSpan.className = 'highlighted-text';

                const myId = window.SIMBA.Utils.generateUniqueId('highlight');
                highlightSpan.id = myId;

                try {
                    range.surroundContents(highlightSpan);
                } catch (e) {
                    const contents = range.extractContents();
                    highlightSpan.appendChild(contents);
                    range.insertNode(highlightSpan);
                }

                const rect = highlightSpan.getBoundingClientRect();
                const tempTarget = document.createElement('div');
                tempTarget.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.bottom}px;width:1px;height:1px;pointer-events:none;`;
                tempTarget.id = 'temp-popover-target';
                document.body.appendChild(tempTarget);

                const popoverEl = document.getElementById('popover-selection');
                if (popoverEl) {
                    popoverEl.setAttribute('data-selected-text', selectedText);
                    popoverEl.setAttribute('data-selected-id', myId);
                }

                popoverEl.addEventListener('popover:close', () => {
                    setTimeout(() => {
                        app.$("#popover-selection").find('.input-clear-button').trigger("click");
                    }, 1000);
                    clearHighlights();
                });

                if (popoverSelection) {
                    popoverSelection.open('#temp-popover-target');
                }

                setTimeout(() => {
                    const tempEl = document.getElementById('temp-popover-target');
                    if (tempEl) {
                        document.body.removeChild(tempEl);
                    }
                }, 100);

            } catch (error) {
                console.error('Error in highlighting process:', error);
            }
        }
    };

    let copyToClipboard = function () {
        const popoverEl = document.getElementById('popover-selection');
        const selectedText = popoverEl.getAttribute('data-selected-text');

        if (selectedText) {
            window.SIMBA.Utils.copyToClipboard(selectedText)
                .then(() => {
                    app.toast.create({
                        text: 'Text copied to clipboard',
                        position: 'center',
                        closeTimeout: 1500,
                    }).open();
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    app.toast.create({
                        text: 'Failed to copy text',
                        position: 'center',
                        closeTimeout: 1500,
                    }).open();
                });
        }
    };

    let highlightForReporting = function () {
        const popoverEl = document.getElementById('popover-selection');
        const selectedId = popoverEl.getAttribute('data-selected-id');
        const selectedText = popoverEl.getAttribute('data-selected-text');

        const highlightEl = document.getElementById(selectedId);
        if (highlightEl) {
            highlightEl.style.backgroundColor = '#333333';
            highlightEl.style.color = 'yellow';
            highlightEl.classList.add('reporting-highlight');

            // Use SIMBA highlight manager
            highlightManager.add(selectedId, selectedText);

            highlightEl.setAttribute('data-persistent', 'true');
            updateTemplate();
            popoverSelection.close();
        }
    };

    let clearHighlights = function () {
        // Clear temporary highlights that don't have data-persistent
        document.querySelectorAll('.highlighted-text:not([data-persistent])').forEach(el => {
            const parent = el.parentNode;
            parent.insertBefore(document.createTextNode(el.textContent), el);
            parent.removeChild(el);
        });
    };
    let clearAllFiles = function() {
        // Limpiar imágenes
        Object.keys(loadedImages).forEach(imageName => {
            if (loadedImages[imageName].url) {
                URL.revokeObjectURL(loadedImages[imageName].url);
            }
        });
        loadedImages = {};

        // 🆕 Limpiar otros archivos
        Object.keys(loadedFiles).forEach(fileName => {
            if (loadedFiles[fileName].url) {
                URL.revokeObjectURL(loadedFiles[fileName].url);
            }
        });
        loadedFiles = {};

        console.log("✅ All files cleared from loadedImages and loadedFiles");
    };

// 6. OPCIONAL: Modificar clearAllImages existente para que llame a clearAllFiles
    let clearAllImages = function() {
        clearAllFiles(); // Llama a la nueva función que limpia todo
    };

    // ===========================================
    // CONFIGURATION MANAGEMENT
    // ===========================================

    let initializePopupConfig = function () {
        popupConfig = $f7.popup.create({
            el: $el.value.find('#popup-config')
        });
    };

    let openPopupConfig = async function () {
        console.log('🔧 Opening config popup');
        console.log('Current config:', config);

        popupConfig.open();

        const loadingToast = $f7.toast.create({
            text: '⏳ Loading available models...',
            position: 'center',
            closeTimeout: 3000
        });
        loadingToast.open();

        try {
            await loadAvailableModels();

            if (availableModels.length > 0) {
                loadingToast.close();
                $f7.toast.show({
                    text: `✅ ${availableModels.length} models loaded`,
                    position: 'center',
                    closeTimeout: 2000,
                    cssClass: 'color-green'
                });
            } else {
                loadingToast.close();
                $f7.toast.show({
                    text: '⚠️ Could not load models, using manual input',
                    position: 'center',
                    closeTimeout: 3000,
                    cssClass: 'color-orange'
                });
            }
        } catch (error) {
            console.error('Error loading models:', error);
            loadingToast.close();
            $f7.toast.show({
                text: '⚠️ Models unavailable, using manual input',
                position: 'center',
                closeTimeout: 3000,
                cssClass: 'color-orange'
            });
        }

        // ✅ Renderizar Model con categorías: chat, reasoning
        renderModelField(
            'model',
            'Model',
            config.model || DEFAULT_MODEL,
            '#model-field-container',
            ['chat', 'reasoning']  // ✅ Solo chat y reasoning
        );

        // ✅ Renderizar Summary Model con categorías: chat, reasoning
        renderModelField(
            'summary_model',
            'Summary Model',
            config.summaryModel || SUMMARY_MODEL,
            '#summary-model-field-container',
            ['chat', 'reasoning']  // ✅ Solo chat y reasoning
        );

        // ✅ Renderizar Vision Model con categoría: vision
        renderModelField(
            'vision_model',
            'Vision Model',
            config.visionModel || VISION_MODEL,
            '#vision-model-field-container',
            ['vision']  // ✅ Solo vision
        );

        updateTemplate();
    };

    let closePopupConfig = function () {
        formConfigValidator.resetForm();
        popupConfig.close();
    };

    let initializeConfigFormValidator = function() {
        const formElement = $el.value.find('form[name=config]');

        if (!formElement.length) {
            console.error('❌ Config form not found');
            return;
        }

        console.log('✅ Initializing config form validator');

        formConfigValidator = jQuery(formElement).validate({
            rules: {
                api_url: { required: true },
                token: { required: true, minlength: 10 },
                completion_url: { required: true },
                api_key: { required: true, minlength: 10 },
                model: { required: true },
                max_tokens: { required: true, min: 100, max: 100000 },
                token_limit: { required: true, min: 1000, max: 200000 },
                temperature: { required: true, min: 0, max: 2 },
                tool_temperature: { required: true, min: 0, max: 2 },
                summary_model: { required: true },
                voice_language: { required: true },
                max_recording_time: { required: true, min: 5, max: 300 }
            },
            messages: {
                api_url: { required: 'Please enter the API URL.' },
                token: {
                    required: 'Please enter the authentication token.',
                    minlength: 'Token seems too short.'
                },
                completion_url: { required: 'Please enter the completion URL.' },
                api_key: {
                    required: 'Please enter the API key.',
                    minlength: 'API key seems too short.'
                },
                model: { required: 'Please enter the model name.' },
                max_tokens: {
                    required: 'Please enter max tokens.',
                    min: 'Minimum is 100 tokens.',
                    max: 'Maximum is 100,000 tokens.'
                },
                token_limit: {
                    required: 'Please enter token limit.',
                    min: 'Minimum is 1,000 tokens.',
                    max: 'Maximum is 200,000 tokens.'
                },
                temperature: {
                    required: 'Please enter temperature.',
                    min: 'Minimum is 0.',
                    max: 'Maximum is 2.'
                },
                tool_temperature: {
                    required: 'Please enter tool temperature.',
                    min: 'Minimum is 0.',
                    max: 'Maximum is 2.'
                },
                summary_model: { required: 'Please enter summary model.' },
                voice_language: { required: 'Please select a voice language.' },
                max_recording_time: {
                    required: 'Please enter max recording time.',
                    min: 'Minimum is 5 seconds.',
                    max: 'Maximum is 300 seconds (5 minutes).'
                }
            },
            submitHandler: function(form) {
                console.log('📝 Config form submitted');

                const formData = $f7.form.convertToData(form);
                console.log('📋 Form data:', formData);

                const updatedConfig = {
                    assistantApiUrl: formData.api_url,
                    assistantAuthToken: formData.token,
                    completionsApiUrl: formData.completion_url,
                    completionsApiKey: formData.api_key,
                    model: formData.model,
                    summaryModel: formData.summary_model,
                    visionModel: formData.vision_model, // ✅ NUEVO
                    maxTokens: parseInt(formData.max_tokens),
                    tokenLimit: parseInt(formData.token_limit),
                    temperature: parseFloat(formData.temperature),
                    toolTemperature: parseFloat(formData.tool_temperature),

                    // Voice config...
                    voiceEnabled: formData.voice_enabled === 'on' || formData.voice_enabled === true || formData.voice_enabled === 'true',
                    voiceLanguage: formData.voice_language,
                    maxRecordingTime: parseInt(formData.max_recording_time),
                    voiceAutoSend: formData.voice_auto_send === 'on' || formData.voice_auto_send === true || formData.voice_auto_send === 'true',
                    voiceShowButton: formData.voice_show_button === 'on' || formData.voice_show_button === true || formData.voice_show_button === 'true',
                    voiceContinuous: formData.voice_continuous === 'on' || formData.voice_continuous === true || formData.voice_continuous === 'true',
                    echoCancellation: formData.echo_cancellation === 'on' || formData.echo_cancellation === true || formData.echo_cancellation === 'true',
                    noiseSuppression: formData.noise_suppression === 'on' || formData.noise_suppression === true || formData.noise_suppression === 'true',
                    autoGainControl: formData.auto_gain_control === 'on' || formData.auto_gain_control === true || formData.auto_gain_control === 'true'
                };

                console.log('💾 Saving config:', updatedConfig);

                configManager.updateConfig(updatedConfig);

                // Actualizar variables globales
                TOKEN_LIMIT = updatedConfig.tokenLimit;
                MAX_TOKENS = updatedConfig.maxTokens;
                DEFAULT_TEMPERATURE = updatedConfig.temperature;
                DEFAULT_MODEL = updatedConfig.model;
                SUMMARY_MODEL = updatedConfig.summaryModel;
                VISION_MODEL = updatedConfig.visionModel; // ✅ NUEVO
                updateCurrentModelCategory();
                console.log('✅ Global variables updated:', {
                    TOKEN_LIMIT,
                    MAX_TOKENS,
                    DEFAULT_TEMPERATURE,
                    DEFAULT_MODEL,
                    SUMMARY_MODEL,
                    VISION_MODEL // ✅ NUEVO
                });

                // ... resto del código (VoiceManager, etc.)

                if (voiceManager && !updatedConfig.voiceEnabled) {
                    voiceManager.destroy().catch(console.error);
                    voiceManager = null;
                    voiceSupported = false;
                } else if (updatedConfig.voiceEnabled) {
                    if (voiceManager) {
                        voiceManager.switchLanguage(updatedConfig.voiceLanguage);
                        voiceManager.config.maxRecordingTime = updatedConfig.maxRecordingTime * 1000;
                    } else {
                        initializeVoiceManager();
                    }
                }

                if (toolManager) {
                    toolManager.updateConfig(configManager.getConfig());
                }

                messageManager.MAX_TOKENS = MAX_TOKENS;
                messageManager.TOKEN_LIMIT = TOKEN_LIMIT;

                console.log('✅ Configuration saved successfully');

                $f7.toast.show({
                    text: 'Configuration saved successfully',
                    cssClass: 'color-green',
                    closeTimeout: 3000
                });

                updateTemplate();
                closePopupConfig();
            }
        });

        // ✅ Event listener mejorado - sin llamar a submit()
        formElement.on('submit', function(e) {
            e.preventDefault(); // Prevenir comportamiento por defecto
            e.stopPropagation(); // Evitar que el evento se propague

            console.log('🔧 Form submit event triggered');

            // jQuery Validate se encarga automáticamente de:
            // 1. Validar el formulario
            // 2. Si es válido, ejecutar submitHandler
            // 3. Si no es válido, mostrar errores

            // ❌ NO HACER ESTO: $(this).submit();
            // ✅ jQuery Validate ya maneja todo automáticamente
        });

        console.log('✅ Config form validator initialized');
    };

    let initializePopoverText = function () {
        popoverText = $f7.popover.create({
            el: $el.value.find('#popover-text'),
            on: {
                closed: function () {
                    myReference = null;
                    updateTemplate();
                }
            }
        });
    };

    // ===========================================
    // UTILITY FUNCTIONS
    // ===========================================

    let setupDocumentUpload = function () {
        const fileInput = document.getElementById('document-upload');
        fileInput.addEventListener('change', function (e) {
            // AGREGAR ESTA VERIFICACI�N AL INICIO
            if (!isFileUploadAllowed()) {
                $f7.toast.show({
                    text: 'File upload is disabled for this assistant.',
                    position: 'center',
                    closeTimeout: 3000,
                    cssClass: 'color-red'
                });
                e.target.value = ''; // Limpiar input
                return;
            }

            // C�digo original
            if (e.target.files && e.target.files.length > 0) {
                if (window.myFileDropzone) {
                    window.myFileDropzone.handleFiles(e.target.files);
                }
            }
        });
    };

    let handleFileUploadClick = function () {
        if (!isFileUploadAllowed()) {
            $f7.toast.show({
                text: 'File upload is disabled for this assistant.',
                position: 'center',
                closeTimeout: 3000,
                cssClass: 'color-red'
            });
            return;
        }

        // C�digo original
        const fileInput = document.getElementById('document-upload');
        fileInput.click();
    };

    let openSourcePanel = function (messageId) {
        if (messageId) {
            const messageSources = sourceManager.getByMessageId(messageId);
            if (messageSources && messageSources.length > 0) {
                renderSourcesInPanel(messageSources);

                $(".source").each(function () {
                    $(this).on('mouseover touchstart', function () {
                        const elementId = $(this).attr('id');
                        $('.reference[data-guid="' + elementId + '"]').addClass('listening-button');
                    }).on('mouseout touchend', function () {
                        const elementId = $(this).attr('id');
                        $('.reference[data-guid="' + elementId + '"]').removeClass('listening-button');
                    });
                });

                app.panel.open('right');
            }
        }
    };

    let renderSourcesInPanel = function (sources) {
        const container = document.getElementById('panel-sources-content');
        if (!container) return;

        container.innerHTML = `
<div class="no-shadow">
    <div class="card-content">
        <div class="list media-list margin-top-auto">
            <ul>
                ${sources.map((item) => {
            const finalSource = (item.source.startsWith('http://') || item.source.startsWith('https://'))
                ? item.source
                : 'https://itc.simeng.es/' + item.source;

            return `
                    <li>
                        <a href="#" onclick="viewDocument('${finalSource}','${item.name}')" id="${item.guid}" class="source color-white link icon-only">
                            <div class="item-content">
                                <div class="item-media"><i class="${item.icon}"></i></div>
                                <div class="item-inner">
                                    <div class="source-title item-title">${item.name}</div>
                                    <div class="source-summary item-text">${item.summary}</div>
                                    <div class="source-extra item-text">${item.site} - ${item.device} - ${item.id}</div>
                                </div>
                            </div>
                        </a>
                    </li>
                    `;
        }).join('')}
            </ul>
        </div>
    </div>
</div>
`;
    };

    let getObjectAndTextByGuid = function (sources, guid, page, section) {
        console.log(sources);
        if (!sources) return null;

        const foundObject = sources[guid];//.find(item => item.guid === guid);
        console.log(getObjectAndTextByGuid,foundObject)
        if (!foundObject) return null;

        let extractedText = null;
        if (page !== undefined && section !== undefined && foundObject.references) {
            const foundReference = foundObject.references.find(ref =>
                ref.page === page && ref.section === section
            );
            if (foundReference) {
                extractedText = foundReference.text;
            }
        }

        if (extractedText === null && foundObject.text) {
            const words = foundObject.summary ? foundObject.summary.split(/\s+/) : foundObject.text.split(/\s+/);
            extractedText = words.slice(0, 10).join(' ') + (words.length > 10 ? '...' : '');
        }

        return {
            sourceObject: foundObject,
            extractedText: extractedText
        };
    };



    let likeMessage = function (messageId) {
        console.log('Message liked:', messageId);
        $f7.toast.show({
            text: 'Thank you for your feedback!',
            cssClass: 'color-green',
            closeTimeout: 2000
        });
    };


    /**
     * Handles stask execution from file dropzone
     */
    let handleStaskExecution = function (file, text) {
        const stask = {file: file, procedure: text};
        localStorage.setItem('stask', JSON.stringify(stask));

        popupTask = app.popup.create({
            destroyOnClose: false, //
            content: `
            <div class="popup popup-tablet-fullscreen">
                <div class="view">
                    <div class="page">
                        <div class="navbar">
                            <div class="navbar-bg"></div>
                            <div class="navbar-inner">
                                <div class="title">${text.procedure.name}</div>
                                <div class="right">
                                    <a href="#" class="link popup-close"><i class="fa fa-close"></i></a>
                                </div>
                            </div>
                        </div>

                        <div class="page-content hide-navbar-on-scroll">
                            <iframe src="https://mysimba.simeng.es/#!/screens/walkthrough/"
                                style="width:100%; height:100%; border:none;"
                                frameborder="0"></iframe>
                        </div>
                    </div>
                </div>
            </div>
        `,
            on: {
                opened: function () {
                    console.log('Stask popup opened');
                }
            }
        }).open();
        $update();
    };

    // ===========================================
    // INITIALIZATION FUNCTIONS
    // ===========================================

    let initializeMessagebar = function () {
        messagebar = $f7.messagebar.create({
            el: $el.value.find('.messagebar-chat'),
            textareaEl: $el.value.find('.messagebar-chat textarea')
        });
    };

    let initializeMessages = function () {
        messages = $f7.messages.create({
            el: $el.value.find('.messages'),
            scrollMessages: true,
            autoLayout: true,
            scrollMessagesOnEdge: true,
            firstMessageRule: function (message, previousMessage, nextMessage) {
                if (message && !message.isTitle && (!previousMessage || previousMessage.type !== message.type || previousMessage.name !== message.name)) {
                    return true;
                }
                return false;
            },
            lastMessageRule: function (message, previousMessage, nextMessage) {
                if (message && !message.isTitle && (!nextMessage || nextMessage.type !== message.type || nextMessage.name !== message.name)) {
                    return true;
                }
                return false;
            },
            tailMessageRule: function (message, previousMessage, nextMessage) {
                if (message && !message.isTitle && (!nextMessage || nextMessage.type !== message.type || nextMessage.name !== message.name)) {
                    return true;
                }
                return false;
            }
        });
    };
    let initializeFileDropzone = function() {
        if (chat && chat.mainAssistant && chat.mainAssistant.activeDropzone === false) {
            console.log('File dropzone disabled for this assistant');
            return null;
        }

        const imageAnalysisType = getImageAnalysisType();

        const dropzone = new FileDropzone({
            dropzoneId: 'file-dropzone',
            fileInputId: 'file-upload',
            textareaId: 'prompt',
            useSimbaDocumentTags: true,
            framework7: $f7,
            enableSqlQueries: true,

            // NUEVO: Configurar capacidades de imagen
            imageAnalysisType: imageAnalysisType, // 'OCR', 'Vision', o null
            allowImages: imageAnalysisType !== null,

            onFileAdded: function (file) {
                console.log("File added:", file.name);

                // Verificar si es imagen y est� permitida
                if (file.type.startsWith('image/') && !isImageUploadAllowed()) {
                    if ($f7) {
                        $f7.toast.show({
                            text: 'Images are not allowed for this assistant.',
                            position: 'center',
                            closeTimeout: 3000,
                            cssClass: 'color-red'
                        });
                    }
                    return false; // Rechazar el archivo
                }
            },

            onFileRemoved: function (file) {
                console.log("File removed:", file.name);


            },
            onTextExtracted: function (file, text) {
                console.log("Text extracted from", file.name);
            },
            onStaskExecuted: function (file, text) {
                handleStaskExecution(file, text);
            },
            onAllFilesProcessed: function (files) {
                console.log("All files processed:", files.length);
            }
        });

        return dropzone;
    };
    /**
     * Actualiza el estado del dropzone seg�n activeDropzone
     */
    let updateDropzoneState = function() {
        const isDropzoneActive = chat && chat.mainAssistant && chat.mainAssistant.activeDropzone !== false;
        const imageAnalysisType = getImageAnalysisType();

        console.log('?? Updating dropzone state:', {
            isDropzoneActive,
            imageAnalysisType,
            allowImages: imageAnalysisType !== null,
            currentAssistant: assistant?.name
        });

        if (!isDropzoneActive) {
            // Deshabilitar dropzone completamente
            if (window.myFileDropzone) {
                // ? Limpiar TODOS los archivos antes de deshabilitar
                if (window.myFileDropzone.hasFiles()) {
                    window.myFileDropzone.clearFiles();
                }
                window.myFileDropzone.disable();
            }
        } else {
            // Habilitar dropzone
            if (!window.myFileDropzone) {
                // Crear nuevo dropzone con la configuraci�n correcta
                window.myFileDropzone = initializeFileDropzone();
            } else {
                // ? IMPORTANTE: Habilitar ANTES de actualizar configuraci�n
                window.myFileDropzone.enable();

                // Actualizar configuraci�n de an�lisis de im�genes
                window.myFileDropzone.updateImageAnalysisType(imageAnalysisType);

                // Si el nuevo asistente no permite im�genes, remover im�genes existentes
                if (imageAnalysisType === null) {
                    const currentFiles = window.myFileDropzone.getFiles();
                    const imageFiles = currentFiles.filter(file =>
                        window.myFileDropzone._getFileType(file) === 'image'
                    );

                    if (imageFiles.length > 0) {
                        console.log('Removing ' + imageFiles.length + ' images (not allowed by new assistant)');

                        imageFiles.forEach(function(imageFile) {
                            window.myFileDropzone.removeFile(imageFile.name);
                        });

                        if ($f7) {
                            $f7.toast.show({
                                text: 'Images removed - not supported by this assistant',
                                position: 'center',
                                closeTimeout: 3000,
                                cssClass: 'color-orange'
                            });
                        }
                    }
                }
            }
        }

        updateTemplate();
    };
    /**
     * Verifica si est� permitido subir archivos
     */
    let isFileUploadAllowed = function() {
        return chat && chat.mainAssistant && chat.mainAssistant.activeDropzone !== false;
    };
    let cleanupCharts = function() {
        if (chartGenerator) {
            chartGenerator.destroyAllCharts();
            console.log('?? All charts cleaned up');
        }
    };

    let initializeVoiceManager = function() {
        try {
            // Inicializar configuraci�n de voz
            const voiceConfigData = initializeVoiceConfig();

            // Verificar si voice est� habilitado
            if (voiceConfigData.voiceEnabled === false) {
                console.log('?? Voice features disabled by configuration');
                voiceSupported = false;
                updateTemplate();
                return;
            }

            voiceManager = new window.SIMBA.VoiceManager({
                engine: 'webspeech',
                language: voiceConfigData.voiceLanguage || 'en-US',
                maxRecordingTime: (voiceConfigData.maxRecordingTime || 30) * 1000, // convertir a ms
                continuous: voiceConfigData.voiceContinuous || false,
                onRecordingStart: () => {
                    isRecording = true;
                    isProcessingVoice = false;
                    updateTextareaPlaceholder();
                    updateTemplate();
                },
                onRecordingStop: () => {
                    isRecording = false;
                    updateTextareaPlaceholder();
                    updateTemplate();
                },
                onProcessingStart: () => {
                    isProcessingVoice = true;
                    updateTextareaPlaceholder();
                    updateTemplate();
                },
                onProcessingEnd: () => {
                    isProcessingVoice = false;
                    updateTextareaPlaceholder();
                    updateTemplate();
                },
                onTranscriptionComplete: (result) => {
                    handleTranscriptionResult(result, voiceConfigData.voiceAutoSend);
                },
                onError: (error) => {
                    handleVoiceError(error);
                }
            });

            voiceSupported = voiceManager.isSupported();

            if (voiceSupported) {
                voiceManager.initialize()
                    .then(() => {
                        console.log('? Voice Manager initialized successfully');
                        updateTemplate();
                    })
                    .catch((error) => {
                        console.error('? Voice Manager initialization failed:', error);
                        voiceSupported = false;
                        updateTemplate();
                    });
            } else {
                console.warn('?? Voice recording not supported in this browser');
            }

        } catch (error) {
            console.error('? Error creating Voice Manager:', error);
            voiceSupported = false;
            updateTemplate();
        }
    };

    let showVoiceDisabledMessage = function() {
        $f7.toast.show({
            text: 'Voice features are disabled. Enable them in settings.',
            position: 'center',
            closeTimeout: 3000,
            cssClass: 'color-orange'
        });
    };



    let updateVoiceConfigByAssistant = function() {
        if (chat && chat.mainAssistant) {
            const assistantVoiceEnabled = chat.mainAssistant.voiceEnabled !== false;
            voiceConfig.enabled = assistantVoiceEnabled;

            if (assistantVoiceEnabled && !voiceManager) {
                initializeVoiceManager();
            }

            updateTemplate();
        }
    };

    let handleVoiceButtonClick = function() {
        if (!voiceManager || !voiceSupported) {
            $f7.toast.show({
                text: 'Voice recording is not supported in your browser',
                position: 'center',
                closeTimeout: 3000,
                cssClass: 'color-red'
            });
            return;
        }

        if (isRecording) {
            stopVoiceRecording();
        } else {
            startVoiceRecording();
        }
    };
    let toggleVoiceFeatures = function(enabled) {
        const currentConfig = configManager.getConfig();
        currentConfig.voiceEnabled = enabled;
        configManager.updateConfig(currentConfig);

        if (enabled && !voiceManager) {
            initializeVoiceManager();
        } else if (!enabled && voiceManager) {
            voiceManager.destroy().catch(console.error);
            voiceManager = null;
            voiceSupported = false;
            isRecording = false;
            isProcessingVoice = false;
        }

        updateTemplate();

        $f7.toast.show({
            text: `Voice features ${enabled ? 'enabled' : 'disabled'}`,
            cssClass: enabled ? 'color-green' : 'color-orange'
        });
    };

// 6. FUNCI�N PARA CAMBIAR IDIOMA DIN�MICAMENTE
    let changeVoiceLanguage = function(languageCode) {
        if (voiceManager) {
            voiceManager.switchLanguage(languageCode)
                .then(() => {
                    const currentConfig = configManager.getConfig();
                    currentConfig.voiceLanguage = languageCode;
                    configManager.updateConfig(currentConfig);

                    $f7.toast.show({
                        text: `Voice language changed to ${languageCode}`,
                        cssClass: 'color-blue'
                    });
                })
                .catch((error) => {
                    console.error('Error changing language:', error);
                    $f7.toast.show({
                        text: 'Failed to change voice language',
                        cssClass: 'color-red'
                    });
                });
        }
    };
    let startVoiceRecording = function() {
        if (!voiceManager) return;

        voiceManager.startRecording()
            .catch((error) => {
                console.error('? Failed to start recording:', error);
                $f7.toast.show({
                    text: 'Failed to start recording. Please check microphone permissions.',
                    position: 'center',
                    closeTimeout: 4000,
                    cssClass: 'color-red'
                });
            });
    };

    let stopVoiceRecording = function() {
        if (!voiceManager) return;

        voiceManager.stopRecording()
            .catch((error) => {
                console.error('? Failed to stop recording:', error);
            });
    };

    let checkMicrophonePermissions = function() {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' })
                .then((permissionStatus) => {
                    console.log('?? Microphone permission status:', permissionStatus.state);

                    permissionStatus.onchange = function() {
                        console.log('?? Microphone permission changed to:', this.state);
                        if (this.state === 'denied' && voiceManager) {
                            voiceSupported = false;
                            updateTemplate();
                        }
                    };
                })
                .catch(console.warn);
        }
    };

    let updateTextareaPlaceholder = function() {
        const textarea = document.getElementById('prompt');
        if (!textarea) return;

        const originalPlaceholder = assistant ? assistant.placeholder : 'Type your message...';

        if (isRecording) {
            textarea.placeholder = '?? Recording... Speak now';
        } else if (isProcessingVoice) {
            textarea.placeholder = '?? Processing voice...';
        } else {
            textarea.placeholder = originalPlaceholder;
        }
    };

    let handleTranscriptionResult = function(result, autoSend = false) {
        console.log('?? Transcription result:', result);

        if (result.text && result.text.trim()) {
            // Obtener el textarea y agregar el texto transcrito
            const promptTextarea = document.getElementById('prompt');
            if (promptTextarea) {
                const currentText = promptTextarea.value || '';
                const newText = currentText + (currentText ? ' ' : '') + result.text.trim();
                promptTextarea.value = newText;
                prompt = newText;

                // Hacer focus y posicionar cursor al final
                textAreaFocus(prompt)
                promptTextarea.setSelectionRange(newText.length, newText.length);

                // Trigger input event para actualizar el estado
                promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            }

            updateTemplate();

            // Auto-send si est� habilitado
            if (autoSend) {
                $f7.toast.show({
                    text: `Voice transcribed and sending: "${result.text.trim()}"`,
                    position: 'center',
                    closeTimeout: 2000,
                    cssClass: 'color-blue'
                });

                // Enviar autom�ticamente despu�s de un breve delay
                setTimeout(() => {
                    sendPrompt();
                }, 500);
            } else {
                // Mostrar toast de confirmaci�n normal
                $f7.toast.show({
                    text: `Voice transcribed: "${result.text.trim()}"`,
                    position: 'center',
                    closeTimeout: 3000,
                    cssClass: 'color-green'
                });
            }
        } else {
            $f7.toast.show({
                text: 'No speech detected. Please try again.',
                position: 'center',
                closeTimeout: 3000,
                cssClass: 'color-orange'
            });
        }
    };

    let handleVoiceError = function(error) {
        console.error('?? Voice error:', error);

        isRecording = false;
        isProcessingVoice = false;
        updateTemplate();

        let errorMessage = 'Voice recording failed';

        if (error.message.includes('Permission')) {
            errorMessage = 'Microphone permission denied. Please allow microphone access.';
        } else if (error.message.includes('NotFound')) {
            errorMessage = 'No microphone found. Please connect a microphone.';
        } else if (error.message.includes('initialization')) {
            errorMessage = 'Voice recognition service failed to initialize';
        }

        $f7.toast.show({
            text: errorMessage,
            position: 'center',
            closeTimeout: 4000,
            cssClass: 'color-red'
        });
    };

    let initializeVoiceConfig = function() {
        const defaultVoiceConfig = {
            voiceEnabled: true,
            voiceLanguage: 'en-US',
            maxRecordingTime: 30, // segundos
            voiceAutoSend: false,
            voiceShowButton: false,
            voiceContinuous: false,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        };

        // Obtener configuraci�n actual y hacer merge con defaults
        const currentConfig = configManager.getConfig();
        const mergedConfig = { ...defaultVoiceConfig, ...currentConfig };

        // Actualizar solo si hay campos nuevos
        if (!currentConfig.voiceLanguage) {
            configManager.updateConfig(mergedConfig);
        }

        return mergedConfig;
    };
    let openConversationsSidebar = function() {
        // Cargar la p�gina del sidebar
        app.views.sidebar.router.navigate('/screens/conversation-list');
        // Abrir el sidebar
        app.panel.open('left');
    };
    let renderExistingMessages = function(messagesArray) {
        const visibleMessages = messagesArray.filter(msg => msg.role !== 'system');
        const currentConfig = configManager.getConfig();
        const contextLocation = currentConfig.documentContextLocation || 'system';

        visibleMessages.forEach((message, index) => {
            const messageId = message.id || `restored-msg-${Date.now()}-${index}`;

            if (message.role === 'user') {
                let displayContent = message.content;

                // Si los documentos est�n en el mensaje de usuario, limpiarlos para UI
                if (contextLocation === 'user') {
                    displayContent = displayContent.replace(/=== REFERENCE DOCUMENTS ===[\s\S]*?=== END OF DOCUMENTS ===/g, '');
                    displayContent = displayContent.replace(/=== QUESTION ===/g, '').trim();
                }

                // Limpiar im�genes (se muestran en header)
                displayContent = displayContent.replace(/<simba_image[^>]*>[\s\S]*?<\/simba_image>/g, '');

                messages.addMessage({
                    attrs: {"data-id": messageId, "id": messageId},
                    isTitle: false,
                    text: `<p class="no-margin-top float-left">${md.render(displayContent)}</p>`,
                    name: 'User',
                    cssClass: 'sent card no-margin-top padding-half',
                    type: 'received',
                    avatar: 'https://ui-avatars.com/api/?name=User',
                    textFooter: footerTemplate
                }, 'append', false);

            } else if (message.role === 'assistant') {
                messages.addMessage({
                    attrs: {"data-id": messageId, "id": messageId},
                    isTitle: false,
                    text: md.render(processAndRenderMarkdown(message.content)),
                    name: assistant.name,
                    cssClass: 'card no-margin-top padding-half',
                    textFooter: footerTemplate,
                    avatar: assistant.avatar,
                    type: 'received',
                }, 'append', false);

                // Agregar fuentes y acciones para mensajes del asistente
                const $messageEl = $('#' + messageId);
                addSourcesToMessage($messageEl);
                addActionsToMessage($messageEl);
            }

            // Procesar el mensaje agregado
            onMessageAdded($('#' + messageId));
        });

        // Hacer referencias clickeables
        makeClickableReferences();
        makeClickableSuggestions()

        // Scroll al final
        setTimeout(() => {
            scrollToBottom();
        }, 500);
    };
    let loadAssistantData = function(assistantGuid) {
        return new Promise((resolve, reject) => {
            $f7.request({
                url: `${window.config.api_methods.load_assistant}?assistant=${assistantGuid}`,
                method: 'GET',
                headers: {
                    'x-auth-token': window.config.token,
                    'Content-Type': 'application/json'
                },
                dataType: 'json'
            }).then((response) => {
                console.log('Assistant data loaded:', response.data);
                resolve(response.data.data);
            }).catch((error) => {
                console.error('Error loading assistant data:', error);
                reject(error);
            });
        });
    };
    let loadExistingConversation = async function(conversationId) {
        try {
            console.log('Loading existing conversation:', conversationId);

            // Cargar la conversaci�n desde localStorage
            const conversation = await conversationManager.loadConversation(conversationId);

            if (!conversation) {
                console.error('Conversation not found:', conversationId);
                $f7.toast.show({
                    text: 'Conversation not found',
                    cssClass: 'color-red'
                });
                return;
            }

            // Actualizar el asistente actual
            const foundAssistant = assistants.find(a => a.guid === conversation.assistant.guid);
            if (foundAssistant) {
                assistant = foundAssistant;
            } else {
                assistant = conversation.assistant;
            }

            // NUEVO: Cargar informaci�n completa del asistente desde la API
            const assistantData = await loadAssistantData(conversation.assistant.guid);

            if (!assistantData) {
                throw new Error('Failed to load assistant data');
            }

            // Configurar el chat con la informaci�n completa del asistente
            chat = {
                guid: conversationId,
                title: conversation.title,
                mainAssistant: assistantData.mainAssistant,
                tools: assistantData.tools || [],
                tools_setup: assistantData.tools_setup || {},
                activeTools: conversation.tools || assistantData.tools || [],
                instructions: assistantData.instructions || [],
                noSelectionInstructions: (assistantData.instructions || []).filter(instruction => !instruction.isSelection)
            };

            // Actualizar assistant con la informaci�n completa
            assistant.name = assistantData.mainAssistant.name;
            assistant.avatar = window.config.domain + assistantData.mainAssistant._myMedias.avatars[0].realPath;
            assistant.mainImage = window.config.domain + assistantData.mainAssistant._myMedias.mainImage[0].realPath;
            assistant.greeting = assistantData.mainAssistant.greeting;
            assistant.placeholder = assistantData.mainAssistant.placeholder;
            assistant.thinkIcon = assistantData.mainAssistant.thinkIcon || '??';

            // Restaurar device si existe
            if (conversation.device) {
                myDevice = conversation.device;
            }

            // Inicializar tool manager con el chat cargado
            toolManager = new window.SIMBA.ToolManager(chat, configManager.getConfig());

            // Inicializar herramientas activas
            initializeActiveTools();
            updateChatTools();

            // Restaurar el estado completo
            const restored = await conversationManager.restoreConversationState(
                conversation,
                messageManager,
                sourceManager,
                highlightManager,
                window.myFileDropzone
            );

            if (restored) {
                console.log('? Conversation state restored successfully');

                // Renderizar mensajes en la UI
                renderExistingMessages(conversation.messages);

                // Actualizar dropzone y template
                updateDropzoneState();
                updateTemplate();

                $f7.toast.show({
                    text: 'Conversation loaded successfully',
                    cssClass: 'color-green',
                    closeTimeout: 2000
                });
            } else {
                throw new Error('Failed to restore conversation state');
            }

        } catch (error) {
            console.error('Error loading conversation:', error);
            $f7.toast.show({
                text: 'Error loading conversation',
                cssClass: 'color-red'
            });
        }
    };
    /**
     * Verifica si las API keys est�n configuradas
     * @returns {Object} - Estado de las API keys
     */
    let checkRequiredApiKeys = function() {
        const config = configManager.getConfig();

        return {
            hasAssistantApi: !!(config.assistantApiUrl && config.assistantAuthToken),
            hasCompletionApi: !!(config.completionsApiUrl && config.completionsApiKey),
            isComplete: function() {
                return this.hasAssistantApi && this.hasCompletionApi;
            }
        };
    };
    /**
     * Inicializa el popup de API keys
     */
    let initializePopupApiKeys = function() {
        popupApiKeys = $f7.popup.create({
            el: $el.value.find('#popup-api-keys'),
            closeByBackdropClick: false,
            closeOnEscape: false,
            swipeToClose: false
        });
    };

    /**
     * Inicializa el validador del formulario de API keys
     */
    let initializeApiKeysFormValidator = function() {
        formApiKeysValidator = jQuery($el.value.find('form[name=api-keys]')).validate({
            rules: {
                assistant_auth_token: { required: true, minlength: 10 },
                completion_api_key: { required: true, minlength: 10 }
            },
            messages: {
                assistant_auth_token: {
                    required: 'Please enter your mySim API key.',
                    minlength: 'API key seems too short.'
                },

                completion_api_key: {
                    required: 'Please enter your Completion API key.',
                    minlength: 'API key seems too short.'
                }
            },
            submitHandler: function(form) {
                const formData = $f7.form.convertToData(form);

                // Actualizar configuraci�n con las API keys
                const updatedConfig = {
                    assistantAuthToken: formData.assistant_auth_token,
                    completionsApiKey: formData.completion_api_key
                };

                configManager.updateConfig(updatedConfig);

                // Actualizar variables globales si existen
                if (typeof window.config !== 'undefined') {
                    window.config.api_methods = window.config.api_methods || {};
                    window.config.token = formData.assistant_auth_token;
                    window.config.completion = {
                        url: formData.completion_api_url,
                        apiKey: formData.completion_api_key
                    };
                }

                $f7.toast.show({
                    text: 'API keys saved successfully!',
                    cssClass: 'color-green',
                    closeTimeout: 2000
                });

                // Cerrar popup y continuar con la inicializaci�n
                popupApiKeys.close();

                // Continuar con la carga normal de la aplicaci�n
                continueAppInitialization();
            }
        });
    };
    let processAndRenderMarkdown = function(text) {
let processedText = window.SIMBA.Utils.preprocessMarkdown(text);
let renderedHtml = md.render(processedText);

// Restaurar los spans despu?s de markdown
renderedHtml = renderedHtml.replace(/\[\[SIMBA_SUGGESTION:([^\]]+)\]\]/g, function(match, encoded) {
    return atob(encoded);
});

return renderedHtml;
};

    let cleanSimbaAfterCompletion = function() {
        console.log('?? Post-completion: Checking simba_document cleanup...');

        if (!messageManager) {
            console.warn('?? MessageManager not available');
            return { cleaned: false, reason: 'No messageManager' };
        }

        const totalTokens = messageManager.getTotalTokens();
        const tokenLimit = messageManager.TOKEN_LIMIT || TOKEN_LIMIT;

        // Contar simba_document actuales
        const systemContent = messageManager.messagesHistory[0]?.content || '';
        const simbaDocumentCount = (systemContent.match(/<simba_document[^>]*>/g) || []).length;

        console.log('?? Post-completion analysis:', {
            totalTokens,
            tokenLimit,
            simbaDocumentCount,
            tokenUsagePercent: Math.round((totalTokens / tokenLimit) * 100)
        });

        // CRITERIOS PARA LIMPIAR:
        // 1. Hay simba_document para limpiar
        // 2. Y CUALQUIERA de estas condiciones:
        //    - Estamos sobre 70% del l�mite
        //    - Hay m�s de 10 simba_document blocks
        //    - El sistema est� cerca de optimizaci�n

        const shouldClean = simbaDocumentCount > 0 && (
            totalTokens >= tokenLimit * 0.7 ||           // 70% del l�mite
            simbaDocumentCount > 10 ||                   // M�s de 10 blocks
            totalTokens >= tokenLimit * 0.85            // 85% - muy cerca del l�mite
        );

        if (shouldClean) {
            console.log(`?? Cleaning ${simbaDocumentCount} simba_document blocks...`);

            const result = messageManager.cleanAllSimbaDocumentsFromSystem();

            const newTotalTokens = messageManager.getTotalTokens();
            const efficiencyGain = Math.round(((tokenLimit - newTotalTokens) / tokenLimit) * 100);

            console.log(`? Cleanup completed: ${result.savedTokens} tokens saved`);
            console.log(`?? New usage: ${newTotalTokens}/${tokenLimit} (${100 - efficiencyGain}%)`);

            // Mostrar notificaci�n discreta
            $f7.toast.show({
                text: `?? Context optimized: ${result.savedTokens} tokens freed`,
                position: 'bottom',
                closeTimeout: 2000,
                cssClass: 'color-blue'
            });

            return {
                cleaned: true,
                ...result,
                newTotalTokens,
                efficiencyGain
            };
        } else {
            const reason = simbaDocumentCount === 0 ? 'No simba_document found' : 'Usage below threshold';
            console.log(`?? No cleanup needed: ${reason}`);
            return { cleaned: false, reason };
        }
    };
    /**
     * Obtiene el estado actual de reasoning directamente desde config
     * @returns {boolean}
     */
    let isReasoningEnabled = function() {
        const currentConfig = configManager.getConfig();
        // Si no existe en config, default es true
        return currentConfig.reasoningEnabled !== false;
    };
    // ===========================================
    // FRAMEWORK7 LIFECYCLE HOOKS
    // ===========================================

    $on('pageBeforeIn', function () {
        scrollToBottomBtn = document.getElementById('scrollToBottom');
        pageContent = document.getElementById('conversationPage');

        // Initialize various dialogs and popups
        initializeDialogChoiceChip();
        initializePopupTicket();
        initializeActionsCustomLayout();
        initializeFormValidator();
        initPopoverSelection();
        initializePopupApiKeys();
        initializeApiKeysFormValidator();
    });

    $on('pageBeforeOut', function () {
        // Resetear variables
        originalAssistant = null;
        showAssistantChip = false;
    });

    $on('pageAfterIn', function () {
        const hasAcceptedTerms = localStorage.getItem('terms_accepted');

        if (!hasAcceptedTerms) {
            $f7.views.main.router.navigate('/screens/terms/', {
                reloadCurrent: true,
                clearPreviousHistory: true
            });
            return;
        }

        // Verificar API keys DESPUÉS de los términos
        const apiKeysStatus = checkRequiredApiKeys();
        if (!apiKeysStatus.isComplete()) {
            console.log('API keys missing, showing configuration modal');

            // Inicializar popup si no existe
            if (!popupApiKeys) {
                initializePopupApiKeys();
                initializeApiKeysFormValidator();
            }

            // Mostrar popup
            popupApiKeys.open();
            return; // No continuar hasta que se configuren
        }
        loadAvailableModels().then(() => {
            console.log('✅ Models loaded on page init');



            // 3. Luego actualizar categoría (que ya tiene los modelos cargados)
            updateCurrentModelCategory();

            // 4. Finalmente actualizar template
            updateTemplate();

        }).catch(error => {
            console.error('❌ Error loading models on init:', error);
        });

        conversationManager = new SIMBA.ConversationManager(
            new SIMBA.LocalStorageProvider(),
            { autoSave: true, autoSaveInterval: 30000 }
        );

        loadAssistants().then(myAssistant => {
            console.log("Assistant loaded:", myAssistant);
            if (myAssistant) {
                // Verificar si viene de "New conversation" con un asistente específico
                const assistantGuid = $f7route.query.assistant;

                if (assistantGuid && $f7route.params.guid === 'new') {
                    // Caso: Nueva conversación con asistente específico
                    console.log('🆕 Creating new conversation with assistant:', assistantGuid);

                    // Primero cambiar al asistente correcto
                    const targetAssistant = assistants.find(a => a.guid === assistantGuid);
                    if (targetAssistant) {
                        assistant = targetAssistant;

                        // Crear conversación con ese asistente
                        createConversation(assistantGuid).then(() => {
                            console.log('✅ New conversation created with assistant');
                            updateCurrentModelCategory();

                            // Initialize mention manager
                            if (mentionManager) {
                                mentionManager.init();
                            }

                            updateDropzoneState();

                            const shouldInitVoice = voiceConfig.enabled;

                            if (shouldInitVoice) {
                                initializeVoiceManager();
                                checkMicrophonePermissions();
                            } else {
                                console.log('🔇 Voice features disabled by configuration');
                                voiceSupported = false;
                            }

                            scrollToBottomBtn = document.getElementById('scrollToBottom');
                            debouncedAutoScroll = createDebouncedAutoScroll();
                            console.log('✅ Debounced auto-scroll initialized');
                            pageContent.addEventListener('scroll', checkScrollPosition);
                            pageContent.addEventListener('scroll', handleUserScroll);
                            checkScrollPosition();

                            updateTemplate();
                        }).catch(error => {
                            console.error('Error creating new conversation:', error);
                            $f7.toast.show({
                                text: 'Error creating conversation',
                                cssClass: 'color-red'
                            });
                        });
                    } else {
                        console.error('Assistant not found:', assistantGuid);
                        $f7.toast.show({
                            text: 'Assistant not found',
                            cssClass: 'color-red'
                        });
                    }
                } else if ($f7route.params.guid && $f7route.params.guid !== 'new') {
                    // Caso: Cargar conversación existente
                    loadExistingConversation($f7route.params.guid);

                    // Initialize mention manager
                    if (mentionManager) {
                        mentionManager.init();
                    }

                    updateDropzoneState();
                    const shouldInitVoice = voiceConfig.enabled;

                    if (shouldInitVoice) {
                        initializeVoiceManager();
                        checkMicrophonePermissions();
                    } else {
                        console.log('🔇 Voice features disabled by configuration');
                        voiceSupported = false;
                    }
                    scrollToBottomBtn = document.getElementById('scrollToBottom');
                    debouncedAutoScroll = createDebouncedAutoScroll();
                    console.log('✅ Debounced auto-scroll initialized');
                    pageContent.addEventListener('scroll', checkScrollPosition);
                    pageContent.addEventListener('scroll', handleUserScroll);
                    checkScrollPosition();
                    updateTemplate();
                } else {
                    // Caso: Primera carga o conversación nueva sin asistente específico
                    // Initialize mention manager
                    if (mentionManager) {
                        mentionManager.init();
                    }

                    updateDropzoneState();
                    const shouldInitVoice = voiceConfig.enabled;

                    if (shouldInitVoice) {
                        initializeVoiceManager();
                        checkMicrophonePermissions();
                    } else {
                        console.log('🔇 Voice features disabled by configuration');
                        voiceSupported = false;
                    }
                    scrollToBottomBtn = document.getElementById('scrollToBottom');
                    debouncedAutoScroll = createDebouncedAutoScroll();
                    console.log('✅ Debounced auto-scroll initialized');
                    pageContent.addEventListener('scroll', checkScrollPosition);
                    pageContent.addEventListener('scroll', handleUserScroll);
                    checkScrollPosition();
                    updateTemplate();
                }
            } else {
                $f7.toast.show({
                    text: 'No assistant is available',
                    cssClass: 'color-red'
                });
            }
        }).catch(error => {
            console.error("Error loading assistants:", error);
        });

        updateChatTools();
        initializeChartGenerator();
        initializeMessagebar();
        initializeMessages();
        setupDocumentUpload();
        initializePopupConfig();
        initializePopoverText();
        initializeConfigFormValidator();
        initializePopoverTools();

        window.addEventListener('storage', function(e) {
            if (e.key === 'walkthroughProgress' && e.newValue === null) {
                popupTask = null;
                $update();
                console.log('walkthroughProgress fue eliminada');
            }
        });
    });

    // ===========================================
    // RETURN TEMPLATE RENDERER
    // ===========================================

    return $render;
}

export class ConversationLifecycle {
    constructor(context, managers) {
        this.context = context;
        this.managers = managers;
    }

    render() {
        return renderConversation(this.context, this.managers);
    }
}

export class ConversationPage {
    static render(props, frameworkContext) {
        const context = new ConversationContext(props, frameworkContext);
        const managers = new ConversationManagers();
        const lifecycle = new ConversationLifecycle(context, managers);
        return lifecycle.render();
    }
}

export default function renderConversationPage(props, frameworkContext) {
    return ConversationPage.render(props, frameworkContext);
}
