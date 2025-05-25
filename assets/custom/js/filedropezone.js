/**
 * FileDropzone.js - A library for managing file uploads and text extraction
 * v1.1.0
 */
(function(global) {
    'use strict';

    /**
     * FileDropzone - Main class for managing file uploads
     * @param {Object} options - Configuration options
     */
    function FileDropzone(options) {
        // Default options
        this.options = {
            dropzoneId: 'file-dropzone',
            fileInputId: 'file-upload',
            textareaId: 'prompt',
            previewClass: 'file-preview',
            dragOverClass: 'drag-over',
            hasFilesClass: 'has-files',
            messagebar: null,
            framework7: null,
            onFileAdded: null,
            onFileRemoved: null,
            onTextExtracted: null,
            onAllFilesProcessed: null,
            onFileRejected: null, // New callback for rejected files
            onStaskExecuted: null,
            extractionTimeout: 30000,  // Timeout for text extraction (30 seconds)
            useSimbaDocumentTags: false, // Nueva opción para controlar el uso de etiquetas simba_document
            allowedExtensions: [       // List of allowed extensions
                // Documents
                'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp',
                // Images
                'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif',
                // Others
                'csv', 'md', 'xml', 'json', 'html', 'htm', 'json','stask','js','php'
            ],
            maxFileSize: 10 * 1024 * 1024 // Maximum file size (10MB by default)

        };

        // Combine user options with default options
        if (options) {
            for (var key in options) {
                if (options.hasOwnProperty(key)) {
                    this.options[key] = options[key];
                }
            }
        }

        // Normalize extensions (convert to lowercase and remove dots)
        if (this.options.allowedExtensions) {
            this.options.allowedExtensions = this.options.allowedExtensions.map(function(ext) {
                return ext.toLowerCase().replace(/^\./, '');
            });
        }

        // DOM elements
        this.dropzone = document.getElementById(this.options.dropzoneId);
        this.fileInput = document.getElementById(this.options.fileInputId);
        this.textarea = document.getElementById(this.options.textareaId);

        // State
        this.uploadedFiles = [];

        // Initialize
        this._init();
    }
    /**
     * Verifies if a file is valid according to configured restrictions
     * @param {File} file - The file to validate
     * @returns {Object} - Validation result {valid: boolean, reason: string}
     * @private
     */
    FileDropzone.prototype._validateFile = function(file) {
        // Check file size
        if (this.options.maxFileSize && file.size > this.options.maxFileSize) {
            var maxSizeMB = (this.options.maxFileSize / (1024 * 1024)).toFixed(2);
            var fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            return {
                valid: false,
                reason: `The file ${file.name} is too large (${fileSizeMB}MB). The maximum allowed size is ${maxSizeMB}MB.`
            };
        }

        // If there are no extension restrictions, accept all files
        if (!this.options.allowedExtensions || this.options.allowedExtensions.length === 0) {
            return { valid: true };
        }

        // Get the file extension
        var fileExt = file.name.split('.').pop().toLowerCase();

        // Check if the extension is allowed
        if (this.options.allowedExtensions.indexOf(fileExt) === -1) {
            return {
                valid: false,
                reason: `The file type .${fileExt} is not allowed. The allowed types are: ${this.options.allowedExtensions.join(', ')}`
            };
        }

        return { valid: true };
    };

    /**
     * Initializes the FileDropzone instance
     * @private
     */
    FileDropzone.prototype._init = function() {
        // Verify necessary DOM elements
        if (!this.dropzone || !this.fileInput || !this.textarea) {
            console.error('FileDropzone: DOM elements not found');
            return;
        }

        // Check for potential prototype issues
        this._checkForPrototypeIssues();

        // Set up drag & drop events
        this._setupDragAndDrop();

        // Set up paste handling in textarea
        this._setupPasteHandler();

        // Set up file input handling
        this._setupFileInput();
        // Add this to the constructor or _init method
        if (!this.options.onFileRejected) {
            this.options.onFileRejected = this._showRejectionNotifications.bind(this);
        }
    };

    /**
     * Sets up events for drag & drop
     * @private
     */
    FileDropzone.prototype._setupDragAndDrop = function() {
        var self = this;

        // Dragover event on document
        document.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (self._isDescendantOf(e.target, 'messagebar-area') || e.target === self.textarea) {
                self.dropzone.classList.add(self.options.dragOverClass);
            }
        });

        // Dragleave event on document
        document.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();

            if (!self._isDescendantOf(e.relatedTarget, 'messagebar-area') &&
                e.relatedTarget !== self.textarea) {
                self.dropzone.classList.remove(self.options.dragOverClass);
            }
        });

        // Drop event on document
        document.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self.dropzone.classList.remove(self.options.dragOverClass);

            if (self._isDescendantOf(e.target, 'messagebar-area') || e.target === self.textarea) {
                if (e.dataTransfer.files.length) {
                    self.handleFiles(e.dataTransfer.files);
                }
            }
        });
    };

    /**
     * Sets up paste handling in the textarea
     * @private
     */
    /**
     * Sets up paste handling in the textarea
     * @private
     */
    FileDropzone.prototype._setupPasteHandler = function() {
        var self = this;

        this.textarea.addEventListener('paste', function(e) {
            // Check if there are files in the clipboard
            if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
                e.preventDefault(); // Prevent default paste behavior

                // Process pasted files
                self.handleFiles(e.clipboardData.files);
                return;
            }

            // Check if there's an image in the clipboard (not as a file)
            var items = e.clipboardData.items;
            if (items) {
                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        e.preventDefault(); // Prevent default behavior

                        // Get the image as blob
                        var blob = items[i].getAsFile();
                        var imageExt = self._getImageExtensionFromMimeType(items[i].type);

                        // Create a filename for the pasted image
                        var timestamp = new Date().toISOString().replace(/[-:.]/g, '');
                        var fileName = 'pasted_image_' + timestamp + '.' + imageExt;

                        // Convert the blob to a File object
                        var pastedFile = new File([blob], fileName, { type: items[i].type });

                        // Process the image
                        self.handleFiles([pastedFile]);
                        return;
                    }
                }
            }
        });
    };

    /**
     * Gets the appropriate file extension based on MIME type
     * @param {string} mimeType - MIME type of the image
     * @returns {string} - File extension
     * @private
     */
    FileDropzone.prototype._getImageExtensionFromMimeType = function(mimeType) {
        switch (mimeType) {
            case 'image/jpeg':
                return 'jpg';
            case 'image/png':
                return 'png';
            case 'image/gif':
                return 'gif';
            case 'image/bmp':
                return 'bmp';
            case 'image/webp':
                return 'webp';
            case 'image/tiff':
                return 'tiff';
            default:
                return 'png'; // Default to png if the type is not recognized
        }
    };

    /**
     * Sets up the file input
     * @private
     */
    FileDropzone.prototype._setupFileInput = function() {
        var self = this;

        this.fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                self.handleFiles(e.target.files);
            }
        });
    };

    /**
     * Checks if an element is a descendant of another by class
     * @param {HTMLElement} element - The element to check
     * @param {string} className - The class to look for
     * @returns {boolean} - True if it's a descendant, false otherwise
     * @private
     */
    FileDropzone.prototype._isDescendantOf = function(element, className) {
        while (element && element !== document) {
            if (element.classList && element.classList.contains(className)) {
                return true;
            }
            element = element.parentNode;
        }
        return false;
    };

    /**
     * Handles uploaded files
     * @param {FileList} files - List of uploaded files
     * @public
     */
    FileDropzone.prototype.handleFiles = function(files) {
        if (!files || files.length === 0) return;

        var self = this;
        var validFiles = [];
        var rejectedFiles = [];

        // Validate each file
        Array.from(files).forEach(function(file) {
            // Check if the file already exists
            if (self.uploadedFiles.some(f => f.name === file.name)) {
                rejectedFiles.push({
                    file: file,
                    reason: `A file with the name "${file.name}" already exists.`
                });
                return; // Skip this file if it already exists
            }

            // Validate the file
            var validation = self._validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                rejectedFiles.push({
                    file: file,
                    reason: validation.reason
                });
            }
        });

        // Notify rejected files
        if (rejectedFiles.length > 0 && typeof self.options.onFileRejected === 'function') {
            self.options.onFileRejected(rejectedFiles);
        }

        // If there are no valid files, don't continue
        if (validFiles.length === 0) {
            return;
        }

        // Show the dropzone when there are files
        this.dropzone.classList.add(this.options.hasFilesClass);


        // Create preview area if it doesn't exist
        var previewArea = this.dropzone.querySelector('.' + this.options.previewClass);
        if (!previewArea) {
            previewArea = document.createElement('div');
            previewArea.className = this.options.previewClass;
            this.dropzone.appendChild(previewArea);
        }

        validFiles.forEach(function(file) {
            // Check if the file already exists
            if (self.uploadedFiles.some(f => f.name === file.name)) {
                return; // Skip this file if it already exists
            }

            // Add to uploaded files array
            self.uploadedFiles.push(file);

            var fileType = self._getFileType(file);
            var icon = 'fa-file';
            var needsExtraction = false;

// Determine icon and if text extraction is needed
            switch(fileType) {
                case 'text':  // Añadir este case para archivos de texto
                    // Elige el ícono según la extensión
                    if (file.name.toLowerCase().endsWith('.json')) {
                        icon = 'fa-file-code';
                    } else if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
                        icon = 'fa-file-code';
                    } else if (file.name.toLowerCase().endsWith('.js')) {
                        icon = 'fa-file-code';
                    } else if (file.name.toLowerCase().endsWith('.css')) {
                    } else if (file.name.toLowerCase().endsWith('.stask')) {
                        icon = 'fa-tasks';
                    } else {
                        icon = 'fa-file-alt';
                    }
                    needsExtraction = true;
                    break;
                case 'word':
                    icon = 'fa-file-word';
                    needsExtraction = true;
                    break;
                case 'excel':
                    icon = 'fa-file-excel';
                    needsExtraction = true;
                    break;
                case 'ppt':
                    icon = 'fa-file-powerpoint';
                    needsExtraction = true;
                    break;
                case 'pdf':
                    icon = 'fa-file-pdf';
                    needsExtraction = true;
                    break;
                case 'txt':
                    icon = 'fa-file-alt';
                    needsExtraction = true;
                    break;
                case 'image':
                    icon = 'fa-file-image';
                    needsExtraction = true; // Now images also require extraction
                    break;
                default:
                    // Basic types that don't need extraction
                    if (file.type.startsWith('video/')) icon = 'fa-file-video';
                    else if (file.type.startsWith('audio/')) icon = 'fa-file-audio';
                    break;
            }
            // Create preview item
            var fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.setAttribute('data-file-id', file.name);

            fileItem.innerHTML = `
        <i class="fa ${icon}"></i>
        <span class="file-name">${file.name}</span>
        <span class="remove-file" data-filename="${file.name}">
            <i class="fa fa-times"></i>
        </span>
    `;

            // Add extraction indicator for files that need processing
            if (needsExtraction) {
                var extractingIndicator = document.createElement('span');
                extractingIndicator.className = 'extracting-indicator';
                extractingIndicator.innerHTML = '<i class="fa fa-sync fa-spin"></i>';
                fileItem.appendChild(extractingIndicator);

                // Extract text from the file
                self._extractTextFromFile(file, fileType);
            }

            previewArea.appendChild(fileItem);

            // Call onFileAdded callback if it exists
            if (typeof self.options.onFileAdded === 'function') {
                self.options.onFileAdded(file);
            }
        });

        // Add event listeners to remove buttons
        previewArea.querySelectorAll('.remove-file').forEach(function(button) {
            // Check if it already has a listener to avoid duplicates
            if (!button.hasAttribute('data-has-listener')) {
                button.setAttribute('data-has-listener', 'true');
                button.addEventListener('click', function(e) {
                    var filename = e.currentTarget.getAttribute('data-filename');
                    self.removeFile(filename);
                });
            }
        });

        // Clear file input
        this.fileInput.value = '';
    };

    /**
     * Shows notifications for rejected files
     * @param {Array} rejectedFiles - List of rejected files with reasons
     * @private
     */
    FileDropzone.prototype._showRejectionNotifications = function(rejectedFiles) {
        var self = this;

        // Verify if there are rejected files
        if (!rejectedFiles || rejectedFiles.length === 0) return;

        // Create a notifications container if it doesn't exist
        var notificationsContainer = document.getElementById('dropzone-notifications');
        if (!notificationsContainer) {
            notificationsContainer = document.createElement('div');
            notificationsContainer.id = 'dropzone-notifications';
            notificationsContainer.style.position = 'fixed';
            notificationsContainer.style.right = '20px';
            notificationsContainer.style.bottom = '20px';
            notificationsContainer.style.zIndex = '9999';
            document.body.appendChild(notificationsContainer);
        }

        // Show a notification for each rejected file
        rejectedFiles.forEach(function(rejected) {
            var notification = document.createElement('div');
            notification.className = 'dropzone-notification';
            notification.style.backgroundColor = '#f44336';
            notification.style.color = 'white';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '5px';
            notification.style.marginTop = '10px';
            notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            notification.style.maxWidth = '300px';
            notification.style.wordWrap = 'break-word';
            notification.style.transition = 'opacity 0.3s ease-out';

            var closeBtn = document.createElement('span');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.float = 'right';
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.marginLeft = '10px';
            closeBtn.onclick = function() {
                notification.style.opacity = '0';
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            };

            var message = document.createElement('div');
            message.textContent = rejected.reason;

            notification.appendChild(closeBtn);
            notification.appendChild(message);
            notificationsContainer.appendChild(notification);

            // Auto-remove the notification after 5 seconds
            setTimeout(function() {
                notification.style.opacity = '0';
                setTimeout(function() {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 5000);
        });
    };
    /**
     * Dynamically loads the JSZip library
     * @param {Function} callback - Function to call when loading is complete
     * @private
     */
    FileDropzone.prototype._loadJSZip = function(callback) {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = function() {
            callback();
        };
        script.onerror = function() {
            console.error("Error loading JSZip from CDN");
            callback();
        };
        document.head.appendChild(script);
    };

    /**
     * Extrae texto de un archivo PPTX con mejor manejo del XML y paginación por diapositivas
     * @param {File} file - El archivo a procesar
     * @param {string} fileType - El tipo de archivo ('ppt')
     * @param {Function} callback - Función a llamar cuando la extracción esté completa
     * @public
     */
    FileDropzone.prototype.extractTextFromPowerPoint = function(file, fileType, callback) {
        var self = this;
        var reader = new FileReader();

        reader.onload = function(e) {
            var arrayBuffer = e.target.result;

            // Primero verificamos si JSZip está disponible
            if (typeof JSZip === 'undefined') {
                self._loadJSZip(function() {
                    if (typeof JSZip !== 'undefined') {
                        self._processPowerPointWithJSZip(arrayBuffer, file, callback);
                    } else {
                        // Si no podemos cargar JSZip, usar método alternativo mejorado
                        self._extractPowerPointTextAlternative(arrayBuffer, file, callback);
                    }
                });
            } else {
                self._processPowerPointWithJSZip(arrayBuffer, file, callback);
            }
        };

        reader.onerror = function() {
            var errorMessage = "Error al leer el archivo PowerPoint";
            console.error(errorMessage);
            self.updateFileWithExtractedContent(file.name, errorMessage);

            if (callback) callback(errorMessage);
        };

        reader.readAsArrayBuffer(file);
    };

    /**
     * Procesa una presentación PowerPoint usando JSZip con mejor extracción de texto y paginación
     * @param {ArrayBuffer} arrayBuffer - El contenido del archivo PowerPoint
     * @param {File} file - El archivo original
     * @param {Function} callback - Función callback
     * @private
     */
    FileDropzone.prototype._processPowerPointWithJSZip = function(arrayBuffer, file, callback) {
        var self = this;

        try {
            var zip = new JSZip();

            zip.loadAsync(arrayBuffer).then(function(contents) {
                var slideFiles = [];
                var slideContents = {};
                var result = "";

                // Buscar archivos de diapositivas
                Object.keys(contents.files).forEach(function(filename) {
                    if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
                        slideFiles.push(filename);
                    }
                });

                // Ordenar archivos de diapositivas por número
                slideFiles.sort(function(a, b) {
                    var numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                    var numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                    return numA - numB;
                });

                // Procesar cada archivo de diapositiva
                var slidePromises = slideFiles.map(function(slideFile) {
                    return zip.file(slideFile).async('string').then(function(content) {
                        var slideNum = parseInt(slideFile.match(/slide(\d+)\.xml/)[1]);
                        slideContents[slideNum] = self._extractTextFromPPTXSlide(content);
                    });
                });

                // Esperar a que todas las diapositivas se procesen
                Promise.all(slidePromises).then(function() {
                    // Construir el resultado en orden, con soporte para paginación
                    if (self.options.useSimbaDocumentTags) {
                        // Formato con etiquetas simba_document
                        for (var i = 1; i <= Object.keys(slideContents).length; i++) {
                            if (slideContents[i]) {
                                result += `<simba_document data-filename="${file.name}" data-page="${i}">\n`;
                                result += "## Diapositiva " + i + "\n\n";
                                result += slideContents[i] + "\n";
                                result += "</simba_document>\n\n";
                            }
                        }
                    } else {
                        // Formato de texto plano con marcadores de página
                        for (var i = 1; i <= Object.keys(slideContents).length; i++) {
                            if (slideContents[i]) {
                                result += `--- Página ${i} ---\n\n`;
                                result += "## Diapositiva " + i + "\n\n";
                                result += slideContents[i] + "\n\n";
                            }
                        }
                    }

                    // Actualizar con el texto extraído
                    self.updateFileWithExtractedContent(file.name, result);

                    // Llamar al callback
                    if (typeof self.options.onTextExtracted === 'function') {
                        self.options.onTextExtracted(file, result);
                    }

                    if (callback) callback(result);
                }).catch(function(error) {
                    console.error("Error procesando diapositivas:", error);
                    var errorMessage = "Error procesando diapositivas: " + error.message;
                    self.updateFileWithExtractedContent(file.name, errorMessage);

                    if (callback) callback(errorMessage);
                });
            }).catch(function(error) {
                console.error("Error abriendo archivo PPTX:", error);
                // Intentar con método alternativo
                self._extractPowerPointTextAlternative(arrayBuffer, file, callback);
            });
        } catch (error) {
            console.error("Error en el procesamiento de PowerPoint:", error);
            // Intentar con método alternativo
            self._extractPowerPointTextAlternative(arrayBuffer, file, callback);
        }
    };

    /**
     * Extrae texto de una diapositiva XML PPTX con mejor limpieza del XML
     * @param {string} xmlContent - Contenido XML de la diapositiva
     * @returns {string} - Texto extraído
     * @private
     */
    FileDropzone.prototype._extractTextFromPPTXSlide = function(xmlContent) {
        var textContent = [];

        // Buscar texto en las etiquetas a:t
        var textRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
        var match;

        while ((match = textRegex.exec(xmlContent)) !== null) {
            var text = match[1].trim();
            if (text) {
                // Decodificar entidades HTML
                text = text.replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'");
                textContent.push(text);
            }
        }

        // Formatear el texto extraído
        var formattedText = "";

        // Identificar títulos y contenido
        if (textContent.length > 0) {
            // El primer texto significativo suele ser el título
            if (textContent[0] && textContent[0].length > 3) {
                formattedText += "### " + textContent[0] + "\n\n";

                // Resto del contenido
                for (var i = 1; i < textContent.length; i++) {
                    // Si parece un elemento de lista
                    if (textContent[i].length < 100 && i < textContent.length - 1) {
                        formattedText += "* " + textContent[i] + "\n";
                    } else {
                        formattedText += textContent[i] + "\n\n";
                    }
                }
            } else {
                // Sin título claro, formatear todo como contenido
                textContent.forEach(function(text) {
                    formattedText += text + "\n\n";
                });
            }
        }

        return formattedText;
    };

    /**
     * Método alternativo mejorado para extraer texto de PowerPoint cuando JSZip falla
     * @param {ArrayBuffer} arrayBuffer - El contenido del archivo PowerPoint
     * @param {File} file - El archivo original
     * @param {Function} callback - Función callback
     * @private
     */
    FileDropzone.prototype._extractPowerPointTextAlternative = function(arrayBuffer, file, callback) {
        var self = this;

        try {
            // Convertir a texto (funciona para archivos PPTX, que son archivos ZIP con XMLs)
            var data = new Uint8Array(arrayBuffer);
            var textContent = "";

            // Intentar extraer todo el texto como una cadena
            for (var i = 0; i < data.length; i++) {
                // Solo incluir caracteres imprimibles
                if (data[i] >= 32 && data[i] <= 126 || data[i] >= 160) {
                    textContent += String.fromCharCode(data[i]);
                }
            }

            // Extraer texto entre etiquetas a:t
            var extractedTexts = [];
            var textMatches = textContent.match(/<a:t>[^<]*<\/a:t>/g);

            if (textMatches && textMatches.length > 0) {
                for (var j = 0; j < textMatches.length; j++) {
                    var text = textMatches[j].replace(/<a:t>|<\/a:t>/g, '').trim();
                    if (text) {
                        extractedTexts.push(text);
                    }
                }
            }

            // Si no encontramos suficiente texto con el método anterior, buscar por otros patrones
            if (extractedTexts.length < 5) {
                // Intentar buscar texto entre comillas en valores de atributos
                var valueMatches = textContent.match(/val="([^"]*)"/g);
                if (valueMatches && valueMatches.length > 0) {
                    valueMatches.forEach(function(match) {
                        var value = match.replace(/val="|"/g, '').trim();
                        if (value && value.length > 3 && !/^\d+$/.test(value) && !/^[a-f0-9-]+$/.test(value)) {
                            extractedTexts.push(value);
                        }
                    });
                }

                // Buscar cualquier secuencia de texto que parezca significativa
                var textBlocks = textContent.match(/[A-Za-z0-9\s.,;:'"-]{10,}/g);
                if (textBlocks && textBlocks.length > 0) {
                    textBlocks.forEach(function(block) {
                        var cleaned = block.trim();
                        // Evitar duplicados y valores que parecen ser datos técnicos
                        if (cleaned && extractedTexts.indexOf(cleaned) === -1 &&
                            !/^[0-9.,-]+$/.test(cleaned) &&
                            !cleaned.includes('xmlns:') &&
                            !cleaned.includes('http://') &&
                            !cleaned.includes('<?xml')) {
                            extractedTexts.push(cleaned);
                        }
                    });
                }
            }

            // Formar el resultado final con paginación
            var result = "";
            if (extractedTexts.length > 0) {
                // Eliminar duplicados pero mantener el orden
                var uniqueTexts = [];
                var seen = {};
                extractedTexts.forEach(function(text) {
                    if (!seen[text]) {
                        uniqueTexts.push(text);
                        seen[text] = true;
                    }
                });

                // Agrupar en "diapositivas" aproximadas para mejor legibilidad
                var slideCount = 1;
                var itemsPerSlide = Math.max(1, Math.floor(uniqueTexts.length / 5));

                for (var k = 0; k < uniqueTexts.length; k += itemsPerSlide) {
                    var slideTexts = uniqueTexts.slice(k, k + itemsPerSlide);
                    var slideContent = "";

                    slideTexts.forEach(function(text) {
                        // Detectar si parece un título
                        if (text.length < 50 && (text.toUpperCase() === text || text.endsWith(':') || /^[A-Z]/.test(text))) {
                            slideContent += "### " + text + "\n\n";
                        } else {
                            slideContent += text + "\n\n";
                        }
                    });

                    if (self.options.useSimbaDocumentTags) {
                        result += `<simba_document data-filename="${file.name}" data-page="${slideCount}">\n`;
                        result += "## Diapositiva " + slideCount + " (Extracción Alternativa)\n\n";
                        result += slideContent;
                        result += "</simba_document>\n\n";
                    } else {
                        result += `--- Página ${slideCount} ---\n\n`;
                        result += "## Diapositiva " + slideCount + " (Extracción Alternativa)\n\n";
                        result += slideContent + "\n\n";
                    }

                    slideCount++;
                }
            } else {
                // Si no pudimos extraer nada útil, mostrar un mensaje más útil
                if (self.options.useSimbaDocumentTags) {
                    result = `<simba_document data-filename="${file.name}" data-page="1">\n`;
                    result += "# No se pudo extraer contenido legible\n\n";
                    result += "El archivo PPTX no pudo ser procesado correctamente. Esto puede deberse a:\n\n";
                    result += "* Formato específico de la presentación\n";
                    result += "* Contenido principalmente visual (imágenes/gráficos)\n";
                    result += "* Protección del documento\n\n";
                    result += "Intente abrir el archivo directamente en PowerPoint para ver su contenido.";
                    result += "</simba_document>";
                } else {
                    result = "--- Página 1 ---\n\n";
                    result += "# No se pudo extraer contenido legible\n\n";
                    result += "El archivo PPTX no pudo ser procesado correctamente. Esto puede deberse a:\n\n";
                    result += "* Formato específico de la presentación\n";
                    result += "* Contenido principalmente visual (imágenes/gráficos)\n";
                    result += "* Protección del documento\n\n";
                    result += "Intente abrir el archivo directamente en PowerPoint para ver su contenido.";
                }
            }

            // Actualizar con el texto extraído
            self.updateFileWithExtractedContent(file.name, result);

            // Llamar al callback
            if (typeof self.options.onTextExtracted === 'function') {
                self.options.onTextExtracted(file, result);
            }

            if (callback) callback(result);
        } catch (error) {
            console.error("Error en la extracción alternativa de PowerPoint:", error);
            var errorMessage = "Error procesando PowerPoint: " + error.message;
            self.updateFileWithExtractedContent(file.name, errorMessage);

            if (callback) callback(errorMessage);
        }
    };

    /**
     * Función mejorada para limpiar XML de PPTX
     * @param {string} xmlText - El texto XML a limpiar
     * @returns {string} - El texto limpio
     * @private
     */
    FileDropzone.prototype._cleanPPTXXML = function(xmlText) {
        // Extraer texto entre etiquetas <a:t> y </a:t>
        var cleanedText = "";
        var regex = /<a:t>(.*?)<\/a:t>/g;
        var match;

        while ((match = regex.exec(xmlText)) !== null) {
            if (match[1] && match[1].trim()) {
                cleanedText += match[1].trim() + "\n";
            }
        }

        // Si no se encontró nada, eliminar todas las etiquetas XML
        if (!cleanedText.trim()) {
            cleanedText = xmlText.replace(/<[^>]+>/g, ' ');
            cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        }

        return cleanedText;
    };
    /**
     * Gets the file type based on its extension and MIME type
     * @param {File} file - The file to analyze
     * @returns {string} - The identified file type
     * @private
     */
    FileDropzone.prototype._getFileType = function(file) {
        // First check the file extension
        var extension = file.name.split('.').pop().toLowerCase();

        // Known extensions
        if (['doc', 'docx'].includes(extension)) return 'word';
        if (['xls', 'xlsx', 'xlsm', 'csv'].includes(extension)) return 'excel';
        if (['ppt', 'pptx', 'pps', 'ppsx'].includes(extension)) return 'ppt';
        if (extension === 'pdf') return 'pdf';

        // Text-based file types - all these are handled as plain text with specialized viewing
        if (['txt', 'text', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'xml','stask',
            'css', 'scss', 'less', 'md', 'markdown', 'sh', 'bash', 'py', 'rb',
            'php', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rust', 'swift', 'yml',
            'yaml', 'ini', 'cfg', 'conf', 'log'].includes(extension)) {
            return 'text';
        }

        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'].includes(extension)) return 'image';

        // If no match by extension, check MIME type
        var mimeType = file.type.toLowerCase();

        if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessing')) return 'word';
        if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'excel';
        if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.startsWith('text/') ||
            mimeType.includes('json') ||
            mimeType.includes('javascript') ||
            mimeType.includes('html') ||
            mimeType.includes('xml') ||
            mimeType.includes('css')) {
            return 'text';
        }
        if (mimeType.startsWith('image/')) return 'image';

        // Unknown type
        return 'unknown';
    };
    /**
     * Extracts text from text-based files (TXT, JSON, JS, HTML, CSS, etc.)
     * @param {File} file - The file to process
     * @param {Function} callback - Function to call when extraction is complete
     * @private
     */
    FileDropzone.prototype._extractTextFromTextFile = function(file, callback) {
        var reader = new FileReader();

        reader.onload = function(e) {
            var text = e.target.result;
            callback(text);
        };

        reader.onerror = function() {
            console.error("Error reading text file");
            callback("Error reading text file");
        };

        reader.readAsText(file);
    };
    /**
     * Extracts text from different file types
     * @param {File} file - The file to process
     * @param {string} fileType - The file type ('word', 'excel', 'pdf', 'text', 'ppt', 'image')
     * @private
     */
    FileDropzone.prototype._extractTextFromFile = function(file, fileType) {
        var self = this;

        // Create a timeout for extraction
        var extractionTimeout = setTimeout(function() {
            console.warn("Extraction timeout for", file.name);
            self.updateFileWithExtractedContent(file.name, "Error: extraction timeout");
        }, this.options.extractionTimeout);

        if (fileType === 'text') {
            // Procesamiento genérico para todos los archivos de texto
            self._extractTextFromTextFile(file, function(text) {
                clearTimeout(extractionTimeout);

                // Intentar formatear el JSON si es un archivo JSON
                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        var jsonObj = JSON.parse(text);
                        text = JSON.stringify(jsonObj, null, 2); // Indentación de 2 espacios
                    } catch (error) {
                        // Si hay error al parsear JSON, dejamos el texto tal cual
                        console.warn("Error al formatear JSON:", error);
                    }
                }

                self.updateFileWithExtractedContent(file.name, text);

                // Call the onTextExtracted callback if it exists
                if (typeof self.options.onTextExtracted === 'function') {
                    self.options.onTextExtracted(file, text);
                }
            });
        }
        else if (fileType === 'pdf') {
            // For PDF files, use pdf.js
            self._extractTextFromPdfFile(file, function(text) {
                clearTimeout(extractionTimeout);
                self.updateFileWithExtractedContent(file.name, text);

                // Call the onTextExtracted callback if it exists
                if (typeof self.options.onTextExtracted === 'function') {
                    self.options.onTextExtracted(file, text);
                }
            });
        }
        else if (fileType === 'ppt') {
            // For PowerPoint files
            self.extractTextFromPowerPoint(file, fileType, function(text) {
                clearTimeout(extractionTimeout);
                // The callback is already called inside extractTextFromPowerPoint
            });
        }
        else if (fileType === 'word' || fileType === 'excel') {
            // For Office files, use the existing function
            self.extractTextFromOfficeFile(file, fileType, function(text) {
                clearTimeout(extractionTimeout);
                // The callback is already called inside extractTextFromOfficeFile
            });
        }
        else if (fileType === 'image') {
            // For images, use OCR
            self.extractTextFromImage(file, function(text) {
                clearTimeout(extractionTimeout);
                // The callback is already called inside extractTextFromImage
            });
        }
    };

    /**
     * Extracts text from an image using OCR
     * @param {File|Blob} file - The image to process
     * @param {Function} callback - Function to call when extraction is complete
     * @public
     */
    FileDropzone.prototype.extractTextFromImage = function(file, callback) {
        var self = this;

        // Check if Tesseract is available
        if (typeof Tesseract === 'undefined') {
            // If Tesseract is not available, load it dynamically
            self._loadTesseract(function() {
                if (typeof Tesseract !== 'undefined') {
                    self._processImageWithTesseract(file, callback);
                } else {
                    var errorMessage = "Could not load Tesseract.js to extract text from the image";
                    console.error(errorMessage);
                    self.updateFileWithExtractedContent(file.name, errorMessage);

                    if (callback) callback(errorMessage);
                }
            });
        } else {
            self._processImageWithTesseract(file, callback);
        }
    };

    /**
     * Dynamically loads the Tesseract.js library
     * @param {Function} callback - Function to call when loading is complete
     * @private
     */
    FileDropzone.prototype._loadTesseract = function(callback) {
        // First load the main Tesseract script
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
        script.onload = function() {
            console.log("Tesseract.js loaded successfully");
            callback();
        };
        script.onerror = function() {
            console.error("Error loading Tesseract.js from CDN");
            callback();
        };
        document.head.appendChild(script);
    };

    /**
     * Processes an image with Tesseract.js to extract text
     * @param {File|Blob} file - The image to process
     * @param {Function} callback - Function to call when processing is complete
     * @private
     */
    FileDropzone.prototype._processImageWithTesseract = function(file, callback) {
        var self = this;

        // Create URL for the image
        var imageUrl = URL.createObjectURL(file);

        // Update UI to show that processing is happening
        if (file.name) {
            var fileItem = self.dropzone.querySelector(`.file-item[data-file-id="${file.name}"]`);
            if (fileItem) {
                var processingIndicator = fileItem.querySelector('.extracting-indicator');
                if (processingIndicator) {
                    processingIndicator.innerHTML = '<i class="fa fa-cog fa-spin"></i> Processing OCR...';
                }
            }
        }

        // Create a container to show a progress message
        var progressInfo = "Starting text recognition in image...";
        self.updateFileWithExtractedContent(file.name, progressInfo, false);

        // Start text recognition
        Tesseract.recognize(
            imageUrl,
            'spa+eng', // Languages: Spanish + English
            {
                logger: function(data) {
                    console.log("OCR Process: " + data.status);
                }
            }
        ).then(function(result) {
            // Release the image URL
            URL.revokeObjectURL(imageUrl);

            // Format the recognized text
            var extractedText = result.data.text || "";

            // Clean up the obtained text a bit
            extractedText = extractedText.replace(/\n{3,}/g, '\n\n'); // Reduce multiple line breaks

            // If the text is empty, show a message
            if (!extractedText.trim()) {
                extractedText = "Could not extract text from this image.";
                self.updateFileWithExtractedContent(file.name, extractedText, true); // With error
            } else {
                // Add information about OCR confidence
                var confidence = result.data.confidence || 0;
                extractedText = `# Text extracted from the image\n\n${extractedText}`;
                self.updateFileWithExtractedContent(file.name, extractedText, false); // Without error
            }

            // Call the onTextExtracted callback if it exists
            if (typeof self.options.onTextExtracted === 'function') {
                self.options.onTextExtracted(file, extractedText);
            }

            if (callback) callback(extractedText);

        }).catch(function(error) {
            // Release the image URL
            URL.revokeObjectURL(imageUrl);

            console.error("Error in OCR recognition:", error);
            var errorMessage = "Error in text recognition: " + error.message;
            self.updateFileWithExtractedContent(file.name, errorMessage, true); // With error

            if (callback) callback(errorMessage);
        });
    };
    /**
     * Extracts text from Office files
     * @param {File} file - The file to process
     * @param {string} fileType - The file type ('word' or 'excel')
     * @param {Function} callback - Function to call when extraction is complete
     * @public
     */
    FileDropzone.prototype.extractTextFromOfficeFile = function(file, fileType, callback) {
        var self = this;
        var reader = new FileReader();

        reader.onload = function(e) {
            var arrayBuffer = e.target.result;

            if (fileType === 'word' && typeof mammoth !== 'undefined') {
                // Use Mammoth.js to extract text from DOCX files
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then(function(result) {
                        var text = result.value;

                        // Intentar dividir el texto en páginas (buscar saltos de página)
                        var pages = text.split(/\f|\[page\]|\[PAGE\]|--PAGE BREAK--/g);
                        var extractedText = "";

                        // Si no se detectaron saltos de página claros, intentar otra aproximación
                        if (pages.length <= 1) {
                            // Aproximación alternativa - dividir por líneas vacías dobles o triples
                            pages = text.split(/\n{3,}/g).filter(page => page.trim().length > 0);

                            // Si todavía tenemos una sola página o demasiado pocas, usar párrafos como aproximación
                            if (pages.length <= 1 || (text.length / pages.length > 2000)) {
                                pages = text.split(/\n{2}/g).filter(page => page.trim().length > 0);

                                // Agrupar párrafos en "páginas" más razonables (aproximadamente 1500-2000 caracteres)
                                if (pages.length > 5) {
                                    var newPages = [];
                                    var currentPage = "";

                                    for (var i = 0; i < pages.length; i++) {
                                        if (currentPage.length < 1500) {
                                            currentPage += pages[i] + "\n\n";
                                        } else {
                                            newPages.push(currentPage);
                                            currentPage = pages[i] + "\n\n";
                                        }
                                    }

                                    if (currentPage.length > 0) {
                                        newPages.push(currentPage);
                                    }

                                    pages = newPages;
                                }
                            }
                        }

                        // Crear la estructura por páginas según opción
                        for (var i = 0; i < pages.length; i++) {
                            if (pages[i].trim().length > 0) {
                                if (self.options.useSimbaDocumentTags) {
                                    extractedText += `<simba_document data-filename="${file.name}" data-page="${i + 1}">\n${pages[i].trim()}\n</simba_document>\n\n`;
                                } else {
                                    extractedText += `--- Página ${i + 1} ---\n\n${pages[i].trim()}\n\n`;
                                }
                            }
                        }

                        // Si no se pudo dividir, poner todo en una página
                        if (extractedText.length === 0) {
                            if (self.options.useSimbaDocumentTags) {
                                extractedText = `<simba_document data-filename="${file.name}" data-page="1">\n${text}\n</simba_document>`;
                            } else {
                                extractedText = `--- Página 1 ---\n\n${text}`;
                            }
                        }

                        self.updateFileWithExtractedContent(file.name, extractedText);

                        // Call the onTextExtracted callback if it exists
                        if (typeof self.options.onTextExtracted === 'function') {
                            self.options.onTextExtracted(file, extractedText);
                        }

                        if (callback) callback(extractedText);
                    })
                    .catch(function(error) {
                        console.error("Error extracting text from DOCX:", error);
                        var errorMessage = "Error extracting text: " + error.message;
                        self.updateFileWithExtractedContent(file.name, errorMessage);

                        if (callback) callback(errorMessage);
                    });
            }
            else if (fileType === 'excel' && typeof XLSX !== 'undefined') {
                // Use SheetJS to extract text from Excel files
                try {
                    var workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    var result = "";

                    if (self.options.useSimbaDocumentTags) {
                        result = `<simba_document data-filename="${file.name}" data-page="1">\n`;
                    } else {
                        result = "--- Página 1 ---\n\n";
                    }

                    // Go through all sheets and extract their content in Markdown table format
                    workbook.SheetNames.forEach(function(sheetName) {
                        var worksheet = workbook.Sheets[sheetName];
                        var json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                        if (json.length > 0) {
                            result += "## Sheet: " + sheetName + "\n\n";

                            // Calculate maximum width for each column
                            var columnWidths = [];
                            json.forEach(function(row) {
                                row.forEach(function(cell, colIndex) {
                                    // Convert the cell content to string and get its length
                                    var cellStr = (cell === null || cell === undefined) ? '' : String(cell);
                                    var cellLength = cellStr.length;

                                    if (!columnWidths[colIndex] || columnWidths[colIndex] < cellLength) {
                                        columnWidths[colIndex] = cellLength;
                                    }
                                });
                            });

                            // Generate the Markdown table
                            if (json[0] && json[0].length > 0) {
                                // Header
                                var headerRow = "|";
                                var separatorRow = "|";

                                for (var i = 0; i < json[0].length; i++) {
                                    var headerContent = json[0][i] !== undefined ? String(json[0][i]) : '';
                                    headerRow += " " + headerContent + " |";
                                    separatorRow += " " + '-'.repeat(Math.max(3, headerContent.length)) + " |";
                                }

                                result += headerRow + "\n" + separatorRow + "\n";

                                // Data
                                for (var rowIndex = 1; rowIndex < json.length; rowIndex++) {
                                    var dataRow = "|";

                                    for (var colIndex = 0; colIndex < json[0].length; colIndex++) {
                                        var cellContent = json[rowIndex][colIndex] !== undefined ? String(json[rowIndex][colIndex]) : '';
                                        dataRow += " " + cellContent + " |";
                                    }

                                    result += dataRow + "\n";
                                }
                            } else {
                                // In case of empty sheet or no header
                                result += "*Empty sheet or no structured data*\n";
                            }

                            result += "\n\n";
                        }
                    });

                    if (self.options.useSimbaDocumentTags) {
                        result += "</simba_document>";
                    }

                    self.updateFileWithExtractedContent(file.name, result);

                    // Call the onTextExtracted callback if it exists
                    if (typeof self.options.onTextExtracted === 'function') {
                        self.options.onTextExtracted(file, result);
                    }

                    if (callback) callback(result);
                }
                catch (error) {
                    console.error("Error extracting text from Excel:", error);
                    var errorMessage = "Error extracting text: " + error.message;
                    self.updateFileWithExtractedContent(file.name, errorMessage);

                    if (callback) callback(errorMessage);
                }
            }
            else {
                var errorMessage = "Cannot extract text: missing necessary library or unsupported file type";
                console.warn(errorMessage);
                self.updateFileWithExtractedContent(file.name, errorMessage);

                if (callback) callback(errorMessage);
            }
        };

        reader.onerror = function() {
            var errorMessage = "Error reading file";
            console.error(errorMessage);
            self.updateFileWithExtractedContent(file.name, errorMessage);

            if (callback) callback(errorMessage);
        };

        reader.readAsArrayBuffer(file);
    };

    /**
     * Extracts text from TXT files
     * @param {File} file - The file to process
     * @param {Function} callback - Function to call when extraction is complete
     * @private
     */
    FileDropzone.prototype._extractTextFromTxtFile = function(file, callback) {
        var reader = new FileReader();

        reader.onload = function(e) {
            var text = e.target.result;
            callback(text);
        };

        reader.onerror = function() {
            console.error("Error reading TXT file");
            callback("Error reading TXT file");
        };

        reader.readAsText(file);
    };
    FileDropzone.prototype._extractTextFromJsonFile = function(file, callback) {
        var reader = new FileReader();

        reader.onload = function(e) {
            var text = e.target.result;

            // Intentamos formatear el JSON para una mejor visualización
            try {
                var jsonObj = JSON.parse(text);
                var formattedJson = JSON.stringify(jsonObj, null, 2); // Indentación de 2 espacios
                callback(formattedJson);
            } catch (error) {
                // Si hay error al parsear, devolvemos el texto tal cual
                console.warn("Error al formatear JSON:", error);
                callback(text);
            }
        };

        reader.onerror = function() {
            console.error("Error reading JSON file");
            callback("Error reading JSON file");
        };

        reader.readAsText(file);
    };
    /**
     * Extracts text from PDF files
     * @param {File} file - The file to process
     * @param {Function} callback - Function to call when extraction is complete
     * @private
     */
    FileDropzone.prototype._extractTextFromPdfFile = function(file, callback) {
        var self = this;

        // Check if pdf.js is available
        if (typeof pdfjsLib === 'undefined') {
            // Load pdf.js dynamically if it's not available
            self._loadPdfJS(function() {
                if (typeof pdfjsLib !== 'undefined') {
                    self._extractPdfWithFallback(file, callback);
                } else {
                    // If we can't load pdf.js, use alternative method
                    self._extractPdfTextAlternative(file, callback);
                }
            });
        } else {
            self._extractPdfWithFallback(file, callback);
        }
    };

    /**
     * Tries to extract text with pdf.js and falls back to alternative method if it fails
     * @param {File} file - The PDF file
     * @param {Function} callback - Callback function
     * @private
     */
    FileDropzone.prototype._extractPdfWithFallback = function(file, callback) {
        var self = this;
        var extractionAttempted = false;

        try {
            self._extractPdfTextWithPdfJS(file, function(result) {
                extractionAttempted = true;

                // If the result indicates an error and we haven't tried the alternative method
                if (result.startsWith("Error") && !result.includes("Could not extract text")) {
                    console.warn("pdf.js failed, trying alternative method");
                    self._extractPdfTextAlternative(file, callback);
                } else {
                    callback(result);
                }
            });
        } catch (error) {
            if (!extractionAttempted) {
                console.error("Error with pdf.js, using alternative method:", error);
                self._extractPdfTextAlternative(file, callback);
            } else {
                callback("Error extracting text from PDF: " + error.message);
            }
        }
    };
    /**
     * Checks and reports prototype modifications that could cause problems
     * @private
     */
    FileDropzone.prototype._checkForPrototypeIssues = function() {
        // Check Array.prototype
        for (var prop in Array.prototype) {
            if (Array.prototype.hasOwnProperty(prop) &&
                !['length', 'constructor', 'toString', 'toLocaleString', 'join',
                    'pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift',
                    'concat', 'slice', 'indexOf', 'lastIndexOf', 'filter', 'forEach',
                    'every', 'map', 'some', 'reduce', 'reduceRight', 'find', 'findIndex',
                    'entries', 'keys', 'values', 'includes', 'flat', 'flatMap'].includes(prop)) {

                console.warn('FileDropzone: Detected non-standard property in Array.prototype: ' + prop +
                    '. This may cause problems with libraries like pdf.js');
            }
        }
    };
    /**
     * Dynamically loads the pdf.js library
     * @param {Function} callback - Function to call when loading is complete
     * @private
     */
    FileDropzone.prototype._loadPdfJS = function(callback) {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
        script.onload = function() {
            // Configure worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
                callback();
            } else {
                console.error("Error loading pdf.js");
                callback();
            }
        };
        script.onerror = function() {
            console.error("Error loading pdf.js from CDN");
            callback();
        };
        document.head.appendChild(script);
    };

    /**
     * Extracts text from PDF using pdf.js
     * @param {File} file - The PDF file
     * @param {Function} callback - Function to call when extraction is complete
     * @private
     */
    FileDropzone.prototype._extractPdfTextWithPdfJS = function(file, callback) {
        // Save the problematic prototype property
        var originalRandomProp;
        var hasRandomProp = Array.prototype.hasOwnProperty('random');

        if (hasRandomProp) {
            // Save and temporarily remove the problematic property
            originalRandomProp = Array.prototype.random;
            delete Array.prototype.random;
            console.log("Property 'random' temporarily removed from Array.prototype for compatibility with PDF.js");
        }

        var reader = new FileReader();
        var self = this;

        reader.onload = function(e) {
            var typedArray = new Uint8Array(e.target.result);

            // Load the PDF document
            pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
                var numPages = pdf.numPages;
                var countPromises = [];
                var extractedText = "";

                // For each page, extract the text
                for (var i = 1; i <= numPages; i++) {
                    var currentPage = i;
                    countPromises.push(
                        pdf.getPage(currentPage).then(function(page) {
                            return page.getTextContent().then(function(textContent) {
                                var pageText = "";
                                var lastY = -1;
                                var lastX = -1;

                                // Process each text element
                                for (var j = 0; j < textContent.items.length; j++) {
                                    var item = textContent.items[j];

                                    if (lastY !== -1 && lastY !== item.transform[5]) {
                                        pageText += "\n";
                                        lastX = -1;
                                    } else if (lastX !== -1 && item.transform[4] - lastX > 10) {
                                        pageText += " ";
                                    }

                                    pageText += item.str;
                                    lastY = item.transform[5];
                                    lastX = item.transform[4] + (item.width || 0);
                                }

                                return { page: page.pageNumber, text: pageText };
                            });
                        })
                    );
                }

                // Combine the text from all pages
                Promise.all(countPromises).then(function(pages) {
                    // Restore the random property if it was removed
                    if (hasRandomProp) {
                        Array.prototype.random = originalRandomProp;
                    }

                    // Sort the pages numerically
                    pages.sort(function(a, b) {
                        return a.page - b.page;
                    });

                    // Formatear según la opción elegida
                    if (self.options.useSimbaDocumentTags) {
                        // Usar etiquetas simba_document
                        for (var k = 0; k < pages.length; k++) {
                            extractedText += `<simba_document data-filename="${file.name}" data-page="${pages[k].page}">\n${pages[k].text}\n</simba_document>\n\n`;
                        }
                    } else {
                        // Usar formato de texto plano con indicador de página
                        for (var k = 0; k < pages.length; k++) {
                            extractedText += `--- Página ${pages[k].page} ---\n\n${pages[k].text}\n\n`;
                        }
                    }

                    callback(extractedText);
                }).catch(function(error) {
                    // Restore the random property if it was removed
                    if (hasRandomProp) {
                        Array.prototype.random = originalRandomProp;
                    }

                    console.error("Error extracting text from PDF pages:", error);
                    callback("Error extracting text from PDF: " + error.message);
                });
            }).catch(function(error) {
                // Restore the random property if it was removed
                if (hasRandomProp) {
                    Array.prototype.random = originalRandomProp;
                }

                console.error("Error opening PDF document:", error);
                callback("Error opening PDF document: " + error.message);
            });
        };

        reader.onerror = function() {
            // Restore the random property if it was removed
            if (hasRandomProp) {
                Array.prototype.random = originalRandomProp;
            }

            console.error("Error reading PDF file");
            callback("Error reading PDF file");
        };

        reader.readAsArrayBuffer(file);
    };

    /**
     * Alternative method to extract text from PDF without using pdf.js
     * @param {File} file - The PDF file
     * @param {Function} callback - Function to call when extraction is complete
     * @private
     */
    FileDropzone.prototype._extractPdfTextAlternative = function(file, callback) {
        var reader = new FileReader();
        var self = this;

        reader.onload = function(e) {
            try {
                var arrayBuffer = e.target.result;
                var byteArray = new Uint8Array(arrayBuffer);
                var extractedText = "";
                var pdfContent = "";

                // Look for text strings in the PDF file
                // This is a simple approximation, it won't work perfectly with all PDFs
                for (var i = 0; i < byteArray.length; i++) {
                    pdfContent += String.fromCharCode(byteArray[i]);
                }

                // Look for text between /Text /BT and /ET markers
                var textMarkerPattern = /BT\s*(.*?)\s*ET/gs;
                var textMatches = pdfContent.match(textMarkerPattern);

                // Buscar marcadores de página
                var pageMarkers = pdfContent.match(/\/Page\s*<<.*?>>/gs) || [];
                var pageCount = Math.max(1, pageMarkers.length);

                if (textMatches && textMatches.length > 0) {
                    // Estimar cuántos marcadores de texto corresponden a cada página
                    var textsPerPage = Math.ceil(textMatches.length / pageCount);

                    for (var pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                        var pageText = "";
                        var startIdx = pageIndex * textsPerPage;
                        var endIdx = Math.min(startIdx + textsPerPage, textMatches.length);

                        for (var j = startIdx; j < endIdx; j++) {
                            // Extract Unicode/ASCII text
                            var textContent = textMatches[j];
                            var textExtracted = "";

                            // Look for strings between parentheses and brackets
                            var stringPattern = /\((.*?)\)|\[(.*?)\]/g;
                            var stringMatch;

                            while ((stringMatch = stringPattern.exec(textContent)) !== null) {
                                if (stringMatch[1]) {
                                    textExtracted += stringMatch[1] + " ";
                                } else if (stringMatch[2]) {
                                    textExtracted += stringMatch[2] + " ";
                                }
                            }

                            if (textExtracted.trim()) {
                                pageText += textExtracted + "\n";
                            }
                        }

                        if (pageText.trim()) {
                            if (self.options.useSimbaDocumentTags) {
                                extractedText += `<simba_document data-filename="${file.name}" data-page="${pageIndex + 1}">\n${pageText.trim()}\n</simba_document>\n\n`;
                            } else {
                                extractedText += `--- Página ${pageIndex + 1} ---\n\n${pageText.trim()}\n\n`;
                            }
                        }
                    }
                }

                // If we didn't find text using the previous method, look for strings
                if (!extractedText.trim()) {
                    var stringPattern = /\(([^\\\(\)]{2,})\)/g;
                    var allStrings = [];
                    var stringMatch;

                    while ((stringMatch = stringPattern.exec(pdfContent)) !== null) {
                        var str = stringMatch[1].trim();
                        if (str && str.length > 3) { // Ignore very short strings
                            allStrings.push(str);
                        }
                    }

                    // Dividir las cadenas en páginas estimadas
                    var stringsPerPage = Math.ceil(allStrings.length / Math.max(1, pageCount));

                    for (var p = 0; p < Math.max(1, pageCount); p++) {
                        var pageContent = "";
                        var start = p * stringsPerPage;
                        var end = Math.min(start + stringsPerPage, allStrings.length);

                        for (var s = start; s < end; s++) {
                            pageContent += allStrings[s] + "\n";
                        }

                        if (pageContent.trim()) {
                            if (self.options.useSimbaDocumentTags) {
                                extractedText += `<simba_document data-filename="${file.name}" data-page="${p + 1}">\n${pageContent.trim()}\n</simba_document>\n\n`;
                            } else {
                                extractedText += `--- Página ${p + 1} ---\n\n${pageContent.trim()}\n\n`;
                            }
                        }
                    }
                }

                if (extractedText.trim()) {
                    extractedText = "Note: Basic extraction without pdf.js\n\n" + extractedText;
                    callback(extractedText);
                } else {
                    // Si no se pudo extraer texto, crear una sola página
                    if (self.options.useSimbaDocumentTags) {
                        extractedText = `<simba_document data-filename="${file.name}" data-page="1">\nCould not extract text from the PDF. This basic method has limitations with some PDF formats.\n</simba_document>`;
                    } else {
                        extractedText = "--- Página 1 ---\n\nCould not extract text from the PDF. This basic method has limitations with some PDF formats.";
                    }
                    callback(extractedText);
                }
            } catch (error) {
                console.error("Error in alternative PDF extraction:", error);
                var errorMessage = "Error processing PDF: " + error.message;
                callback(errorMessage);
            }
        };

        reader.onerror = function() {
            console.error("Error reading PDF file");
            callback("Error reading PDF file");
        };

        reader.readAsArrayBuffer(file);
    };
    /**
     * Ejecuta una tarea Stask desde un contenido de texto
     * @param {string} content - El contenido del archivo Stask como string
     * @param {string} [taskName="Tarea"] - Nombre opcional de la tarea para las notificaciones
     * @returns {Object|null} - El objeto Stask parseado o null si hay un error
     * @public
     */
    FileDropzone.prototype.executeStaskContent = function(content, taskName) {
        var self = this;
        taskName = taskName || "Tarea"; // Nombre por defecto si no se proporciona

        if (!content) {
            console.error("Error: No se proporcionó contenido para ejecutar");

            // Mostrar mensaje de error
            if (this.options.framework7) {
                this.options.framework7.toast.show({
                    text: 'Error: No se proporcionó contenido para la tarea',
                    position: 'center',
                    closeTimeout: 3000,
                    color: 'red'
                });
            }

            return null;
        }

        try {
            // Intentar parsear el contenido como JSON
            var staskContent = JSON.parse(content);

            // Notificar que se está ejecutando la tarea
            if (this.options.framework7) {
                this.options.framework7.toast.show({
                    text: 'Ejecutando tarea: ' + taskName,
                    position: 'center',
                    closeTimeout: 2000,
                });
            }

            // Llamar al callback de ejecución si existe
            if (typeof this.options.onStaskExecuted === 'function') {
                this.options.onStaskExecuted(taskName, staskContent);
            }

            return staskContent;
        } catch (error) {
            console.error("Error al ejecutar el contenido Stask:", error);

            // Mostrar mensaje de error
            if (this.options.framework7) {
                this.options.framework7.toast.show({
                    text: 'Error al ejecutar la tarea: ' + error.message,
                    position: 'center',
                    closeTimeout: 3000,
                    color: 'red'
                });
            }

            return null;
        }
    };

    /**
     * Ejecuta un archivo .stask
     * @param {string} fileName - Nombre del archivo
     * @public
     */
    FileDropzone.prototype.executeStaskFile = function(fileName) {
        var self = this;
        var fileIndex = this.uploadedFiles.findIndex(f => f.name === fileName);

        if (fileIndex !== -1 && this.uploadedFiles[fileIndex].extractedText) {
            try {
                // Intentar parsear el contenido como JSON
                var staskContent = JSON.parse(this.uploadedFiles[fileIndex].extractedText);

                // Notificar que se está ejecutando la tarea
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'Ejecutando tarea: ' + fileName,
                        position: 'center',
                        closeTimeout: 2000,
                    });
                }

                // Llamar al callback de ejecución si existe
                if (typeof this.options.onStaskExecuted === 'function') {
                    this.options.onStaskExecuted(fileName, staskContent);
                }

                return staskContent;
            } catch (error) {
                console.error("Error al ejecutar el archivo .stask:", error);

                // Mostrar mensaje de error
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'Error al ejecutar la tarea: ' + error.message,
                        position: 'center',
                        closeTimeout: 3000,
                        color: 'red'
                    });
                }

                return null;
            }
        }

        return null;
    };
    /**
     * Updates a file with extracted text
     * @param {string} fileName - File name
     * @param {string} content - Extracted text
     * @param {boolean} isError - Indicates if there was an error in the process
     * @public
     */
    FileDropzone.prototype.updateFileWithExtractedContent = function(fileName, content, isError) {
        var self = this;
        var fileIndex = this.uploadedFiles.findIndex(f => f.name === fileName);

        if (fileIndex !== -1) {
            // Add the extracted content to the file object
            this.uploadedFiles[fileIndex].extractedText = content;

            // Check if this is a completion message or a progress message
            var isProgressMessage = content.includes("Processing") || content.includes("Starting");

            // Update the UI to show that extraction has finished
            var fileItem = this.dropzone.querySelector(`.file-item[data-file-id="${fileName}"]`);
            if (fileItem) {
                // Find or create the container for action buttons
                var actionsContainer = fileItem.querySelector('.file-actions');
                if (!actionsContainer && !isProgressMessage) {
                    // Clear any existing extraction indicator
                    var extractingIndicator = fileItem.querySelector('.extracting-indicator');
                    if (extractingIndicator) {
                        extractingIndicator.remove();
                    }

                    // Create container for action buttons
                    actionsContainer = document.createElement('div');
                    actionsContainer.className = 'file-actions';
                    actionsContainer.style.display = 'inline-flex';
                    actionsContainer.style.marginLeft = '5px';
                    fileItem.appendChild(actionsContainer);

                    // 1. Delete button (X)
                    var deleteButton = document.createElement('span');
                    deleteButton.className = 'delete-file';
                    deleteButton.innerHTML = '<i class="fa fa-times" style="margin-left: 5px; color: #f44336; cursor: pointer;"></i>';
                    deleteButton.setAttribute('title', 'Delete file');
                    deleteButton.addEventListener('click', function(e) {
                        e.stopPropagation();
                        self.removeFile(fileName);
                    });

                    // 2. Status indicator (check or cross)
                    var statusIndicator = document.createElement('span');
                    statusIndicator.className = isError ? 'error-indicator' : 'success-indicator';
                    statusIndicator.innerHTML = isError ?
                        '<i class="fa fa-times-circle" style="margin-left: 5px; color: #f44336;"></i>' :
                        '<i class="fa fa-check-circle" style="margin-left: 5px; color: #4caf50;"></i>';
                    statusIndicator.setAttribute('title', isError ? 'Error processing file' : 'File processed successfully');

                    // 3. View button (eye)
                    var viewButton = document.createElement('span');
                    viewButton.className = 'view-file';
                    viewButton.innerHTML = '<i class="fa fa-eye" style="margin-left: 5px; color: #2196f3; cursor: pointer;"></i>';
                    viewButton.setAttribute('title', 'View content');
                    viewButton.addEventListener('click', function(e) {
                        e.stopPropagation();

                        // Obtener la extensión del archivo para determinar cómo mostrarlo
                        var fileExtension = fileName.split('.').pop().toLowerCase();

                        // Lista de extensiones que deben abrirse con el editor de código
                        var codeEditorExtensions = {
                            'json': 'json',
                            'js': 'javascript',
                            'jsx': 'javascript',
                            'ts': 'typescript',
                            'tsx': 'typescript',
                            'html': 'html',
                            'htm': 'html',
                            'xml': 'xml',
                            'css': 'css',
                            'scss': 'scss',
                            'less': 'less',
                            'md': 'markdown',
                            'markdown': 'markdown',
                            'sh': 'sh',
                            'bash': 'sh',
                            'py': 'python',
                            'rb': 'ruby',
                            'php': 'php',
                            'java': 'java',
                            'c': 'c',
                            'cpp': 'cpp',
                            'h': 'c',
                            'cs': 'csharp',
                            'go': 'go',
                            'rs': 'rust',
                            'swift': 'swift',
                            'yml': 'yaml',
                            'yaml': 'yaml',
                            'stask': 'json'
                        };

                        // Si la extensión está en la lista, usar el editor de código
                        if (fileExtension in codeEditorExtensions) {
                            editContent(content, Date.now(), fileName, true, codeEditorExtensions[fileExtension]);
                        } else {
                            // Para otros tipos de archivo, usar el editor normal
                         //   self.options.useSimbaDocumentTags = false;

                            editContent(content.replace(/<simba_document[^>]*>([\s\S]*?)<\/simba_document>/g, '$1'), Date.now(), fileName);
                        }
                    });
                    if (fileName.toLowerCase().endsWith('.stask')) {
                        var executeButton = document.createElement('span');
                        executeButton.className = 'execute-stask';
                        executeButton.innerHTML = '<i class="fa fa-play" style="margin-left: 5px; color: #4CAF50; cursor: pointer;"></i>';
                        executeButton.setAttribute('title', 'Execute task');
                        executeButton.addEventListener('click', function(e) {
                            e.stopPropagation();
                            self.executeStaskFile(fileName);
                        });
                        actionsContainer.appendChild(executeButton);
                    }
                    // Add the buttons to the container in the desired order
                    actionsContainer.appendChild(statusIndicator); // Status second
                    actionsContainer.appendChild(viewButton);      // Eye first
                    //  actionsContainer.appendChild(deleteButton);    // Delete last

                    // Show a preview of the extracted text when hovering over the file
                    var previewText = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                    fileItem.setAttribute('title', previewText);
                }
            }

            // Check if all files have extracted text
            var allProcessed = this.uploadedFiles.every(function(file) {
                // Lista extensiva de extensiones de archivo que necesitan extracción
                var textExtensions = [
                    '.txt', '.json', '.js', '.jsx', '.ts', '.tsx',
                    '.html', '.htm', '.xml', '.css', '.scss', '.less',
                    '.md', '.markdown', '.sh', '.bash', '.py', '.rb',
                    '.php', '.java', '.c', '.cpp', '.h', '.cs',
                    '.go', '.rs', '.swift', '.yml', '.yaml'
                ];

                var documentExtensions = [
                    '.doc', '.docx', '.xls', '.xlsx', '.pdf',
                    '.ppt', '.pptx'
                ];

                var imageExtensions = [
                    '.jpg', '.jpeg', '.png', '.gif', '.bmp',
                    '.webp', '.tiff', '.tif'
                ];

                // Obtener la extensión del archivo
                var fileExt = '.' + file.name.split('.').pop().toLowerCase();

                // Verificar si el archivo necesita extracción
                var needsExtraction =
                    textExtensions.includes(fileExt) ||
                    documentExtensions.includes(fileExt) ||
                    imageExtensions.includes(fileExt) ||
                    file.type.startsWith('text/') ||
                    file.type.includes('json') ||
                    file.type.includes('javascript') ||
                    file.type.includes('html') ||
                    file.type.includes('xml') ||
                    file.type.includes('css') ||
                    file.type.includes('word') ||
                    file.type.includes('excel') ||
                    file.type.includes('powerpoint') ||
                    file.type.includes('pdf') ||
                    file.type.startsWith('image/');

                return !needsExtraction || file.extractedText !== undefined;
            });

            if (allProcessed && typeof this.options.onAllFilesProcessed === 'function') {
                this.options.onAllFilesProcessed(this.uploadedFiles);
            }
        }
    };
    /**
     * Shows the extracted text from a file
     * @param {string} fileName - File name
     * @param {string} content - Extracted text
     * @public
     */
    FileDropzone.prototype.showExtractedText = function(fileName, content) {
        var self = this; // Ensures that 'self' is correctly defined

        // Use Framework7 dialog if available
        if (this.options.framework7) {
            this.options.framework7.dialog.create({
                title: 'Text extracted from ' + fileName,
                content: `
                <div style="max-height: 300px; overflow-y: auto; white-space: pre-wrap; padding: 10px; font-family: monospace; background-color: #f0f0f0; border-radius: 5px;">${content}</div>
            `,
                buttons: [
                    {
                        text: 'Copy',
                        onClick: function() {
                            navigator.clipboard.writeText(content).then(function() {
                                // Use self instead of this inside this function
                                self.options.framework7.toast.show({
                                    text: 'Text copied to clipboard',
                                    position: 'center',
                                    closeTimeout: 2000,
                                });
                            }).catch(function(err) {
                                console.error('Error copying: ', err);
                            });
                        }
                    },
                    {
                        text: 'Close',
                        color: 'red'
                    }
                ],
                verticalButtons: false,
            }).open();
        } else {
            // Fallback if Framework7 is not available
            alert("Text extracted from " + fileName + ":\n\n" + content);
        }
    };

    /**
     * Removes a file
     * @param {string} filename - Name of the file to remove
     * @public
     */
    FileDropzone.prototype.removeFile = function(filename) {
        var fileIndex = this.uploadedFiles.findIndex(f => f.name === filename);

        if (fileIndex !== -1) {
            var removedFile = this.uploadedFiles[fileIndex];

            // Remove from the uploaded files array
            this.uploadedFiles.splice(fileIndex, 1);

            // Remove preview item
            var fileItems = this.dropzone.querySelectorAll('.file-item');
            fileItems.forEach(function(item) {
                if (item.querySelector('.file-name').textContent === filename) {
                    item.remove();
                }
            });

            // Hide the dropzone if there are no files left
            if (this.uploadedFiles.length === 0) {
                this.dropzone.classList.remove(this.options.hasFilesClass);
            }

            // Call the onFileRemoved callback if it exists
            if (typeof this.options.onFileRemoved === 'function') {
                this.options.onFileRemoved(removedFile);
            }
        }
    };

    /**
     * Clears all files
     * @public
     */
    FileDropzone.prototype.clearFiles = function() {
        // Make a copy of the files array to notify removals
        var filesToRemove = this.uploadedFiles.slice();

        // Clear the files array
        this.uploadedFiles = [];

        // Remove all preview elements
        var previewArea = this.dropzone.querySelector('.' + this.options.previewClass);
        if (previewArea) {
            previewArea.innerHTML = '';
        }

        // Hide the dropzone
        this.dropzone.classList.remove(this.options.hasFilesClass);

        // Notify the removal of each file
        if (typeof this.options.onFileRemoved === 'function') {
            filesToRemove.forEach(file => {
                this.options.onFileRemoved(file);
            });
        }
    };

    /**
     * Gets all uploaded files
     * @returns {Array} - Array of uploaded files
     * @public
     */
    FileDropzone.prototype.getFiles = function() {
        return this.uploadedFiles;
    };

    /**
     * Gets the extracted text from all files
     * @returns {Object} - Object with file names as keys and extracted text as values
     * @public
     */
    FileDropzone.prototype.getExtractedText = function() {
        var result = {};

        this.uploadedFiles.forEach(function(file) {
            if (file.extractedText) {
                result[file.name] = file.extractedText;
            }
        });

        return result;
    };
    /**
     * Renderiza todos los elementos de archivo en un contenedor con botones funcionales
     * @param {string} containerId - ID del elemento contenedor donde se mostrarán los archivos
     * @returns {void}
     * @public
     */
    FileDropzone.prototype.renderFileItems = function(containerId) {
        var self = this;
        var container = document.getElementById(containerId);

        if (!container) {
            console.error('Container element not found:', containerId);
            return;
        }

        // Limpiar el contenedor
        container.innerHTML = '';

        // Si no hay archivos, no hacer nada más
        if (!this.uploadedFiles || this.uploadedFiles.length === 0) {
            return;
        }

        // Iterar sobre cada archivo cargado
        this.uploadedFiles.forEach(function(file) {
            var fileName = file.name;
            var fileType = self._getFileType(file);
            var icon = 'fa-file';
            var extractedText = file.extractedText || '';
            var isError = extractedText.startsWith('Error');

            // Determinar el ícono según el tipo de archivo
            switch(fileType) {
                case 'text':
                    if (fileName.toLowerCase().endsWith('.json')) {
                        icon = 'fa-file-code';
                    } else if (fileName.toLowerCase().endsWith('.html') || fileName.toLowerCase().endsWith('.htm')) {
                        icon = 'fa-file-code';
                    } else if (fileName.toLowerCase().endsWith('.js')) {
                        icon = 'fa-file-code';
                    } else if (fileName.toLowerCase().endsWith('.stask')) {
                        icon = 'fa-tasks';
                    } else {
                        icon = 'fa-file-alt';
                    }
                    break;
                case 'word':
                    icon = 'fa-file-word';
                    break;
                case 'excel':
                    icon = 'fa-file-excel';
                    break;
                case 'ppt':
                    icon = 'fa-file-powerpoint';
                    break;
                case 'pdf':
                    icon = 'fa-file-pdf';
                    break;
                case 'txt':
                    icon = 'fa-file-alt';
                    break;
                case 'image':
                    icon = 'fa-file-image';
                    break;
                default:
                    if (file.type && file.type.startsWith('video/')) icon = 'fa-file-video';
                    else if (file.type && file.type.startsWith('audio/')) icon = 'fa-file-audio';
                    break;
            }

            // Crear el elemento de archivo
            var fileItem = document.createElement('div');
            fileItem.className = 'file-item float-left margin-right margin-top';
            fileItem.style.width = '200px';
            fileItem.style.height = '30px'
            fileItem.setAttribute('data-file-id', fileName);

            // Agregar vista previa del texto extraído
            var previewText = extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : '');
            fileItem.setAttribute('title', previewText);

            // Establecer el contenido HTML del elemento
            fileItem.innerHTML = `
            <i class="fa ${icon}"></i>
            <span class="file-name">${fileName}</span>
            <div class="file-actions" style="display: inline-flex; margin-left: 5px;">
                <span class="${isError ? 'error-indicator' : 'success-indicator'}" 
                      title="${isError ? 'Error processing file' : 'File processed successfully'}">
                    <i class="fa fa-${isError ? 'times' : 'check'}-circle" 
                       style="margin-left: 5px; color: ${isError ? '#f44336' : '#4caf50'};"></i>
                </span>
                <span class="view-file" title="View content">
                    <i class="fa fa-eye" style="margin-left: 5px; color: #2196f3; cursor: pointer;"></i>
                </span>
                <span class="download-file" title="Download file">
                    <i class="fa fa-download" style="margin-left: 5px; color: #009688; cursor: pointer;"></i>
                </span>
                ${fileName.toLowerCase().endsWith('.stask') ?
                `<span class="execute-stask" title="Execute task">
                        <i class="fa fa-play" style="margin-left: 5px; color: #4CAF50; cursor: pointer;"></i>
                    </span>` : ''}
            </div>
        `;

            // Agregar el elemento al contenedor
            container.appendChild(fileItem);

            // Configurar event listeners para botones

            // Botón de visualización
            var viewButton = fileItem.querySelector('.view-file');
            if (viewButton) {
                viewButton.addEventListener('click', function(e) {
                    e.stopPropagation();

                    // Obtener la extensión para determinar cómo mostrar el contenido
                    var fileExtension = fileName.split('.').pop().toLowerCase();

                    // Lista de extensiones para editor de código
                    var codeEditorExtensions = {
                        'json': 'json',
                        'js': 'javascript',
                        'jsx': 'javascript',
                        'ts': 'typescript',
                        'tsx': 'typescript',
                        'html': 'html',
                        'htm': 'html',
                        'xml': 'xml',
                        'css': 'css',
                        'scss': 'scss',
                        'less': 'less',
                        'md': 'markdown',
                        'markdown': 'markdown',
                        'sh': 'sh',
                        'bash': 'sh',
                        'py': 'python',
                        'rb': 'ruby',
                        'php': 'php',
                        'java': 'java',
                        'c': 'c',
                        'cpp': 'cpp',
                        'h': 'c',
                        'cs': 'csharp',
                        'go': 'go',
                        'rs': 'rust',
                        'swift': 'swift',
                        'yml': 'yaml',
                        'yaml': 'yaml',
                        'stask': 'json'
                    };

                    // Verificar si está definida la función editContent (normalmente proporcionada por la app)
                    if (typeof editContent === 'function') {
                        // Si la extensión está en la lista, usar el editor de código
                        if (fileExtension in codeEditorExtensions) {
                            editContent(extractedText, Date.now(), fileName, true, codeEditorExtensions[fileExtension]);
                        } else {
                            // Para otros tipos de archivo, usar el editor normal
                            editContent(extractedText.replace(/<simba_document[^>]*>([\s\S]*?)<\/simba_document>/g, '$1'), Date.now(), fileName);
                        }
                    } else {
                        // Si editContent no está disponible, mostrar el contenido directamente
                        self.showExtractedText(fileName, extractedText);
                    }
                });
            }

            // Botón de descarga
            var downloadButton = fileItem.querySelector('.download-file');
            if (downloadButton) {
                downloadButton.addEventListener('click', function(e) {
                    e.stopPropagation();

                    // Crear un blob con el contenido del archivo
                    var content = extractedText;
                    var blob = new Blob([content], { type: 'text/plain' });

                    // Crear un enlace de descarga
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();

                    // Limpiar
                    setTimeout(function() {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 100);
                });
            }

            // Botón de ejecución para archivos .stask
            var executeButton = fileItem.querySelector('.execute-stask');
            if (executeButton) {
                executeButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self.executeStaskFile(fileName);
                });
            }
        });
    };
    /**
     * Establece el modo de extracción para usar etiquetas simba_document o texto plano
     * @param {boolean} useSimbaDocumentTags - Si es true, usa etiquetas simba_document
     * @public
     */
    FileDropzone.prototype.setSimbaDocumentTagsMode = function(useSimbaDocumentTags) {
        this.options.useSimbaDocumentTags = !!useSimbaDocumentTags;
        console.log("Modo de etiquetas simba_document " + (this.options.useSimbaDocumentTags ? "activado" : "desactivado"));
    };
    /**
     * Gets the combined extracted text from all files
     * @param {string} [separator="\n\n"] - Separator between texts
     * @returns {string} - Combined extracted text
     * @public
     */
    FileDropzone.prototype.getCombinedExtractedText = function(separator) {
        separator = separator || "\n\n";
        let result = "";
        var self = this;

        this.uploadedFiles.forEach(function(file) {
            if (file.extractedText) {
                if (result) {
                    result += separator;
                }

                // Si ya tiene etiquetas simba_document y está en modo simba_document, no modificar
                if (file.extractedText.includes("<simba_document") && self.options.useSimbaDocumentTags) {
                    result += file.extractedText;
                }
                // Si ya tiene etiquetas simba_document pero no está en modo simba_document, convertir a texto plano
                else if (file.extractedText.includes("<simba_document") && !self.options.useSimbaDocumentTags) {
                    // Extraer el contenido de las etiquetas y convertirlo a formato de texto plano
                    var matches = file.extractedText.match(/<simba_document[^>]*data-page="(\d+)"[^>]*>\s*([\s\S]*?)\s*<\/simba_document>/g);

                    if (matches && matches.length > 0) {
                        var plainText = "";

                        for (var i = 0; i < matches.length; i++) {
                            var pageMatch = matches[i].match(/<simba_document[^>]*data-page="(\d+)"[^>]*>\s*([\s\S]*?)\s*<\/simba_document>/);
                            if (pageMatch && pageMatch.length >= 3) {
                                var pageNum = pageMatch[1];
                                var pageContent = pageMatch[2];
                                plainText += `--- Página ${pageNum} ---\n\n${pageContent}\n\n`;
                            }
                        }

                        result += plainText;
                    } else {
                        // Si no se pueden extraer las etiquetas, simplemente eliminarlas
                        result += file.extractedText.replace(/<\/?simba_document[^>]*>/g, '');
                    }
                }
                // Si no tiene etiquetas simba_document pero está en modo simba_document, añadirlas
                else if (!file.extractedText.includes("<simba_document") && self.options.useSimbaDocumentTags) {
                    // Intentar detectar formato de página en texto plano
                    var pageMatches = file.extractedText.match(/---\s*Página\s*(\d+)\s*---/g);

                    if (pageMatches && pageMatches.length > 0) {
                        // Dividir por marcadores de página y convertir a formato simba_document
                        var pages = file.extractedText.split(/---\s*Página\s*\d+\s*---/);
                        pages.shift(); // Eliminar primera parte vacía antes del primer marcador

                        var simbaText = "";
                        for (var i = 0; i < pages.length; i++) {
                            var pageNum = i + 1;
                            var pageContent = pages[i].trim();
                            simbaText += `<simba_document data-filename="${file.name}" data-page="${pageNum}">\n${pageContent}\n</simba_document>\n\n`;
                        }

                        result += simbaText;
                    } else {
                        // Si no hay marcadores de página, poner todo en una sola página
                        result += `<simba_document data-filename="${file.name}" data-page="1">\n${file.extractedText}\n</simba_document>`;
                    }
                }
                // Si no tiene etiquetas y no está en modo simba_document, dejarlo como texto plano
                else {
                    result += file.extractedText;
                }
            }
        });

        return result;
    };


// Expose the class to the global scope
    global.FileDropzone = FileDropzone;

})(typeof window !== 'undefined' ? window : this);