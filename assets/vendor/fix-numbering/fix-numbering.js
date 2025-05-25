/**
 * fixMarkdownNumbering.js
 *
 * Una solución genérica para corregir problemas de numeración en contenido
 * generado por LLMs y procesado por formateadores de Markdown.
 *
 * Esta solución es independiente de la estructura HTML específica y
 * funcionará con cualquier texto generado por un LLM que se haya
 * convertido a HTML desde Markdown.
 */

(function() {
    /**
     * Función principal que busca y arregla todas las listas numeradas en el documento
     * @param {string} selector - Selector CSS para el contenedor donde buscar listas (opcional)
     */
    function fixMarkdownNumbering(selector = 'body') {
        // 1. Identificar todas las listas ordenadas (ol) en el documento
        const allOrderedLists = document.querySelectorAll(`${selector} ol`);

        // 2. Procesar cada lista ordenada
        allOrderedLists.forEach(function(list) {
            // Determinar si es una lista de nivel superior o anidada
            const isTopLevel = !list.parentElement.closest('li');

            if (isTopLevel) {
                // 3. Corregir la lista de nivel superior
                fixTopLevelList(list);
            }
        });

        // 4. Buscar patrones comunes de error en la numeración aunque no sean listas HTML correctas
        fixBrokenMarkdownLists(selector);
    }

    /**
     * Corrige una lista ordenada de nivel superior
     * @param {HTMLElement} list - Elemento ol a corregir
     */
    function fixTopLevelList(list) {
        // Encontrar todos los elementos li directos
        const items = list.children;

        // Establecer el contador para la numeración correcta
        let counter = 1;

        // Recorrer cada elemento de la lista
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Solo procesar elementos li (por si hay otros elementos en medio)
            if (item.tagName.toLowerCase() === 'li') {
                // Corregir la numeración usando la propiedad value
                item.value = counter;

                // Si el texto comienza con un número seguido de punto, corregirlo
                const content = item.innerHTML;
                const regex = /^\s*\d+\.\s*/;

                if (regex.test(content)) {
                    // Reemplazar el número incorrecto con el número correcto
                    item.innerHTML = content.replace(regex, `${counter}. `);
                }

                // Incrementar el contador
                counter++;
            }
        }
    }

    /**
     * Busca y corrige patrones comunes de error en listas que no están en formato HTML correcto
     * @param {string} selector - Selector CSS para el contenedor donde buscar
     */
    function fixBrokenMarkdownLists(selector) {
        // Encontrar todos los elementos en el documento
        const allElements = document.querySelectorAll(`${selector} *`);

        // Variables para rastrear el estado de la lista actual
        let inNumberedSection = false;
        let currentCounter = 1;
        let lastNumberedElement = null;

        // Revisar todos los elementos en busca de patrones de numeración
        allElements.forEach(function(element) {
            // Buscar patrones como "1. Título:" o similares
            const content = element.innerHTML;
            const numberMatch = content.match(/^\s*(\d+)\.\s+(.*)/);

            if (numberMatch) {
                // Es un elemento numerado
                const currentNumber = parseInt(numberMatch[1], 10);
                const text = numberMatch[2];

                // Si acabamos de comenzar una nueva sección numerada o estamos en una diferente
                if (!inNumberedSection || (lastNumberedElement && !isConsecutiveElement(lastNumberedElement, element))) {
                    inNumberedSection = true;
                    currentCounter = 1;
                }

                // Corregir la numeración
                element.innerHTML = content.replace(/^\s*\d+\./, `${currentCounter}.`);

                // Agregar una clase para poder aplicar estilos después
                element.classList.add('fixed-numbered-item');

                // Actualizar el estado
                lastNumberedElement = element;
                currentCounter++;
            } else {
                // Comprobamos si esto es un separador que indica el fin de una sección numerada
                const isSeparator = element.tagName === 'HR' ||
                    (element.tagName === 'H1' || element.tagName === 'H2' || element.tagName === 'H3');

                if (isSeparator) {
                    inNumberedSection = false;
                }
            }
        });
    }

    /**
     * Comprueba si dos elementos son consecutivos en el DOM
     * @param {HTMLElement} elem1 - Primer elemento
     * @param {HTMLElement} elem2 - Segundo elemento
     * @return {boolean} - True si los elementos son consecutivos
     */
    function isConsecutiveElement(elem1, elem2) {
        // Revisar si los elementos son hermanos directos
        if (elem1.nextElementSibling === elem2) return true;

        // También revisar si están separados por elementos de texto o elementos vacíos
        let current = elem1.nextElementSibling;
        while (current && current !== elem2) {
            // Si hay contenido significativo entre ellos, no son consecutivos
            if (current.textContent.trim().length > 0 &&
                !['BR', 'HR'].includes(current.tagName)) {
                return false;
            }
            current = current.nextElementSibling;
        }

        return current === elem2;
    }

    /**
     * Función más sofisticada para detectar y corregir texto markdown mal convertido
     * @param {string} selector - Selector para el contenedor
     */
    function fixMarkdownTextContent(selector) {
        const container = document.querySelector(selector);
        if (!container) return;

        // Obtener el HTML completo
        let html = container.innerHTML;

        // 1. Buscar patrones de numeración consecutivos incorrectos como "1. ... 1. ... 1. ..."
        const sectionHeadingPattern = /(<[^>]+>)?\s*1\.\s+([^<:]+)(:|<\/[^>]+>)/g;

        // Función para reemplazar con números incrementales
        let counter = 1;
        html = html.replace(sectionHeadingPattern, function(match, startTag, text, endTag) {
            const replacement = `${startTag || ''}${counter}. ${text}${endTag}`;
            counter++;
            return replacement;
        });

        // 2. Restaurar el HTML corregido
        container.innerHTML = html;

        // 3. Aplicar estilos CSS para garantizar que las listas se vean correctamente
        applyFixedStyles(selector);
    }

    /**
     * Aplica estilos CSS para que las listas corregidas se vean bien
     * @param {string} selector - Selector para el contenedor
     */
    function applyFixedStyles(selector) {
        // Crear un elemento de estilo
        const styleElement = document.createElement('style');
        styleElement.textContent = `
      ${selector} ol {
        counter-reset: item;
      }
      
      ${selector} ol > li {
        display: block;
        counter-increment: item;
      }
      
      ${selector} .fixed-numbered-item {
        position: relative;
        margin-left: 2em;
      }
      
      ${selector} .fixed-numbered-item:before {
        content: counter(section) ". ";
        counter-increment: section;
        font-weight: bold;
        position: absolute;
        left: -2em;
      }
    `;

        // Añadir al head del documento
        document.head.appendChild(styleElement);
    }

    // Función integrada - detecta el tipo de error de numeración y aplica la corrección adecuada
    function autoFixNumbering(selector = 'body') {
        // 1. Intentar el método estándar para listas bien formadas
        fixMarkdownNumbering(selector);

        // 2. Intentar el método para texto markdown puro mal convertido
        fixMarkdownTextContent(selector);

        // 3. Dar retroalimentación
        console.log('Corrección de numeración aplicada');
    }

    // Exponer al ámbito global
    window.fixMarkdownNumbering = fixMarkdownNumbering;
    window.autoFixNumbering = autoFixNumbering;
})();

// Versión jQuery si está disponible jQuery
if (typeof jQuery !== 'undefined') {
    (function($) {
        $.fn.fixMarkdownNumbering = function() {
            return this.each(function() {
                window.fixMarkdownNumbering('#' + this.id);
            });
        };

        // Inicializar automáticamente si se encuentra un elemento con la clase
        $(document).ready(function() {
            $('.auto-fix-numbering').each(function() {
                $(this).fixMarkdownNumbering();
            });
        });
    })(jQuery);
}

/**
 * ALTERNATIVA: Solución completa con CSS puro
 * Esta solución no modifica el HTML y corrige los errores visualmente
 */
function applyCSSOnlyFix(selector = 'body') {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
    /* Reset cualquier numeración manual existente */
    ${selector} ol {
      counter-reset: section;
      list-style-type: none !important;
    }
    
    /* Asignar numeración automática a cada elemento li */
    ${selector} ol > li {
      counter-increment: section;
      position: relative;
      padding-left: 2em;
    }
    
    /* Mostrar el número correcto */
    ${selector} ol > li::before {
      content: counter(section) ".";
      position: absolute;
      left: 0;
      font-weight: bold;
    }
    
    /* Ocultar números originales incorrectos */
    ${selector} ol > li > strong,
    ${selector} ol > li > b {
      position: relative;
    }
    
    /* Estilo para elementos que parecen encabezados numerados pero no están en listas */
    ${selector} [class*="section"],
    ${selector} [class*="numbered"],
    ${selector} [class*="step"] {
      counter-increment: standalone;
      position: relative;
    }
    
    ${selector} p:first-child:not(:only-child) {
      counter-increment: paragraph;
    }
  `;

    document.head.appendChild(styleElement);
    console.log('Solución CSS aplicada');
}

// Detectar automáticamente el tipo de documento y aplicar la mejor solución
function intelligentNumberingFix(selector = 'body') {
    const container = document.querySelector(selector);
    if (!container) return false;

    // Determinar la estrategia de corrección según la estructura del documento
    const hasProperLists = container.querySelectorAll('ol').length > 0;
    const hasBrokenNumerics = /\d+\.\s+[A-Z]/g.test(container.innerHTML);

    if (hasProperLists) {
        // Tiene listas HTML correctas - usar el método estándar
        fixMarkdownNumbering(selector);
        return true;
    } else if (hasBrokenNumerics) {
        // Tiene números incorrectos pero no en listas - usar la solución de texto
        fixMarkdownTextContent(selector);
        return true;
    } else {
        // Cuando no hay un patrón claro, intentar la solución CSS
        applyCSSOnlyFix(selector);
        return true;
    }
}

// Función principal simplificada para usar
function fixNumbering(selector = 'body') {
    return intelligentNumberingFix(selector);
}