const DEBUG_CONFIG = {
    enabled: true, // Master switch
    levels: {
        error: true,   // console.error
        warn: true,    // console.warn
        info: false,   // console.info
        log: true,    // console.log
        sql: false     // logs específicos de SQL
    }
};

// Guardar las funciones originales
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Sobrescribir console methods
// Función para extraer información del stack trace
function getCallerInfo() {
    const stack = new Error().stack;
    const stackLines = stack.split('\n');

    // Buscar la línea que no sea esta función ni console.log
    for (let i = 2; i < stackLines.length; i++) {
        const line = stackLines[i];
        if (line && !line.includes('console.log') && !line.includes('getCallerInfo')) {
            // Extraer información usando regex
            // Formatos comunes: "at function (file:line:column)" o "file:line:column"
            const match = line.match(/(?:at\s+.*?\s+\()?(.+?):(\d+):(\d+)\)?/) ||
                line.match(/(.+?):(\d+):(\d+)/);

            if (match) {
                const [, fullPath, lineNumber, columnNumber] = match;
                // Extraer solo el nombre del archivo
                const fileName = fullPath.split('/').pop().split('\\').pop();

                return {
                    file: fileName,
                    line: lineNumber,
                    column: columnNumber,
                    fullPath: fullPath
                };
            }
        }
    }

    return {
        file: 'unknown',
        line: '?',
        column: '?',
        fullPath: 'unknown'
    };
}

// Console.log mejorado
console.error = function(...args) {
    if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.levels.error) {
        const caller = getCallerInfo();
        originalConsole.error(
            `🔴 ERROR [${caller.file}:${caller.line}:${caller.column}]:`,
            ...args
        );
    }
};

console.error = function(...args) {
    if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.levels.error) {
        originalConsole.error('🔴 ERROR:', ...args);
    }
};

console.warn = function(...args) {
    if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.levels.warn) {
        originalConsole.warn('🟡 WARN:', ...args);
    }
};

console.info = function(...args) {
    if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.levels.info) {
        originalConsole.info('🔵 INFO:', ...args);
    }
};

// Función especial para SQL (opcional)
const sqlLog = function(...args) {
    if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.levels.sql) {
        originalConsole.log('🗄️ SQL:', ...args);
    }
};
// === Helpers ===
function addTimestamp(url) {
    const t = Date.now();
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${t}`;
}

/**
 * Intenta cargar la URL en el iframe y, si está bloqueado por frame-ancestors
 * o X-Frame-Options, abre una pestaña nueva como fallback.
 *
 * @param {HTMLIFrameElement} iframe
 * @param {string} url
 * @param {object} opts
 *   - timeoutMs: número de ms a esperar antes del fallback (por defecto 1500)
 *   - onBlocked: callback si detectamos bloqueo (opcional)
 *   - onLoaded: callback si cargó bien (opcional)
 */
function setIframeSrcWithFallback(iframe, url, opts = {}) {
    const timeoutMs = opts.timeoutMs || 8000;
    let resolved = false;
    let cspBlocked = false; // ✅ NUEVO: Flag para CSP

    const finalUrl = addTimestamp(url);

    // ✅ DETECTAR ERRORES DE CSP EN LA CONSOLA
    const originalConsoleError = console.error;
    const cspErrorDetector = function(...args) {
        const message = args.join(' ');
        if (message.includes('frame-ancestors') ||
            message.includes('X-Frame-Options') ||
            message.includes('refused to connect') ||
            message.includes('CSP')) {
            console.warn('🚫 CSP/Frame blocking detected');
            cspBlocked = true;
        }
        originalConsoleError.apply(console, args);
    };
    console.error = cspErrorDetector;

    function cleanup() {
        console.error = originalConsoleError; // ✅ Restaurar console.error
        iframe.removeEventListener('load', onLoad);
        iframe.removeEventListener('error', onError);
    }

    function onError(e) {
        if (resolved) return;
        resolved = true;
        cleanup();
        clearTimeout(timer);

        console.error('❌ Iframe error event:', e);
        if (typeof opts.onError === 'function') {
            opts.onError(new Error('Iframe failed to load'));
        }
        if (typeof opts.onBlocked === 'function') opts.onBlocked();
        window.open(url, '_blank');
    }

    function onLoad() {
        if (resolved) return;

        // ✅ ESPERAR UN POCO para que CSP error se detecte
        setTimeout(() => {
            if (resolved) return;

            let isBlank = false;

            // ✅ PRIMERO: Verificar si CSP bloqueó
            if (cspBlocked) {
                console.warn('🚫 CSP blocking confirmed');
                isBlank = true;
            } else {
                // ✅ SEGUNDO: Verificar contenido del iframe
                try {
                    if (!iframe.contentWindow) {
                        isBlank = true;
                    } else {
                        const href = iframe.contentWindow.location && iframe.contentWindow.location.href;
                        if (!href || href === 'about:blank') {
                            isBlank = true;
                        } else {
                            // Verificar si el documento está vacío
                            const doc = iframe.contentDocument;
                            if (doc && doc.body && doc.body.innerHTML.trim() === '') {
                                isBlank = true;
                            }
                        }
                    }
                } catch (e) {
                    // ✅ CROSS-ORIGIN: Puede ser legítimo O puede ser CSP
                    // Si detectamos CSP, es bloqueado
                    if (cspBlocked) {
                        isBlank = true;
                    } else {
                        // Asumimos que cargó bien (cross-origin legítimo)
                        isBlank = false;
                    }
                }
            }

            resolved = true;
            cleanup();

            if (isBlank) {
                console.log('❌ Documento bloqueado o vacío');
                if (typeof opts.onBlocked === 'function') opts.onBlocked();
                window.open(url, '_blank');
            } else {
                console.log('✅ Documento cargado correctamente');
                if (typeof opts.onLoaded === 'function') opts.onLoaded();
            }
        }, 300); // ✅ Esperar 300ms para que CSP error se registre
    }

    const timer = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();

        console.warn('⏱️ Timeout loading iframe');
        if (typeof opts.onBlocked === 'function') opts.onBlocked();
        window.open(url, '_blank');
    }, timeoutMs);

    iframe.addEventListener('load', () => {
        clearTimeout(timer);
        onLoad();
    });

    iframe.addEventListener('error', onError);

    // Dispara la navegación
    iframe.src = finalUrl;
}
function handleSourceClick(guid, sourceUrl, name) {
    const sources = JSON.parse(localStorage.getItem('sources') || '{}');
    const sourceData = sources[guid] || {};
    const viewerStrategy = sourceData?.extra?.viewerStrategy || 'auto';

    console.log('📋 Opening source with strategy:', viewerStrategy, 'for', name);

    if (viewerStrategy === 'new_tab') {
        console.log('🌐 Opening in new tab');
        window.open(sourceUrl, '_blank');
    } else {
        // iframe o auto → usar viewDocument
        console.log('📄 Opening with viewDocument');
        viewDocument(sourceUrl, name);
    }
}
// === Tu función con fallback integrado ===
function viewDocument(url, title, openInSplitView = false) {
    title = title || '';

    if (openInSplitView) {
        const iframeId = 'document-viewer-split-' + Date.now();
        const html = `<iframe id="${iframeId}" src="about:blank" style="width:100%; height:98vh; border:none;" class="document-viewer-split"></iframe>`;

        $("#close-secundary").unbind('click').bind('click', function() {
            app.splitView.close();
            setTimeout(function(){
                setDynamicHeight();
            }, 500);
        });

        $("#secundary-title").find('.title').text(title);
        app.splitView.open(html, {isHtml: true, pageTitle: title});

        setTimeout(function() {
            const iframe = document.getElementById(iframeId);

            setIframeSrcWithFallback(iframe, url, {
                timeoutMs: 8000, // ✅ Aumentado a 8 segundos
                onBlocked: () => {
                    console.log('❌ Bloqueado por CSP/X-Frame-Options. Abriendo en nueva pestaña...');
                    app.splitView.close();
                    app.toast.show({
                        text: 'Documento abierto en nueva pestaña',
                        closeTimeout: 2000,
                        cssClass: 'color-blue'
                    });
                },
                onLoaded: () => {
                    console.log('✅ Documento cargado correctamente en split view');
                    window.currentIframeId = iframeId;
                    waitForIframeLoad(iframeId, function(iframeEl) {
                        // callIframeFunction(iframeId, 'inicializar');
                    });
                },
                onError: (error) => { // ✅ NUEVO
                    console.error('❌ Error cargando documento:', error);
                    app.splitView.close();
                    app.toast.show({
                        text: 'Error cargando documento. Abierto en nueva pestaña.',
                        closeTimeout: 2000,
                        cssClass: 'color-orange'
                    });
                }
            });
        }, 100);

        $("#save-secundary").unbind('click').bind('click', function() {
            window.open(url, "_blank");
        });

        $("#print-btn").unbind('click').bind('click', function() {
            try {
                const iframe = document.getElementById(iframeId);
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                }
            } catch (error) {
                console.log('No se pudo imprimir directamente, abriendo en nueva ventana');
                window.open(url, "_blank");
            }
        });

    } else {
        // Popup mode
        $("#document-viewer").attr('src', 'about:blank');

        setTimeout(function() {
            const iframe = document.getElementById('document-viewer');

            setIframeSrcWithFallback(iframe, url, {
                timeoutMs: 8000,
                onBlocked: () => {
                    console.log('❌ Bloqueado. Abriendo en nueva pestaña...');
                    try { app.popup.close('#viewer-popup'); } catch(_) {}
                    app.toast.show({
                        text: 'Documento abierto en nueva pestaña',
                        closeTimeout: 2000,
                        cssClass: 'color-blue'
                    });
                },
                onLoaded: () => {
                    console.log('✅ Documento cargado en popup');
                    $("#viewer-popup").find('.title').text(title);

                    $("#btn-document-maximize").unbind('click').bind('click', function() {
                        window.open(url, "_blank");
                    });
                    $("#close-sources").bind('click', function() {
                        app.panel.close("#sources-panel");
                    });
                    $("#close-viewer").unbind('click').bind('click', function() {
                        app.popup.close('#viewer-popup');
                    });

                    app.popup.open('#viewer-popup');
                },
                onError: (error) => {
                    console.error('❌ Error cargando documento:', error);
                    try { app.popup.close('#viewer-popup'); } catch(_) {}
                    app.toast.show({
                        text: 'Error cargando documento. Abierto en nueva pestaña.',
                        closeTimeout: 2000,
                        cssClass: 'color-orange'
                    });
                }
            });
        }, 50);
    }
}

function waitForIframeLoad(iframeId, callback) {
    const iframe = document.getElementById(iframeId);

    if (!iframe) {
        console.error('Iframe no encontrado:', iframeId);
        return;
    }

    // Verificar si ya está cargado
    if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
        // Ya está cargado completamente
        callback(iframe);
        return;
    }

    // Si no está cargado, esperar al evento load
    iframe.onload = function() {
        // Verificar una vez más que esté completamente cargado
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            callback(iframe);
        } else {
            // Si aún no está listo, esperar un poco más
            setTimeout(function() {
                callback(iframe);
            }, 100);
        }
    };

    // Fallback: si después de 10 segundos no se ha cargado, ejecutar callback de todos modos
    setTimeout(function() {
        if (iframe.contentDocument) {
            console.warn('Iframe tardó más de lo esperado en cargar, ejecutando callback de todos modos');
            callback(iframe);
        }
    }, 10000);
}

// Llamar función en el iframe desde la página padre
// Reemplazar callIframeFunction con esta versión que usa postMessage
function callIframeFunctionCrossOrigin(iframeId, functionName, ...args) {
    return new Promise((resolve, reject) => {
        const iframe = document.getElementById(iframeId);

        if (!iframe || !iframe.contentWindow) {
            reject('Iframe no encontrado');
            return;
        }

        const messageId = Date.now() + Math.random();

        // Crear listener temporal para la respuesta
        const responseListener = function(event) {
            if (event.data.messageId === messageId) {
                window.removeEventListener('message', responseListener);

                if (event.data.success) {
                    resolve(event.data.result);
                } else {
                    reject(event.data.error);
                }
            }
        };

        window.addEventListener('message', responseListener);

        // Enviar mensaje
        iframe.contentWindow.postMessage({
            type: 'function_call',
            functionName: functionName,
            args: args,
            messageId: messageId
        }, '*');

        // Timeout después de 5 segundos
        setTimeout(() => {
            window.removeEventListener('message', responseListener);
            reject('Timeout - no response from iframe');
        }, 5000);
    });
}



// Acceder a variables del iframe
function getIframeVariable(iframeId, variableName) {
    const iframe = document.getElementById(iframeId);

    if (iframe && iframe.contentWindow) {
        try {
            return iframe.contentWindow[variableName];
        } catch (error) {
            console.error('Error al acceder variable del iframe:', error);
            return null;
        }
    } else {
        console.error('Iframe no encontrado o no cargado');
        return null;
    }
}
function clearHighlights() {
    const highlights = document.querySelectorAll('.highlighted-text');
    highlights.forEach(highlight => {
        // Solo limpiar los highlights no persistentes
        if (!highlight.hasAttribute('data-persistent')) {
            const parent = highlight.parentNode;
            // Insertar el contenido de texto del highlight directamente en el padre
            parent.insertBefore(document.createTextNode(highlight.textContent), highlight);
            // Eliminar el span del highlight
            parent.removeChild(highlight);
        }
    });
}

function addCodeHeaders() {
    // Encontrar todos los bloques de código
    const codeBlocks = document.querySelectorAll('pre.hljs');

    // Procesar cada bloque de código
    codeBlocks.forEach(pre => {
        // Comprobar si ya tiene una cabecera (verificando el elemento anterior)
        const prevElement = pre.previousElementSibling;
        if (prevElement && prevElement.classList.contains('card-header')) {
            // Ya tiene una cabecera, no hacer nada
            return;
        }

        // Marcar este pre como procesado
        pre.dataset.headerAdded = 'true';

        // Obtener el lenguaje del atributo data-lang
        const lang = pre.getAttribute('data-lang') || 'code';

        // Crear contenedor de cabecera usando card-header de F7
        const headerContainer = document.createElement('div');
        headerContainer.className = 'card-header font-size-12 bg-color-bluegray';

        // Crear indicador de lenguaje
        const langIndicator = document.createElement('span');
        langIndicator.textContent = lang;

        // Crear contenedor para los iconos (para agruparlos a la derecha)
        const iconsContainer = document.createElement('div');
        iconsContainer.className = 'float-right';
        iconsContainer.style.display = 'inline-block';

        // Crear icono de editar
        const editIcon = document.createElement('i');
        editIcon.className = 'fa fa-edit font-size-12 link';
        editIcon.style.cursor = 'pointer';
        editIcon.style.marginRight = '10px';

        // Añadir evento al hacer clic para editar el código
        editIcon.addEventListener('click', function(e) {
            e.preventDefault();

            // Obtener el código del bloque pre
            const codeElement = pre.querySelector('code');
            const codeText = codeElement ? codeElement.textContent : pre.textContent;

            // Usar el lenguaje del bloque de código para el editor
            let editorLanguage = lang;

            // Mapeo de algunos lenguajes comunes a los modos de Ace
            const languageMap = {
                'js': 'javascript',
                'py': 'python',
                'rb': 'ruby',
                'cs': 'csharp',
                'ts': 'typescript',
                'yml': 'yaml',
                'sh': 'sh',
                'bash': 'sh',
                'md': 'markdown'
            };

            // Usar el mapeo si existe, de lo contrario usar el lenguaje tal cual
            editorLanguage = languageMap[editorLanguage] || editorLanguage;

            // Generar un título para el editor basado en el lenguaje
            const editorTitle = 'Edit code ' + lang;

            // Llamar a la función editContent con los parámetros adecuados
            editContent(codeText, Date.now().toString(), editorTitle, true, editorLanguage);
        });

        // Crear icono de copiar
        const copyIcon = document.createElement('i');
        copyIcon.className = 'fa fa-copy font-size-12 link';
        copyIcon.style.cursor = 'pointer';

        // Añadir evento al hacer clic para copiar el código al portapapeles
        copyIcon.addEventListener('click', function(e) {
            e.preventDefault();

            // Obtener el código del bloque pre
            const codeElement = pre.querySelector('code');
            const codeText = codeElement ? codeElement.textContent : pre.textContent;

            // Copiar al portapapeles usando la API Clipboard
            navigator.clipboard.writeText(codeText)
                .then(() => {
                    // Cambiar el icono a check de Font Awesome
                    this.classList.remove('fa-copy');
                    this.classList.add('fa-check');
                    this.classList.add('color-green');

                    // Restaurar el icono original después de 2 segundos
                    setTimeout(() => {
                        this.classList.remove('fa-check');
                        this.classList.remove('color-green');
                        this.classList.add('fa-copy');
                    }, 2000);
                })
                .catch(err => {
                    // En caso de error, mostrar un mensaje en la consola
                    console.error('Error al copiar al portapapeles: ', err);

                    // Cambiar el icono a error
                    this.classList.remove('fa-copy');
                    this.classList.add('fa-times');
                    this.classList.add('color-red');

                    // Restaurar el icono original después de 2 segundos
                    setTimeout(() => {
                        this.classList.remove('fa-times');
                        this.classList.remove('color-red');
                        this.classList.add('fa-copy');
                    }, 2000);
                });
        });

        // Añadir iconos al contenedor
        iconsContainer.appendChild(editIcon);
        iconsContainer.appendChild(copyIcon);

        // Ensamblar la cabecera
        headerContainer.appendChild(langIndicator);
        headerContainer.appendChild(iconsContainer);

        // Insertar cabecera antes del elemento pre
        pre.parentNode.insertBefore(headerContainer, pre);
    });
}
function exportTableToCSV(table) {
    // Get all rows
    const rows = table.querySelectorAll('tr');
    let csv = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
        const row = [], cols = rows[i].querySelectorAll('td, th');

        // Process each column
        for (let j = 0; j < cols.length; j++) {
            // Get text content and escape double quotes
            let text = cols[j].innerText.trim().replace(/"/g, '""');
            // Wrap with quotes to handle commas in content
            row.push('"' + text + '"');
        }

        // Add the row to the CSV array
        csv.push(row.join(','));
    }

    // Create CSV content
    const csvContent = csv.join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create temporary link for download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'table_export_' + new Date().toISOString().slice(0,10) + '.csv');
    link.className = "link external";
    link.style.display = 'none';

    // Append to body, trigger click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
function editContent(content, id, pageTitle, isCode = false, language = 'javascript') {
    // Variable para almacenar la instancia del editor (sea Ace o textEditor)
    id = id.toString();
    let editorInstance;
    let html = '';

    if (isCode) {
        // CASO 1: ES CÓDIGO FUENTE - USAR ACE EDITOR

        // Crear el contenedor para Ace Editor
        html = '<div style="height:98vh" class="no-margin ace-editor-container inset" id="' + id + '"></div>';

        $("#close-secundary").bind('click', function() {
            app.splitView.close();
            setTimeout(function(){
                setDynamicHeight();
            }, 500);
        });

        $("#secundary-title").find('.title').text(pageTitle);
        app.splitView.open(html, {isHtml: true, pageTitle: pageTitle});

        // Inicializar Ace Editor una vez que el DOM está listo
        setTimeout(function() {
            // Crear la instancia de Ace Editor
            var aceEditor = ace.edit(id);
            var myLanguage = language == 'stask' ? 'json' : language;
            // Configurar Ace Editor
            aceEditor.setTheme("ace/theme/monokai"); // Tema oscuro por defecto
            aceEditor.session.setMode("ace/mode/" + myLanguage);
            aceEditor.setFontSize(14);
            aceEditor.setShowPrintMargin(false);
            aceEditor.session.setUseWrapMode(true);

            // Ajustar el espaciado entre líneas
            var baseFontSize = parseInt(aceEditor.getFontSize(), 10);
            aceEditor.renderer.lineHeight = Math.round(baseFontSize * 1.5);
            aceEditor.renderer.updateFontSize();

            // Configurar opciones avanzadas
            aceEditor.setOptions({
                enableBasicAutocompletion: true,
                enableSnippets: true,
                enableLiveAutocompletion: true
            });

            // Establecer el contenido directamente desde el parámetro content
            aceEditor.setValue(content, -1); // -1 para mover el cursor al inicio

            // Guardar la instancia para uso posterior
            editorInstance = aceEditor;

            // Configurar el botón de guardar para código
            $("#save-secundary").unbind('click');
            $("#save-secundary").bind('click', function() {
                // Obtener el código del editor
                var code = aceEditor.getValue();

                // Obtener el título actualizado del secundary-title
                var currentTitle = $("#secundary-title").find('.title').text();

                // Determinar la extensión correcta
                var extension;

                if (currentTitle.toLowerCase().endsWith('.stask')) {
                    extension = 'stask';
                } else {
                    extension = getExtensionForLanguage(language);
                }

                // Generar el nombre del archivo
                var fileName = currentTitle.replace(/\s+/g, '') + '.' + extension;

                // Crear un Blob con el código
                var blob = new Blob([code], {type: 'text/plain;charset=utf-8'});
                saveAs(blob, fileName);
            });

            // Configurar el botón de imprimir para código
            $("#print-btn").unbind('click');
            $("#print-btn").bind('click', function() {
                // Obtener el título actualizado
                var currentTitle = $("#secundary-title").find('.title').text();

                // Obtener el código formateado con colores
                var session = aceEditor.getSession();
                var content = '<pre class="ace_editor">' +
                    '<div class="ace_scroller">' +
                    document.getElementById(id).querySelector('.ace_content').innerHTML +
                    '</div></pre>';

                // Incluir los estilos de Ace en la impresión
                var aceStyles = document.head.querySelectorAll('style');
                var styleContent = '';

                for (var i = 0; i < aceStyles.length; i++) {
                    if (aceStyles[i].innerHTML.includes('ace_')) {
                        styleContent += aceStyles[i].innerHTML;
                    }
                }

                // Llamar a la función de impresión con los estilos
                printContentWithStyles(content, currentTitle, styleContent);
            });

            // NUEVO: Añadir botón de ejecución para archivos stask
            if ((language === 'stask' || pageTitle.toLowerCase().endsWith('.stask')) &&
                $("#execute-stask-btn").length === 0) { // Verificar que el botón no existe ya

                // Buscar el contenedor de botones (donde está el botón de imprimir)
                var buttonsContainer = $("#print-btn").parent();

                // Crear el botón de ejecución con estilo similar al de imprimir pero en verde
                var executeButton = $('<a href="#" id="execute-stask-btn" class="link icon-only" style="color: green;"><i class="icon f7-icons">play_fill</i></a>');

                // Añadir el botón ANTES del botón de imprimir (prepend)
                buttonsContainer.prepend(executeButton);

                // Configurar el evento click para el botón de ejecución
                $("#execute-stask-btn").unbind('click'); // Eliminar cualquier handler previo
                $("#execute-stask-btn").bind('click', function(e) {
                    e.preventDefault();

                    // Obtener el contenido del editor como string
                    var staskContent = aceEditor.getValue();

                    // Ejecutar el contenido stask pasando directamente el string
                    if (window.myFileDropzone && typeof window.myFileDropzone.executeStaskContent === 'function') {
                        window.myFileDropzone.executeStaskContent(staskContent);
                    } else {
                        console.error("La función executeStaskContent no está disponible");
                        alert("Error: La función de ejecución de Stask no está disponible");
                    }
                });
            }

        }, 100);
    } else {
        // CASO 2: ES CONTENIDO NORMAL - USAR EDITOR DE TEXTO ENRIQUECIDO

        // Configuración de markdown-it
        let md = window.markdownit({
            html: true,
            linkify: true,
            typographer: true,
            highlight: function (str, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    try {
                        const result = hljs.highlight(str, {language: lang, ignoreIllegals: true}).value;

                        // Crear el HTML para el bloque de código con botones
                        let codeHtml = '<pre class="hljs" data-lang="' + lang + '">';

                        // Añadir botones de control
                        codeHtml += '<div class="hljs-control">';

                        // Añadir botón de ejecución para stask ANTES del botón de imprimir
                        if (lang === 'stask' || (lang === 'json' && str.includes('stask'))) {
                            codeHtml += '<button class="hljs-button hljs-execute" style="color: green;" title="Execute Stask"><i class="icon f7-icons">play_fill</i></button>';
                        }

                        codeHtml += '<button class="hljs-button hljs-print" title="Print"><i class="icon f7-icons">printer</i></button>';
                        codeHtml += '</div>';

                        // Añadir el código resaltado
                        codeHtml += '<code class="cod-with-auto">' + result + '</code></pre>';

                        return codeHtml;
                    } catch (__) {}
                }
                return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
            }
        }).use(window.texmath, {engine: window.katex, delimiters: 'brackets'});

        html = '<div style="height:90vh" class="no-margin text-editor inset' +
            '" id="' + id + '"><div class="text-editor-content" contenteditable>' + md.render(content) + '</div></div>';

        $("#close-secundary").bind('click', function() {
            app.splitView.close();
            setTimeout(function(){
                setDynamicHeight();
            }, 500);
        });

        $("#secundary-title").find('.title').text(pageTitle);
        app.splitView.open(html, {isHtml: true, pageTitle: pageTitle});

        textEditorDefault = app.textEditor.create({
            el: document.querySelector('#' + id)
        });

        // Gestión del pegado
        var editorContent = $('#' + id).find('.text-editor-content')[0];

        editorContent.addEventListener('paste', function(e) {
            // Prevenir el comportamiento por defecto
            e.preventDefault();
            e.stopPropagation();

            // Obtener el texto del portapapeles
            var clipboardData = e.clipboardData || window.clipboardData;
            var pastedText = clipboardData.getData('text/plain');

            // Procesar con markdown
            var renderedHtml = md.render(pastedText);

            // Usar execCommand para insertar el HTML en la posición actual
            document.execCommand('insertHTML', false, renderedHtml);

            return false; // Asegurar que no se propague
        }, true); // true para la fase de captura

        // Configuración del guardado
        $("#save-secundary").unbind('click');
        $("#save-secundary").bind('click', function() {
            // Obtener el título actualizado
            var currentTitle = $("#secundary-title").find('.title').text();

            // Capturar el contenido HTML del editor
            var content = $('#' + id).find('.text-editor-content').html();

            // Generar el nombre del archivo (primeras 10 letras sin espacios)
            var fileName = currentTitle.replace(/\s+/g, '').substring(0, 10) + '.docx';

            // Agregar metadatos para asegurar codificación UTF-8
            var htmlWithMeta = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>' + content + '</body></html>';

            // Opciones para htmlDocx con codificación especificada
            var options = {
                orientation: 'portrait',
                margins: {top: 720},
                encoding: 'UTF-8' // Especificar codificación UTF-8
            };


            var converted = htmlDocx.asBlob(htmlWithMeta, options);
            saveAs(converted, fileName);
        });

        // Configuración de la impresión
        $("#print-btn").unbind('click');
        $("#print-btn").bind('click', function() {
            // Obtener el título actualizado
            var currentTitle = $("#secundary-title").find('.title').text();

            var content = $('#' + id).find('.text-editor-content').html();

            // Llamar a la función de impresión
            printContent(content, currentTitle);
        });

        // NUEVO: Limpiar cualquier evento anterior y añadir evento para botones de ejecución en bloques de código stask
        setTimeout(function() {
            // Primero desasociar cualquier evento previamente asociado para evitar duplicidad
            $('#' + id).find('.hljs-execute').off('click');

            // Luego asociar el nuevo evento
            $('#' + id).find('.hljs-execute').on('click', function() {
                // Obtener el bloque de código asociado
                const codeBlock = $(this).closest('.hljs').find('code');
                const codeContent = codeBlock.text();

                // Ejecutar el contenido stask pasando directamente el string
                if (window.myFileDropzone && typeof window.myFileDropzone.executeStaskContent === 'function') {
                    window.myFileDropzone.executeStaskContent(codeContent);
                } else {
                    console.error("La función executeStaskContent no está disponible");
                    alert("Error: La función de ejecución de Stask no está disponible");
                }
            });
        }, 500);

        editorInstance = textEditorDefault;
    }

    return editorInstance;
}// Función auxiliar para determinar la extensión del archivo según el lenguaje
function getExtensionForLanguage(language) {
    const extensions = {
        'javascript': 'js',
        'html': 'html',
        'css': 'css',
        'python': 'py',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'csharp': 'cs',
        'php': 'php',
        'ruby': 'rb',
        'swift': 'swift',
        'go': 'go',
        'typescript': 'ts',
        'sql': 'sql',
        'markdown': 'md',
        'json': 'json',
        'xml': 'xml',
        'yaml': 'yml',
        'stask':'stask'
    };

    return extensions[language] || 'txt';
}
// Función para crear y descargar un archivo .stask
function downloadJsonAsStask(jsonData, filename = "download.stask") {
    // Asegurarse de que el JSON sea una cadena
    const jsonString = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);

    // Crear un blob con el contenido JSON
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Crear un enlace de descarga
    const downloadLink = document.createElement('a');
    var executeButton = document.createElement('span');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename;
    downloadLink.className = "link margin file-item external stask-download-btn";
    downloadLink.innerHTML = "<i class='fa fa-download margin-right-half'></i> Download .stask";
    downloadLink.style.marginLeft = "10px";
    downloadLink.style.textDecoration = "none";
    downloadLink.style.padding = "3px 8px";
    downloadLink.style.color = "white";
    //downloadLink.style.backgroundColor = "#f0f0f0";
    //downloadLink.style.border = "1px solid #ccc";
    downloadLink.style.borderRadius = "4px";
    downloadLink.style.cursor = "pointer";
    // Buscar el elemento .progress-percentage y añadir el botón a su lado
    //const progressElement = document.querySelector('.progress-percentage');
    const progressElement =  Array.from(document.querySelectorAll('.progress-percentage')).pop();
    console.log("progress element",progressElement)
    if (progressElement) {
        // Crear un contenedor para mantener ambos elementos juntos
        const container = document.createElement('div');
        container.style.display = "flex";
        container.style.alignItems = "center";

        // Clonar el elemento progress-percentage en el nuevo contenedor
        const progressClone = progressElement.cloneNode(true);
        container.appendChild(progressClone);
        container.appendChild(downloadLink);

        executeButton.className = 'execute-stask';
        executeButton.innerHTML = '<i class="fa fa-play" style="margin-left: 5px; color: #4CAF50; cursor: pointer;"></i>';
        executeButton.setAttribute('title', 'Execute task');
        executeButton.addEventListener('click', function(e) {

            e.preventDefault(); // Prevenir cualquier acción predeterminada
            e.stopPropagation();
            window.myFileDropzone.executeStaskContent(jsonData);
        });
        downloadLink.appendChild(executeButton)
        // Reemplazar el elemento original con nuestro contenedor
        progressElement.parentNode.replaceChild(container, progressElement);
    } else {
        // Si no encontramos el elemento .progress-percentage, añadimos el enlace al body
        document.body.appendChild(downloadLink);
    }

    // Opcionalmente, hacer clic automáticamente para iniciar la descarga
    // downloadLink.click();
}
function extractJsonFromString(str) {
    // Buscar dónde comienza el JSON (después de ```json o ```stask)
    const jsonStartMatch = str.match(/```(json|stask)\s*(\{.*)/s);

    if (!jsonStartMatch) {
        return null; // No se encontró el patrón de inicio
    }

    // Obtener todo desde el inicio del JSON
    let jsonContent = jsonStartMatch[2]; // Ahora usamos el grupo 2 porque el grupo 1 es (json|stask)

    // Buscar dónde termina el JSON (con ```)
    const jsonEndIndex = jsonContent.lastIndexOf('```');

    if (jsonEndIndex !== -1) {
        // Cortar hasta el final del JSON
        jsonContent = jsonContent.substring(0, jsonEndIndex);
    }

    // Intentar parsear el JSON
    try {
        return jsonContent;
    } catch (error) {
        console.error("Error al parsear el JSON:", error);
        return null;
    }
}
// Función para imprimir contenido con estilos personalizados
function printContentWithStyles(content, title, extraStyles) {
    // Crear una ventana de impresión
    var printWindow = window.open('', '_blank');

    // Escribir el contenido en la ventana
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <meta charset="UTF-8">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 30px;
                }
                pre {
                    background-color: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                }
                ${extraStyles}
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            ${content}
        </body>
        </html>
    `);

    // Esperar a que el contenido se cargue antes de imprimir
    printWindow.document.close();
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        // Cerrar después de imprimir (opcional)
        printWindow.onafterprint = function() {
            printWindow.close();
        };
    };
}

// Ejemplo de uso:
// Para contenido normal (texto/markdown):
// editContent(htmlContent, 'editor-container', 'Mi Documento');

// Para código fuente:
// editContent(codeContent, 'editor-container', 'Mi Código JavaScript', true, 'javascript');
// Función separada para imprimir contenido
function printContent(content, title) {
    // Crear un iframe temporal para imprimir solo el contenido
    var printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.left = '-9999px';
    document.body.appendChild(printFrame);

    var printDocument = printFrame.contentDocument || printFrame.contentWindow.document;
    printDocument.open();
    printDocument.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + title + '</title>' +
        '<style>body { font-family: Arial, sans-serif; margin: 20px; } ' +
        'pre.hljs { background-color: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; } ' +
        'code { font-family: Consolas, monospace; }</style>' +
        '</head><body>' + content + '</body></html>');
    printDocument.close();

    // Esperar a que cargue el contenido
    setTimeout(function() {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();

        // Eliminar el iframe después de imprimir
        setTimeout(function() {
            document.body.removeChild(printFrame);
        }, 1000);
    }, 500);
}

// Y luego modificamos el evento click para usar esta función
$("#print-btn").unbind('click');
$("#print-btn").bind('click', function() {
    // Capturar el contenido HTML del editor
    var content = $('#' + id).find('.text-editor-content').html();

    // Llamar a la función de impresión
    printContent(content, pageTitle);
});
function isSqlQuery(text) {
    if (!text || typeof text !== 'string') return false;

    const cleanText = text.trim();

    // 1. Verificar que no sea demasiado largo (las queries suelen ser concisas)
    if (cleanText.length > 1000) return false;

    // 2. No debe contener muchos párrafos (SQL suele ser más compacto)
    const paragraphs = cleanText.split('\n\n').length;
    if (paragraphs > 3) return false;

    // 3. Verificar palabras clave SQL
    const sqlKeywords = /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|JOIN|GROUP\s+BY|ORDER\s+BY)\b/i;

    return sqlKeywords.test(cleanText);
}
function setDynamicHeight(messagesHistory) {
    const editVar = messagesHistory ? messagesHistory.length > 3 : true;
    // Selecciona el contenedor de referencia
    const container = document.querySelector('#conversationPage');
    const promptarea = document.querySelector('#conversation-navbar');
    const messagesSpace = document.querySelector("#messages-space");
    const messagebarChat = document.querySelector("#messagebar-chat");
    const legalInfo = document.querySelector("#legal-info");

    if (container) {
        // Obtiene la altura del contenedor
        const heightContainer = container.offsetHeight - 470;

        // Define una variable CSS para usar en todo el documento

        if (editVar) {

            document.documentElement.style.setProperty('--message-height', `${heightContainer}px`);
        }

        console.log(`Altura del contenedor: ${heightContainer}px`);
    }

    // Establecer el ancho de messagebar-chat basado en el ancho de messages-space
    if (messagesSpace && messagebarChat) {
        const messagesSpaceWidth = messagesSpace.offsetWidth;

        // Aplicar el ancho a messagebar-chat
        messagebarChat.style.width = `${messagesSpaceWidth}px`;
        messagebarChat.style.maxWidth = `${messagesSpaceWidth}px`;
        legalInfo.style.width = `${messagesSpaceWidth}px`;
        legalInfo.style.maxWidth = `${messagesSpaceWidth}px`;
        console.log(`Ancho de messages-space aplicado a messagebar-chat: ${messagesSpaceWidth}px`);
    }


    window.addEventListener('resize', setDynamicHeight);


}

/**
 * ==========================================
 * DETECCIÓN DE PROXY Y TOOL DINÁMICO
 * ==========================================
 * Este código debe insertarse en conversation.html después de cargar los tools del asistente
 * Específicamente después de: chat.tools = assistantData.tools || [];
 */

/**
 * Detecta si el proxy está disponible y obtiene la lista de servicios
 */
async function detectProxyAndServices() {
    try {
        const proxyBaseUrl = 'http://localhost:8000';

        // 1. Verificar si el proxy está disponible
        console.log('🔍 Checking proxy availability...');
        const healthResponse = await fetch(`${proxyBaseUrl}/_health`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!healthResponse.ok) {
            console.log('⚠️ Proxy not available');
            return null;
        }

        console.log('✅ Proxy is available');

        // 2. Obtener lista de servicios disponibles
        const servicesResponse = await fetch(`${proxyBaseUrl}/_services`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!servicesResponse.ok) {
            console.error('❌ Failed to fetch services');
            return null;
        }

        const servicesData = await servicesResponse.json();
        const services = servicesData.services || [];

        console.log('📋 Available services:', services);

        return {
            available: true,
            baseUrl: proxyBaseUrl,
            services: services
        };

    } catch (error) {
        console.log('⚠️ Proxy detection failed:', error.message);
        return null;
    }
}

/**
 * Crea el tool dinámico basado en los servicios disponibles
 */
function createRetrieveDataTool(proxyInfo) {
    if (!proxyInfo || !proxyInfo.services || proxyInfo.services.length === 0) {
        return null;
    }

    // Construir la descripción con los servicios disponibles
    const serviceDescriptions = proxyInfo.services.map(service => {
        return `- **${service.name}**: ${service.description}`;
    }).join('\n');

    const serviceNames = proxyInfo.services.map(s => s.name).join(', ');

    const tool = {
        type: "function",
        function: {
            ask_for_execution:true,
            in_progress_message : "Searching in internal data source",
            name: "retrieve_data_from_corporate_services",
            friendly_name: "Retrieve Corporate Data",
            description: `Search and retrieve data from corporate services through the proxy.

**Available services:**
${serviceDescriptions}

Use this tool when the user asks for information that might be stored in corporate systems like Confluence, Jira, or other integrated services.

**Usage guidelines:**
- Select only the relevant services for the query (don't use all services for every query)
- The 'term' parameter should be a clear search query
- Multiple services can be specified as a semicolon-separated list
- Available service names: ${serviceNames}`,
            parameters: {
                type: "object",
                properties: {
                    term: {
                        type: "string",
                        description: "The search term or query to look up in the corporate services"
                    },
                    services: {
                        type: "string",
                        description: `Semicolon-separated list of services to search. Available: ${serviceNames}. Example: "confluence" or "confluence;jira"`
                    }
                },
                required: ["term", "services"]
            }
        }
    };

    return tool;
}

/**
 * Función principal para inicializar el tool del proxy
 * Esta función debe llamarse después de cargar chat.tools
 */
async function initializeProxyTool(chat,assistant) {

    console.log(assistant)
    console.log('🚀 Initializing proxy tool detection...');

    if (!assistant || !assistant.activeProxy) {
        console.log('⚠️ Assistant does not have proxy enabled');
        return false;
    }
    const proxyInfo = await detectProxyAndServices();

    if (!proxyInfo) {
        console.log('ℹ️ Proxy tool not available - continuing without it');
        return false;
    }
    window.activeServices = {};
    proxyInfo.services.forEach(service => {
        window.activeServices[service.name] = true;
    });
    console.log('🎯 Active services initialized:', Object.keys(window.activeServices));

    const retrieveDataTool = createRetrieveDataTool(proxyInfo);

    if (!retrieveDataTool) {
        console.log('⚠️ Could not create retrieve data tool');
        return false;
    }

    // Verificar si el tool ya existe para no duplicarlo
    const existingToolIndex = chat.tools.findIndex(
        t => t.function?.name === 'retrieve_data_from_corporate_services'
    );

    if (existingToolIndex >= 0) {
        // Actualizar el tool existente
        chat.tools[existingToolIndex] = retrieveDataTool;
        console.log('🔄 Updated existing retrieve_data_from_corporate_services tool');
    } else {
        // Agregar el nuevo tool

        chat.tools.push(retrieveDataTool);
        console.log('✅ Added retrieve_data_from_corporate_services tool');
        window.activeTools['retrieve_data_from_corporate_services'] = true;
    }

    // También agregarlo a activeTools si existe
    if (chat.activeTools) {
        const activeIndex = chat.activeTools.findIndex(
            t => t.function?.name === 'retrieve_data_from_corporate_services'
        );

        if (activeIndex >= 0) {
            chat.activeTools[activeIndex] = retrieveDataTool;
        } else {
            chat.activeTools.push(retrieveDataTool);
        }
    }

    // Guardar la información del proxy para uso posterior
    window.proxyInfo = proxyInfo;

    console.log('📊 Current tools:', chat.tools.map(t => t.function?.name));

    // Iniciar monitoreo en tiempo real
    startProxyMonitoring(chat);

    return true;
}
async function startProxyMonitoring(chat) {
    async function checkProxy() {
        try {
            const response = await fetch('http://localhost:8000/_health', {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });

            if (response.ok) {
                if (!window.proxyInfo) {
                    console.log('✅ Proxy came back online, re-detecting...');

                    // Re-detectar servicios
                    const proxyInfo = await detectProxyAndServices();

                    if (proxyInfo) {
                        // Recrear tool
                        const retrieveDataTool = createRetrieveDataTool(proxyInfo);

                        if (retrieveDataTool && chat && chat.tools) {
                            const existingIndex = chat.tools.findIndex(
                                t => t.function?.name === 'retrieve_data_from_corporate_services'
                            );

                            if (existingIndex >= 0) {
                                chat.tools[existingIndex] = retrieveDataTool;
                            } else {
                                chat.tools.push(retrieveDataTool);
                                window.activeTools['retrieve_data_from_corporate_services'] = true;
                            }

                            if (chat.activeTools) {
                                const activeIndex = chat.activeTools.findIndex(
                                    t => t.function?.name === 'retrieve_data_from_corporate_services'
                                );
                                if (activeIndex >= 0) {
                                    chat.activeTools[activeIndex] = retrieveDataTool;
                                } else {
                                    chat.activeTools.push(retrieveDataTool);
                                }
                            }

                            window.proxyInfo = proxyInfo;

                            // Inicializar servicios activos
                            window.activeServices = {};
                            proxyInfo.services.forEach(service => {
                                window.activeServices[service.name] = true;
                            });

                            console.log('✅ Proxy tool restored');
                            window.dispatchEvent(new CustomEvent('proxy-status-changed'));
                        }
                    }
                }
            } else {
                throw new Error('Proxy offline');
            }
        } catch (error) {
            if (window.proxyInfo) {
                console.log('❌ Proxy went offline');
                window.proxyInfo = null;

                // ELIMINAR EL TOOL
                if (chat && chat.tools) {
                    const toolIndex = chat.tools.findIndex(
                        t => t.function?.name === 'retrieve_data_from_corporate_services'
                    );
                    if (toolIndex >= 0) {
                        chat.tools.splice(toolIndex, 1);
                        console.log('🗑️ Removed retrieve_data_from_corporate_services tool');
                    }
                }

                // ELIMINAR DE ACTIVE TOOLS
                if (chat && chat.activeTools) {
                    const activeIndex = chat.activeTools.findIndex(
                        t => t.function?.name === 'retrieve_data_from_corporate_services'
                    );
                    if (activeIndex >= 0) {
                        chat.activeTools.splice(activeIndex, 1);
                    }
                }

                window.dispatchEvent(new CustomEvent('proxy-status-changed'));
            }
        }

        setTimeout(checkProxy, 5000);
    }

    checkProxy();
}

// Función para detener el monitoreo
function stopProxyMonitoring() {
    if (window.proxyEventSource) {
        window.proxyEventSource.close();
        window.proxyEventSource = null;
        console.log('⏹️ Proxy monitoring stopped');
    }
}

/**
 * Handler para ejecutar el tool retrieve_data_from_corporate_services
 * Este código debe insertarse en la función callTool()
 */
async function handleRetrieveDataTool(params) {
    const searchTerm = params.term || '';
    const servicesParam = params.services || '';

    if (!searchTerm) {
        throw new Error('Search term is required');
    }

    if (!window.proxyInfo || !window.proxyInfo.baseUrl) {
        throw new Error('Proxy not available');
    }

    console.log(`🔍 Retrieving data: "${searchTerm}" from services: ${servicesParam}`);

    try {
        // Construir la URL de búsqueda
        const queryParams = new URLSearchParams({
            q: searchTerm,
            services: servicesParam,
            limit: '10',
            include: 'content',
            normalize: 'simba_v1'
        });

        const searchUrl = `${window.proxyInfo.baseUrl}/_search?${queryParams.toString()}`;

        console.log('🌐 Search URL:', searchUrl);

        const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.results || [];
        const stats = data.stats || {};

        console.log(`✅ Found ${results.length} results`);
        console.log('📊 Stats:', stats);

        // Formatear los resultados para el LLM
        if (results.length === 0) {
            return {
                success: true,
                message: `No results found for "${searchTerm}" in services: ${servicesParam}`,
                results: [],
                stats: stats
            };
        }

        // Construir el contexto para el LLM
        const formattedResults = results.map((result, index) => {
            const text = result.text || '';
            const references = result.references || [];

            let content = '';
            if (text) {
                content = text;
            } else if (references.length > 0) {
                content = references.map(ref => ref.text || '').join('\n\n');
            }

            return {
                index: index + 1,
                title: result.name || result.id || 'Untitled',
                url: result.url || '',
                site: result.site || 'Unknown',
                summary: result.summary || '',
                content: content.substring(0, 2000), // Limitar contenido
                type: result.extra?.type || 'document'
            };
        });

        return {
            success: true,
            message: `Found ${results.length} results for "${searchTerm}"`,
            results: formattedResults,
            stats: stats
        };

    } catch (error) {
        console.error('❌ Error retrieving data:', error);
        return {
            success: false,
            error: error.message,
            results: []
        };
    }
}

// ==========================================
// EXPORT PARA USO EN CONVERSATION.HTML
// ==========================================
window.initializeProxyTool = initializeProxyTool;
window.handleRetrieveDataTool = handleRetrieveDataTool;