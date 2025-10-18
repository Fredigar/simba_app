// MCP Client Adapter para SIMBA
class MCPClientAdapter {
    constructor(config) {
        this.servers = new Map();
        this.tools = new Map();
        this.resources = new Map();
        this.prompts = new Map();
        this.config = config;
    }

    // Conectar a un servidor MCP
    async connectToServer(serverConfig) {
        const { name, transport, capabilities } = serverConfig;

        try {
            // Implementar conexión según el transport (SSE, WebSocket, etc.)
            const connection = await this.createConnection(transport);

            // Handshake MCP
            const initResult = await this.sendRequest(connection, {
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {},
                        resources: {},
                        prompts: {}
                    },
                    clientInfo: {
                        name: 'SIMBA-Client',
                        version: '1.0.0'
                    }
                }
            });

            this.servers.set(name, {
                connection,
                capabilities: initResult.capabilities,
                config: serverConfig
            });

            // Cargar tools, resources y prompts del servidor
            await this.loadServerCapabilities(name);

            console.log(`Connected to MCP server: ${name}`);
            return true;
        } catch (error) {
            console.error(`Failed to connect to server ${name}:`, error);
            return false;
        }
    }

    // Cargar capacidades del servidor
    async loadServerCapabilities(serverName) {
        const server = this.servers.get(serverName);
        if (!server) return;

        // Listar tools disponibles
        if (server.capabilities.tools) {
            const toolsResult = await this.sendRequest(server.connection, {
                method: 'tools/list'
            });

            toolsResult.tools?.forEach(tool => {
                this.tools.set(tool.name, {
                    ...tool,
                    serverName
                });
            });
        }

        // Listar resources disponibles
        if (server.capabilities.resources) {
            const resourcesResult = await this.sendRequest(server.connection, {
                method: 'resources/list'
            });

            resourcesResult.resources?.forEach(resource => {
                this.resources.set(resource.uri, {
                    ...resource,
                    serverName
                });
            });
        }

        // Listar prompts disponibles
        if (server.capabilities.prompts) {
            const promptsResult = await this.sendRequest(server.connection, {
                method: 'prompts/list'
            });

            promptsResult.prompts?.forEach(prompt => {
                this.prompts.set(prompt.name, {
                    ...prompt,
                    serverName
                });
            });
        }
    }

    // Ejecutar tool (compatible con el sistema actual)
    async callTool(name, params) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }

        const server = this.servers.get(tool.serverName);
        if (!server) {
            throw new Error(`Server ${tool.serverName} not connected`);
        }

        const result = await this.sendRequest(server.connection, {
            method: 'tools/call',
            params: {
                name,
                arguments: params
            }
        });

        return result;
    }

    // Leer resource
    async readResource(uri) {
        const resource = this.resources.get(uri);
        if (!resource) {
            throw new Error(`Resource ${uri} not found`);
        }

        const server = this.servers.get(resource.serverName);
        const result = await this.sendRequest(server.connection, {
            method: 'resources/read',
            params: { uri }
        });

        return result;
    }

    // Obtener prompt
    async getPrompt(name, args = {}) {
        const prompt = this.prompts.get(name);
        if (!prompt) {
            throw new Error(`Prompt ${name} not found`);
        }

        const server = this.servers.get(prompt.serverName);
        const result = await this.sendRequest(server.connection, {
            method: 'prompts/get',
            params: { name, arguments: args }
        });

        return result;
    }

    // Crear conexión según transport
    async createConnection(transport) {
        switch (transport.type) {
            case 'sse':
                return new SSEConnection(transport.url);
            case 'websocket':
                return new WebSocketConnection(transport.url);
            case 'stdio':
                return new StdioConnection(transport.command);
            default:
                throw new Error(`Unsupported transport: ${transport.type}`);
        }
    }

    // Enviar request MCP
    async sendRequest(connection, request) {
        return connection.sendRequest(request);
    }

    // Obtener todas las tools disponibles (para UI)
    getAvailableTools() {
        return Array.from(this.tools.values());
    }

    // Obtener todos los resources (para UI)
    getAvailableResources() {
        return Array.from(this.resources.values());
    }

    // Obtener todos los prompts (para UI)
    getAvailablePrompts() {
        return Array.from(this.prompts.values());
    }
}

// Integración con el sistema SIMBA existente
class SIMBAMCPIntegration {
    constructor(simbaConfig) {
        this.mcpClient = new MCPClientAdapter(simbaConfig);
        this.simbaToolManager = null;
    }

    // Inicializar con servidores MCP
    async initialize(mcpServers) {
        for (const serverConfig of mcpServers) {
            await this.mcpClient.connectToServer(serverConfig);
        }

        // Crear herramientas híbridas (SIMBA + MCP)
        this.createHybridToolManager();
    }

    // Crear manager que combina tools SIMBA y MCP
    createHybridToolManager() {
        const mcpTools = this.mcpClient.getAvailableTools();

        // Convertir tools MCP al formato SIMBA
        const mcpToolsForSIMBA = mcpTools.map(tool => ({
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
                friendly_name: tool.name,
                icon: 'fa-plug' // Icono por defecto para tools MCP
            },
            type: 'function',
            source: 'mcp'
        }));

        return mcpToolsForSIMBA;
    }

    // Adapter para llamadas de tools
    async callTool(name, params) {
        // Primero intentar con MCP
        if (this.mcpClient.tools.has(name)) {
            const result = await this.mcpClient.callTool(name, params);

            // Convertir respuesta MCP al formato SIMBA
            return this.convertMCPResponseToSIMBA(result);
        }

        // Si no es MCP, usar el sistema SIMBA original
        return this.simbaToolManager.callTool(name, params);
    }

    // Convertir respuesta MCP al formato esperado por SIMBA
    convertMCPResponseToSIMBA(mcpResult) {
        if (mcpResult.content) {
            return {
                data: {
                    data: {
                        sources: mcpResult.content.map(content => ({
                            name: content.text || 'MCP Resource',
                            content: content.text || content.data,
                            type: content.type,
                            source: 'mcp',
                            icon: 'fa-plug'
                        }))
                    }
                }
            };
        }

        return mcpResult;
    }

    // Obtener resources MCP como sources SIMBA
    async getMCPResourcesAsSources() {
        const resources = this.mcpClient.getAvailableResources();
        const sources = [];

        for (const resource of resources) {
            try {
                const content = await this.mcpClient.readResource(resource.uri);
                sources.push({
                    name: resource.name || resource.uri,
                    content: content.contents?.[0]?.text || 'No content',
                    uri: resource.uri,
                    type: resource.mimeType,
                    source: 'mcp',
                    icon: 'fa-plug'
                });
            } catch (error) {
                console.error(`Error reading resource ${resource.uri}:`, error);
            }
        }

        return sources;
    }
}

// Ejemplo de uso en el código SIMBA existente
function integrateWithMCP() {
    // Configuración de servidores MCP
    const mcpServers = [
        {
            name: 'filesystem',
            transport: {
                type: 'stdio',
                command: 'npx @modelcontextprotocol/server-filesystem /path/to/docs'
            },
            capabilities: ['tools', 'resources']
        },
        {
            name: 'web-search',
            transport: {
                type: 'sse',
                url: 'http://localhost:3001/sse'
            },
            capabilities: ['tools']
        }
    ];

    // Inicializar integración
    const mcpIntegration = new SIMBAMCPIntegration(config);

    // En el contexto del template, reemplazar el toolManager original
    mcpIntegration.initialize(mcpServers).then(() => {
        // Actualizar las tools disponibles en el chat
        const mcpTools = mcpIntegration.createHybridToolManager();
        chat.tools = [...(chat.tools || []), ...mcpTools];

        // Actualizar el tool manager
        toolManager = {
            callTool: (name, params) => mcpIntegration.callTool(name, params),
            updateConfig: (config) => { /* implementar */ }
        };

        console.log('MCP integration completed');
        updateTemplate();
    });
}

// Conexiones de transporte
class SSEConnection {
    constructor(url) {
        this.url = url;
        this.eventSource = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
    }

    async connect() {
        this.eventSource = new EventSource(this.url);

        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const request = this.pendingRequests.get(data.id);
            if (request) {
                request.resolve(data.result);
                this.pendingRequests.delete(data.id);
            }
        };
    }

    async sendRequest(request) {
        const id = ++this.messageId;
        const message = { ...request, id };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });

            // Enviar via POST al endpoint SSE
            fetch(this.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            }).catch(reject);
        });
    }
}

class WebSocketConnection {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.messageId = 0;
        this.pendingRequests = new Map();
    }

    async connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            const request = this.pendingRequests.get(data.id);
            if (request) {
                request.resolve(data.result);
                this.pendingRequests.delete(data.id);
            }
        };

        return new Promise((resolve) => {
            this.ws.onopen = resolve;
        });
    }

    async sendRequest(request) {
        const id = ++this.messageId;
        const message = { ...request, id };

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.ws.send(JSON.stringify(message));
        });
    }
}

// Exportar para uso en SIMBA
window.SIMBAMCPIntegration = SIMBAMCPIntegration;
window.MCPClientAdapter = MCPClientAdapter;