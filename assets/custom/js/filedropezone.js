/**
 * FileDropzone.js - A library for managing file uploads and text extraction
 * v1.1.0
 */
(function (global) {
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
                enableSqlQueries: true, // Enable SQL functionality
                sqlLibraryUrl: 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js',
                onSqlQueryExecuted: null, // New callback for SQL queries
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
                    'csv', 'md', 'xml', 'json', 'html', 'htm', 'json', 'stask', 'js', 'php'
                ],
                maxFileSize: 10 * 1024 * 1024, // Maximum file size (10MB by default),
                visionApiUrl: null, // Se tomará de window.config.completion.url si no se especifica
                visionApiKey: null, // Se tomará de window.config.completion.apiKey si no se especifica
                enableVisionAnalysis: true, // Flag para habilitar/deshabilitar análisis de visión
                visionPrompt: "describe detalladamente la siguiente imagen", // Prompt personalizable
                visionModel: "phi-3-5-instruct-vision",// Modelo personalizable
                maxFiles: 3, // null = sin límite, número = máximo de archivos,// En el objeto this.options del constructor, agregar:
                imageAnalysisType: null, // 'OCR', 'Vision', o null
                allowImages: true, // Si se permiten imágenes
                longTextDetection: {
                    enabled: true,
                    charThreshold: 1000,    // Caracteres mínimos
                    lineThreshold: 20,      // Líneas mínimas
                    wordThreshold: 200,     // Palabras mínimas
                    filenamePrefix: 'pasted_text_'
                }
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
                this.options.allowedExtensions = this.options.allowedExtensions.map(function (ext) {
                    return ext.toLowerCase().replace(/^\./, '');
                });
            }

            // DOM elements
            this.dropzone = document.getElementById(this.options.dropzoneId);
            this.fileInput = document.getElementById(this.options.fileInputId);
            this.textarea = document.getElementById(this.options.textareaId);

            // State
            this.uploadedFiles = [];
            this.sqlDatabase = null; // SQLite database instance
            this.sqlReady = false; // Flag to track if SQL.js is loaded
            this.excelTables = {}; // Store table names and structures for Excel files
            this.columnMetadata = {}; // Store column type information
            // Initialize
            this._init();
        }

        /**
         * Verifies if a file is valid according to configured restrictions
         * @param {File} file - The file to validate
         * @returns {Object} - Validation result {valid: boolean, reason: string}
         * @private
         */
        FileDropzone.prototype._validateFile = function (file) {
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
                return {valid: true};
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

            if (file.type.startsWith('image/') && !this.options.allowImages) {
                return {
                    valid: false,
                    reason: `Images are not allowed for this assistant.`
                };
            }

            return {valid: true};
        };

        /**
         * Initializes the FileDropzone instance
         * @private
         */
        FileDropzone.prototype._init = function () {
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
        FileDropzone.prototype._setupDragAndDrop = function () {
            var self = this;

            // Dragover event on document
            document.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (self._isDescendantOf(e.target, 'messagebar-area') || e.target === self.textarea) {
                    self.dropzone.classList.add(self.options.dragOverClass);
                }
            });

            // Dragleave event on document
            document.addEventListener('dragleave', function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (!self._isDescendantOf(e.relatedTarget, 'messagebar-area') &&
                    e.relatedTarget !== self.textarea) {
                    self.dropzone.classList.remove(self.options.dragOverClass);
                }
            });

            // Drop event on document
            document.addEventListener('drop', function (e) {
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
         * Sets up paste handling in the textarea with long text detection
         * @private
         */
        FileDropzone.prototype._setupPasteHandler = function () {
            var self = this;

            this.textarea.addEventListener('paste', function (e) {
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
                            var pastedFile = new File([blob], fileName, {type: items[i].type});

                            // Process the image
                            self.handleFiles([pastedFile]);
                            return;
                        }
                    }
                }

                // NEW: Handle long text detection
                var pastedText = e.clipboardData.getData('text/plain');
                if (pastedText && self._isLongText(pastedText)) {
                    e.preventDefault(); // Prevent default paste behavior

                    // Create a .txt file from the long text
                    self._createTextFileFromPaste(pastedText);
                    return;
                }
            });
        };

        FileDropzone.prototype._isLongText = function (text) {
            if (!text || typeof text !== 'string') return false;
            if (!this.options.longTextDetection.enabled) return false;

            var config = this.options.longTextDetection;
            var charCount = text.length;
            var lineCount = text.split('\n').length;
            var wordCount = text.trim().split(/\s+/).length;

            return charCount >= config.charThreshold ||
                lineCount >= config.lineThreshold ||
                wordCount >= config.wordThreshold;
        };
        /**
         * Creates a .txt file from pasted long text
         * @param {string} text - The pasted text
         * @private
         */
        FileDropzone.prototype._createTextFileFromPaste = function (text) {
            var self = this;

            // Check if dropzone is disabled
            if (this.disabled) {
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'File upload is disabled for this assistant.',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            // Generate filename with timestamp
            var timestamp = new Date().toISOString()
                .replace(/[-:.]/g, '')
                .replace('T', '_')
                .substring(0, 15);

            var fileName = 'pasted_text_' + timestamp + '.txt';

            // Create File object from text
            var blob = new Blob([text], {type: 'text/plain'});
            var file = new File([blob], fileName, {type: 'text/plain'});

            // Show notification
            /* if (this.options.framework7) {
                 this.options.framework7.toast.show({
                     text: `Long text detected. Created file: ${fileName}`,
                     position: 'center',
                     closeTimeout: 3000,
                     cssClass: 'color-blue'
                 });
             }*/

            // Process the file through normal file handling
            this.handleFiles([file]);

            // FORZAR la actualización después de que se procese
            setTimeout(function () {
                // Simular que la extracción ha terminado
                self.updateFileWithExtractedContent(fileName, text, false);

                // Llamar al callback si existe
                if (typeof self.options.onTextExtracted === 'function') {
                    self.options.onTextExtracted(file, text);
                }
            }, 200); // Dar más tiempo para que se procese handleFiles
        };

        /**
         * Gets the appropriate file extension based on MIME type
         * @param {string} mimeType - MIME type of the image
         * @returns {string} - File extension
         * @private
         */
        FileDropzone.prototype._getImageExtensionFromMimeType = function (mimeType) {
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
        FileDropzone.prototype._setupFileInput = function () {
            var self = this;

            this.fileInput.addEventListener('change', function (e) {
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
        FileDropzone.prototype._isDescendantOf = function (element, className) {
            while (element && element !== document) {
                if (element.classList && element.classList.contains(className)) {
                    return true;
                }
                element = element.parentNode;
            }
            return false;
        };

        /**
         * Actualiza el contador de archivos en la UI
         * @private
         */
        FileDropzone.prototype._updateFileCounter = function () {
            if (this.options.maxFiles === null) return;

            var status = this.canAddMoreFiles();
            var counterEl = this.dropzone.querySelector('.file-counter');

            if (!counterEl) {
                counterEl = document.createElement('div');
                counterEl.className = 'file-counter';
                counterEl.style.cssText = 'text-align: right; font-size: 12px; color: #666;';
                this.dropzone.insertBefore(counterEl, this.dropzone.firstChild);
            }

            var colorClass = status.remaining === 0 ? 'color: #f44336' : 'color: #666';
            counterEl.innerHTML = `<span style="${colorClass}">Files: ${status.current}/${status.max}</span>`;
        };

        /**
         * Verifica si se pueden agregar más archivos
         * @returns {Object} - Estado del límite de archivos
         * @public
         */
        FileDropzone.prototype.canAddMoreFiles = function () {
            if (this.options.maxFiles === null) {
                return {canAdd: true, remaining: Infinity};
            }

            var remaining = this.options.maxFiles - this.uploadedFiles.length;
            return {
                canAdd: remaining > 0,
                remaining: Math.max(0, remaining),
                current: this.uploadedFiles.length,
                max: this.options.maxFiles
            };
        };
        /**
         * Handles uploaded files
         * @param {FileList} files - List of uploaded files
         * @public
         */
        FileDropzone.prototype.handleFiles = function (files) {
            if (this.disabled) {
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'File upload is disabled for this assistant.',
                        cssClass: 'color-red'
                    });
                }
                return;
            }
            if (!files || files.length === 0) return;

            var self = this;
            var validFiles = [];
            var rejectedFiles = [];

            // NUEVA VERIFICACIÓN: Comprobar límite de archivos
            if (this.options.maxFiles !== null) {
                var currentFileCount = this.uploadedFiles.length;
                var newFileCount = files.length;
                var totalAfterUpload = currentFileCount + newFileCount;

                if (totalAfterUpload > this.options.maxFiles) {
                    var allowedNewFiles = this.options.maxFiles - currentFileCount;

                    if (allowedNewFiles <= 0) {
                        // No se pueden agregar más archivos
                        if (this.options.framework7) {
                            this.options.framework7.toast.show({
                                text: `Maximum ${this.options.maxFiles} files allowed. Please remove some files first.`,
                                cssClass: 'color-red',
                                closeTimeout: 4000
                            });
                        }
                        return;
                    } else {
                        // Solo se pueden agregar algunos archivos
                        if (this.options.framework7) {
                            this.options.framework7.toast.show({
                                text: `Only ${allowedNewFiles} more files can be added (max: ${this.options.maxFiles}).`,
                                cssClass: 'color-orange',
                                closeTimeout: 4000
                            });
                        }

                        // Tomar solo los primeros archivos permitidos
                        files = Array.from(files).slice(0, allowedNewFiles);
                    }
                }
            }

            // Validate each file
            Array.from(files).forEach(function (file) {
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

            // Determine if we should use compact mode
            var totalFiles = this.uploadedFiles.length + validFiles.length;
            var isCompactMode = totalFiles > 1;

            validFiles.forEach(function (file) {
                // Check if the file already exists (double check)
                if (self.uploadedFiles.some(f => f.name === file.name)) {
                    return; // Skip this file if it already exists
                }

                // Add to uploaded files array
                self.uploadedFiles.push(file);

                var fileType = self._getFileType(file);
                var icon = 'fa-file';
                var needsExtraction = false;

                // Determine icon and if text extraction is needed
                switch (fileType) {
                    case 'text':
                        if (file.name.toLowerCase().endsWith('.json')) {
                            icon = 'fa-file-code';
                        } else if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
                            icon = 'fa-file-code';
                        } else if (file.name.toLowerCase().endsWith('.js')) {
                            icon = 'fa-file-code';
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
                        needsExtraction = true;
                        break;
                    default:
                        if (file.type.startsWith('video/')) icon = 'fa-file-video';
                        else if (file.type.startsWith('audio/')) icon = 'fa-file-audio';
                        break;
                }

                // Create preview item
                var fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.setAttribute('data-file-id', file.name);

                // Handle images differently based on compact mode
                if (fileType === 'image') {
                    self._createImagePreview(file, fileItem, isCompactMode);
                } else {
                    // Handle non-image files
                    //  if (isCompactMode) {
                    // Compact mode: icon fa-2x, name, click whole box
                    fileItem.className = 'file-item file-compact float-left margin-right margin-top';
                    fileItem.style.cssText = 'height: 34px; display: flex; align-items: center; cursor: pointer; padding: 5px; border-radius: 4px;';

                    fileItem.innerHTML = `
                    <i class="fa ${icon} fa-2x margin-right"></i>
                    <span class="file-name" style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
                `;

                    // Click handler for whole box
                    fileItem.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (file.extractedText && file.extractedText !== "pending_vision_analysis") {
                            var fileExtension = file.name.split('.').pop().toLowerCase();
                            var codeEditorExtensions = {
                                'json': 'json', 'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript',
                                'tsx': 'typescript', 'html': 'html', 'htm': 'html', 'xml': 'xml',
                                'css': 'css', 'scss': 'scss', 'less': 'less', 'md': 'markdown',
                                'markdown': 'markdown', 'sh': 'sh', 'bash': 'sh', 'py': 'python',
                                'rb': 'ruby', 'php': 'php', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
                                'h': 'c', 'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'swift': 'swift',
                                'yml': 'yaml', 'yaml': 'yaml', 'stask': 'json'
                            };
                            if (self._getFileType(file) === 'ppt') {
                                self.showPowerPointInSplitView(file.name);
                            } else if (self._getFileType(file) === 'word') {
                                self.showWordInSplitView(file.name);
                            } else if (fileType === 'pdf') {
                                // 🔥 NUEVO: Mostrar PDF en split view
                                self.showPdfInSplitView(file.name);
                            } else if (typeof editContent === 'function') {
                                if (fileExtension in codeEditorExtensions) {
                                    editContent(file.extractedText, 'editor_' + Date.now(), file.name, true, codeEditorExtensions[fileExtension]);
                                } else {
                                    editContent(file.extractedText.replace(/<simba_document[^>]*>([\s\S]*?)<\/simba_document>/g, '$1'), 'editor_' + Date.now(), file.name);
                                }
                            } else {
                                self.showExtractedText(file.name, file.extractedText);
                            }
                        }
                    });
                    // }
                }

                // Add extraction indicator for files that need processing
                if (needsExtraction) {
                    var extractingIndicator = document.createElement('span');
                    extractingIndicator.className = 'extracting-indicator';
                    extractingIndicator.innerHTML = '<i class="fa fa-sync fa-spin"></i>';

                    // For images in compact mode or regular mode, hide the indicator as they have overlays
                    if (fileType === 'image') {
                        extractingIndicator.style.display = 'none';
                    }
                    // For compact mode non-images, position the indicator appropriately
                    else if (isCompactMode) {
                        extractingIndicator.style.cssText = 'position: absolute; right: 5px; top: 5px; font-size: 12px;';
                        fileItem.style.position = 'relative';
                    }

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

            // Only add event listeners for normal mode (non-compact)
            if (!isCompactMode) {
                // Add event listeners to view buttons
                previewArea.querySelectorAll('.view-file').forEach(function (button) {
                    if (!button.hasAttribute('data-has-listener')) {
                        button.setAttribute('data-has-listener', 'true');
                        button.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var filename = e.currentTarget.getAttribute('data-filename');
                            var file = self.uploadedFiles.find(f => f.name === filename);
                            if (!file) return;

                            if (self._getFileType(file) === 'word') {
                                self.showWordViewOptions(filename);
                            } else {
                                if (file.extractedText) {
                                    var fileExtension = filename.split('.').pop().toLowerCase();
                                    var codeEditorExtensions = {
                                        'json': 'json', 'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript',
                                        'tsx': 'typescript', 'html': 'html', 'htm': 'html', 'xml': 'xml',
                                        'css': 'css', 'scss': 'scss', 'sass': 'scss', 'less': 'less',
                                        'md': 'markdown', 'markdown': 'markdown', 'sh': 'sh', 'bash': 'bash',
                                        'py': 'python', 'rb': 'ruby', 'php': 'php', 'java': 'java',
                                        'c': 'c', 'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'h': 'c',
                                        'hpp': 'cpp', 'cs': 'csharp', 'go': 'go', 'rs': 'rust',
                                        'swift': 'swift', 'kt': 'kotlin', 'scala': 'scala',
                                        'yml': 'yaml', 'yaml': 'yaml', 'sql': 'sql', 'r': 'r',
                                        'pl': 'perl', 'lua': 'lua', 'dart': 'dart', 'vue': 'vue',
                                        'svelte': 'svelte', 'stask': 'json', 'ini': 'ini',
                                        'cfg': 'ini', 'conf': 'ini', 'toml': 'toml',
                                        'dockerfile': 'dockerfile', 'makefile': 'makefile',
                                        'gitignore': 'gitignore', 'env': 'dotenv', 'log': 'log', 'txt': 'text'
                                    };

                                    if (typeof editContent === 'function') {
                                        if (fileExtension in codeEditorExtensions) {
                                            editContent(file.extractedText, 'editor_' + Date.now(), filename, true, codeEditorExtensions[fileExtension]);
                                        } else {
                                            editContent(file.extractedText.replace(/<simba_document[^>]*>([\s\S]*?)<\/simba_document>/g, '$1'), 'editor_' + Date.now(), filename);
                                        }
                                    } else {
                                        self.showExtractedText(filename, file.extractedText);
                                    }
                                }
                            }
                        });
                    }
                });
            }

            // Add event listeners to remove buttons (only for normal mode)
            previewArea.querySelectorAll('.remove-file').forEach(function (button) {
                var newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);

                newButton.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    var filename = e.currentTarget.getAttribute('data-filename');
                    if (filename) {
                        self.removeFile(filename);
                    }
                });

                newButton.setAttribute('data-has-listener', 'true');
            });

            // Clear file input
            this.fileInput.value = '';
            this._updateFileCounter();

        };

        /**
         * Shows notifications for rejected files
         * @param {Array} rejectedFiles - List of rejected files with reasons
         * @private
         */
        FileDropzone.prototype._showRejectionNotifications = function (rejectedFiles) {
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
            rejectedFiles.forEach(function (rejected) {
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
                closeBtn.onclick = function () {
                    notification.style.opacity = '0';
                    setTimeout(function () {
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
                setTimeout(function () {
                    notification.style.opacity = '0';
                    setTimeout(function () {
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
        FileDropzone.prototype._loadJSZip = function (callback) {
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = function () {
                callback();
            };
            script.onerror = function () {
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
        FileDropzone.prototype.extractTextFromPowerPoint = function (file, fileType, callback) {
            var self = this;
            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                // Primero verificamos si JSZip está disponible
                if (typeof JSZip === 'undefined') {
                    self._loadJSZip(function () {
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

            reader.onerror = function () {
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
        FileDropzone.prototype._processPowerPointWithJSZip = function (arrayBuffer, file, callback) {
            var self = this;

            try {
                var zip = new JSZip();

                zip.loadAsync(arrayBuffer).then(function (contents) {
                    var slideFiles = [];
                    var slideContents = {};
                    var result = "";

                    // Buscar archivos de diapositivas
                    Object.keys(contents.files).forEach(function (filename) {
                        if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
                            slideFiles.push(filename);
                        }
                    });

                    // Ordenar archivos de diapositivas por número
                    slideFiles.sort(function (a, b) {
                        var numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                        var numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                        return numA - numB;
                    });

                    // Procesar cada archivo de diapositiva
                    var slidePromises = slideFiles.map(function (slideFile) {
                        return zip.file(slideFile).async('string').then(function (content) {
                            var slideNum = parseInt(slideFile.match(/slide(\d+)\.xml/)[1]);
                            slideContents[slideNum] = self._extractTextFromPPTXSlide(content);
                        });
                    });

                    // Esperar a que todas las diapositivas se procesen
                    Promise.all(slidePromises).then(function () {
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
                    }).catch(function (error) {
                        console.error("Error procesando diapositivas:", error);
                        var errorMessage = "Error procesando diapositivas: " + error.message;
                        self.updateFileWithExtractedContent(file.name, errorMessage);

                        if (callback) callback(errorMessage);
                    });
                }).catch(function (error) {
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
         * @returns {string} - Texto extra�do
         * @private
         */
        FileDropzone.prototype._extractTextFromPPTXSlide = function (xmlContent) {
            var textContent = [];

            // Buscar texto en las etiquetas a:t (m�s estricto)
            var textRegex = /<a:t>([^<]*)<\/a:t>/g;
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

                    // Filtrar texto que parezca ser XML o c�digo
                    if (!this._looksLikeXmlOrCode(text)) {
                        textContent.push(text);
                    }
                }
            }

            // Formatear el texto extra�do
            var formattedText = "";

            if (textContent.length > 0) {
                // El primer texto significativo suele ser el t�tulo
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
                    // Sin t�tulo claro, formatear todo como contenido
                    textContent.forEach(function (text) {
                        formattedText += text + "\n\n";
                    });
                }
            }

            return formattedText;
        };

        /**
         * Verifica si un texto parece ser XML o c�digo en lugar de contenido legible
         * @param {string} text - Texto a verificar
         * @returns {boolean} - True si parece ser XML/c�digo
         * @private
         */
        FileDropzone.prototype._looksLikeXmlOrCode = function (text) {
            // Patrones que indican XML o c�digo
            var xmlPatterns = [
                /<[^>]+>/,                    // Contiene tags XML
                /^[{}\[\]]+$/,                // Solo llaves/corchetes
                /xmlns/i,                     // Namespace XML
                /^[a-z]+:[a-z]+/i,           // Prefijos XML (a:tblPr, etc)
                /\{[A-F0-9-]{36}\}/,         // GUIDs
                /^[0-9]{6,}$/,               // N�meros largos (medidas XML)
                /="[^"]*"/,                  // Atributos XML
                /^[a-z]+[A-Z][a-z]+$/        // CamelCase t�pico de propiedades
            ];

            return xmlPatterns.some(function (pattern) {
                return pattern.test(text);
            });
        };
        /**
         * Método alternativo mejorado para extraer texto de PowerPoint cuando JSZip falla
         * @param {ArrayBuffer} arrayBuffer - El contenido del archivo PowerPoint
         * @param {File} file - El archivo original
         * @param {Function} callback - Función callback
         * @private
         */
        FileDropzone.prototype._extractPowerPointTextAlternative = function (arrayBuffer, file, callback) {
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
                        valueMatches.forEach(function (match) {
                            var value = match.replace(/val="|"/g, '').trim();
                            if (value && value.length > 3 && !/^\d+$/.test(value) && !/^[a-f0-9-]+$/.test(value)) {
                                extractedTexts.push(value);
                            }
                        });
                    }

                    // Buscar cualquier secuencia de texto que parezca significativa
                    var textBlocks = textContent.match(/[A-Za-z0-9\s.,;:'"-]{10,}/g);
                    if (textBlocks && textBlocks.length > 0) {
                        textBlocks.forEach(function (block) {
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
                    extractedTexts.forEach(function (text) {
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

                        slideTexts.forEach(function (text) {
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
        FileDropzone.prototype._cleanPPTXXML = function (xmlText) {
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
         * Muestra PowerPoint usando pptxjs en editContent con configuración completa
         * @param {string} fileName - Nombre del archivo PowerPoint
         * @public
         */
        FileDropzone.prototype.showPowerPointInEditContent = function (fileName) {
            var self = this;

            // Buscar el archivo PowerPoint
            var pptFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'ppt';
            });

            if (!pptFile) {
                console.error('PowerPoint file not found:', fileName);
                return;
            }

            if (typeof $ === 'undefined' || typeof $.fn.pptxToHtml === 'undefined') {
                console.error('pptxjs library or jQuery not loaded');
                // Fallback a texto plano
                if (pptFile.extractedText) {
                    editContent(pptFile.extractedText, 'editor_' + Date.now(), fileName);
                }
                return;
            }

            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });

                // Crear URL temporal para el blob
                var blobUrl = URL.createObjectURL(blob);

                // Crear contenedor temporal para el visor
                var containerHtml = `
            <style>
                .pptx-viewer-wrapper {
                    width: 100%;
                    min-height: 600px;
                    background: #f5f5f5;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .pptx-viewer-wrapper #pptx-container {
                    width: 100%;
                    margin: 0 auto;
                }
                /* Estilos para las diapositivas */
                .pptx-viewer-wrapper .slide {
                    background: white;
                    margin: 20px auto;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-width: 960px;
                    page-break-after: always;
                }
                /* Estilos para modo presentación */
                .pptx-viewer-wrapper .slide-mode-toolbar {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8);
                    padding: 10px 20px;
                    border-radius: 25px;
                    z-index: 1000;
                }
                .pptx-viewer-wrapper .slide-mode-toolbar button {
                    background: transparent;
                    border: 1px solid white;
                    color: white;
                    padding: 8px 15px;
                    margin: 0 5px;
                    border-radius: 5px;
                    cursor: pointer;
                }
                .pptx-viewer-wrapper .slide-mode-toolbar button:hover {
                    background: rgba(255,255,255,0.2);
                }
            </style>
            <div class="pptx-viewer-wrapper">
                <div id="pptx-container"></div>
            </div>
        `;

                // Mostrar en editContent primero
                if (typeof editContent === 'function') {
                    editContent(containerHtml, 'editor_' + Date.now(), fileName, false, 'html');

                    // Dar tiempo para que se renderice el contenedor
                    setTimeout(function() {
                        // Buscar el contenedor en el DOM
                        var container = document.querySelector('.pptx-viewer-wrapper #pptx-container');

                        if (!container) {
                            console.error('PPTX container not found in DOM');
                            // Fallback a texto plano
                            if (pptFile.extractedText) {
                                editContent(pptFile.extractedText, 'editor_' + Date.now(), fileName);
                            }
                            return;
                        }

                        // Inicializar pptxjs con el contenedor
                        $(container).pptxToHtml({
                            pptxFileUrl: blobUrl,
                            slidesScale: "100%",
                            slideMode: false, // false = mostrar todas las diapositivas
                            keyBoardShortCut: true,
                            mediaProcess: true,
                            slideModeConfig: {
                                first: 1,
                                nav: true,
                                navTxtColor: "white",
                                showPlayPauseBtn: true,
                                keyBoardShortCut: true,
                                showSlideNum: true,
                                showTotalSlideNum: true,
                                autoSlide: false,
                                randomAutoSlide: false,
                                loop: false,
                                background: "#2c3e50",
                                transition: "default",
                                transitionTime: 0.5
                            }
                        });

                        console.log('PowerPoint rendered successfully in editContent');

                        // Limpiar URL del blob después de un tiempo
                        setTimeout(function() {
                            URL.revokeObjectURL(blobUrl);
                        }, 60000); // 1 minuto

                    }, 500); // Esperar 500ms para que editContent renderice

                } else {
                    console.error('editContent function not available');
                    URL.revokeObjectURL(blobUrl);
                }
            };

            reader.onerror = function () {
                console.error('Error reading PowerPoint file');

                // Fallback a texto plano
                if (pptFile.extractedText) {
                    editContent(pptFile.extractedText, 'editor_' + Date.now(), fileName);
                }
            };

            reader.readAsArrayBuffer(pptFile);
        };
        /**
         * Muestra archivo PDF desde File object O desde URL
         * @param {File|string} fileOrUrl - File object o URL del PDF
         * @param {string} fileName - Nombre del archivo PDF
         * @param {string} searchQuery - Texto a buscar
         * @param {number} page - Número de página
         * @public
         */
        FileDropzone.prototype.showPdfInSplitViewFromFile = function(fileOrUrl, fileName, searchQuery, page) {
            searchQuery = searchQuery || "Simba tech";
            page = page || 1;
            var self = this;

            // 🔥 DETECTAR SI ES URL O FILE
            if (typeof fileOrUrl === 'string') {
                // Es una URL, usarla directamente
                console.log('📄 Opening PDF from URL:', fileOrUrl);
                this._showPdfFromUrl(fileOrUrl, fileName, searchQuery, page);
            } else if (fileOrUrl && fileOrUrl instanceof File) {
                // Es un File object, convertir a blob
                console.log('📄 Opening PDF from File object:', fileName);
                this._showPdfFromFileObject(fileOrUrl, fileName, searchQuery, page);
            } else {
                console.error('❌ Invalid input: expected File object or URL string');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'Invalid PDF source',
                        cssClass: 'color-red'
                    });
                }
            }
        };

        /**
         * Muestra PDF desde URL directa
         * @private
         */
        FileDropzone.prototype._showPdfFromUrl = function(pdfUrl, fileName, searchQuery, page) {
            var self = this;

            console.log('📥 Fetching PDF from URL:', pdfUrl);

            // 🔥 HACER FETCH DEL PDF Y CONVERTIRLO A FILE
            fetch(pdfUrl)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('HTTP error ' + response.status);
                    }
                    return response.blob();
                })
                .then(function(blob) {
                    console.log('✅ PDF blob received:', blob.size, 'bytes');

                    // 🔥 CONVERTIR BLOB A FILE OBJECT
                    var file = new File([blob], fileName, { type: 'application/pdf' });

                    console.log('✅ Converted to File object, now using standard viewer');

                    // 🎯 USAR EL MÉTODO QUE YA FUNCIONA CON FILE OBJECTS
                    self._showPdfFromFileObject(file, fileName, searchQuery, page);
                })
                .catch(function(error) {
                    console.error('❌ Error fetching PDF:', error);

                    if (self.options.framework7) {
                        self.options.framework7.toast.show({
                            text: 'Error loading PDF: ' + error.message,
                            cssClass: 'color-red',
                            closeTimeout: 4000
                        });
                    }
                });
        };

        /**
         * Muestra PDF desde File object (método original)
         * @private
         */
        FileDropzone.prototype._showPdfFromFileObject = function(file, fileName, searchQuery, page) {
            var self = this;

            if (!file) {
                console.error('❌ No file provided');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'File not found',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            var reader = new FileReader();

            reader.onload = function(e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                var blobUrl = URL.createObjectURL(blob);
                var encodedUrl = encodeURIComponent(blobUrl);

                var viewerId = 'pdf-viewer-' + Date.now();
                var html = `
            <style>
                #${viewerId} {
                    width: 100%;
                    height: 98vh;
                    border: none;
                    background: #525659;
                }
                .pdf-loader {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: white;
                    z-index: 1000;
                }
            </style>
            <div style="position: relative; width: 100%; height: 98vh;">
                <div class="pdf-loader">
                    <i class="fa fa-spinner fa-spin" style="font-size: 48px;"></i>
                    <p style="margin-top: 20px;">Loading PDF viewer...</p>
                </div>
                <iframe 
                    id="${viewerId}" 
                    src="/assets/vendor/pdfjs/web/viewer.html?file=${encodedUrl}"
                    style="display: none;"
                    onload="this.style.display='block'; this.previousElementSibling.style.display='none';">
                </iframe>
            </div>
        `;

                $("#close-secundary").unbind('click').bind('click', function() {
                    URL.revokeObjectURL(blobUrl);
                    app.splitView.close();
                    setTimeout(function() {
                        if (typeof setDynamicHeight === 'function') setDynamicHeight();
                    }, 500);
                });

                $("#secundary-title").find('.title').text(fileName);
                app.splitView.open(html, {isHtml: true, pageTitle: fileName});

                setTimeout(() => {
                    const iframe = document.getElementById(viewerId);
                    const w = iframe.contentWindow;
                    w.PDFViewerApplication.initializedPromise.then(() => {
                        const runSearch = () => {
                            const bus = w.PDFViewerApplication.eventBus;

                            bus.dispatch('find', {
                                type: 'find',
                                query: searchQuery,
                                caseSensitive: false,
                                entireWord: true,
                                highlightAll: true,
                                findPrevious: false
                            });
                        };

                        w.PDFViewerApplication.pdfViewer.currentPageNumber = page;

                        if (w.PDFViewerApplication.pdfViewer?.pagesCount > 0) {
                            runSearch();
                        } else {
                            w.PDFViewerApplication.eventBus.on('pagesloaded', runSearch, { once: true });
                        }
                    });
                }, 1500);

                console.log('✅ PDF viewer loaded:', fileName);
            };

            reader.onerror = function() {
                console.error('❌ Error reading PDF file');
                if (self.options.framework7) {
                    self.options.framework7.toast.show({
                        text: 'Error reading PDF file',
                        cssClass: 'color-red'
                    });
                }
            };

            reader.readAsArrayBuffer(file);
        };
        /**
         * Muestra archivo PDF usando el visor local de Mozilla PDF.js
         * @param {string} fileName - Nombre del archivo PDF
         * @public
         */
        FileDropzone.prototype.showPdfInSplitView = function(fileName, searchQuery,page) {
            searchQuery = searchQuery || "Simba tech";
            page = page || 1;
            var self = this;

            var pdfFile = this.uploadedFiles.find(function(file) {
                return file.name === fileName && self._getFileType(file) === 'pdf';
            });

            if (!pdfFile) {
                console.error('PDF file not found:', fileName);
                return;
            }

            var reader = new FileReader();

            reader.onload = function(e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                var blobUrl = URL.createObjectURL(blob);
                var encodedUrl = encodeURIComponent(blobUrl);

                var viewerId = 'pdf-viewer-' + Date.now();
                var html = `
            <style>
                #${viewerId} {
                    width: 100%;
                    height: 98vh;
                    border: none;
                    background: #525659;
                }
                .pdf-loader {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: white;
                    z-index: 1000;
                }
            </style>
            <div style="position: relative; width: 100%; height: 98vh;">
                <div class="pdf-loader">
                    <i class="fa fa-spinner fa-spin" style="font-size: 48px;"></i>
                    <p style="margin-top: 20px;">Loading PDF viewer...</p>
                </div>
                <iframe 
                    id="${viewerId}" 
                    src="/assets/vendor/pdfjs/web/viewer.html?file=${encodedUrl}"
                    style="display: none;"
                    onload="this.style.display='block'; this.previousElementSibling.style.display='none';">
                </iframe>
            </div>
        `;

                $("#close-secundary").unbind('click').bind('click', function() {
                    URL.revokeObjectURL(blobUrl);
                    app.splitView.close();
                    setTimeout(function() {
                        if (typeof setDynamicHeight === 'function') setDynamicHeight();
                    }, 500);
                });

                $("#secundary-title").find('.title').text(fileName);
                app.splitView.open(html, { isHtml: true, pageTitle: fileName });

                // Esperar a que el iframe cargue PDF.js completamente
                setTimeout(() => {
                    console.log(viewerId)
                    const iframe = document.getElementById(viewerId);
                    const w = iframe.contentWindow;
                    w.PDFViewerApplication.initializedPromise.then(() => {
                        const runSearch = () => {
                            const bus = w.PDFViewerApplication.eventBus;



                            // Lanza búsqueda exacta de frase (no palabras sueltas)
                            bus.dispatch('find', {
                                type: 'find',
                                query: searchQuery,
                                caseSensitive: false,
                                entireWord: true,     // evita matches parciales dentro de palabras
                                highlightAll: true,
                                findPrevious: false
                            });

                        }

                        w.PDFViewerApplication.pdfViewer.currentPageNumber = page;


                        // Espera a que las páginas estén cargadas
                        if (w.PDFViewerApplication.pdfViewer?.pagesCount > 0) {
                            runSearch();
                        } else {
                            w.PDFViewerApplication.eventBus.on('pagesloaded', runSearch, { once: true });
                        }
                    });
                }, 1500);

                console.log('✅ PDF viewer loaded:', fileName);
            };

            reader.onerror = function() {
                console.error('❌ Error reading PDF file');
                if (self.options.framework7) {
                    self.options.framework7.toast.show({
                        text: 'Error reading PDF file',
                        cssClass: 'color-red'
                    });
                }
            };

            reader.readAsArrayBuffer(pdfFile);
        };

        /**
         * Muestra PowerPoint en modo presentación (slideMode: true)
         * @param {string} fileName - Nombre del archivo PowerPoint
         * @public
         */
        FileDropzone.prototype.showPowerPointPresentation = function (fileName) {
            var self = this;

            var pptFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'ppt';
            });

            if (!pptFile) {
                console.error('PowerPoint file not found:', fileName);
                return;
            }

            if (typeof $ === 'undefined' || typeof $.fn.pptxToHtml === 'undefined') {
                console.error('pptxjs library not loaded');
                return;
            }

            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });
                var blobUrl = URL.createObjectURL(blob);

                var containerHtml = `
            <style>
                .pptx-presentation-fullscreen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: black;
                    z-index: 9999;
                }
                .pptx-presentation-fullscreen #pptx-presentation-container {
                    width: 100%;
                    height: 100%;
                }
            </style>
            <div class="pptx-presentation-fullscreen">
                <div id="pptx-presentation-container"></div>
            </div>
        `;

                editContent(containerHtml, 'editor_' + Date.now(), fileName + ' (Presentation)', false, 'html');

                setTimeout(function() {
                    var container = document.querySelector('#pptx-presentation-container');

                    if (container) {
                        $(container).pptxToHtml({
                            pptxFileUrl: blobUrl,
                            slidesScale: "100%",
                            slideMode: true, // Modo presentación
                            keyBoardShortCut: true,
                            mediaProcess: true,
                            slideModeConfig: {
                                first: 1,
                                nav: true,
                                navTxtColor: "white",
                                showPlayPauseBtn: true,
                                keyBoardShortCut: true,
                                showSlideNum: true,
                                showTotalSlideNum: true,
                                autoSlide: false,
                                randomAutoSlide: false,
                                loop: false,
                                background: "black",
                                transition: "slide",
                                transitionTime: 0.5
                            }
                        });

                        setTimeout(function() {
                            URL.revokeObjectURL(blobUrl);
                        }, 60000);
                    }
                }, 500);
            };

            reader.readAsArrayBuffer(pptFile);
        };
        /**
         * Muestra archivo PowerPoint usando pptxjs en split view
         * @param {string} fileName - Nombre del archivo PowerPoint
         * @public
         */
        FileDropzone.prototype.showPowerPointViewOptions = function(fileName) {
            var self = this;

            // 🔥 FORZAR JSZIP 2.x TEMPORALMENTE
            var originalJSZip = window.JSZip;
            if (typeof window.JSZipV2 !== 'undefined') {
                window.JSZip = window.JSZipV2;
                console.log('🔄 Forced JSZip 2.x for PowerPoint rendering');
            }

            var pptFile = this.uploadedFiles.find(function(file) {
                return file.name === fileName && self._getFileType(file) === 'ppt';
            });

            if (!pptFile) {
                console.error('PowerPoint file not found:', fileName);
                window.JSZip = originalJSZip; // Restaurar
                return;
            }

            if (typeof $ === 'undefined' || typeof $.fn.pptxToHtml === 'undefined') {
                console.error('pptxjs library not loaded');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'PowerPoint viewer not available',
                        cssClass: 'color-red'
                    });
                }
                window.JSZip = originalJSZip; // Restaurar
                return;
            }

            var reader = new FileReader();

            reader.onload = function(e) {
                var arrayBuffer = e.target.result;

                // 🔥 VERIFICAR JSZIP ANTES DE CREAR BLOB
                console.log('📊 JSZip version during blob creation:', typeof JSZip, JSZip.version || 'v2.x');

                var blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });
                var blobUrl = URL.createObjectURL(blob);

                // Crear contenedor para pptxjs
                var viewerId = 'pptx-viewer-' + Date.now();
                var html = `
            <style>
                #${viewerId} {
                    width: 100%;
                    height: 98vh;
                    background: #f5f5f5;
                    overflow: auto;
                }
                #${viewerId} .slide {
                    background: white;
                    margin: 20px auto;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    max-width: 960px;
                }
            </style>
            <div id="${viewerId}"></div>
        `;

                // Configurar botones del split view
                $("#close-secundary").unbind('click');
                $("#close-secundary").bind('click', function() {
                    URL.revokeObjectURL(blobUrl);
                    window.JSZip = originalJSZip; // 🔥 RESTAURAR AL CERRAR
                    app.splitView.close();
                    setTimeout(function() {
                        if (typeof setDynamicHeight === 'function') {
                            setDynamicHeight();
                        }
                    }, 500);
                });

                $("#secundary-title").find('.title').text(fileName);

                // Abrir split view
                app.splitView.open(html, {isHtml: true, pageTitle: fileName});

                // Renderizar presentación
                setTimeout(function() {
                    var container = document.getElementById(viewerId);

                    if (!container) {
                        console.error('Container not found');
                        window.JSZip = originalJSZip; // Restaurar
                        return;
                    }

                    // 🔥 VERIFICAR JSZIP JUSTO ANTES DE RENDERIZAR
                    console.log('📊 JSZip version before pptxToHtml:', typeof JSZip, JSZip.version || 'v2.x');

                    try {
                        $(container).pptxToHtml({
                            pptxFileUrl: blobUrl,
                            slidesScale: "100%",
                            slideMode: false,
                            keyBoardShortCut: false,
                            mediaProcess: true,
                            slideModeConfig: {
                                first: 1,
                                nav: false,
                                showPlayPauseBtn: false,
                                keyBoardShortCut: false,
                                showSlideNum: true,
                                showTotalSlideNum: true,
                                autoSlide: false,
                                loop: false,
                                background: "#f5f5f5"
                            }
                        });

                        console.log('✅ PowerPoint rendered successfully');

                        // Limpiar URL después de 60 segundos
                        setTimeout(function() {
                            URL.revokeObjectURL(blobUrl);
                        }, 60000);

                        // 🔥 RESTAURAR JSZIP DESPUÉS DE RENDERIZAR
                        setTimeout(function() {
                            window.JSZip = originalJSZip;
                            console.log('✅ JSZip restored to v3');
                        }, 1000);

                    } catch (error) {
                        console.error('❌ Error rendering PowerPoint:', error);
                        container.innerHTML = '<div style="padding:40px; text-align:center;">' +
                            '<i class="fa fa-exclamation-triangle" style="font-size:48px; color:#f44336; margin-bottom:20px;"></i>' +
                            '<h3 style="color:#f44336;">Error Rendering Presentation</h3>' +
                            '<p style="color:#666;">' + error.message + '</p>' +
                            '</div>';

                        window.JSZip = originalJSZip; // Restaurar en caso de error
                    }
                }, 100);
            };

            reader.onerror = function() {
                console.error('❌ Error reading PowerPoint file');
                if (self.options.framework7) {
                    self.options.framework7.toast.show({
                        text: 'Error reading file',
                        cssClass: 'color-red'
                    });
                }
                window.JSZip = originalJSZip; // Restaurar
            };

            reader.readAsArrayBuffer(pptFile);
        };
// --- Utilidades de normalización y mapeo --- //
        function normalizeForSearch(str) {
            // Quita guión blando, convierte NBSP a espacio, colapsa espacios
            return str
                .replace(/\u00AD/g, '')       // soft hyphen
                .replace(/\u00A0/g, ' ')      // nbsp -> space
                .replace(/\s+/g, ' ');
        }

        function buildTextIndex(rootEl) {
            // Recorre todos los text nodes en orden, construye:
            // - fullTextNorm: texto concatenado normalizado
            // - map: por cada char normalizado, a qué (node, offsetReal) corresponde
            // También insertamos un "espacio sintético" entre nodos sin separación para permitir matches entre nodos.
            const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
                acceptNode(n) {
                    const t = n.textContent;
                    if (!t || !t.trim()) return NodeFilter.FILTER_SKIP;
                    return NodeFilter.FILTER_ACCEPT;
                }
            });

            const map = []; // { node, offset, synthetic?: true }
            let fullTextNorm = '';
            let prevEndedWithSpace = true;

            let current;
            while ((current = walker.nextNode())) {
                // Texto original y normalizado con mapeo
                const raw = current.textContent;
                // Primero limpiamos NBSP y soft-hyphen, pero mantendremos un mapeo por char
                const cleaned = raw.replace(/\u00AD/g, '').replace(/\u00A0/g, ' ');

                // Si el texto previo no terminaba en espacio y el siguiente nodo no empieza con espacio,
                // insertamos un "espacio sintético" para poder matchear a través de nodos.
                const beginsWithSpace = /^\s/.test(cleaned);
                if (!prevEndedWithSpace && !beginsWithSpace) {
                    fullTextNorm += ' ';
                    map.push({ node: null, offset: 0, synthetic: true });
                }

                // Construimos normalización con mapeo char a char
                let i = 0;
                while (i < cleaned.length) {
                    if (/\s/.test(cleaned[i])) {
                        // Colapsar cualquier racha de espacios en UN espacio
                        // Solo añadimos un espacio si el último char normalizado no es espacio
                        if (fullTextNorm.length === 0 || fullTextNorm[fullTextNorm.length - 1] !== ' ') {
                            fullTextNorm += ' ';
                            // Mapear este espacio a la primera posición del bloque de espacios
                            map.push({ node: current, offset: i });
                        }
                        // Saltar todos los espacios consecutivos
                        while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
                        continue;
                    }
                    // Carácter normal
                    fullTextNorm += cleaned[i];
                    // Calcular offset real respecto al raw original:
                    // (como quitamos soft hyphen antes, offset i ya es válido contra cleaned;
                    // suficiente para resaltar visualmente)
                    map.push({ node: current, offset: i });
                    i++;
                }

                prevEndedWithSpace = fullTextNorm.length === 0 ? true : (fullTextNorm[fullTextNorm.length - 1] === ' ');
            }

            // Trim final si terminó en espacio
            if (fullTextNorm.endsWith(' ')) {
                fullTextNorm = fullTextNorm.slice(0, -1);
                // quita el último map si era espacio
                if (map.length && (map[map.length - 1].node === null || /\s/.test(map[map.length - 1].node?.textContent?.[map[map.length - 1].offset] || ' '))) {
                    map.pop();
                }
            }

            return { fullTextNorm, map };
        }
        function escapeRegex(str) {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        function findMatches(fullTextNorm, query) {
            // Los espacios del query equivalen a \s+
            const pattern = escapeRegex(query).replace(/\s+/g, '\\s+');
            const re = new RegExp(pattern, 'gi');
            const matches = [];
            let m;
            while ((m = re.exec(fullTextNorm)) !== null) {
                matches.push({ start: m.index, end: m.index + m[0].length });
                if (m.index === re.lastIndex) re.lastIndex++;
            }
            return matches;
        }

        function wrapHighlightRange(startPoint, endPoint, highlightClass) {
            // startPoint = { node, offset }, endPoint = { node, offset } (inclusive/exclusive)
            if (!startPoint?.node || !endPoint?.node) return null;

            const range = document.createRange();
            try {
                range.setStart(startPoint.node, startPoint.offset);
                range.setEnd(endPoint.node, endPoint.offset);
            } catch (e) {
                // Si hay algún problema con offsets fuera de rango, abortamos este match
                return null;
            }

            // Evitar rodear nada vacío
            if (range.collapsed) return null;

            const span = document.createElement('span');
            span.className = highlightClass;

            // surroundContents puede fallar si el range abarca nodos no-texto parcialmente.
            // Estrategia: extraer el contenido y reinsertarlo envuelto.
            const frag = range.extractContents();
            span.appendChild(frag);
            range.insertNode(span);
            range.detach();
            return span;
        }

        function toRealPoint(map, normIndex, forward) {
            // Avanza o retrocede desde normIndex hasta encontrar una posición real (no sintética)
            let i = normIndex;
            while (i >= 0 && i < map.length) {
                const entry = map[i];
                if (entry && entry.node) return { node: entry.node, offset: entry.offset };
                i += forward ? 1 : -1;
            }
            return null;
        }

        /**
         * Muestra archivo PowerPoint usando pptxjs desde un File object (CORREGIDO)
         * @param {File} file - El archivo PowerPoint (File object)
         * @param {string} fileName - Nombre del archivo PowerPoint
         * @param {string} searchQuery - Texto a buscar y resaltar
         * @param {number} slide - Número de diapositiva
         * @public
         */
        FileDropzone.prototype.showPowerPointInSplitViewFromFile = function(file, fileName, searchQuery, slide) {
            searchQuery = searchQuery || "";
            slide = slide || 1;
            var self = this;

            if (!file) {
                console.error('❌ No file provided');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'File not found',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            console.log('📊 Opening PowerPoint:', {
                fileName: file.name,
                searchQuery: searchQuery,
                slide: slide
            });

            if (typeof $ === 'undefined' || typeof $.fn.pptxToHtml === 'undefined') {
                console.error('❌ pptxjs library not loaded');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'PowerPoint viewer not available',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            // 🔥 FORZAR JSZIP 2.x TEMPORALMENTE
            var originalJSZip = window.JSZip;
            if (typeof window.JSZipV2 !== 'undefined') {
                window.JSZip = window.JSZipV2;
                console.log('🔄 Forced JSZip 2.x for PowerPoint rendering');
            }

            var reader = new FileReader();

            reader.onload = function(e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                });
                var blobUrl = URL.createObjectURL(blob);

                var viewerId = 'pptx-viewer-' + Date.now();
                var containerId = viewerId + '-container';
                var contentId = viewerId + '-content';

                var html = `
    <style>
        #${containerId} {
            width: 100%;
            height: 98vh;
            background: #1e1e1e;
            overflow: auto;
            position: relative;
        }
        
        #${contentId} {
            width: 100%;
            height: 100%;
        }
        
        /* Estilos para las diapositivas */
        #${contentId} .slide {
            background: white;
            margin: 20px auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            max-width: 960px;
            position: relative;
        }
        
        /* Numeración de diapositivas */
        #${contentId} .slide::before {
            content: "Slide " attr(data-slide-number);
            position: absolute;
            top: 10px;
            right: 20px;
            background: rgba(0,0,0,0.6);
            color: white;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            z-index: 10;
        }
        
        /* Resaltado de búsqueda - ESTILO PDF.js */
        #${contentId} .pptx-highlight {
            background-color: rgba(180, 220, 255, 0.4) !important;
            padding: 2px 4px;
            border-radius: 2px;
            display: inline;
            box-shadow: 0 0 3px rgba(180, 220, 255, 0.8);
        }
        
        #${contentId} .pptx-highlight.current {
            background-color: rgba(255, 150, 0, 0.6) !important;
            font-weight: bold;
            box-shadow: 0 0 8px rgba(255, 152, 0, 0.9);
        }
        
        .pptx-loader {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: white;
            z-index: 1000;
        }
    </style>
    
    <div id="${containerId}">
        <div class="pptx-loader">
            <i class="fa fa-spinner fa-spin" style="font-size: 48px;"></i>
            <p style="margin-top: 20px;">Loading presentation...</p>
        </div>
        <div id="${contentId}"></div>
    </div>
`;

                $("#close-secundary").unbind('click').bind('click', function() {
                    URL.revokeObjectURL(blobUrl);
                    window.JSZip = originalJSZip; // 🔥 RESTAURAR
                    app.splitView.close();
                    setTimeout(function() {
                        if (typeof setDynamicHeight === 'function') {
                            setDynamicHeight();
                        }
                    }, 500);
                });

                $("#secundary-title").find('.title').text(fileName);
                app.splitView.open(html, {isHtml: true, pageTitle: fileName});

                setTimeout(function() {
                    var content = document.getElementById(contentId);
                    var container = document.getElementById(containerId);
                    var loader = container ? container.querySelector('.pptx-loader') : null;

                    if (!content || !container) {
                        console.error('❌ Container not found');
                        window.JSZip = originalJSZip;
                        return;
                    }

                    try {
                        console.log('📊 JSZip version before pptxToHtml:', typeof JSZip, JSZip.version || 'v2.x');

                        $(content).pptxToHtml({
                            pptxFileUrl: blobUrl,
                            slidesScale: "100%",
                            slideMode: false,
                            keyBoardShortCut: false,
                            mediaProcess: true,
                            slideModeConfig: {
                                first: 1,
                                nav: false,
                                showPlayPauseBtn: false,
                                keyBoardShortCut: false,
                                showSlideNum: true,
                                showTotalSlideNum: true,
                                autoSlide: false,
                                loop: false,
                                background: "#1e1e1e"
                            }
                        });

                        // Esperar MUCHO más tiempo para que pptxjs termine completamente
                        setTimeout(function() {
                            if (loader) loader.remove();

                            // Verificar que el contenido se renderizó
                            if (!content || !content.querySelector('.slide')) {
                                console.warn('⚠️ No slides found yet, waiting more...');

                                setTimeout(function() {
                                    processSlides();
                                }, 2000);
                            } else {
                                processSlides();
                            }

                        }, 2000); // Aumentado de 1500 a 2000

                    } catch (error) {
                        console.error('❌ Error rendering PowerPoint:', error);
                        window.JSZip = originalJSZip;

                        if (loader) {
                            loader.innerHTML =
                                '<i class="fa fa-exclamation-triangle" style="font-size:48px; color:#f44336;"></i>' +
                                '<p style="color:#f44336; margin-top:20px;">Error: ' + error.message + '</p>';
                        }
                    }
                }, 100);

                // Función para procesar diapositivas una vez renderizadas
                function processSlides() {
                    var content = document.getElementById(contentId);
                    var container = document.getElementById(containerId);

                    if (!content || !container) {
                        console.error('❌ Containers disappeared');
                        return;
                    }

                    // Numerar diapositivas
                    var slides = content.querySelectorAll('.slide');
                    console.log(`📊 Found ${slides.length} slides`);

                    if (slides.length === 0) {
                        console.warn('⚠️ Still no slides found');
                        return;
                    }

                    slides.forEach(function(slideElement, index) {
                        slideElement.setAttribute('data-slide-number', index + 1);
                        slideElement.setAttribute('data-slide-index', index + 1);
                    });

                    // 🔥 RESTAURAR JSZIP
                    setTimeout(function() {
                        window.JSZip = originalJSZip;
                        console.log('✅ JSZip restored to v3');
                    }, 500);

                    // Ir a la diapositiva especificada
                    if (slide > 1) {
                        setTimeout(function() {
                            goToSlide(slide);
                        }, 300);
                    }

                    // Realizar búsqueda si hay query
                    if (searchQuery && searchQuery.trim() !== '') {
                        setTimeout(function() {
                            performSearch(searchQuery);
                        }, 600);
                    }

                    console.log('✅ PowerPoint rendered successfully');
                }

                // Función para ir a una diapositiva específica
                function goToSlide(slideNum) {
                    slideNum = parseInt(slideNum);

                    var targetSlide = document.querySelector(`.slide[data-slide-index="${slideNum}"]`);
                    if (targetSlide) {
                        console.log(`📍 Navigating to slide ${slideNum}`);
                        targetSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                        console.warn(`⚠️ Slide ${slideNum} not found`);
                    }
                }
                function performSearch(query) {
                    if (!query || !query.trim()) return;

                    console.log(`🔍 Searching for: "${query}"`);
                    const content = document.getElementById(contentId);
                    if (!content) {
                        console.error('❌ Content container not found for search');
                        return;
                    }

                    // Limpia resaltados previos
                    Array.from(content.querySelectorAll('.pptx-highlight')).forEach(el => {
                        const parent = el.parentNode;
                        while (el.firstChild) parent.insertBefore(el.firstChild, el);
                        parent.removeChild(el);
                        parent.normalize(); // fusiona text nodes adyacentes
                    });

                    // Construimos índice de texto normalizado con mapeo a nodos reales
                    const { fullTextNorm, map } = buildTextIndex(content);
                    const normDoc = normalizeForSearch(fullTextNorm);
                    const normQuery = normalizeForSearch(query);

                    // Buscar matches (espacios del query = \s+)
                    const matches = findMatches(normDoc, normQuery);
                    console.log(`✅ Found ${matches.length} matches`);

                    const createdHighlights = [];

                    matches.forEach(({ start, end }) => {
                        // Convertimos los índices normalizados a puntos reales en el DOM
                        // startPoint → primer índice real >= start
                        // endPoint   → último índice real < end, así que usamos end-1 y avanzamos 1 en offset
                        const startPoint = toRealPoint(map, start, true);
                        const endRealPoint = toRealPoint(map, end - 1, false);

                        if (!startPoint || !endRealPoint) return;

                        // Ajustar endPoint a offset exclusivo (sumar 1 carácter en ese text node)
                        const endPoint = { node: endRealPoint.node, offset: endRealPoint.offset + 1 };

                        const span = wrapHighlightRange(startPoint, endPoint, 'pptx-highlight');
                        if (span) createdHighlights.push(span);
                    });

                    // Marcar el primero y hacer scroll
                    if (createdHighlights.length > 0) {
                        createdHighlights[0].classList.add('current');
                        setTimeout(() => {
                            createdHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                        }, 150);
                    } else {
                        console.warn('⚠️ No matches found for:', query);
                    }
                }



                function getTextNodes(element) {
                    if (!element || !element.nodeType) {
                        console.error('❌ Invalid element passed to getTextNodes');
                        return [];
                    }

                    var textNodes = [];

                    try {
                        var walker = document.createTreeWalker(
                            element,
                            NodeFilter.SHOW_TEXT,
                            {
                                acceptNode: function(node) {
                                    // Solo aceptar nodos con texto no vacío
                                    if (node.textContent && node.textContent.trim()) {
                                        return NodeFilter.FILTER_ACCEPT;
                                    }
                                    return NodeFilter.FILTER_SKIP;
                                }
                            },
                            false
                        );

                        var node;
                        while (node = walker.nextNode()) {
                            textNodes.push(node);
                        }
                    } catch (error) {
                        console.error('❌ Error in getTextNodes:', error);
                    }

                    return textNodes;
                }

                function escapeRegex(str) {
                    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }
            };

            reader.onerror = function() {
                console.error('❌ Error reading PowerPoint file');
                window.JSZip = originalJSZip;

                if (self.options.framework7) {
                    self.options.framework7.toast.show({
                        text: 'Error reading file',
                        cssClass: 'color-red'
                    });
                }
            };

            reader.readAsArrayBuffer(file);
        };

        /**
         * Versión simplificada desde uploadedFiles
         */
        FileDropzone.prototype.showPowerPointInSplitView = function(fileName, searchQuery, slide) {
            var self = this;

            var pptFile = this.uploadedFiles.find(function(file) {
                return file.name === fileName && self._getFileType(file) === 'ppt';
            });

            if (!pptFile) {
                console.error('❌ PowerPoint file not found:', fileName);
                return;
            }

            this.showPowerPointInSplitViewFromFile(pptFile, fileName, searchQuery, slide);
        };
        /**
         * Versión simplificada desde uploadedFiles
         */
        FileDropzone.prototype.showWordInSplitViewFromFile = function(file, fileName, searchQuery, page) {
            searchQuery = searchQuery || "";
            page = page || 1;
            var self = this;

            if (!file) {
                console.error('❌ No file provided');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'File not found',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            console.log('📄 Opening Word:', fileName);

            if (typeof docx === 'undefined') {
                console.error('❌ docx-preview library not loaded');
                if (this.options.framework7) {
                    this.options.framework7.toast.show({
                        text: 'Document viewer not available',
                        cssClass: 'color-red'
                    });
                }
                return;
            }

            var reader = new FileReader();

            reader.onload = function(e) {
                var arrayBuffer = e.target.result;
                var blob = new Blob([arrayBuffer], {
                    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });

                var viewerId = 'word-viewer-' + Date.now();
                var html = `
             <style>
        #${viewerId}-container {
            width: 100%;
            height: 98vh;
            overflow: auto;
            background: #525659;
            position: relative;
        }
        
        /* Resaltado de búsqueda - ESTILO PDF.js */
        .word-highlight {
            background-color: rgba(180, 220, 255, 0.4) !important;
            padding: 2px 4px;
            border-radius: 2px;
            display: inline;
            box-shadow: 0 0 3px rgba(180, 220, 255, 0.8);
        }
        
        .word-highlight.current {
            background-color: rgba(255, 150, 0, 0.6) !important;
            font-weight: bold;
            box-shadow: 0 0 8px rgba(255, 152, 0, 0.9);
        }
        
        .word-loader {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: white;
            z-index: 1000;
        }
    </style>
            
            <div id="${viewerId}-container">
                <div class="word-loader">
                    <i class="fa fa-spinner fa-spin" style="font-size: 48px;"></i>
                    <p style="margin-top: 20px;">Loading document...</p>
                </div>
            </div>
        `;

                $("#close-secundary").unbind('click').bind('click', function() {
                    app.splitView.close();
                    setTimeout(function() {
                        if (typeof setDynamicHeight === 'function') {
                            setDynamicHeight();
                        }
                    }, 500);
                });

                $("#secundary-title").find('.title').text(fileName);
                app.splitView.open(html, {isHtml: true, pageTitle: fileName,
                    onRendered: function() {
                        var container = document.getElementById(viewerId + '-container');
                        if (!container) {
                            return;
                        }

// Ahora sí, usar container sabiendo que existe
                        var loader = container.querySelector('.word-loader');

                        try {
                            docx.renderAsync(blob, container, null, {
                                className: "docx",
                                inWrapper: true,
                                ignoreWidth: false,
                                ignoreHeight: false,
                                ignoreFonts: false,
                                breakPages: true,
                                ignoreLastRenderedPageBreak: false,
                                experimental: true,
                                trimXmlDeclaration: true,
                                useBase64URL: false,
                                renderChanges: false,
                                renderHeaders: true,
                                renderFooters: true,
                                renderFootnotes: true,
                                renderEndnotes: true,
                                debug: false
                            }).then(function(result) {
                                console.log('✅ Word document rendered successfully', result);

                                if (loader) loader.remove();

                                var pages = container.querySelectorAll('section[class*="page"]');
                                console.log(`📄 Found ${pages.length} page sections`);

                                if (page > 1 && pages.length > 0) {
                                    setTimeout(function() {
                                        var targetPage = pages[page - 1];
                                        if (targetPage) {
                                            targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            console.log(`📍 Navigated to page ${page}`);
                                        } else {
                                            var scrollPosition = (page - 1) * 1056;
                                            container.scrollTop = scrollPosition;
                                            console.log(`📍 Scrolled to approximate page ${page}`);
                                        }
                                    }, 300);
                                }

                                if (searchQuery && searchQuery.trim() !== '') {
                                    setTimeout(function() {
                                        performSearch(searchQuery,page);
                                    }, 500);
                                }

                            }).catch(function(error) {
                                console.error('❌ Error rendering Word:', error);
                                if (loader) {
                                    loader.innerHTML =
                                        '<i class="fa fa-exclamation-triangle" style="font-size:48px; color:#f44336;"></i>' +
                                        '<p style="color:#f44336; margin-top:20px;">Error: ' + error.message + '</p>';
                                }
                            });

                        } catch (error) {
                            console.error('❌ Exception:', error);
                            if (loader) {
                                loader.innerHTML =
                                    '<i class="fa fa-exclamation-triangle" style="font-size:48px; color:#f44336;"></i>' +
                                    '<p style="color:#f44336; margin-top:20px;">Error: ' + error.message + '</p>';
                            }
                        }
                }
                });


                function performSearch(query, pageNumber) {
                    if (!query || !query.trim()) return;

                    console.log('🔍 ========== SEARCH DEBUG START ==========');
                    console.log('Query:', query);
                    console.log('Query length:', query.length);

                    const container = document.getElementById(viewerId + '-container');
                    if (!container) {
                        console.error('❌ Container not found for search');
                        return;
                    }

                    const root = container.querySelector('.docx-wrapper') || container;
                    console.log('Root element:', root);

                    // Limpiar resaltados previos
                    Array.from(root.querySelectorAll('.word-highlight')).forEach(el => {
                        const parent = el.parentNode;
                        while (el.firstChild) parent.insertBefore(el.firstChild, el);
                        parent.removeChild(el);
                        parent.normalize();
                    });

                    console.log('🔨 Building text index...');
                    const { fullTextNorm, map } = buildTextIndex(root);

                    console.log('📊 Normalized text length:', fullTextNorm.length);
                    console.log('📊 First 500 chars:', fullTextNorm.substring(0, 500));
                    console.log('📊 Map entries:', map.length);

                    // 🔥 BÚSQUEDA MANUAL para debug
                    const queryLower = query.toLowerCase();
                    const textLower = fullTextNorm.toLowerCase();
                    const manualIndex = textLower.indexOf(queryLower);

                    console.log('🔍 Manual search result:');
                    console.log('  - Query (lowercase):', queryLower);
                    console.log('  - Found at index:', manualIndex);
                    if (manualIndex >= 0) {
                        console.log('  - Context:', textLower.substring(Math.max(0, manualIndex - 20), manualIndex + queryLower.length + 20));
                    }

                    console.log('🔨 Running regex search...');
                    const matches = findMatches(fullTextNorm, query);

                    console.log('✅ Regex matches found:', matches.length);
                    matches.forEach((match, i) => {
                        console.log(`  Match ${i + 1}:`, match);
                        console.log(`    Text: "${fullTextNorm.substring(match.start, match.end)}"`);
                    });

                    const createdHighlights = [];

                    matches.forEach(({ start, end }, matchIndex) => {
                        console.log(`\n🎯 Processing match ${matchIndex + 1}: [${start}, ${end}]`);
                        const highlights = highlightMatchAcrossNodes(map, start, end, root);
                        console.log(`  Created ${highlights.length} highlight spans`);
                        createdHighlights.push(...highlights);
                    });

                    console.log(`\n✅ Total highlights created: ${createdHighlights.length}`);
                    console.log('🔍 ========== SEARCH DEBUG END ==========\n');

                    // Scroll al primer match
                    if (createdHighlights.length > 0) {
                        createdHighlights[0].classList.add('current');
                        setTimeout(() => {
                            createdHighlights[0].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                                inline: 'nearest'
                            });
                        }, 150);
                    } else {
                        console.warn('⚠️ No highlights created for query:', query);

                        // Fallback: scroll a la página
                        if (pageNumber && pageNumber > 0) {
                            const pages = container.querySelectorAll('section[class*="page"]');
                            if (pages.length > 0) {
                                const targetPage = pages[pageNumber - 1];
                                if (targetPage) {
                                    targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }
                    }
                }

// También añadir logging a buildTextIndex
                function buildTextIndex(rootEl) {
                    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
                        acceptNode(n) {
                            const t = n.textContent;
                            if (!t || !t.trim()) return NodeFilter.FILTER_SKIP;
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    });

                    const map = [];
                    let fullTextNorm = '';
                    let prevNode = null;
                    let prevEndedWithSpace = true;
                    let nodeCount = 0;

                    let current;
                    while ((current = walker.nextNode())) {
                        nodeCount++;
                        const raw = current.textContent;
                        const cleaned = raw.replace(/\u00AD/g, '').replace(/\u00A0/g, ' ');

                        console.log(`  Node ${nodeCount}: "${raw}" → "${cleaned}"`);

                        const beginsWithSpace = /^\s/.test(cleaned);

                        if (!prevEndedWithSpace && !beginsWithSpace && prevNode) {
                            if (shouldAddSyntheticSpace(prevNode, current)) {
                                console.log(`    → Adding synthetic space`);
                                fullTextNorm += ' ';
                                map.push({ node: null, offset: 0, synthetic: true });
                            }
                        }

                        let i = 0;
                        while (i < cleaned.length) {
                            if (/\s/.test(cleaned[i])) {
                                if (fullTextNorm.length === 0 || fullTextNorm[fullTextNorm.length - 1] !== ' ') {
                                    fullTextNorm += ' ';
                                    map.push({ node: current, offset: i });
                                }
                                while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
                                continue;
                            }
                            fullTextNorm += cleaned[i];
                            map.push({ node: current, offset: i });
                            i++;
                        }

                        prevNode = current;
                        prevEndedWithSpace = fullTextNorm.length === 0 ? true : (fullTextNorm[fullTextNorm.length - 1] === ' ');
                    }

                    console.log(`📊 Processed ${nodeCount} text nodes`);

                    if (fullTextNorm.endsWith(' ')) {
                        fullTextNorm = fullTextNorm.slice(0, -1);
                        if (map.length && (map[map.length - 1].node === null)) {
                            map.pop();
                        }
                    }

                    return { fullTextNorm, map };
                }

// 🔥 NUEVA FUNCIÓN: Resalta un match agrupando nodos contiguos
                function highlightMatchAcrossNodes(map, start, end, root) {
                    const highlights = [];

                    // Obtener todos los nodos involucrados en el match
                    const nodesInMatch = [];

                    for (let i = start; i < end && i < map.length; i++) {
                        const entry = map[i];
                        if (entry && entry.node && !entry.synthetic) {
                            // Verificar si este nodo ya está en la lista
                            const lastNode = nodesInMatch[nodesInMatch.length - 1];
                            if (!lastNode || lastNode.node !== entry.node) {
                                nodesInMatch.push({
                                    node: entry.node,
                                    startOffset: entry.offset,
                                    endOffset: entry.offset + 1
                                });
                            } else {
                                // Extender el rango del nodo actual
                                lastNode.endOffset = entry.offset + 1;
                            }
                        }
                    }

                    console.log(`📍 Match spans ${nodesInMatch.length} text nodes`);

                    // Resaltar cada nodo individualmente
                    nodesInMatch.forEach(({ node, startOffset, endOffset }) => {
                        try {
                            const range = document.createRange();

                            // Ajustar offsets para no exceder el contenido del nodo
                            const maxOffset = node.textContent.length;
                            const safeStart = Math.min(startOffset, maxOffset);
                            const safeEnd = Math.min(endOffset, maxOffset);

                            if (safeStart >= safeEnd) return; // Skip si no hay contenido

                            range.setStart(node, safeStart);
                            range.setEnd(node, safeEnd);

                            if (range.collapsed) return; // Skip si está vacío

                            const span = document.createElement('span');
                            span.className = 'word-highlight';

                            const fragment = range.extractContents();
                            span.appendChild(fragment);
                            range.insertNode(span);

                            highlights.push(span);

                            console.log(`✅ Highlighted in node: "${node.textContent.substring(safeStart, safeEnd)}"`);
                        } catch (error) {
                            console.warn(`⚠️ Could not highlight node:`, error);
                        }
                    });

                    return highlights;
                }

                function performSearch(query, pageNumber) {
                    if (!query || !query.trim()) return;

                    console.log('🔍 ========== SEARCH DEBUG START ==========');
                    console.log('Query:', query);
                    console.log('Query length:', query.length);

                    const container = document.getElementById(viewerId + '-container');
                    if (!container) {
                        console.error('❌ Container not found for search');
                        return;
                    }

                    const root = container.querySelector('.docx-wrapper') || container;
                    console.log('Root element:', root);

                    // Limpiar resaltados previos
                    Array.from(root.querySelectorAll('.word-highlight')).forEach(el => {
                        const parent = el.parentNode;
                        while (el.firstChild) parent.insertBefore(el.firstChild, el);
                        parent.removeChild(el);
                        parent.normalize();
                    });

                    console.log('🔨 Building text index...');
                    const { fullTextNorm, map } = buildTextIndex(root);

                    console.log('📊 Normalized text length:', fullTextNorm.length);
                    console.log('📊 First 500 chars:', fullTextNorm.substring(0, 500));
                    console.log('📊 Map entries:', map.length);

                    // 🔥 BÚSQUEDA MANUAL para debug
                    const queryLower = query.toLowerCase();
                    const textLower = fullTextNorm.toLowerCase();
                    const manualIndex = textLower.indexOf(queryLower);

                    console.log('🔍 Manual search result:');
                    console.log('  - Query (lowercase):', queryLower);
                    console.log('  - Found at index:', manualIndex);
                    if (manualIndex >= 0) {
                        console.log('  - Context:', textLower.substring(Math.max(0, manualIndex - 20), manualIndex + queryLower.length + 20));
                    }

                    console.log('🔨 Running regex search...');
                    const matches = findMatches(fullTextNorm, query);

                    console.log('✅ Regex matches found:', matches.length);
                    matches.forEach((match, i) => {
                        console.log(`  Match ${i + 1}:`, match);
                        console.log(`    Text: "${fullTextNorm.substring(match.start, match.end)}"`);
                    });

                    const createdHighlights = [];

                    matches.forEach(({ start, end }, matchIndex) => {
                        console.log(`\n🎯 Processing match ${matchIndex + 1}: [${start}, ${end}]`);
                        const highlights = highlightMatchAcrossNodes(map, start, end, root);
                        console.log(`  Created ${highlights.length} highlight spans`);
                        createdHighlights.push(...highlights);
                    });

                    console.log(`\n✅ Total highlights created: ${createdHighlights.length}`);
                    console.log('🔍 ========== SEARCH DEBUG END ==========\n');

                    // Scroll al primer match
                    if (createdHighlights.length > 0) {
                        createdHighlights[0].classList.add('current');
                        setTimeout(() => {
                            createdHighlights[0].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                                inline: 'nearest'
                            });
                        }, 150);
                    } else {
                        console.warn('⚠️ No highlights created for query:', query);

                        // Fallback: scroll a la página
                        if (pageNumber && pageNumber > 0) {
                            const pages = container.querySelectorAll('section[class*="page"]');
                            if (pages.length > 0) {
                                const targetPage = pages[pageNumber - 1];
                                if (targetPage) {
                                    targetPage.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        }
                    }
                }

// También añadir logging a buildTextIndex
                function buildTextIndex(rootEl) {
                    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
                        acceptNode(n) {
                            const t = n.textContent;
                            if (!t) return NodeFilter.FILTER_SKIP;
                            // 🔥 Aceptar también nodos con solo espacios
                            return NodeFilter.FILTER_ACCEPT;
                        }
                    });

                    const map = [];
                    let fullTextNorm = '';
                    let prevNode = null;
                    let prevEndedWithSpace = true;
                    let nodeCount = 0;

                    let current;
                    while ((current = walker.nextNode())) {
                        nodeCount++;
                        const raw = current.textContent;
                        const cleaned = raw.replace(/\u00AD/g, '').replace(/\u00A0/g, ' ');

                        console.log(`  Node ${nodeCount}: "${raw}" → "${cleaned}"`);

                        const beginsWithSpace = /^\s/.test(cleaned);

                        if (!prevEndedWithSpace && !beginsWithSpace && prevNode) {
                            if (shouldAddSyntheticSpace(prevNode, current)) {
                                console.log(`    → Adding synthetic space`);
                                fullTextNorm += ' ';
                                map.push({ node: null, offset: 0, synthetic: true });
                            }
                        }

                        let i = 0;
                        while (i < cleaned.length) {
                            if (/\s/.test(cleaned[i])) {
                                if (fullTextNorm.length === 0 || fullTextNorm[fullTextNorm.length - 1] !== ' ') {
                                    fullTextNorm += ' ';
                                    map.push({ node: current, offset: i });
                                }
                                while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
                                continue;
                            }
                            fullTextNorm += cleaned[i];
                            map.push({ node: current, offset: i });
                            i++;
                        }

                        prevNode = current;
                        prevEndedWithSpace = fullTextNorm.length === 0 ? true : (fullTextNorm[fullTextNorm.length - 1] === ' ');
                    }

                    console.log(`📊 Processed ${nodeCount} text nodes`);

                    if (fullTextNorm.endsWith(' ')) {
                        fullTextNorm = fullTextNorm.slice(0, -1);
                        if (map.length && (map[map.length - 1].node === null)) {
                            map.pop();
                        }
                    }

                    return { fullTextNorm, map };
                }

                function shouldAddSyntheticSpace(prevNode, currentNode) {
                    if (!prevNode || !currentNode) return false;

                    const currentText = currentNode.textContent;

                    // 🔥 No añadir espacio si el nodo actual empieza con puntuación
                    if (currentText && /^[\s:;,.\-—–!?¿¡()[\]{}"""''«»]/.test(currentText)) {
                        return false;
                    }

                    const prevParent = prevNode.parentElement;
                    const currentParent = currentNode.parentElement;

                    // 🔥 Si tienen el mismo padre (hermanos)
                    if (prevParent === currentParent) {
                        let nextSibling = prevNode.nextSibling;

                        // Saltar nodos vacíos/whitespace
                        while (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && !nextSibling.textContent.trim()) {
                            nextSibling = nextSibling.nextSibling;
                        }

                        // Si son hermanos consecutivos, NO añadir espacio
                        if (nextSibling === currentNode || nextSibling === currentParent) {
                            return false;
                        }

                        // 🔥 NUEVA REGLA: Si el nodo actual es muy corto (1-2 chars),
                        // probablemente es parte de una palabra (como "3" en "TASMO3")
                        if (currentText && currentText.trim().length <= 2 && !/^\s/.test(currentText)) {
                            return false;
                        }
                    }

                    // Lista de elementos de bloque
                    const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'SECTION', 'ARTICLE'];

                    if (blockElements.includes(prevParent?.tagName) || blockElements.includes(currentParent?.tagName)) {
                        return prevParent !== currentParent;
                    }

                    return prevParent !== currentParent;
                }

                function findMatches(fullTextNorm, query) {
                    const pattern = escapeRegex(query).replace(/\s+/g, '\\s+');
                    const re = new RegExp(pattern, 'gi');
                    const matches = [];
                    let m;
                    while ((m = re.exec(fullTextNorm)) !== null) {
                        matches.push({ start: m.index, end: m.index + m[0].length });
                        if (m.index === re.lastIndex) re.lastIndex++;
                    }
                    return matches;
                }

                function wrapHighlightRange(startPoint, endPoint, highlightClass) {
                    if (!startPoint?.node || !endPoint?.node) return null;

                    const range = document.createRange();
                    try {
                        range.setStart(startPoint.node, startPoint.offset);
                        range.setEnd(endPoint.node, endPoint.offset);
                    } catch (e) {
                        return null;
                    }

                    if (range.collapsed) return null;

                    const span = document.createElement('span');
                    span.className = highlightClass;

                    const frag = range.extractContents();
                    span.appendChild(frag);
                    range.insertNode(span);
                    range.detach();
                    return span;
                }

                function toRealPoint(map, normIndex, forward) {
                    let i = normIndex;
                    while (i >= 0 && i < map.length) {
                        const entry = map[i];
                        if (entry && entry.node) return { node: entry.node, offset: entry.offset };
                        i += forward ? 1 : -1;
                    }
                    return null;
                }

                function escapeRegex(str) {
                    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                }
            };

            reader.onerror = function() {
                console.error('❌ Error reading Word file');
                if (self.options.framework7) {
                    self.options.framework7.toast.show({
                        text: 'Error reading file',
                        cssClass: 'color-red'
                    });
                }
            };

            reader.readAsArrayBuffer(file);
        };

        /**
         * Versión simplificada desde uploadedFiles
         */
        FileDropzone.prototype.showWordInSplitView = function(fileName, searchQuery, page) {
            var self = this;

            var wordFile = this.uploadedFiles.find(function(file) {
                return file.name === fileName && self._getFileType(file) === 'word';
            });

            if (!wordFile) {
                console.error('❌ Word file not found:', fileName);
                return;
            }

            this.showWordInSplitViewFromFile(wordFile, fileName, searchQuery, page);
        };  /**

        /**
         * Gets the file type based on its extension and MIME type
         * @param {File} file - The file to analyze
         * @returns {string} - The identified file type
         * @private
         */
        FileDropzone.prototype._getFileType = function (file) {
            // First check the file extension
            var extension = file.name.split('.').pop().toLowerCase();

            // Known extensions
            if (['doc', 'docx'].includes(extension)) return 'word';
            if (['xls', 'xlsx', 'xlsm', 'csv'].includes(extension)) return 'excel';
            if (['ppt', 'pptx', 'pps', 'ppsx'].includes(extension)) return 'ppt';
            if (extension === 'pdf') return 'pdf';

            // Text-based file types - all these are handled as plain text with specialized viewing
            if (['txt', 'text', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'xml', 'stask',
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
        FileDropzone.prototype._extractTextFromTextFile = function (file, callback) {
            var reader = new FileReader();

            reader.onload = function (e) {
                var text = e.target.result;
                callback(text);
            };

            reader.onerror = function () {
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
        FileDropzone.prototype._extractTextFromFile = function (file, fileType) {
            var self = this;

            // Create a timeout for extraction
            var extractionTimeout = setTimeout(function () {
                console.warn("Extraction timeout for", file.name);
                self.updateFileWithExtractedContent(file.name, "Error: extraction timeout");
            }, this.options.extractionTimeout);

            if (fileType === 'text') {
                // Procesamiento genérico para todos los archivos de texto
                self._extractTextFromTextFile(file, function (text) {
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
            } else if (fileType === 'pdf') {
                // For PDF files, use pdf.js
                self._extractTextFromPdfFile(file, function (text) {
                    clearTimeout(extractionTimeout);
                    self.updateFileWithExtractedContent(file.name, text);

                    // Call the onTextExtracted callback if it exists
                    if (typeof self.options.onTextExtracted === 'function') {
                        self.options.onTextExtracted(file, text);
                    }
                });
            } else if (fileType === 'ppt') {
                // For PowerPoint files
                self.extractTextFromPowerPoint(file, fileType, function (text) {
                    clearTimeout(extractionTimeout);
                    // The callback is already called inside extractTextFromPowerPoint
                });
            } else if (fileType === 'word' || fileType === 'excel') {
                // For Office files, use the existing function
                self.extractTextFromOfficeFile(file, fileType, function (text) {
                    clearTimeout(extractionTimeout);
                    // The callback is already called inside extractTextFromOfficeFile
                });
            } else if (fileType === 'image') {
                // Verificar qué tipo de análisis usar
                if (this.options.imageAnalysisType === 'OCR') {
                    // Usar OCR (Tesseract)
                    self.extractTextFromImage(file, function (text) {
                        clearTimeout(extractionTimeout);
                        self.updateFileWithExtractedContent(file.name, text);

                        if (typeof self.options.onTextExtracted === 'function') {
                            self.options.onTextExtracted(file, text);
                        }
                    });
                } else if (this.options.imageAnalysisType === 'Vision') {
                    // Marcar como pendiente para análisis de visión
                    clearTimeout(extractionTimeout);
                    self.updateFileWithExtractedContent(file.name, "pending_vision_analysis", false);

                    if (typeof self.options.onTextExtracted === 'function') {
                        self.options.onTextExtracted(file, "pending_vision_analysis");
                    }
                } else {
                    // No permitido, no hacer nada
                    clearTimeout(extractionTimeout);
                    self.updateFileWithExtractedContent(file.name, "Image analysis not allowed", true);
                }
                return;

            }
        };
        FileDropzone.prototype.updateImageAnalysisType = function (analysisType) {
            this.options.imageAnalysisType = analysisType;
            this.options.allowImages = analysisType !== null;

            console.log('Image analysis type updated to:', analysisType);
        };
        /**
         * Extracts text from an image using OCR
         * @param {File|Blob} file - The image to process
         * @param {Function} callback - Function to call when extraction is complete
         * @public
         */
        FileDropzone.prototype.extractTextFromImage = function (file, callback) {
            var self = this;

            // Check if Tesseract is available
            if (typeof Tesseract === 'undefined') {
                // If Tesseract is not available, load it dynamically
                self._loadTesseract(function () {
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
        FileDropzone.prototype._loadTesseract = function (callback) {
            // First load the main Tesseract script
            var script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
            script.onload = function () {
                console.log("Tesseract.js loaded successfully");
                callback();
            };
            script.onerror = function () {
                console.error("Error loading Tesseract.js from CDN");
                callback();
            };
            document.head.appendChild(script);
        };
        /**
         * Actualiza el tipo de análisis de imagen dinámicamente
         * @param {string|null} analysisType - 'OCR', 'Vision', o null
         * @public
         */
        FileDropzone.prototype.updateImageAnalysisType = function (analysisType) {
            var oldType = this.options.imageAnalysisType;

            this.options.imageAnalysisType = analysisType;
            this.options.allowImages = analysisType !== null;

            console.log('Image analysis type updated from', oldType, 'to', analysisType);

            // Actualizar allowedExtensions si es necesario
            if (analysisType === null) {
                // Remover extensiones de imagen de la lista permitida
                var imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
                this.options.allowedExtensions = this.options.allowedExtensions.filter(function (ext) {
                    return imageExtensions.indexOf(ext) === -1;
                });
            } else if (oldType === null && analysisType !== null) {
                // Reagregar extensiones de imagen si antes no estaban permitidas
                var imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
                imageExtensions.forEach(function (ext) {
                    if (this.options.allowedExtensions.indexOf(ext) === -1) {
                        this.options.allowedExtensions.push(ext);
                    }
                }, this);
            }
        };
        /**
         * Processes an image with Tesseract.js to extract text
         * @param {File|Blob} file - The image to process
         * @param {Function} callback - Function to call when processing is complete
         * @private
         */
        FileDropzone.prototype._processImageWithTesseract = function (file, callback) {
            // return false;
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
                    logger: function (data) {
                        console.log("OCR Process: " + data.status);
                    }
                }
            ).then(function (result) {
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

            }).catch(function (error) {
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
        FileDropzone.prototype.extractTextFromOfficeFile = function (file, fileType, callback) {
            var self = this;
            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                if (fileType === 'word' && typeof mammoth !== 'undefined') {
                    // Use Mammoth.js to extract text from DOCX files
                    mammoth.extractRawText({arrayBuffer: arrayBuffer})
                        .then(function (result) {
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
                        .catch(function (error) {
                            console.error("Error extracting text from DOCX:", error);
                            var errorMessage = "Error extracting text: " + error.message;
                            self.updateFileWithExtractedContent(file.name, errorMessage);

                            if (callback) callback(errorMessage);
                        });
                } else if (fileType === 'excel' && typeof XLSX !== 'undefined') {
                    // Use SheetJS to extract text from Excel files
                    try {
                        var workbook = XLSX.read(arrayBuffer, {
                            type: 'array',
                            cellDates: false,
                            cellStyles: true,
                            cellNF: true
                        });
                        var result = "";
                        var excelData = {}; // Store structured data for SQL queries

                        if (self.options.useSimbaDocumentTags) {
                            result = `<simba_document data-filename="${file.name}" data-page="1">\n`;
                        } else {
                            result = "--- Página 1 ---\n\n";
                        }

                        // Go through all sheets and extract their content in Markdown table format
                        workbook.SheetNames.forEach(function (sheetName) {
                            var worksheet = workbook.Sheets[sheetName];
                            var json = XLSX.utils.sheet_to_json(worksheet, {header: 1});
                            var jsonObjects = XLSX.utils.sheet_to_json(worksheet); // For SQL queries

                            // Store structured data for SQL queries
                            if (jsonObjects && jsonObjects.length > 0) {
                                excelData[sheetName] = jsonObjects;
                            }

                            if (json.length > 0) {
                                result += "## Sheet: " + sheetName + "\n\n";

                                // Calculate maximum width for each column
                                var columnWidths = [];
                                json.forEach(function (row) {
                                    row.forEach(function (cell, colIndex) {
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

                        // Store Excel data in file object for SQL queries
                        var fileIndex = self.uploadedFiles.findIndex(f => f.name === file.name);
                        if (fileIndex !== -1) {
                            self.uploadedFiles[fileIndex].excelData = excelData;
                        }

                        // Initialize SQL functionality if enabled
                        if (self.options.enableSqlQueries && !self.sqlReady) {
                            self._loadSqlJs();
                        } else if (self.sqlReady) {
                            // Create tables immediately if SQL is ready
                            Object.keys(excelData).forEach(function (sheetName) {
                                self._createTableFromExcelData(file.name, sheetName, excelData[sheetName]);
                            });
                        }

                        self.updateFileWithExtractedContent(file.name, result);

                        // Call the onTextExtracted callback if it exists
                        if (typeof self.options.onTextExtracted === 'function') {
                            self.options.onTextExtracted(file, result);
                        }

                        if (callback) callback(result);
                    } catch (error) {
                        console.error("Error extracting text from Excel:", error);
                        var errorMessage = "Error extracting text: " + error.message;
                        self.updateFileWithExtractedContent(file.name, errorMessage);

                        if (callback) callback(errorMessage);
                    }
                } else {
                    var errorMessage = "Cannot extract text: missing necessary library or unsupported file type";
                    console.warn(errorMessage);
                    self.updateFileWithExtractedContent(file.name, errorMessage);

                    if (callback) callback(errorMessage);
                }
            };

            reader.onerror = function () {
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
        FileDropzone.prototype._extractTextFromTxtFile = function (file, callback) {
            var reader = new FileReader();

            reader.onload = function (e) {
                var text = e.target.result;
                callback(text);
            };

            reader.onerror = function () {
                console.error("Error reading TXT file");
                callback("Error reading TXT file");
            };

            reader.readAsText(file);
        };
        FileDropzone.prototype._extractTextFromJsonFile = function (file, callback) {
            var reader = new FileReader();

            reader.onload = function (e) {
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

            reader.onerror = function () {
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
        FileDropzone.prototype._extractTextFromPdfFile = function (file, callback) {
            var self = this;

            // Check if pdf.js is available
            if (typeof pdfjsLib === 'undefined') {
                // Load pdf.js dynamically if it's not available
                self._loadPdfJS(function () {
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
        FileDropzone.prototype._extractPdfWithFallback = function (file, callback) {
            var self = this;
            var extractionAttempted = false;

            try {
                self._extractPdfTextWithPdfJS(file, function (result) {
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
        FileDropzone.prototype._checkForPrototypeIssues = function () {
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
        FileDropzone.prototype._loadPdfJS = function (callback) {
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js';
            script.onload = function () {
                // Configure worker
                if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
                    callback();
                } else {
                    console.error("Error loading pdf.js");
                    callback();
                }
            };
            script.onerror = function () {
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
        FileDropzone.prototype._extractPdfTextWithPdfJS = function (file, callback) {
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

            reader.onload = function (e) {
                var typedArray = new Uint8Array(e.target.result);

                // Load the PDF document
                pdfjsLib.getDocument(typedArray).promise.then(function (pdf) {
                    var numPages = pdf.numPages;
                    var countPromises = [];
                    var extractedText = "";

                    // For each page, extract the text
                    for (var i = 1; i <= numPages; i++) {
                        var currentPage = i;
                        countPromises.push(
                            pdf.getPage(currentPage).then(function (page) {
                                return page.getTextContent().then(function (textContent) {
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

                                    return {page: page.pageNumber, text: pageText};
                                });
                            })
                        );
                    }

                    // Combine the text from all pages
                    Promise.all(countPromises).then(function (pages) {
                        // Restore the random property if it was removed
                        if (hasRandomProp) {
                            Array.prototype.random = originalRandomProp;
                        }

                        // Sort the pages numerically
                        pages.sort(function (a, b) {
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
                    }).catch(function (error) {
                        // Restore the random property if it was removed
                        if (hasRandomProp) {
                            Array.prototype.random = originalRandomProp;
                        }

                        console.error("Error extracting text from PDF pages:", error);
                        callback("Error extracting text from PDF: " + error.message);
                    });
                }).catch(function (error) {
                    // Restore the random property if it was removed
                    if (hasRandomProp) {
                        Array.prototype.random = originalRandomProp;
                    }

                    console.error("Error opening PDF document:", error);
                    callback("Error opening PDF document: " + error.message);
                });
            };

            reader.onerror = function () {
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
        FileDropzone.prototype._extractPdfTextAlternative = function (file, callback) {
            var reader = new FileReader();
            var self = this;

            reader.onload = function (e) {
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

            reader.onerror = function () {
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
        FileDropzone.prototype.executeStaskContent = function (content, taskName) {
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
        FileDropzone.prototype.executeStaskFile = function (fileName) {
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
        FileDropzone.prototype.updateFileWithExtractedContent = function (fileName, content, isError) {
            var self = this;
            var fileIndex = this.uploadedFiles.findIndex(f => f.name === fileName);

            if (fileIndex !== -1) {
                // Add the extracted content to the file object
                this.uploadedFiles[fileIndex].extractedText = content;

                // Check if this is a completion message or a progress message
                var isProgressMessage = content.includes("Processing") || content.includes("Starting") || content === "pending_vision_analysis";

                // Update the UI to show that extraction has finished
                var fileItem = this.dropzone.querySelector(`.file-item[data-file-id="${fileName}"]`);
                if (fileItem) {
                    // SIEMPRE remover el indicador de extracción cuando no es un mensaje de progreso
                    if (!isProgressMessage) {
                        var extractingIndicator = fileItem.querySelector('.extracting-indicator');
                        if (extractingIndicator) {
                            extractingIndicator.remove();
                        }
                    }

                    // Find or create the container for action buttons
                    var actionsContainer = fileItem.querySelector('.file-actions');
                    if (!actionsContainer && !isProgressMessage) {
                        // Create container for action buttons
                        actionsContainer = document.createElement('div');
                        actionsContainer.className = 'file-actions';
                        actionsContainer.style.display = 'inline-flex';
                        actionsContainer.style.marginLeft = '5px';
                        fileItem.appendChild(actionsContainer);

                        var removeButton = document.createElement('span');
                        removeButton.className = 'remove-file link';
                        removeButton.setAttribute('data-filename', fileName);
                        removeButton.innerHTML = '<i class="fa fa-times" style="margin-left: 5px;  cursor: pointer;"></i>';
                        removeButton.setAttribute('title', 'Remove file');
                        removeButton.addEventListener('click', function (e) {
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
                        viewButton.addEventListener('click', function (e) {
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
                                editContent(content, 'editor_' + Date.now(), fileName, true, codeEditorExtensions[fileExtension]);
                            } else {
                                editContent(content.replace(/<simba_document[^>]*>([\s\S]*?)<\/simba_document>/g, '$1'), 'editor_' + Date.now(), fileName);
                            }
                        });

                        if (fileName.toLowerCase().endsWith('.stask')) {
                            var executeButton = document.createElement('span');
                            executeButton.className = 'execute-stask';
                            executeButton.innerHTML = '<i class="fa fa-play" style="margin-left: 5px; color: #4CAF50; cursor: pointer;"></i>';
                            executeButton.setAttribute('title', 'Execute task');
                            executeButton.addEventListener('click', function (e) {
                                e.stopPropagation();
                                self.executeStaskFile(fileName);
                            });
                            actionsContainer.appendChild(executeButton);
                        }

                        // Add the buttons to the container in the desired order
                        actionsContainer.appendChild(statusIndicator); // Status first
                        actionsContainer.appendChild(removeButton);      // Eye second

                        // Show a preview of the extracted text when hovering over the file
                        var previewText = content.substring(0, 200) + (content.length > 200 ? '...' : '');
                        fileItem.setAttribute('title', previewText);
                    }
                }

                // Check if all files have extracted text
                var allProcessed = this.uploadedFiles.every(function (file) {
                    // Lista de extensiones que necesitan extracción
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

                    return !needsExtraction || (file.extractedText !== undefined && file.extractedText !== "pending_vision_analysis");
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
        FileDropzone.prototype.showExtractedText = function (fileName, content) {
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
                            onClick: function () {
                                navigator.clipboard.writeText(content).then(function () {
                                    // Use self instead of this inside this function
                                    self.options.framework7.toast.show({
                                        text: 'Text copied to clipboard',
                                        position: 'center',
                                        closeTimeout: 2000,
                                    });
                                }).catch(function (err) {
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
        FileDropzone.prototype.removeFile = function (filename) {
            var fileIndex = this.uploadedFiles.findIndex(f => f.name === filename);

            if (fileIndex !== -1) {
                var removedFile = this.uploadedFiles[fileIndex];

                // Remove from the uploaded files array
                this.uploadedFiles.splice(fileIndex, 1);

                // Remove preview item - VERSIÓN CORREGIDA
                var fileItems = this.dropzone.querySelectorAll('.file-item');
                fileItems.forEach(function (item) {
                    // Verificar por data-file-id primero
                    var fileId = item.getAttribute('data-file-id');
                    if (fileId === filename) {
                        // Limpiar URL de imagen si existe
                        var imageUrl = item.getAttribute('data-image-url');
                        if (imageUrl) {
                            URL.revokeObjectURL(imageUrl);
                        }
                        item.remove();
                        return;
                    }

                    // Fallback: buscar por .file-name si existe
                    var fileNameElement = item.querySelector('.file-name');
                    if (fileNameElement && fileNameElement.textContent === filename) {
                        // Limpiar URL de imagen si existe
                        var imageUrl = item.getAttribute('data-image-url');
                        if (imageUrl) {
                            URL.revokeObjectURL(imageUrl);
                        }
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

                console.log('File removed successfully:', filename);
            } else {
                console.warn('File not found for removal:', filename);
            }
            this._updateFileCounter();

        };

        /**
         * Clears all files
         * @public
         */
        FileDropzone.prototype.clearFiles = function () {
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
        FileDropzone.prototype.getFiles = function () {
            return this.uploadedFiles;
        };

        /**
         * Gets the extracted text from all files
         * @returns {Object} - Object with file names as keys and extracted text as values
         * @public
         */
        FileDropzone.prototype.getExtractedText = function () {
            var result = {};

            this.uploadedFiles.forEach(function (file) {
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
        FileDropzone.prototype.renderFileItems = function (containerId) {
            var self = this;
            var container = document.getElementById(containerId);

            if (!container || !this.uploadedFiles || this.uploadedFiles.length === 0) {
                return;
            }

            container.innerHTML = '';

            // Determinar si usar modo compacto
            var isMultipleFiles = this.uploadedFiles.length > 1;

            this.uploadedFiles.forEach(function (file) {
                var fileName = file.name;
                var fileType = self._getFileType(file);
                var icon = 'fa-file';
                var extractedText = file.extractedText || '';
                var isError = extractedText.startsWith('Error');

                // Determinar ícono
                switch (fileType) {
                    case 'text':
                        if (fileName.toLowerCase().endsWith('.json')) icon = 'fa-file-code';
                        else if (fileName.toLowerCase().endsWith('.stask')) icon = 'fa-tasks';
                        else icon = 'fa-file-alt';
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
                    case 'image':
                        icon = 'fa-file-image';
                        break;
                    default:
                        if (file.type && file.type.startsWith('video/')) icon = 'fa-file-video';
                        else if (file.type && file.type.startsWith('audio/')) icon = 'fa-file-audio';
                        break;
                }

                var fileItem = document.createElement('div');
                fileItem.setAttribute('data-file-id', fileName);

                if (fileType === 'image') {
                    fileItem.className = 'file-item image-card-compact float-left';
                    fileItem.style.cssText = `
                    position: relative; width: 80px; height: 50px; 
                    display: inline-block; margin: 5px; border-radius: 6px; 
                    overflow: hidden;  cursor: pointer;
                `;


                    var imageUrl = file.previewUrl || URL.createObjectURL(file);
                    fileItem.innerHTML = `
                <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
            `;

                    fileItem.addEventListener('click', function (e) {
                        e.stopPropagation();
                        self._openImageViewer(fileName, imageUrl);
                    });
                } else {

                    fileItem.className = 'cursor-pointer file-item float-left margin-right margin-top';
                    fileItem.style.cssText = 'height: 34px;';

                    fileItem.innerHTML = `
                    <i class="fa ${icon} fa-2x margin-right"></i>
                    <span class="file-name">${fileName}</span>
                    <!--div class="file-actions" style="display: inline-flex; margin-left: 5px;">
                        <span class="view-file">
                            <i class="fa fa-eye" style="margin-left: 5px; color: #2196f3; cursor: pointer;"></i>
                        </span>
                    </div-->
                `;

                    // Event listeners para botones
                    //var viewButton = fileItem.querySelector('.view-file');
                    // if (viewButton) {
                    fileItem.addEventListener('click', function (e) {
                        e.stopPropagation();
                        if (typeof editContent === 'function') {
                            editContent(extractedText, 'editor_' + Date.now(), fileName);
                        } else {
                            self.showExtractedText(fileName, extractedText);
                        }
                    });
                    // }

                }

                container.appendChild(fileItem);
            });
        };

        /**
         * Establece el modo de extracción para usar etiquetas simba_document o texto plano
         * @param {boolean} useSimbaDocumentTags - Si es true, usa etiquetas simba_document
         * @public
         */
        FileDropzone.prototype.setSimbaDocumentTagsMode = function (useSimbaDocumentTags) {
            this.options.useSimbaDocumentTags = !!useSimbaDocumentTags;
            console.log("Modo de etiquetas simba_document " + (this.options.useSimbaDocumentTags ? "activado" : "desactivado"));
        };
        /**
         * Inspects the current state of SQL.js loading
         * @returns {Object} - Detailed state information
         * @public
         */
        FileDropzone.prototype.inspectSqlState = function () {
            var state = {
                timestamp: new Date().toISOString(),
                windowSql: {
                    exists: typeof window.SQL !== 'undefined',
                    type: typeof window.SQL,
                    isFunction: typeof window.SQL === 'function',
                    hasDatabase: window.SQL && typeof window.SQL.Database === 'function'
                },
                globalSql: {
                    exists: typeof SQL !== 'undefined',
                    type: typeof SQL
                },
                instance: {
                    sqlReady: this.sqlReady,
                    hasDatabase: this.sqlDatabase !== null,
                    tablesCount: Object.keys(this.excelTables).length
                },
                windowKeys: Object.keys(window).filter(function (key) {
                    return key.toLowerCase().includes('sql') || key.toLowerCase().includes('database');
                }),
                scripts: Array.from(document.querySelectorAll('script')).map(function (script) {
                    return script.src;
                }).filter(function (src) {
                    return src && src.includes('sql');
                })
            };

            console.log('=== SQL State Inspection ===', state);
            return state;
        };

// ========================================
// PASO 4: Test de carga manual
// ========================================

        /**
         * Manually tests SQL.js loading
         * @public
         */
        FileDropzone.prototype.testSqlLoading = function () {
            var self = this;

            console.log('=== Manual SQL Loading Test ===');

            // Reset state
            this.sqlReady = false;
            this.sqlDatabase = null;

            // Inspect current state
            this.inspectSqlState();

            // Force reload
            console.log('Forcing SQL.js reload...');
            this._loadSqlJs();

            // Check periodically
            var checkCount = 0;
            var checkInterval = setInterval(function () {
                checkCount++;
                console.log('Check #' + checkCount + ':', self.inspectSqlState());

                if (self.sqlReady || checkCount >= 10) {
                    clearInterval(checkInterval);
                    console.log('=== Final State ===', self.sqlReady ? 'SUCCESS' : 'FAILED');
                }
            }, 1000);
        };

        /**
         * Loads SQL.js library dynamically
         * @private
         */
        FileDropzone.prototype._loadSqlJs = function () {
            var self = this;

            console.log('=== SQL.js Loading Debug ===');
            console.log('1. Before loading - window.SQL exists:', typeof window.SQL !== 'undefined');
            console.log('2. Before loading - global SQL exists:', typeof SQL !== 'undefined');

            var script = document.createElement('script');
            script.src = this.options.sqlLibraryUrl;

            script.onload = function () {
                console.log('3. Script loaded successfully');
                console.log('4. After load - window.SQL exists:', typeof window.SQL !== 'undefined');
                console.log('5. After load - global SQL exists:', typeof SQL !== 'undefined');
                console.log('6. After load - window object keys containing SQL:', Object.keys(window).filter(k => k.toLowerCase().includes('sql')));

                // Verificar diferentes posibles ubicaciones del objeto SQL
                console.log('7. Checking possible SQL locations:');
                console.log('   - window.SQL:', typeof window.SQL);
                console.log('   - window.sql:', typeof window.sql);
                console.log('   - global SQL:', typeof SQL);
                console.log('   - self.SQL:', typeof self.SQL);

                // Intentar con diferentes nombres
                var sqlObject = window.SQL || window.sql || SQL || self.SQL;
                console.log('8. Found SQL object:', typeof sqlObject);

                if (sqlObject) {
                    console.log('9. SQL object properties:', Object.keys(sqlObject));
                    // Asignar a window.SQL si no está ahí
                    if (typeof window.SQL === 'undefined') {
                        window.SQL = sqlObject;
                        console.log('10. Assigned SQL to window.SQL');
                    }

                    // Dar tiempo para que se inicialize
                    setTimeout(function () {
                        console.log('11. Delayed initialization attempt');
                        self._initializeSqlDatabase();
                    }, 500);
                } else {
                    console.error('12. SQL object not found after loading');
                    self.sqlReady = false;
                }
            };

            script.onerror = function () {
                console.error('Script loading failed');
                self.sqlReady = false;
            };

            document.head.appendChild(script);
        };

        /**
         * Initializes the SQLite database (DEBUG VERSION)
         * @private
         */
        FileDropzone.prototype._initializeSqlDatabase = function () {
            var self = this;

            console.log('=== SQL.js Initialization Debug ===');
            console.log('1. window.SQL type:', typeof window.SQL);
            console.log('2. SQL is callable:', typeof window.SQL === 'function');

            if (typeof window.SQL === 'undefined') {
                console.error('3. SQL is not available, checking alternatives...');

                // Buscar en todo el objeto window
                var sqlKeys = Object.keys(window).filter(function (key) {
                    return key.toLowerCase().includes('sql') ||
                        (typeof window[key] === 'function' && window[key].toString().includes('Database'));
                });

                console.log('4. Possible SQL-related objects:', sqlKeys);

                if (sqlKeys.length > 0) {
                    window.SQL = window[sqlKeys[0]];
                    console.log('5. Trying with:', sqlKeys[0]);
                } else {
                    self.sqlReady = false;
                    return;
                }
            }

            try {
                console.log('6. Attempting to call SQL()...');

                // Verificar si SQL necesita configuración
                if (typeof window.SQL === 'function') {
                    console.log('7. SQL is a function, calling it...');

                    window.SQL({
                        locateFile: function (file) {
                            console.log('8. locateFile called for:', file);
                            var url = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + file;
                            console.log('9. Returning URL:', url);
                            return url;
                        }
                    }).then(function (SQL) {
                        console.log('10. SQL.js initialized successfully');
                        console.log('11. SQL constructor available:', typeof SQL.Database === 'function');

                        self.sqlDatabase = new SQL.Database();
                        self.sqlReady = true;

                        console.log('12. Database created successfully');
                        self._processQueuedExcelFiles();

                    }).catch(function (error) {
                        console.error('13. SQL.js initialization failed:', error);
                        console.log('14. Trying direct Database creation...');

                        // Intentar crear directamente si el objeto SQL ya tiene Database
                        if (window.SQL && window.SQL.Database) {
                            try {
                                self.sqlDatabase = new window.SQL.Database();
                                self.sqlReady = true;
                                console.log('15. Direct database creation successful');
                                self._processQueuedExcelFiles();
                            } catch (directError) {
                                console.error('16. Direct database creation failed:', directError);
                                self.sqlReady = false;
                            }
                        } else {
                            self.sqlReady = false;
                        }
                    });
                } else {
                    console.log('17. SQL is not a function, checking if it has Database directly...');

                    if (window.SQL && window.SQL.Database) {
                        console.log('18. Found SQL.Database directly');
                        self.sqlDatabase = new window.SQL.Database();
                        self.sqlReady = true;
                        console.log('19. Database created directly');
                        self._processQueuedExcelFiles();
                    } else {
                        console.error('20. No Database constructor found');
                        self.sqlReady = false;
                    }
                }

            } catch (error) {
                console.error('21. Exception in initialization:', error);
                self.sqlReady = false;
            }
        };
        // REEMPLAZAR _loadSqlJs:
        FileDropzone.prototype._loadSqlJs = function () {
            var self = this;

            if (typeof window.initSqlJs === 'function') {
                console.log('initSqlJs found, initializing...');
                self._initializeSqlDatabase();
                return;
            }

            console.error('initSqlJs not available. Make sure to include SQL.js script tag.');
            self.sqlReady = false;
        };

// REEMPLAZAR _initializeSqlDatabase:
        FileDropzone.prototype._initializeSqlDatabase = function () {
            var self = this;

            if (typeof window.initSqlJs !== 'function') {
                console.error('initSqlJs not available');
                self.sqlReady = false;
                return;
            }

            try {
                console.log('Initializing SQL.js (no WASM)...');

                window.initSqlJs({
                    locateFile: function (file) {
                        return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/' + file;
                    }
                }).then(function (SQL) {
                    console.log('✅ SQL.js initialized in FileDropzone');

                    window.SQL = SQL;
                    self.sqlDatabase = new SQL.Database();
                    self.sqlReady = true;

                    console.log('✅ SQLite database ready for FileDropzone');
                    self._processQueuedExcelFiles();

                }).catch(function (error) {
                    console.error('❌ Error initializing SQL.js in FileDropzone:', error);
                    self.sqlReady = false;
                });

            } catch (error) {
                console.error('❌ Error in SQL initialization:', error);
                self.sqlReady = false;
            }
        };

// ========================================
// AGREGAR función para verificar que todo esté bien:
// ========================================

        /**
         * Verifies SQL.js is properly loaded
         * @returns {Object} - Verification results
         * @public
         */
        FileDropzone.prototype.verifySqlJs = function () {
            var verification = {
                sqlGlobalExists: typeof SQL !== 'undefined',
                sqlReady: this.sqlReady,
                databaseExists: this.sqlDatabase !== null,
                tablesCount: Object.keys(this.excelTables).length,
                timestamp: new Date().toISOString()
            };

            console.log('SQL.js Verification:', verification);

            if (!verification.sqlGlobalExists) {
                console.error('❌ SQL.js not loaded. Add this to your HTML head:');
                console.error('<script src="https://unpkg.com/sql.js@1.8.0/dist/sql-wasm.js"></script>');
            } else if (!verification.sqlReady) {
                console.warn('⚠️ SQL.js loaded but database not ready. Trying to initialize...');
                this._loadSqlJs();
            } else {
                console.log('✅ SQL.js working correctly');
            }

            return verification;
        };

        FileDropzone.prototype._convertExcelSerialToDate = function (serial) {
            const excelEpoch = new Date(1900, 0, 1);
            let daysToAdd = serial >= 60 ? serial - 2 : serial - 1;

            const resultDate = new Date(excelEpoch);
            resultDate.setDate(resultDate.getDate() + daysToAdd);

            const year = resultDate.getFullYear();
            const month = String(resultDate.getMonth() + 1).padStart(2, '0');
            const day = String(resultDate.getDate()).padStart(2, '0');

            return `${year}-${month}-${day}`;
        }
        /**
         * Creates a table from Excel data with column metadata
         * @param {string} fileName - Name of the Excel file
         * @param {string} sheetName - Name of the sheet
         * @param {Array} data - Array of objects representing the data
         * @private
         */
        FileDropzone.prototype._createTableFromExcelData = function (fileName, sheetName, data) {
            var self = this;
            if (!this.sqlReady || !this.sqlDatabase || !data || data.length === 0) {
                return;
            }

            try {
                // Crear nombre único de tabla
                var baseTableName = (fileName.replace(/[^a-zA-Z0-9]/g, '_') + '_' + sheetName.replace(/[^a-zA-Z0-9]/g, '_')).toLowerCase();
                var tableName = baseTableName;

                // Verificar si la tabla ya existe y crear nombre único
                var counter = 1;
                while (this.excelTables[tableName]) {
                    tableName = baseTableName + '_' + counter;
                    counter++;
                }

                // Get column names from first row
                var columns = Object.keys(data[0]);

                // Detectar tipos de columnas basado en los datos procesados
                var columnTypes = this._detectColumnTypesFromProcessedData(data, columns);

                // Almacenar metadatos de columnas para uso posterior en queries
                this.columnMetadata[tableName] = {
                    dateColumns: columnTypes.dateColumns,
                    numberColumns: columnTypes.numberColumns,
                    originalColumnNames: columns
                };

                console.log(`Table ${tableName} metadata:`, this.columnMetadata[tableName]);

                // Create table schema
                var createTableSQL = 'CREATE TABLE IF NOT EXISTS ' + tableName + ' (';
                var columnDefs = columns.map(function (col) {
                    var cleanCol = col.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    if (!cleanCol || /^\d+$/.test(cleanCol)) {
                        cleanCol = 'col_' + cleanCol;
                    }
                    return cleanCol + ' TEXT';
                });
                createTableSQL += columnDefs.join(', ') + ')';

                // Execute CREATE TABLE
                this.sqlDatabase.run(createTableSQL);

                // Insert data
                var cleanColumns = columns.map(function (col) {
                    var cleanCol = col.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    if (!cleanCol || /^\d+$/.test(cleanCol)) {
                        cleanCol = 'col_' + cleanCol;
                    }
                    return cleanCol;
                });

                var insertSQL = 'INSERT INTO ' + tableName + ' (' + cleanColumns.join(', ') + ') VALUES (' +
                    columns.map(function () {
                        return '?';
                    }).join(', ') + ')';

                var stmt = this.sqlDatabase.prepare(insertSQL);

                data.forEach(function (row) {
                    var values = columns.map(function (col) {
                        var value = row[col];
                        //   console.log("column:",col)
                        if (self._isLikelyDateColumn(col) && self._isExcelSerialCandidate(value)) {
                            try {
                                value = self._convertExcelSerialToDate(parseFloat(value));
                                //             console.log(`🔄 Converted ${col}: ${row[col]} → ${value}`);
                            } catch (error) {
                                console.warn(`❌ Error converting ${col}:`, row[col], error);
                                // Mantener valor original si falla
                            }
                        }
                        return value !== null && value !== undefined ? String(value) : '';
                    });
                    stmt.run(values);
                });

                stmt.free();

                // Store table info
                this.excelTables[tableName] = {
                    fileName: fileName,
                    sheetName: sheetName,
                    columns: cleanColumns,
                    originalColumns: columns,
                    rowCount: data.length,
                    createdAt: new Date().toISOString(),
                    fileIndex: this.uploadedFiles.findIndex(f => f.name === fileName),
                    columnMetadata: this.columnMetadata[tableName]
                };

                console.log('Table created:', tableName, 'with', data.length, 'rows');

            } catch (error) {
                console.error('Error creating table from Excel data:', error);
            }
        };


        /**
         * Processes queued Excel files after SQL is ready
         * @private
         */
        FileDropzone.prototype._processQueuedExcelFiles = function () {
            var self = this;

            this.uploadedFiles.forEach(function (file) {
                if (self._getFileType(file) === 'excel' && file.excelData) {
                    Object.keys(file.excelData).forEach(function (sheetName) {
                        self._createTableFromExcelData(file.name, sheetName, file.excelData[sheetName]);
                    });
                }
            });
        };
        /**
         * Converts SQL query results to Markdown table format
         * @param {Object} queryResult - Result from executeSqlQuery
         * @param {Object} options - Formatting options
         * @returns {string} - Markdown formatted table
         * @public
         */
        FileDropzone.prototype.convertSqlResultToMarkdown = function (queryResult, options) {
            // Default options
            options = options || {};
            var tableTitle = options.title || '';
            var showRowNumbers = options.showRowNumbers || false;
            var maxColumnWidth = options.maxColumnWidth || 50;
            var alignment = options.alignment || 'left'; // 'left', 'center', 'right'
            var includeMetadata = options.includeMetadata !== false; // true by default

            // Check if query was successful
            if (!queryResult.success) {
                return `## Error in SQL Query\n\n\`\`\`\n${queryResult.error}\n\`\`\`\n\n**Query:** \`${queryResult.query}\``;
            }

            // Check if there's data
            if (!queryResult.data || queryResult.data.length === 0) {
                var result = '';
                if (tableTitle) {
                    result += `## ${tableTitle}\n\n`;
                }
                result += '*No data returned from query*\n\n';
                if (includeMetadata) {
                    result += `**Query:** \`${queryResult.query}\`\n`;
                    result += `**Execution time:** ${new Date().toISOString()}\n`;
                }
                return result;
            }

            var data = queryResult.data;
            var headers = Object.keys(data[0]);
            var markdown = '';

            // Add title if provided
            if (tableTitle) {
                markdown += `## ${tableTitle}\n\n`;
            }

            // Add row numbers column if requested
            if (showRowNumbers) {
                headers.unshift('#');
            }

            // Function to truncate text if too long
            function truncateText(text, maxLength) {
                if (typeof text !== 'string') {
                    text = String(text || '');
                }
                if (text.length <= maxLength) {
                    return text;
                }
                return text.substring(0, maxLength - 3) + '...';
            }

            // Function to escape pipe characters in cell content
            function escapePipes(text) {
                if (typeof text !== 'string') {
                    text = String(text || '');
                }
                return text.replace(/\|/g, '\\|');
            }

            // Create alignment indicators
            function getAlignmentMarker(alignment) {
                switch (alignment) {
                    case 'center':
                        return ':---:';
                    case 'right':
                        return '---:';
                    default:
                        return '---';
                }
            }

            // Build header row
            var headerRow = '| ';
            headers.forEach(function (header, index) {
                var headerText = showRowNumbers && index === 0 ? '#' : header;
                headerRow += truncateText(escapePipes(headerText), maxColumnWidth) + ' | ';
            });
            markdown += headerRow + '\n';

            // Build separator row
            var separatorRow = '| ';
            headers.forEach(function () {
                separatorRow += getAlignmentMarker(alignment) + ' | ';
            });
            markdown += separatorRow + '\n';

            // Build data rows
            data.forEach(function (row, rowIndex) {
                var dataRow = '| ';

                headers.forEach(function (header, colIndex) {
                    var cellValue;

                    if (showRowNumbers && colIndex === 0) {
                        cellValue = String(rowIndex + 1);
                    } else {
                        var actualHeader = showRowNumbers ? headers[colIndex] : header;
                        cellValue = row[actualHeader];

                        // Handle different data types
                        if (cellValue === null || cellValue === undefined) {
                            cellValue = '';
                        } else if (typeof cellValue === 'number') {
                            // Format numbers nicely
                            if (cellValue % 1 === 0) {
                                cellValue = cellValue.toLocaleString();
                            } else {
                                cellValue = cellValue.toFixed(2);
                            }
                        } else if (typeof cellValue === 'boolean') {
                            cellValue = cellValue ? '✓' : '✗';
                        } else {
                            cellValue = String(cellValue);
                        }
                    }

                    dataRow += truncateText(escapePipes(cellValue), maxColumnWidth) + ' | ';
                });

                markdown += dataRow + '\n';
            });

            // Add metadata if requested
            if (includeMetadata) {
                markdown += '\n';
                markdown += `**Total rows:** ${queryResult.rowCount}\n`;
                markdown += `**Query:** \`${queryResult.query}\`\n`;
                markdown += `**Generated:** ${new Date().toISOString()}\n`;
            }

            return markdown;
        };

        /**
         * Converts SQL query results to Markdown and copies to clipboard
         * @param {Object} queryResult - Result from executeSqlQuery
         * @param {Object} options - Formatting options
         * @returns {string} - Markdown formatted table
         * @public
         */
        FileDropzone.prototype.convertSqlResultToMarkdownAndCopy = function (queryResult, options) {
            var markdown = this.convertSqlResultToMarkdown(queryResult, options);

            // Copy to clipboard if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(markdown).then(function () {
                    console.log('Markdown table copied to clipboard');

                    // Show toast notification if Framework7 is available
                    if (this.options && this.options.framework7) {
                        this.options.framework7.toast.show({
                            text: 'Markdown table copied to clipboard',
                            position: 'center',
                            closeTimeout: 2000,
                        });
                    }
                }.bind(this)).catch(function (err) {
                    console.error('Error copying to clipboard:', err);
                });
            }

            return markdown;
        };

        /**
         * Executes SQL query and returns result in Markdown format
         * @param {string} query - SQL query to execute
         * @param {Object} options - Formatting options for Markdown
         * @returns {Object} - Query results with Markdown formatted data
         * @public
         */
        FileDropzone.prototype.executeSqlQueryToMarkdown = function (query, options) {
            var queryResult = this.executeSqlQuery(query);

            if (queryResult.success) {
                queryResult.markdown = this.convertSqlResultToMarkdown(queryResult, options);
            }

            return queryResult;
        };

        /**
         * Generates a comprehensive report with multiple queries in Markdown
         * @param {Array} queries - Array of query objects {query: string, title: string, options: object}
         * @param {Object} reportOptions - Overall report options
         * @returns {string} - Complete Markdown report
         * @public
         */
        FileDropzone.prototype.generateMarkdownReport = function (queries, reportOptions) {
            reportOptions = reportOptions || {};
            var reportTitle = reportOptions.title || 'SQL Query Report';
            var includeTableOfContents = reportOptions.includeTableOfContents !== false;

            var markdown = `# ${reportTitle}\n\n`;
            markdown += `*Generated on: ${new Date().toLocaleString()}*\n\n`;

            // Add table info
            var tableInfo = this.getTableInfo();
            if (tableInfo.tableCount > 0) {
                markdown += `## Available Tables\n\n`;
                Object.keys(tableInfo.tables).forEach(function (tableName) {
                    var table = tableInfo.tables[tableName];
                    markdown += `- **${tableName}** (${table.sheetName} from ${table.fileName}) - ${table.rowCount} rows\n`;
                });
                markdown += '\n';
            }

            // Table of contents
            if (includeTableOfContents && queries.length > 1) {
                markdown += '## Table of Contents\n\n';
                queries.forEach(function (queryObj, index) {
                    var title = queryObj.title || `Query ${index + 1}`;
                    var anchor = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    markdown += `${index + 1}. [${title}](#${anchor})\n`;
                });
                markdown += '\n';
            }

            // Execute queries and add results
            queries.forEach(function (queryObj, index) {
                var title = queryObj.title || `Query ${index + 1}`;
                var options = queryObj.options || {};
                options.title = title;

                var result = this.executeSqlQueryToMarkdown(queryObj.query, options);
                markdown += result.markdown + '\n\n';
            }, this);

            return markdown;
        };

        /**
         * Quick helper to execute a query and show results in Markdown format
         * @param {string} query - SQL query
         * @param {string} title - Optional title for the table
         * @public
         */
        FileDropzone.prototype.showSqlResultAsMarkdown = function (query, title) {
            var options = title ? {title: title} : {};
            var result = this.executeSqlQueryToMarkdown(query, options);

            if (result.success) {
                console.log('=== SQL RESULT (MARKDOWN) ===');
                console.log(result.markdown);
                console.log('=== END RESULT ===');

                // If there's a view function available (like editContent), use it
                if (typeof editContent === 'function') {
                    var fileName = `sql_result_${Date.now()}.md`;
                    editContent(result.markdown, 'editor_' + Date.now(), fileName, true, 'markdown');
                }
            } else {
                console.error('SQL Query failed:', result.error);
            }

            return result;
        };

        /**
         * Export multiple query results as a single Markdown file
         * @param {Array} queries - Array of query strings or query objects
         * @param {string} filename - Name for the exported file
         * @param {Object} options - Export options
         * @public
         */
        FileDropzone.prototype.exportSqlResultsAsMarkdown = function (queries, filename, options) {
            filename = filename || `sql_export_${Date.now()}.md`;
            options = options || {};

            // Convert simple query strings to query objects
            var queryObjects = queries.map(function (query, index) {
                if (typeof query === 'string') {
                    return {
                        query: query,
                        title: `Query ${index + 1}`,
                        options: {}
                    };
                }
                return query;
            });

            // Generate the report
            var markdown = this.generateMarkdownReport(queryObjects, options);

            // Create download
            var blob = new Blob([markdown], {type: 'text/markdown'});
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            setTimeout(function () {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            return markdown;
        };
        /**
         * Executes a SQL query on the loaded Excel data with date processing
         * @param {string} query - SQL query to execute
         * @returns {Object} - Query results with processed dates
         * @public
         */
        FileDropzone.prototype.executeSqlQuery = function (query) {
            if (!this.sqlReady || !this.sqlDatabase) {
                return {
                    success: false,
                    error: 'SQL database not ready. Make sure Excel files are loaded first.'
                };
            }

            try {
                var stmt = this.sqlDatabase.prepare(query);
                var results = [];

                while (stmt.step()) {
                    var row = stmt.getAsObject();
                    results.push(row);
                }

                stmt.free();

                // Post-procesar resultados para convertir fechas
                var tableName = this._extractTableNameFromQuery(query);
                var processedResults = this._postProcessSqlResults(results, tableName);

                var result = {
                    success: true,
                    data: processedResults,
                    rowCount: processedResults.length,
                    query: query,
                    originalData: results
                };

                // Call callback if provided
                if (typeof this.options.onSqlQueryExecuted === 'function') {
                    this.options.onSqlQueryExecuted(result);
                }

                return result;

            } catch (error) {
                var errorResult = {
                    success: false,
                    error: error.message,
                    query: query
                };

                console.error('SQL Query Error:', error);
                return errorResult;
            }
        };

        /**
         /**
         * NUEVA VERSIÓN MEJORADA: Detecta tipos de columnas con mejor lógica para fechas
         * Reemplaza la función _detectColumnTypesFromProcessedData existente
         */
        FileDropzone.prototype._detectColumnTypesFromProcessedData = function (data, columns) {
            var dateColumns = [];
            var numberColumns = [];
            var stringColumns = [];

            //  console.log('🔍 Analyzing column types for:', columns);

            columns.forEach(function (column) {
                var dateCount = 0;
                var numberCount = 0;
                var stringCount = 0;
                var totalSamples = 0;
                var excelDateCount = 0; // *** NUEVO: Contador específico para fechas Excel

                //console.log(`\n📊 Analyzing column: "${column}"`);

                // Analizar primeras 10 filas para determinar tipo
                var sampleSize = Math.min(10, data.length);

                for (var i = 0; i < sampleSize; i++) {
                    var value = data[i][column];

                    if (value !== undefined && value !== null && value !== '') {
                        totalSamples++;
                        //  console.log(`  Sample ${i + 1}: "${value}" (type: ${typeof value})`);

                        // *** NUEVA LÓGICA: Detectar fechas Excel por nombre de columna + valor numérico ***
                        if (this._isLikelyDateColumn(column) && this._isExcelSerialCandidate(value)) {
                            excelDateCount++;
                            //        console.log(`    ✅ Detected as Excel date candidate`);
                        }
                        // Verificar si es fecha ya formateada (formato YYYY-MM-DD, DD/MM/YYYY, etc.)
                        else if (typeof value === 'string' && this._looksLikeDate(value)) {
                            dateCount++;
                            //       console.log(`    ✅ Detected as formatted date`);
                        }
                        // Si es número pero no parece fecha Excel
                        else if (!isNaN(value) && !isNaN(parseFloat(value))) {
                            numberCount++;
                            console.log(`    🔢 Detected as number`);
                        }
                        // Todo lo demás es string
                        else {
                            stringCount++;
                            //   console.log(`    📝 Detected as string`);
                        }
                    }
                }

                if (totalSamples > 0) {
                    var excelDatePercentage = excelDateCount / totalSamples;
                    var datePercentage = dateCount / totalSamples;
                    var numberPercentage = numberCount / totalSamples;

                    /*  console.log(`  📈 Results for "${column}":`);
                      console.log(`    - Excel dates: ${excelDateCount}/${totalSamples} (${(excelDatePercentage * 100).toFixed(1)}%)`);
                      console.log(`    - Formatted dates: ${dateCount}/${totalSamples} (${(datePercentage * 100).toFixed(1)}%)`);
                      console.log(`    - Numbers: ${numberCount}/${totalSamples} (${(numberPercentage * 100).toFixed(1)}%)`);
                      console.log(`    - Strings: ${stringCount}/${totalSamples}`);*/

                    // *** NUEVA LÓGICA DE CLASIFICACIÓN ***
                    if (excelDatePercentage >= 0.5 || datePercentage >= 0.7) {
                        dateColumns.push(column);
                        // console.log(`    🎯 CLASSIFIED AS: DATE COLUMN`);
                    } else if (numberPercentage >= 0.8 && excelDatePercentage < 0.3) {
                        numberColumns.push(column);
                        //console.log(`    🎯 CLASSIFIED AS: NUMBER COLUMN`);
                    } else {
                        stringColumns.push(column);
                        //console.log(`    🎯 CLASSIFIED AS: STRING COLUMN`);
                    }
                } else {
                    stringColumns.push(column);
                    //console.log(`    🎯 CLASSIFIED AS: STRING COLUMN (no data)`);
                }
            }, this);

            console.log('\n📋 FINAL CLASSIFICATION:');
            console.log('  📅 Date columns:', dateColumns);
            console.log('  🔢 Number columns:', numberColumns);
            console.log('  📝 String columns:', stringColumns);

            return {
                dateColumns: dateColumns,
                numberColumns: numberColumns,
                stringColumns: stringColumns
            };
        };

        /**
         * NUEVA FUNCIÓN: Verifica si el nombre de columna sugiere que es una fecha
         */
        FileDropzone.prototype._isLikelyDateColumn = function (columnName) {
            if (!columnName) return false;
            //@todo mejorar esto llamando a un servicio o similar
            var dateKeywords = [
                'date', 'fecha', 'day', 'dia', 'time', 'tiempo', 'when', 'cuando',
                'birth', 'nacimiento', 'created', 'creado', 'updated', 'actualizado',
                'start', 'inicio', 'end', 'fin', 'expiry', 'expiracion', 'due', 'vencimiento',
                'interview', 'entrevista', 'appointment', 'cita', 'meeting', 'reunion',
                'deadline', 'plazo', 'schedule', 'horario', 'timestamp', 'hired', 'contratado',
                'joined', 'ingreso', 'departure', 'salida', 'modified', 'modificado'
            ];

            var columnLower = columnName.toLowerCase();
            var hasDateKeyword = dateKeywords.some(keyword => columnLower.includes(keyword));

            // console.log(`    🔍 Column "${columnName}" has date keyword: ${hasDateKeyword}`);
            return hasDateKeyword;
        };

        /**
         * NUEVA FUNCIÓN: Verifica si un valor podría ser una fecha serial de Excel
         */
        FileDropzone.prototype._isExcelSerialCandidate = function (value) {
            // Convertir a número si es string
            if (typeof value === 'string') {
                value = parseFloat(value);
            }

            // Debe ser número válido
            if (typeof value !== 'number' || isNaN(value)) {
                return false;
            }

            // Rango típico de fechas Excel (1 = 1900-01-01, 80000 ≈ 2119)
            // También debe ser entero (las fechas Excel sin horas son enteros)
            var isInRange = value >= 1 && value <= 80000;
            var isInteger = value % 1 === 0;

            // console.log(`      🧮 Value ${value}: inRange=${isInRange}, isInteger=${isInteger}`);

            return isInRange && isInteger;
        };

        /**
         * Verifica si un string parece ser una fecha
         * @param {string} value - Valor a verificar
         * @returns {boolean} - True si parece fecha
         * @private
         */
        FileDropzone.prototype._looksLikeDate = function (value) {
            if (typeof value !== 'string') return false;

            // Patrones comunes de fecha
            var datePatterns = [
                /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
                /^\d{2}\/\d{2}\/\d{4}$/,         // DD/MM/YYYY o MM/DD/YYYY
                /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,   // D/M/YY o DD/MM/YYYY variaciones
                /^\d{4}-\d{1,2}-\d{1,2}$/,       // YYYY-M-D variaciones
                /^\d{1,2}-\d{1,2}-\d{4}$/        // D-M-YYYY variaciones
            ];

            return datePatterns.some(pattern => pattern.test(value));
        };

        /**
         * FUNCIÓN MEJORADA: Post-procesa resultados SQL con mejor detección
         */
        FileDropzone.prototype._postProcessSqlResults = function (results, tableName) {
            if (!results || results.length === 0) return results;

            var self = this;
            var metadata = null;

            console.log('🔄 Post-processing SQL results...');
            console.log('📊 Available metadata:', Object.keys(this.columnMetadata));

            // Intentar obtener metadatos si se proporciona nombre de tabla
            if (tableName && this.columnMetadata[tableName]) {
                metadata = this.columnMetadata[tableName];
                console.log(`✅ Using metadata for table: ${tableName}`, metadata);
            } else {
                // Si no hay tabla específica, buscar en todas las tablas por columnas similares
                var allDateColumns = [];
                Object.keys(this.columnMetadata).forEach(function (table) {
                    allDateColumns = allDateColumns.concat(self.columnMetadata[table].dateColumns);
                });
                metadata = {dateColumns: allDateColumns};
                console.log(`⚠️ Using combined metadata:`, metadata);
            }

            if (!metadata || !metadata.dateColumns || metadata.dateColumns.length === 0) {
                console.log('❌ No date columns found in metadata, trying manual detection...');

                // *** FALLBACK: Detección manual por nombre de columna ***
                return results.map(function (row) {
                    var processedRow = {};
                    Object.keys(row).forEach(function (column) {
                        var value = row[column];

                        // Detectar manualmente si parece fecha por nombre + valor
                        if (self._isLikelyDateColumn(column) && self._isExcelSerialCandidate(value)) {
                            try {
                                processedRow[column] = self._convertExcelSerialToDate(parseFloat(value));
                                console.log(`🔄 Manual conversion ${column}: ${value} → ${processedRow[column]}`);
                            } catch (error) {
                                console.warn(`❌ Error in manual conversion for ${column}:`, value, error);
                                processedRow[column] = value;
                            }
                        } else {
                            processedRow[column] = value;
                        }
                    });
                    return processedRow;
                });
            }

            console.log('✅ Processing with metadata date columns:', metadata.dateColumns);

            return results.map(function (row) {
                var processedRow = {};

                Object.keys(row).forEach(function (column) {
                    var value = row[column];
                    var originalColumn = self._findOriginalColumnName(column, metadata);
                    console.log(column);
                    // Verificar si esta columna debería contener fechas
                    console.log(metadata.dateColumns)
                    var isDateColumn = metadata.dateColumns[column];/*.some(function(dateCol) {
                    return dateCol.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_') === column.toLowerCase() ||
                        dateCol.toLowerCase() === column.toLowerCase() ||
                        (originalColumn && dateCol.toLowerCase() === originalColumn.toLowerCase());
                });*/

                    if (isDateColumn && self._isExcelSerialCandidate(value)) {
                        // Convertir número serial de Excel a fecha
                        try {
                            processedRow[column] = self._convertExcelSerialToDate(parseFloat(value));
                            console.log(`🔄 Metadata conversion ${column}: ${value} → ${processedRow[column]}`);
                        } catch (error) {
                            console.warn(`❌ Error converting date for ${column}:`, value, error);
                            processedRow[column] = value; // Mantener original si falla
                        }
                    } else {
                        processedRow[column] = value;
                    }
                });

                return processedRow;
            });
        };
        /**
         * Encuentra el nombre original de columna basado en el nombre limpio
         * @param {string} cleanColumn - Nombre de columna limpio
         * @param {Object} metadata - Metadatos de la tabla
         * @returns {string|null} - Nombre original de columna
         * @private
         */
        FileDropzone.prototype._findOriginalColumnName = function (cleanColumn, metadata) {
            if (!metadata || !metadata.originalColumnNames) return null;

            return metadata.originalColumnNames.find(function (original) {
                var cleaned = original.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                return cleaned === cleanColumn.toLowerCase();
            });
        };

        /**
         * Verifica si un valor es un número serial de Excel
         * @param {*} value - Valor a verificar
         * @returns {boolean} - True si es número serial de Excel
         * @private
         */
        FileDropzone.prototype._isExcelSerialNumber = function (value) {
            if (typeof value === 'string') {
                value = parseFloat(value);
            }

            return typeof value === 'number' &&
                !isNaN(value) &&
                value >= 1 &&
                value <= 80000 &&
                value % 1 === 0; // Es entero
        };

        /**
         * Extrae el nombre de tabla de una query SQL (simple)
         * @param {string} query - Query SQL
         * @returns {string|null} - Nombre de tabla o null
         * @private
         */
        FileDropzone.prototype._extractTableNameFromQuery = function (query) {
            // Buscar patrón "FROM table_name"
            var fromMatch = query.match(/FROM\s+([a-zA-Z0-9_]+)/i);
            if (fromMatch && fromMatch[1]) {
                return fromMatch[1].toLowerCase();
            }

            // Buscar patrón "UPDATE table_name"
            var updateMatch = query.match(/UPDATE\s+([a-zA-Z0-9_]+)/i);
            if (updateMatch && updateMatch[1]) {
                return updateMatch[1].toLowerCase();
            }

            // Buscar patrón "INSERT INTO table_name"
            var insertMatch = query.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
            if (insertMatch && insertMatch[1]) {
                return insertMatch[1].toLowerCase();
            }

            return null;
        };

        /**
         * Gets information about available tables
         * @returns {Object} - Information about loaded tables
         * @public
         */
        FileDropzone.prototype.getTableInfo = function () {
            return {
                tables: this.excelTables,
                sqlReady: this.sqlReady,
                tableCount: Object.keys(this.excelTables).length
            };
        };

        /**
         * Gets tables from a specific file
         * @param {string} fileName - Name of the file
         * @returns {Array} - Array of table names for that file
         * @public
         */
        FileDropzone.prototype.getTablesByFile = function (fileName) {
            var tables = [];
            for (var tableName in this.excelTables) {
                if (this.excelTables[tableName].fileName === fileName) {
                    tables.push({
                        tableName: tableName,
                        sheetName: this.excelTables[tableName].sheetName,
                        rowCount: this.excelTables[tableName].rowCount,
                        columns: this.excelTables[tableName].columns
                    });
                }
            }
            return tables;
        };

        /**
         * Lists all available tables
         * @returns {Array} - Array of table names
         * @public
         */
        FileDropzone.prototype.listTables = function () {
            return Object.keys(this.excelTables);
        };

        /**
         * Gets sample data from a table
         * @param {string} tableName - Name of the table
         * @param {number} limit - Number of rows to return (default: 5)
         * @returns {Object} - Sample data
         * @public
         */
        FileDropzone.prototype.getSampleData = function (tableName, limit) {
            limit = limit || 5;
            var query = 'SELECT * FROM ' + tableName + ' LIMIT ' + limit;
            return this.executeSqlQuery(query);
        };

        /**
         * Generates SQL query suggestions based on loaded tables
         * @returns {Array} - Array of suggested queries
         * @public
         */
        FileDropzone.prototype.getSqlQuerySuggestions = function () {
            var suggestions = [];
            var tableNames = Object.keys(this.excelTables);
            var fileGroups = {};

            if (tableNames.length === 0) {
                return ['-- No Excel tables loaded yet'];
            }

            // Agrupar tablas por archivo
            tableNames.forEach(function (tableName) {
                var tableInfo = this.excelTables[tableName];
                if (!fileGroups[tableInfo.fileName]) {
                    fileGroups[tableInfo.fileName] = [];
                }
                fileGroups[tableInfo.fileName].push({
                    tableName: tableName,
                    tableInfo: tableInfo
                });
            }, this);

            // Generar sugerencias por archivo
            Object.keys(fileGroups).forEach(function (fileName) {
                suggestions.push('-- ===============================');
                suggestions.push('-- File: ' + fileName);
                suggestions.push('-- ===============================');

                fileGroups[fileName].forEach(function (table) {
                    var tableName = table.tableName;
                    var tableInfo = table.tableInfo;

                    suggestions.push('-- Sheet: ' + tableInfo.sheetName + ' (' + tableInfo.rowCount + ' rows)');
                    suggestions.push('SELECT * FROM ' + tableName + ' LIMIT 5;');
                    suggestions.push('SELECT COUNT(*) as total_rows FROM ' + tableName + ';');

                    if (tableInfo.columns.length > 0) {
                        suggestions.push('SELECT ' + tableInfo.columns.slice(0, 3).join(', ') + ' FROM ' + tableName + ';');
                    }
                    suggestions.push('');
                });
            });

            return suggestions;
        };

        /**
         * Exports query results to CSV
         * @param {Object} queryResult - Result from executeSqlQuery
         * @returns {string} - CSV string
         * @public
         */
        FileDropzone.prototype.exportQueryResultToCsv = function (queryResult) {
            if (!queryResult.success || !queryResult.data || queryResult.data.length === 0) {
                return '';
            }

            var data = queryResult.data;
            var headers = Object.keys(data[0]);
            var csv = headers.join(',') + '\n';

            data.forEach(function (row) {
                var values = headers.map(function (header) {
                    var value = row[header] || '';
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });

            return csv;
        };

        /**
         * Formatea texto de archivo según configuración (extraída de getCombinedExtractedText)
         * @param {Object} item - Objeto con {file, text}
         * @returns {string} - Texto formateado
         * @private
         */
        FileDropzone.prototype._formatText = function (item) {
            var text = item.text;
            var fileName = item.file.name;
            var fileType = this._getFileType(item.file);

            // Si es una imagen, solo envolver en simba_image (sin simba_document)
            if (fileType === 'image') {
                if (text.includes("<simba_image")) {
                    return text;
                }

                var contentMatch = text.match(/^# Análisis de la imagen [^\n]*\n\n([\s\S]*)$/);
                var imageContent = contentMatch ? contentMatch[1] : text;

                return '<simba_image data-filename="' + fileName + '">\n' + imageContent + '\n</simba_image>';
            }

            // Para archivos no-imagen, lógica existente
            if (text.includes("<simba_document") && this.options.useSimbaDocumentTags) {
                return text;
            } else if (text.includes("<simba_document") && !this.options.useSimbaDocumentTags) {
                // Convertir a texto plano
                var matches = text.match(/<simba_document[^>]*data-page="(\d+)"[^>]*>\s*([\s\S]*?)\s*<\/simba_document>/g);
                if (matches && matches.length > 0) {
                    var plainText = "";
                    for (var i = 0; i < matches.length; i++) {
                        var pageMatch = matches[i].match(/<simba_document[^>]*data-page="(\d+)"[^>]*>\s*([\s\S]*?)\s*<\/simba_document>/);
                        if (pageMatch && pageMatch.length >= 3) {
                            var pageNum = pageMatch[1];
                            var pageContent = pageMatch[2];
                            plainText += "--- Página " + pageNum + " ---\n\n" + pageContent + "\n\n";
                        }
                    }
                    return plainText;
                } else {
                    return text.replace(/<\/?simba_document[^>]*>/g, '');
                }
            } else if (!text.includes("<simba_document") && this.options.useSimbaDocumentTags) {
                // Agregar etiquetas simba_document (solo para archivos no-imagen)
                var pageMarkers = text.match(/---\s*Página\s*(\d+)\s*---/g);
                if (pageMarkers && pageMarkers.length > 0) {
                    var pages = text.split(/---\s*Página\s*\d+\s*---/);
                    pages.shift();

                    var simbaText = "";
                    for (var i = 0; i < pages.length; i++) {
                        var pageNum = i + 1;
                        var pageContent = pages[i].trim();
                        simbaText += '<simba_document data-filename="' + fileName + '" data-page="' + pageNum + '">\n' + pageContent + '\n</simba_document>\n\n';
                    }
                    return simbaText;
                } else {
                    return '<simba_document data-filename="' + fileName + '" data-page="1">\n' + text + '\n</simba_document>';
                }
            } else {
                return text;
            }
        };

        FileDropzone.prototype.getCombinedExtractedText = function (separator, userPrompt) {
            separator = separator || "\n\n";
            userPrompt = userPrompt || "Describe in detail this image"; // Fallback por defecto

            var result = "";
            var self = this;
            var imagePromises = [];

            // Primera pasada: procesar archivos no-imagen y recopilar imágenes
            var nonImageTexts = [];
            var imageFiles = [];

            this.uploadedFiles.forEach(function (file) {
                var fileType = self._getFileType(file);

                if (fileType === 'image') {
                    // Si es imagen y no tiene texto extraído o tiene el marcador pending
                    if (!file.extractedText || file.extractedText === "pending_vision_analysis") {
                        imageFiles.push(file);
                    } else {
                        // Ya tiene texto extraído (por ejemplo, de OCR anterior)
                        nonImageTexts.push({
                            file: file,
                            text: file.extractedText
                        });
                    }
                } else if (file.extractedText) {
                    // Archivo no-imagen con texto
                    nonImageTexts.push({
                        file: file,
                        text: file.extractedText
                    });
                }
            });
// Función helper para formatear texto según configuración
            // Si hay imágenes pendientes de análisis, procesarlas
            if (imageFiles.length > 0) {
                console.log('Processing ' + imageFiles.length + ' images with vision analysis...');

                // Crear promesas para todas las imágenes
                // En getCombinedExtractedText, cuando se inicia el análisis de imágenes:
                imageFiles.forEach(function (file) {
                    // AGREGAR: Mostrar indicador de procesamiento específico para imágenes
                    var fileItem = self.dropzone.querySelector(`.file-item[data-file-id="${file.name}"]`);
                    if (fileItem && self._getFileType(file) === 'image') {
                        // Crear overlay de procesamiento para imágenes
                        var processingOverlay = document.createElement('div');
                        processingOverlay.className = 'image-processing-overlay';
                        processingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            z-index: 10;
        `;

                        processingOverlay.innerHTML = `
            <div style="text-align: center; color: white;">
                <i class="fa fa-eye" style="animation: pulse 1.5s infinite;"></i>
                <div style="margin-top: 8px; font-size: 10px;">Analyzing image...</div>
            </div>
        `;

                        fileItem.appendChild(processingOverlay);
                    }

                    var promise = self._analyzeImageWithVision(file, userPrompt, false) // usando hardcoded
                        .then(function (description) {
                            // AGREGAR: Remover overlay de procesamiento
                            var fileItem = self.dropzone.querySelector(`.file-item[data-file-id="${file.name}"]`);
                            if (fileItem) {
                                var overlay = fileItem.querySelector('.image-processing-overlay');
                                if (overlay) {
                                    overlay.remove();
                                }
                            }

                            // Solo agregar título, sin envolver en simba_image
                            var formattedDescription = "# Análisis de la imagen " + file.name + "\n\n" + description;

                            // Actualizar el archivo con el texto extraído
                            file.extractedText = formattedDescription;
                            self.updateFileWithExtractedContent(file.name, formattedDescription, false);

                            return {
                                file: file,
                                text: formattedDescription
                            };
                        })
                        .catch(function (error) {
                            // AGREGAR: Remover overlay también en caso de error
                            var fileItem = self.dropzone.querySelector(`.file-item[data-file-id="${file.name}"]`);
                            if (fileItem) {
                                var overlay = fileItem.querySelector('.image-processing-overlay');
                                if (overlay) {
                                    overlay.remove();
                                }
                            }

                            console.error('Error analyzing image ' + file.name + ':', error);
                            var errorText = "Error analyzing image: " + error.message;

                            file.extractedText = errorText;
                            self.updateFileWithExtractedContent(file.name, errorText, true);

                            return {
                                file: file,
                                text: errorText
                            };
                        });

                    imagePromises.push(promise);
                });

                // Esperar a que todas las imágenes se procesen
                return Promise.all(imagePromises).then(function (imageResults) {
                    // Combinar textos de archivos no-imagen y resultados de imágenes
                    var allTexts = nonImageTexts.concat(imageResults);

                    // Construir resultado final
                    allTexts.forEach(function (item) {
                        if (result) {
                            result += separator;
                        }
                        result += this._formatText(item)//formatText(item);
                    });

                    return result;
                });
            } else {
                // No hay imágenes pendientes, procesar sincrónicamente
                nonImageTexts.forEach(function (item) {
                    if (result) {
                        result += separator;
                    }
                    result += this._formatText(item);
                });

                return Promise.resolve(result);
            }
        };

        /**
         * Procesa imágenes en segundo plano después de mostrar el mensaje
         * @param {string} containerId - ID del contenedor donde están las imágenes
         * @param {string} userPrompt - Prompt del usuario
         * @returns {Promise<Array>} - Promise con descripciones
         */
        FileDropzone.prototype.processImagesInBackground = function (containerId, userPrompt, imageFilesArray) {
            var self = this;

            // Si se pasa un array, usarlo; si no, buscar en uploadedFiles
            var imageFiles = imageFilesArray || this.uploadedFiles.filter(function (file) {
                return self._getFileType(file) === 'image';
            });

            if (imageFiles.length === 0) {
                return Promise.resolve([]);
            }

            console.log('Processing ' + imageFiles.length + ' images in background...');

            var imagePromises = imageFiles.map(function (file) {
                return new Promise(function (resolve, reject) {
                    // Encontrar la imagen en el chat
                    var container = document.getElementById(containerId);
                    if (!container) {
                        console.warn('Container not found:', containerId);
                        resolve({file: file, description: null, error: 'Container not found'});
                        return;
                    }

                    var imageCard = container.querySelector('[data-file-id="' + file.name + '"]');
                    if (!imageCard) {
                        console.warn('Image card not found for:', file.name);
                        resolve({file: file, description: null, error: 'Image card not found'});
                        return;
                    }

                    // Crear overlay de procesamiento
                    var processingOverlay = document.createElement('div');
                    processingOverlay.className = 'chat-image-processing-overlay';
                    processingOverlay.style.cssText = `
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex; align-items: center; justify-content: center;
                border-radius: 8px; z-index: 10;
            `;
                    processingOverlay.innerHTML = `
                <div style="text-align: center; color: white;">
                    <i class="fa fa-eye" style="animation: pulse 1.5s infinite;"></i>
                    <div style="margin-top: 8px; font-size: 10px;">Analyzing image...</div>
                </div>
            `;

                    imageCard.appendChild(processingOverlay);

                    // Procesar imagen (usar hardcoded=true temporalmente para evitar errores de red)
                    self._analyzeImageWithVision(file, userPrompt, false) // Cambiar a false cuando la API funcione
                        .then(function (description) {
                            // Remover overlay
                            if (processingOverlay.parentNode) {
                                processingOverlay.remove();
                            }

                            // Actualizar archivo
                            var formattedDescription = "# Análisis de la imagen " + file.name + "\n\n" + description;
                            file.extractedText = formattedDescription;

                            resolve({
                                file: file,
                                description: formattedDescription,
                                success: true
                            });
                        })
                        .catch(function (error) {
                            // Remover overlay
                            if (processingOverlay.parentNode) {
                                processingOverlay.remove();
                            }

                            console.error('Error analyzing image ' + file.name + ':', error);
                            resolve({
                                file: file,
                                description: null,
                                error: error.message,
                                success: false
                            });
                        });
                });
            });

            return Promise.all(imagePromises);
        };

        FileDropzone.prototype.getCombinedExtractedTextSync = function (analysisType) {
            var result = "";
            var separator = "\n\n";
            var self = this;

            this.uploadedFiles.forEach(function (file) {
                var fileType = this._getFileType(file);

                // Para imágenes, verificar si deben procesarse según el tipo
                if (fileType === 'image') {
                    // Solo incluir si hay análisis y está permitido
                    if (file.extractedText &&
                        file.extractedText !== "pending_vision_analysis" &&
                        analysisType) {

                        if (result) result += separator;
                        result += self._formatText({
                            file: file,
                            text: file.extractedText
                        });
                    }
                }
                // Para archivos no-imagen, lógica normal
                else if (file.extractedText) {
                    if (result) result += separator;
                    result += self._formatText({
                        file: file,
                        text: file.extractedText
                    });
                }
            }, this);

            return result;
        };
        // =============================================================================
// INTEGRACIÓN DE DOCX.JS CON FILEDROPZONE
// =============================================================================

// ========================================
// 1. AGREGAR A TU HTML (antes de FileDropzone):
// ========================================

        /*
        <script src="https://unpkg.com/docx-preview@0.1.4/dist/docx-preview.min.js"></script>
        */

// ========================================
// 2. FUNCIONES PARA AGREGAR A FILEDROPZONE.JS:
// ========================================

        /**
         * Renderiza archivo Word usando docx.js
         * @param {string} fileName - Nombre del archivo Word ya cargado
         * @param {HTMLElement} container - Elemento donde mostrar el documento
         * @public
         */
        FileDropzone.prototype.renderWordWithDocxJs = function (fileName, container) {
            var self = this;

            // Buscar el archivo Word
            var wordFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'word';
            });

            if (!wordFile) {
                console.error('Word file not found:', fileName);
                return;
            }

            if (typeof docx === 'undefined') {
                console.error('docx-preview library not loaded');
                return;
            }

            // Leer el archivo como ArrayBuffer
            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                // Renderizar con docx.js
                docx.renderAsync(arrayBuffer, container)
                    .then(function () {
                        console.log('Word document rendered successfully');
                    })
                    .catch(function (error) {
                        console.error('Error rendering Word document:', error);
                        container.innerHTML = '<p>Error rendering document: ' + error.message + '</p>';
                    });
            };

            reader.onerror = function () {
                console.error('Error reading file');
                container.innerHTML = '<p>Error reading file</p>';
            };

            reader.readAsArrayBuffer(wordFile);
        };

        /**
         * Muestra archivo Word en nueva ventana usando docx.js
         * @param {string} fileName - Nombre del archivo Word
         * @public
         */
        FileDropzone.prototype.previewWordWithDocxJs = function (fileName) {
            var self = this;

            // Crear nueva ventana
            var newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');

            newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Preview: ${fileName}</title>
            <script src="https://unpkg.com/docx-preview@0.1.4/dist/docx-preview.min.js"></script>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }
                .header {
                    background: white;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .container {
                    background: white;
                    padding: 20px;
                    border-radius: 5px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    min-height: 500px;
                }
                .loading {
                    text-align: center;
                    padding: 50px;
                    color: #666;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>📄 ${fileName}</h2>
                <p>Rendered with docx.js</p>
            </div>
            <div class="container" id="docx-container">
                <div class="loading">Loading document...</div>
            </div>
        </body>
        </html>
    `);

            newWindow.document.close();

            // Esperar a que se cargue docx.js en la nueva ventana
            newWindow.addEventListener('load', function () {
                setTimeout(function () {
                    if (typeof newWindow.docx !== 'undefined') {
                        var container = newWindow.document.getElementById('docx-container');
                        self.renderWordInWindow(fileName, container, newWindow);
                    } else {
                        console.error('docx.js not loaded in new window');
                    }
                }, 500);
            });
        };

        /**
         * Renderiza Word en ventana específica
         * @param {string} fileName - Nombre del archivo
         * @param {HTMLElement} container - Contenedor en la ventana
         * @param {Window} targetWindow - Ventana donde renderizar
         * @private
         */
        FileDropzone.prototype.renderWordInWindow = function (fileName, container, targetWindow) {
            var self = this;

            var wordFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'word';
            });

            if (!wordFile) {
                container.innerHTML = '<p>File not found</p>';
                return;
            }

            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                targetWindow.docx.renderAsync(arrayBuffer, container)
                    .then(function () {
                        console.log('Document rendered in new window');
                    })
                    .catch(function (error) {
                        console.error('Error rendering:', error);
                        container.innerHTML = '<p>Error rendering document: ' + error.message + '</p>';
                    });
            };

            reader.readAsArrayBuffer(wordFile);
        };

        /**
         * Modifica el botón de visualización para usar docx.js con archivos Word
         * @param {string} fileName - Nombre del archivo
         * @public
         */
        FileDropzone.prototype.showWordPreviewOptions = function (fileName) {
            var self = this;
            self.previewWordWithDocxJs(fileName);
            return false;
            if (this.options.framework7) {
                // Usar Framework7 action sheet
                this.options.framework7.actions.create({
                    text: 'Choose preview method for ' + fileName,
                    buttons: [
                        {
                            text: '📄 Rich Preview (docx.js)',
                            onClick: function () {
                                self.previewWordWithDocxJs(fileName);
                            }
                        },
                        {
                            text: '📝 Text Preview',
                            onClick: function () {
                                var wordFile = self.uploadedFiles.find(f => f.name === fileName);
                                if (wordFile && wordFile.extractedText) {
                                    self.showExtractedText(fileName, wordFile.extractedText);
                                }
                            }
                        },
                        {
                            text: 'Cancel',
                            color: 'red'
                        }
                    ]
                }).open();
            } else {
                // Usar confirm simple
                if (confirm('¿Usar vista rica con docx.js (OK) o texto plano (Cancel)?')) {
                    this.previewWordWithDocxJs(fileName);
                } else {
                    var wordFile = this.uploadedFiles.find(f => f.name === fileName);
                    if (wordFile && wordFile.extractedText) {
                        this.showExtractedText(fileName, wordFile.extractedText);
                    }
                }
            }
        };

        // =============================================================================
// DOCX.JS INTEGRADO CON EDITCONTENT
// =============================================================================

        /**
         * Convierte Word a HTML usando docx.js y lo muestra en editContent
         * @param {string} fileName - Nombre del archivo Word
         * @public
         */
        FileDropzone.prototype.showWordInEditContent = function (fileName) {
            var self = this;

            // Buscar el archivo Word
            var wordFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'word';
            });

            if (!wordFile) {
                console.error('Word file not found:', fileName);
                return;
            }

            if (typeof docx === 'undefined') {
                console.error('docx-preview library not loaded');
                // Fallback a texto plano
                if (wordFile.extractedText) {
                    editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
                }
                return;
            }

            // Crear contenedor temporal para docx.js
            var tempContainer = document.createElement('div');
            tempContainer.style.display = 'none';
            document.body.appendChild(tempContainer);

            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                // Renderizar con docx.js en contenedor temporal
                docx.renderAsync(arrayBuffer, tempContainer)
                    .then(function () {
                        // Obtener el HTML generado
                        var htmlContent = tempContainer.innerHTML;

                        // Limpiar el contenedor temporal
                        document.body.removeChild(tempContainer);

                        // Mostrar en editContent
                        if (typeof editContent === 'function') {
                            editContent(htmlContent, 'editor_' + Date.now(), fileName, false, 'html');
                        } else {
                            console.error('editContent function not available');
                        }

                        console.log('Word document converted to HTML and shown in editContent');
                    })
                    .catch(function (error) {
                        console.error('Error rendering Word document:', error);

                        // Limpiar contenedor temporal
                        document.body.removeChild(tempContainer);

                        // Fallback a texto plano
                        if (wordFile.extractedText) {
                            editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
                        } else {
                            editContent('Error rendering Word document: ' + error.message, 'editor_' + Date.now(), fileName);
                        }
                    });
            };

            reader.onerror = function () {
                console.error('Error reading file');
                document.body.removeChild(tempContainer);

                // Fallback a texto plano
                if (wordFile.extractedText) {
                    editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
                }
            };

            reader.readAsArrayBuffer(wordFile);
        };

        /**
         * Convierte Word a HTML usando Mammoth.js y lo muestra en editContent
         * @param {string} fileName - Nombre del archivo Word
         * @public
         */
        FileDropzone.prototype.showWordAsHtmlInEditContent = function (fileName) {
            var self = this;

            var wordFile = this.uploadedFiles.find(function (file) {
                return file.name === fileName && self._getFileType(file) === 'word';
            });

            if (!wordFile) {
                console.error('Word file not found:', fileName);
                return;
            }

            var reader = new FileReader();

            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                if (typeof mammoth !== 'undefined') {
                    mammoth.convertToHtml({arrayBuffer: arrayBuffer})
                        .then(function (result) {
                            var html = result.value;

                            // Mostrar en editContent
                            if (typeof editContent === 'function') {
                                editContent(html, 'editor_' + Date.now(), fileName, false, 'html');
                            } else {
                                console.error('editContent function not available');
                            }
                        })
                        .catch(function (error) {
                            console.error('Error converting with Mammoth:', error);

                            // Fallback a texto plano
                            if (wordFile.extractedText) {
                                editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
                            }
                        });
                } else {
                    console.error('Mammoth.js not available');

                    // Fallback a texto plano
                    if (wordFile.extractedText) {
                        editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
                    }
                }
            };

            reader.readAsArrayBuffer(wordFile);
        };

        /**
         * Muestra opciones de visualización para archivos Word
         * @param {string} fileName - Nombre del archivo Word
         * @public

         FileDropzone.prototype.showWordViewOptions = function (fileName) {
         var self = this;
         self.showWordInEditContent(fileName);
         false;
         if (this.options.framework7) {
         this.options.framework7.actions.create({
         text: 'Choose view method for ' + fileName,
         buttons: [
         {
         text: '📄 Rich View (docx.js)',
         onClick: function () {
         self.showWordInEditContent(fileName);
         }
         },
         {
         text: '🌐 HTML View (Mammoth)',
         onClick: function () {
         self.showWordAsHtmlInEditContent(fileName);
         }
         },
         {
         text: '📝 Text View',
         onClick: function () {
         var wordFile = self.uploadedFiles.find(f => f.name === fileName);
         if (wordFile && wordFile.extractedText) {
         editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
         }
         }
         },
         {
         text: 'Cancel',
         color: 'red'
         }
         ]
         }).open();
         } else {
         // Versión simple con prompt
         var choice = prompt(
         'Choose view method for ' + fileName + ':\n' +
         '1 - Rich View (docx.js)\n' +
         '2 - HTML View (Mammoth)\n' +
         '3 - Text View\n' +
         'Enter 1, 2, or 3:'
         );

         switch (choice) {
         case '1':
         self.showWordInEditContent(fileName);
         break;
         case '2':
         self.showWordAsHtmlInEditContent(fileName);
         break;
         case '3':
         default:
         var wordFile = self.uploadedFiles.find(f => f.name === fileName);
         if (wordFile && wordFile.extractedText) {
         editContent(wordFile.extractedText, 'editor_' + Date.now(), fileName);
         }
         break;
         }
         }
         }; */


        // Al final de FileDropzone.js, antes del cierre
        FileDropzone.prototype.disable = function () {
            this.disabled = true;
            if (this.dropzone) {
                this.dropzone.style.display = 'none';
            }

            // Simplemente añadir una clase CSS para deshabilitar visualmente
            if (this.dropzone) {
                this.dropzone.classList.add('dropzone-disabled');
            }

        };

        FileDropzone.prototype.enable = function () {
            this.disabled = false;
            if (this.dropzone) {
                this.dropzone.style.display = 'block';
                this.dropzone.classList.remove('dropzone-disabled');
            }

        };

        FileDropzone.prototype.hasFiles = function () {
            return this.uploadedFiles && this.uploadedFiles.length > 0;
        };

        FileDropzone.prototype.isEnabled = function () {
            return !this.disabled;
        };

        /**
         * Analyzes an image using vision model
         * @param {File} imageFile - The image file to analyze
         * @param {boolean} useHardcoded - If true, returns hardcoded text for testing
         * @returns {Promise<string>} - Promise that resolves with image description
         * @private
         */
        FileDropzone.prototype._analyzeImageWithVision = function (imageFile, prompt, useHardcoded) {
            var self = this;
            prompt = prompt ?? 'describe detallamante la siguiente imagen'
            // Si se pasa el parámetro useHardcoded, devolver texto hardcodeado con delay
            if (useHardcoded === true) {
                return new Promise(function (resolve) {
                    // Simular tiempo de procesamiento (2-4 segundos aleatorio)
                    var delay = Math.random() * 2000 + 2000; // Entre 2000ms y 4000ms

                    setTimeout(function () {
                        resolve("Esta es una imagen de prueba que contiene varios elementos visuales. Se puede observar text, formas geométricas y colores diversos. La imagen parece ser un documento o captura de pantalla con información relevante para el contexto de la conversación.");
                    }, delay);
                });
            }

            return new Promise(function (resolve, reject) {
                var reader = new FileReader();

                reader.onload = function (e) {
                    var base64Data = e.target.result;

                    var payload = {
                        stream: false,
                        model: app.config.completion.vision,//"mistral-small-24B-instruct-2506-vision",//"phi-3-5-instruct-vision",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: prompt
                                    },
                                    {
                                        type: "image_url",
                                        image_url: {
                                            url: base64Data
                                        }
                                    }
                                ]
                            }
                        ],
                        max_tokens: 25000,
                        stream_options: {
                            include_usage: true
                        },
                        temperature: 0.1
                    };

                    var apiUrl = window.config && window.config.completion
                        ? window.config.completion.url
                        : self.options.visionApiUrl;

                    var apiKey = window.config && window.config.completion
                        ? window.config.completion.apiKey
                        : self.options.visionApiKey;

                    if (!apiUrl || !apiKey) {
                        reject(new Error('Vision API configuration not found'));
                        return;
                    }

                    fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + apiKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    })
                        .then(function (response) {
                            if (!response.ok) {
                                throw new Error('HTTP error ' + response.status);
                            }
                            return response.json();
                        })
                        .then(function (data) {
                            if (data && data.choices && data.choices[0] && data.choices[0].message) {
                                var description = data.choices[0].message.content;
                                resolve(description);
                            } else {
                                reject(new Error('Invalid response format'));
                            }
                        })
                        .catch(function (error) {
                            console.error('Vision API error:', error);
                            reject(new Error('Vision API failed: ' + error.message));
                        });
                };

                reader.onerror = function () {
                    reject(new Error('Failed to read image file'));
                };

                reader.readAsDataURL(imageFile);
            });
        };
        FileDropzone.prototype._createImagePreview = function (file, fileItem, isCompactMode) {
            isCompactMode = true;
            if (!file.type.startsWith('image/')) return;

            var imageUrl = URL.createObjectURL(file);
            file.previewUrl = imageUrl;

            // Ocultar elementos existentes
            var existingIcon = fileItem.querySelector('i');
            var existingName = fileItem.querySelector('.file-name');
            var existingActions = fileItem.querySelector('.file-actions');

            if (existingIcon) existingIcon.style.display = 'none';
            if (existingName) existingName.style.display = 'none';
            if (existingActions) existingActions.style.display = 'none';

            // Configurar estilo según modo
            if (isCompactMode) {
                // Modo compacto (50px altura)
                fileItem.className = 'file-item image-card-compact float-left';
                fileItem.style.cssText = `
            position: relative; 
            width: 80px; 
            height: 50px; 
            display: inline-block; 
            margin: 5px; 
            border-radius: 6px; 
            overflow: hidden; 
        `;
            } else {
                // Modo normal (120px)
                fileItem.className = 'file-item image-card float-left';
                fileItem.style.cssText = `
            position: relative; 
            width: 120px; 
            height: 120px; 
            display: inline-block; 
            margin: 5px; 
            border-radius: 8px; 
            overflow: hidden; 
        `;
            }

            fileItem.setAttribute('data-image-url', imageUrl);

            // Crear imagen
            var img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'image-card-thumbnail';
            img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer;';

            // Crear botón de eliminar
            var removeBtn = document.createElement('span');
            removeBtn.className = 'remove-file link';
            removeBtn.setAttribute('data-filename', file.name);
            removeBtn.style.cssText = `
        position: absolute; 
        top: 2px; 
        right: 2px; 
        z-index: 20; 
        background: rgba(73,73,73,0.9); 
        border-radius: 50%; 
        width: 20px; 
        height: 20px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer;
        transition: background-color 0.2s;
    `;
            removeBtn.innerHTML = '<i class="fa fa-times" style="font-size: 12px;"></i>';


            fileItem.insertBefore(img, fileItem.firstChild);
            fileItem.appendChild(removeBtn);

            var self = this;

            // Click en imagen para abrir visor
            img.addEventListener('click', function (e) {
                e.stopPropagation();
                self._openImageViewer(file.name, imageUrl);
            });

            // Click en botón eliminar
            removeBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.removeFile(file.name);
            });
        };
        /**
         * Opens Framework7 photo browser for image viewing
         * @param {string} fileName - Name of the image file
         * @param {string} imageUrl - URL of the image
         * @private
         */
        FileDropzone.prototype._openImageViewer = function (fileName, imageUrl) {
            if (!this.options.framework7) {
                // Fallback si no hay Framework7
                window.open(imageUrl, '_blank');
                return;/**
                 * Creates image preview for image files with card-like layout
                 * @param {File} file - The image file
                 * @param {HTMLElement} fileItem - The file item container
                 * @private
                 */

            }

            // Crear photo browser de Framework7
            var photoBrowser = this.options.framework7.photoBrowser.create({
                photos: [
                    {
                        url: imageUrl,
                        caption: fileName
                    }
                ],
                theme: 'dark',
                type: 'standalone',
                toolbar: false,
                popupCloseLinkText: '<i class="fa fa-times"></i>',
                navbar: true,
                navbarShowCount: false,
                iconsColor: 'white',
                swipeToClose: true,
                backLinkText: 'Back'
            });

            // Abrir el visor
            photoBrowser.open();
        };
// Expose the class to the global scope
        global.FileDropzone = FileDropzone;

    }
)
(typeof window !== 'undefined' ? window : this);