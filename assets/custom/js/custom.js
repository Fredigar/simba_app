
function viewDocument(url, title, openInSplitView = false) {
    title = title || '';

    if (openInSplitView) {
        // NUEVO: Abrir en split view (como editContent)

        // Generar un ID único para el iframe
        const iframeId = 'document-viewer-split-' + Date.now();

        // Crear el HTML del iframe para el split view
        const html = `<iframe id="${iframeId}" src="about:blank" style="width:100%; height:98vh; border:none;" class="document-viewer-split"></iframe>`;

        // Configurar el botón de cerrar del split view
        $("#close-secundary").unbind('click');
        $("#close-secundary").bind('click', function() {
            app.splitView.close();
            setTimeout(function(){
                setDynamicHeight();
            }, 500);
        });

        // Establecer el título en el split view
        $("#secundary-title").find('.title').text(title);

        // Abrir el split view
        app.splitView.open(html, {isHtml: true, pageTitle: title});

        // Cargar el documento en el iframe después de un pequeño delay
        setTimeout(function() {
            const timestamp = new Date().getTime();
            const separator = url.includes('?') ? '&' : '?';
            const newUrl = `${url}${separator}t=${timestamp}`;

            // Establecer la URL del documento en el iframe del split view
            $(`#${iframeId}`).attr('src', newUrl);

            // Esperar a que se cargue el iframe para poder comunicarse con él
            waitForIframeLoad(iframeId, function(iframe) {
                console.log('Iframe cargado, ahora puedes comunicarte con él');

                // Almacenar el ID del iframe para uso posterior
                window.currentIframeId = iframeId;

                // Ejemplo: puedes llamar funciones del iframe aquí
                // callIframeFunction(iframeId, 'inicializar');
            });

        }, 100);

        // Configurar el botón de guardar (opcional, para abrir en nueva ventana)
        $("#save-secundary").unbind('click');
        $("#save-secundary").bind('click', function() {
            window.open(url, "_blank");
        });

        // Configurar el botón de imprimir
        $("#print-btn").unbind('click');
        $("#print-btn").bind('click', function() {
            // Intentar imprimir el contenido del iframe
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
        // COMPORTAMIENTO ORIGINAL: Abrir en popup

        // Primero limpia el iframe estableciendo src a about:blank
        $("#document-viewer").attr('src', 'about:blank');

        // Usa setTimeout para asegurar que el iframe se limpie antes de cargar la nueva URL
        setTimeout(function() {
            // Agrega un parámetro de timestamp para evitar caché
            const timestamp = new Date().getTime();
            const separator = url.includes('?') ? '&' : '?';
            const newUrl = `${url}${separator}t=${timestamp}`;

            // Establece la nueva URL con el timestamp
            $("#document-viewer").attr('src', newUrl);

            // El resto de tu código original
            $("#viewer-popup").find('.title').text(title);
            $("#btn-document-maximize").unbind('click');
            $("#btn-document-maximize").bind('click', function() {
                window.open(url, "_blank");
            });
            $("#close-sources").bind('click', function() {
                app.panel.close("#sources-panel");
            });
            $("#close-viewer").unbind('click');
            $("#close-viewer").bind('click', function() {
                app.popup.close('#viewer-popup');
            });
            app.popup.open('#viewer-popup');
        }, 50); // Un pequeño retraso de 50ms
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