# Asistente SIMBA (Pantalla de Conversación)

Este documento resume exclusivamente la parte del proyecto relacionada con la pantalla del asistente SIMBA, describiendo su arquitectura, configuración y uso. El resto de la aplicación no se detalla aquí.

## Estructura principal

- **`partials/screens/conversation_refactored.html`**: plantilla Framework7 que renderiza la vista, compuesta por la barra superior, barra de mensajes, listado de mensajes, panel lateral de conversaciones, popovers y popups auxiliares. La plantilla importa el módulo JS refactorizado y la hoja de estilos específica del asistente.【F:partials/screens/conversation_refactored.html†L1-L1260】【F:partials/screens/conversation_refactored.html†L1261-L1265】
- **`assets/js/conversation_refactored.js`**: encapsula toda la lógica del asistente dentro de clases. Expone `ConversationContext`, `ConversationManagers`, `ConversationLifecycle` y `ConversationPage.render`, que Framework7 utiliza como componente principal.【F:assets/js/conversation_refactored.js†L1-L6】【F:assets/js/conversation_refactored.js†L8-L18】【F:assets/js/conversation_refactored.js†L5696-L5714】
- **`assets/custom/css/conversation_refactored.css`**: contiene los estilos dedicados al módulo (razonamiento, tarjetas de archivos, sugerencias, lista de conversaciones, etc.).【F:assets/custom/css/conversation_refactored.css†L1-L214】

## Clases y responsabilidades

### `ConversationContext`
Envuelve las props de Framework7 y el contexto del componente para facilitar el acceso a `$f7`, `$update`, `$render`, etc., evitando variables sueltas en el ámbito global.【F:assets/js/conversation_refactored.js†L1-L6】

### `ConversationManagers`
Centraliza la inicialización de los managers globales del ecosistema SIMBA (configuración, mensajes, fuentes, destacados). Mantiene referencias que se completan dinámicamente (`toolManager`, `mentionManager`, `voiceManager`, `conversationManager`).【F:assets/js/conversation_refactored.js†L8-L18】

### `ConversationLifecycle`
Centraliza la fase de inicialización y renderizado usando el contexto de Framework7 y los managers de SIMBA. Su método `render()` configura estados, listeners y devuelve el renderizador original. Gestiona:

- Estados principales (respuesta en streaming, barras, autosroll, banderas de razonamiento, etc.).【F:assets/js/conversation_refactored.js†L28-L160】
- Datos de usuario, asistentes, dispositivos y configuración de voz.【F:assets/js/conversation_refactored.js†L75-L124】
- Lógica de modelos (tokens, modelos base, instrucciones especiales de razonamiento).【F:assets/js/conversation_refactored.js†L133-L162】
- Inicialización del historial, carga de conversaciones, listeners de scroll, arrastrar archivos, popovers, validadores, etc. (ver comentarios secciones `INITIALIZATION`, `EVENT HANDLERS`, `HELPERS`).【F:assets/js/conversation_refactored.js†L164-L565】
- Integración con los managers: creación de mensajes, resumen de fuentes, resaltados, herramientas, tareas, API keys, estadísticas y eliminación de conversaciones.【F:assets/js/conversation_refactored.js†L566-L1512】
- Funcionalidades avanzadas: razonamiento step-by-step, control de modelos, visualización de referencias, render de archivos multimedia, OCR, reproducción de voz y gestión de tickets de soporte.【F:assets/js/conversation_refactored.js†L1513-L2699】

El módulo exporta por defecto `ConversationPage.render`, permitiendo que la plantilla lo importe directamente como componente Framework7.【F:assets/js/conversation_refactored.js†L5707-L5718】

## Configuración del asistente

1. **ConfigManager**: `configManager.getConfig()` lee la configuración activa (modelos, límites de tokens, flags de razonamiento). Ajuste los valores en el backend SIMBA o modifique el resultado antes de usarlo en la UI.【F:assets/js/conversation_refactored.js†L123-L153】
2. **Modelos**: `DEFAULT_MODEL`, `SUMMARY_MODEL` y `VISION_MODEL` definen las variantes por defecto. Puede personalizarlos para apuntar a otros endpoints de inferencia.【F:assets/js/conversation_refactored.js†L140-L153】
3. **Voz**: la bandera `VOICE_FEATURES_ENABLED` y `voiceConfig` controlan si se muestra el botón de dictado y cómo se inicializa el reconocimiento. Ajuste estos valores para habilitar o deshabilitar la experiencia de voz.【F:assets/js/conversation_refactored.js†L108-L124】
4. **Dispositivos y tickets**: la lista `devices` y el objeto `ticket` determinan las opciones del selector y del formulario de incidencias. Puede reemplazar estos valores con los de su organización.【F:assets/js/conversation_refactored.js†L92-L110】
5. **Personalización visual**: modifique `assets/custom/css/conversation_refactored.css` para adaptar colores, tamaños o interacciones (por ejemplo, tarjetas de archivos, sugerencias o badges de conversaciones).【F:assets/custom/css/conversation_refactored.css†L1-L214】

## Funcionalidades destacadas

- **Gestión de conversaciones**: listado lateral con búsqueda, agrupación y acciones (renombrar, eliminar, limpiar todo).【F:assets/js/conversation_refactored.js†L566-L862】
- **Mensajería enriquecida**: mensajes de asistente y usuario con historial, respuestas en streaming, indicadores de progreso y acciones contextualizadas.【F:assets/js/conversation_refactored.js†L863-L1512】
- **Fuentes y referencias**: `SourceManager` y elementos `reference-group` muestran citas y agrupan referencias con contadores visuales.【F:assets/js/conversation_refactored.js†L580-L926】【F:assets/custom/css/conversation_refactored.css†L154-L193】
- **Herramientas y menciones**: integración con tool calls, chips de asistentes alternativos y popover para cambiar de asistente.【F:assets/js/conversation_refactored.js†L927-L1410】
- **Archivos adjuntos**: soporte para arrastrar/soltar, previsualización de imágenes con overlays y acciones (ver, eliminar, OCR).【F:assets/js/conversation_refactored.js†L1116-L1410】【F:assets/custom/css/conversation_refactored.css†L39-L153】
- **Modo razonamiento**: conmutador que envía instrucciones adicionales para respuestas con secciones `[THINK]` ocultas y finales resumidos.【F:assets/js/conversation_refactored.js†L131-L162】【F:assets/js/conversation_refactored.js†L1918-L2116】
- **Soporte por voz**: manejo de grabación, estado de procesamiento y reproducción mediante `VoiceManager`.【F:assets/js/conversation_refactored.js†L2117-L2404】
- **Gestión de tickets**: formulario emergente para registrar incidencias asociadas a un dispositivo.【F:assets/js/conversation_refactored.js†L2405-L2536】

## Manual de usuario

1. **Abrir la pantalla** desde el menú principal para acceder al historial de conversaciones y al asistente principal.
2. **Seleccionar asistente** usando el popover de avatar si hay múltiples asistentes disponibles.【F:partials/screens/conversation_refactored.html†L7-L29】【F:assets/js/conversation_refactored.js†L927-L1008】
3. **Elegir dispositivo** en el chip superior para contextualizar la consulta. Si el asistente requiere selección, la barra centrada guía al usuario.【F:partials/screens/conversation_refactored.html†L34-L118】【F:assets/js/conversation_refactored.js†L92-L110】
4. **Escribir o dictar** un mensaje en la barra inferior. Se soporta entrada por teclado, atajos (Enter para enviar), dictado y pegado de texto largo.【F:partials/screens/conversation_refactored.html†L34-L154】【F:assets/js/conversation_refactored.js†L1005-L1236】
5. **Adjuntar archivos** arrastrándolos al área de dropzone o usando el botón de subida. Las imágenes muestran miniaturas con acciones para visualizar, eliminar u obtener OCR.【F:partials/screens/conversation_refactored.html†L81-L150】【F:assets/js/conversation_refactored.js†L1116-L1410】
6. **Revisar respuestas** con indicaciones de razonamiento, referencias y botones de herramientas. Los mensajes conservan un footer con accesos rápidos y referencias agrupadas.【F:assets/js/conversation_refactored.js†L131-L162】【F:assets/js/conversation_refactored.js†L1513-L2116】
7. **Gestionar la conversación** desde el panel lateral: renombrar, duplicar, consultar estadísticas o borrar conversaciones completas.【F:partials/screens/conversation_refactored.html†L653-L1252】【F:assets/js/conversation_refactored.js†L566-L926】
8. **Crear tickets o configurar** accesos a API y herramientas mediante los popups dedicados dentro de la misma pantalla.【F:partials/screens/conversation_refactored.html†L360-L1252】【F:assets/js/conversation_refactored.js†L926-L2536】

## Consejos de mantenimiento

- Mantenga sincronizadas las clases del módulo con los managers disponibles en `window.SIMBA`. Si se añade un nuevo manager, agréguelo a `ConversationManagers` para mantener la estructura centralizada.【F:assets/js/conversation_refactored.js†L25-L38】
- Cualquier modificación visual debe realizarse en la hoja de estilos externa para conservar la separación entre lógica y presentación.【F:partials/screens/conversation_refactored.html†L1261-L1265】【F:assets/custom/css/conversation_refactored.css†L1-L214】
- Para extender funcionalidades, cree métodos auxiliares dentro de `ConversationLifecycle` respetando las secciones existentes (comentarios `// ===========================================`). Esto ayuda a localizar rápidamente el área a modificar.【F:assets/js/conversation_refactored.js†L21-L5693】

