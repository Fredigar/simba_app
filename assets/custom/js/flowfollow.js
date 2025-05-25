// Mejora de la clase FlowFollow
function flowfollow() {
    // Propiedades principales
    this.jsonString = '';
    this.jsonObject = null;
    this.jsonPath = '';
    this.guid = '';
    this.tasksFolderPath = 'assets/custom/dataset/flowfollow/';
    this.taskFolder = '';
    this.paramValues = {}; // Para almacenar valores de parámetros en condiciones

    /**
     * Establece el flujo a partir de una cadena JSON
     * @param {string} jsonString - Cadena en formato JSON
     */
    this.setFlowFromString = function(jsonString) {
        try {
            // Eliminar punto y coma final si existe
            if (jsonString.trim().endsWith(';')) {
                jsonString = jsonString.trim().slice(0, -1);
            }

            this.jsonString = jsonString;
            this.jsonObject = JSON.parse(jsonString);
            return this.jsonObject;
        } catch (e) {
            console.error("Error al parsear JSON:", e);
            return null;
        }
    };

    /**
     * Verifica si una cadena tiene formato JSON válido
     * @param {string} jsonString - Cadena a verificar
     * @return {boolean} - Verdadero si es JSON válido
     */
    this.isJSONString = function(jsonString) {
        if (!jsonString || typeof jsonString !== 'string') {
            return false;
        }

        try {
            // Eliminar punto y coma final si existe
            if (jsonString.trim().endsWith(';')) {
                jsonString = jsonString.trim().slice(0, -1);
            }

            JSON.parse(jsonString);
            return true;
        } catch (e) {
            return false;
        }
    };

    /**
     * Carga un flujo desde un archivo
     * @param {string} filePath - Ruta del archivo JSON
     * @return {Object} - Objeto JSON cargado o null si hay error
     */
    this.setFlowFromFile = function(filePath) {
        var self = this;
        try {
            $.ajax({
                url: filePath,
                async: false,
                dataType: 'text', // Cambiado a 'text' para manejar el parsing manualmente
                success: function(data) {
                    // Eliminar punto y coma final si existe
                    if (data.trim().endsWith(';')) {
                        data = data.trim().slice(0, -1);
                    }

                    try {
                        self.jsonObject = JSON.parse(data);
                        self.jsonString = data;
                    } catch (e) {
                        console.error("Error al parsear respuesta:", e);
                        self.jsonObject = null;
                    }
                },
                error: function(xhr, status, error) {
                    console.error("Error cargando el archivo:", error);
                    self.guid = '';
                    self.taskFolder = '';
                    self.jsonObject = null;
                }
            });

            return this.jsonObject;
        } catch (e) {
            console.error("Excepción en setFlowFromFile:", e);
            return null;
        }
    };

    /**
     * Inicializa el flujo con un GUID específico
     * @param {string} taskGuid - GUID del procedimiento
     * @return {Object} - Objeto JSON cargado
     */
    this.init = function(taskGuid) {
        this.guid = taskGuid;
        this.taskFolder = this.tasksFolderPath + taskGuid + '/';
        return this.setFlowFromFile(this.taskFolder + taskGuid + '.json?a=' + Date.now());
    };

    /**
     * Carga flujo directamente desde un objeto JSON
     * @param {Object} jsonObj - Objeto JSON
     * @return {Object} - El mismo objeto JSON
     */
    this.loadFromObject = function(jsonObj) {
        this.jsonObject = jsonObj;
        this.jsonString = JSON.stringify(jsonObj);
        return this.jsonObject;
    };

    /**
     * Obtiene todas las instrucciones
     * @return {Object} - Instrucciones del procedimiento
     */
    this.getInstructions = function() {
        if (this.jsonObject && this.jsonObject.procedure && this.jsonObject.procedure.instructions) {
            return this.jsonObject.procedure.instructions;
        }
        return {};
    };
    this.getEquipments = function() {
        if (this.jsonObject && this.jsonObject.procedure && this.jsonObject.procedure.equipments) {
            return this.jsonObject.procedure.equipments;
        }
        return {};
    };

    /**
     * Obtiene una instrucción específica por índice
     * @param {number|string} index - Índice de la instrucción
     * @return {Object} - Instrucción solicitada
     */
    this.getInstruction = function(index) {
        const instructions = this.getInstructions();
        return instructions[index] || null;
    };

    this.evaluateCondition = function(index, paramValues) {
        const instruction = this.getInstruction(index);

        if (!instruction || instruction.type !== 'condition') {
            return instruction?.nextInstruction || null;
        }

        // Combinar valores de parámetros con los existentes
        let mergedParams = {...this.paramValues};
        if (paramValues) {
            mergedParams = {...mergedParams, ...paramValues};
        }

        // Evaluar la condición
        if (instruction.conditions && instruction.conditions.conditionQuery) {
            let conditionQuery = instruction.conditions.conditionQuery;

            // Extraer todas las variables de la condición
            let allVariables = new Set();
            let placeholderVariables = new Set();

            // Primero, identificar las variables que están entre #hashtags#
            const hashtagRegex = /#(\w+)#/g;
            let hashMatch;
            while ((hashMatch = hashtagRegex.exec(conditionQuery)) !== null) {
                placeholderVariables.add(hashMatch[1]);
            }

            // Ahora extraer todas las variables de la consulta de condición
            const variableRegex = /[a-zA-Z_][a-zA-Z0-9_]*/g;
            let match;
            while ((match = variableRegex.exec(conditionQuery)) !== null) {
                // Ignorar palabras clave de JavaScript y variables que ya están entre #hashtags#
                const jsKeywords = ["true", "false", "null", "undefined", "NaN", "Infinity"];
                if (!jsKeywords.includes(match[0]) && !placeholderVariables.has(match[0])) {
                    allVariables.add(match[0]);
                }
            }

            // Reemplazar placeholders con valores reales
            for (const alias in mergedParams) {
                const regex = new RegExp(`#${alias}#`, 'g');
                // Asegurarse de que los valores numéricos se manejan como números
                let value = mergedParams[alias];
                // Si el valor es booleano o numérico, no añadir comillas
                const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);
                const isBoolean = value === true || value === false;

                if (!isNumeric && !isBoolean && typeof value === 'string') {
                    value = `"${value}"`;  // Añadir comillas para strings
                }

                conditionQuery = conditionQuery.replace(regex, value);
            }

            console.log("Condición a evaluar:", conditionQuery);

            // Función para solicitar variables faltantes y volver a evaluar
            const requestMissingVariables = async (undefinedVars) => {
                const app = window.app; // Asumiendo que F7 está disponible globalmente como app

                // Crear una promesa que se resolverá cuando se completen todos los diálogos
                return new Promise((resolve) => {
                    const processNextVariable = (index) => {
                        if (index >= undefinedVars.length) {
                            // Si hemos procesado todas las variables, resolvemos la promesa
                            resolve(true);
                            return;
                        }

                        const varName = undefinedVars[index];

                        app.dialog.prompt(`Por favor, ingresa el valor para: ${varName}`, 'Valor requerido',
                            function (value) {
                                // Determinar si el valor es numérico
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && value.trim() !== '') {
                                    // Es numérico, guardarlo como número
                                    mergedParams[varName] = numValue;
                                    // También actualizar los parámetros principales
                                    this.paramValues[varName] = numValue;
                                } else {
                                    // No es numérico, guardarlo como string
                                    mergedParams[varName] = value;
                                    // También actualizar los parámetros principales
                                    this.paramValues[varName] = value;
                                }

                                // Procesar la siguiente variable
                                processNextVariable(index + 1);
                            }.bind(this),
                            function () {
                                // Si el usuario cancela, igual pasamos a la siguiente variable
                                // pero usamos un valor predeterminado
                                mergedParams[varName] = 0; // Valor por defecto
                                this.paramValues[varName] = 0;
                                processNextVariable(index + 1);
                            }.bind(this)
                        );
                    };  // No necesita .bind(this) porque es una función arrow

                    // Comenzar el proceso con la primera variable
                    processNextVariable(0);
                });
            };

            // Evaluar la expresión
            try {
                const result = eval(conditionQuery);
                console.log("Resultado de la evaluación:", result);

                if (result && instruction.conditions.goToInstruction.true) {
                    return instruction.conditions.goToInstruction.true;
                } else if (!result && instruction.conditions.goToInstruction.false) {
                    return instruction.conditions.goToInstruction.false;
                }
            } catch (e) {
                console.error("Error evaluando condición:", e);

                // Verificar si el error es por una variable no definida
                if (e instanceof ReferenceError) {
                    // Extraer el nombre de la variable no definida
                    const match = e.message.match(/(\w+) is not defined/);
                    if (match && match[1]) {
                        const undefinedVar = match[1];
                        console.log(`Variable no definida detectada: ${undefinedVar}`);

                        // Crear una lista de variables no definidas que necesitamos pedir al usuario
                        const undefinedVars = Array.from(allVariables).filter(v => !(v in mergedParams));

                        if (undefinedVars.length > 0) {
                            // Usamos una promesa para manejar el flujo asíncrono
                            return {
                                __asyncEvaluation: true,
                                promise: new Promise(async (resolve) => {
                                    // Solicitar las variables faltantes
                                    await requestMissingVariables(undefinedVars);

                                    // Volver a llamar a la función con los nuevos parámetros
                                    const result = this.evaluateCondition(index, mergedParams);

                                    // Resolver con el resultado
                                    if (result && result.__asyncEvaluation) {
                                        result.promise.then(resolve);
                                    } else {
                                        resolve(result);
                                    }
                                })
                            };
                        }
                    }
                }
            }
        }

        return instruction.nextInstruction || null;
    };

    /**
     * Determina el siguiente paso basado en la instrucción actual
     * @param {string} currentIndex - Índice actual
     * @param {Object} paramValues - Valores de parámetros (para condiciones)
     * @return {string} - Índice de la siguiente instrucción
     */
    this.getNextStep = function(currentIndex, paramValues) {
        const instruction = this.getInstruction(currentIndex);

        if (!instruction) {
            return null;
        }

        // Si es una condición, evaluar
        if (instruction.type === 'condition') {
            return this.evaluateCondition(currentIndex, paramValues);
        }

        // Si es una instrucción normal, usar nextInstruction
        return instruction.nextInstruction || null;
    };
}