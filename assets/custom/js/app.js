var notificationQueue = [];
var isProcessingQueue = false;
var eventSource = [];
var popover = null;

var langs = {
    "0-0": { "value": "0-0", "text": "Autodetect Language" },
    "en-UK": { "value": "en-UK", "text": "English" },
    "es-ES": { "value": "es-ES", "text": "Spanish" },
    "fr-FR": { "value": "fr-FR", "text": "French" },
    "de-DE": { "value": "de-DE", "text": "German" },
    "it-IT": { "value": "it-IT", "text": "Italian" },
    "pt-BR": { "value": "pt-BR", "text": "Portuguese" },
    "tr-TR": { "value": "tr-TR", "text": "Turkish" }
    // You can add more languages here if necessary
};

function addNotificationToQueue(message, cssClass) {
    notificationQueue.push({ message, cssClass });
    processQueue();
}

function openMoreOptions(event,options){
    console.log(event);
    popover = app.popover.create({
        content: options,
    });

    popover.open(event.target);
}



function copyDivToClipboardWithStructure(jQueryObj, message) {
    let div;

    // Comprobar si jQueryObj es una cadena de texto
    if (typeof jQueryObj === 'string') {
        // Crear un div temporal y usar el texto como su HTML
        div = document.createElement('div');
        div.innerHTML = jQueryObj;
    } else if (jQueryObj && jQueryObj.length !== 0) {
        // Usar el objeto jQuery como antes
        div = jQueryObj.get(0);
    } else {
        console.error('Invalid input provided. It must be a jQuery object or a string.');
        return;
    }

    const cloneDiv = div.cloneNode(true);

    // Remove unnecessary elements
    const elementsToRemove = cloneDiv.querySelectorAll('.message-toolbar, .message-avatar, .message-name, .message-text-footer, .goto-message, .no-copy');
    elementsToRemove.forEach(element => element.remove());

    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(cloneDiv);
    selection.removeAllRanges();
    selection.addRange(range);

    const hiddenInputElement = document.createElement('textarea');
    hiddenInputElement.innerHTML = cloneDiv.innerHTML
        .replace(/<\/?ol>/g, '') // Remove <ol> and </ol> tags
        .replace(/<li>/g, '') // Remove <li> tags
        .replace(/<li>([a-d]\))/g, '\t$1') // Add one tab character before each answer option
        .replace(/<\/li>/g, '') // Remove </li> tags
        .replace(/<br\s*\/?>/g, '\n') // Replace <br> and <br/> with newline
        .replace(/<p>|<\/p>|<h2>|<\/h2>/g, '') // Remove <p>, </p>, <h2>, and </h2> tags
        .replace(/<\/?[^>]+(>|$)/g, '') // Remove all other HTML tags
        .replace(/(\n\s*){2,}/g, '\n') // Replace multiple consecutive newlines with a single newline
        .replace(/^\s+|\s+$/g, '') // Remove whitespace from the beginning and end
        .replace(/(\n[a-d]\))/g, '\t$1'); // Add one tab character before each answer option (fix for the first answer)
    hiddenInputElement.style.cssText = `
        position: absolute;
        left: -9999px;
        top: 0;
        opacity: 0;
    `;
    document.body.appendChild(hiddenInputElement);
    hiddenInputElement.select();

    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copy to clipboard was ' + msg);
        if (message) {
            app.toast.show({
                text: 'Copied to clipboard.',
                position: 'center',
                icon:'<i class="fa fa-copy"></i>'
            });
        }
    } catch (err) {
        console.error('Unable to copy to clipboard.', err);
    }

    selection.removeAllRanges();
    document.body.removeChild(hiddenInputElement);
}

function createToast(message, cssClass) {
    var toast = app.toast.create({
        text: message,
        cssClass: cssClass,
        closeButton: true,
        duration: 0,
        on: {
            open: function (toast) {
                toast.$el.on('click', function () {
                    toast.close();
                });
            },
            closed: function () {
                isProcessingQueue = false;
                processQueue();
            }
        }
    });
    toast.open();
}



function processQueue() {
    if (isProcessingQueue || notificationQueue.length === 0) {
        return;
    }

    isProcessingQueue = true;
    var notification = notificationQueue.shift();
    createToast(notification.message, notification.cssClass);
}
function speechText(text,lang) {
    var msg = new SpeechSynthesisUtterance(text);
    msg.addEventListener("end", (event) => {


        console.log('Utterance has finished being spoken after ${event.elapsedTime} seconds.');
    });
    msg.addEventListener("start", (event) => {


        console.log('Utterance has finished being spoken after ${event.elapsedTime} seconds.');
    });

    $("#chatbot-autospeech").removeClass('pulse')
    msg.lang = lang ?? 'en-UK';
    console.log(msg.lang)
    console.log(text)
    window.speechSynthesis.speak(msg);
}

/**
 * Function to fix list numbering in HTML content
 * @param {string} containerSelector - CSS selector for the container that holds the lists
 * @returns {boolean} - Returns true if successful, false if an error occurs
 */
function fixListNumbering(containerSelector) {
    return false;
    // Default to '.message-text' if no selector is provided
    containerSelector = containerSelector || '.message-text';

    // Save original content in case we need to restore it
    var originalContent = $(containerSelector).html();

    try {
        // Create a new ordered list
        var newOrderedList = $('<ol></ol>');

        // Find all ordered lists in the container
        var orderedLists = $(containerSelector).find('ol');

        // Check if there are any ordered lists to process
        if (orderedLists.length === 0) {
            console.error("No ordered lists found in the container");
            return false;
        }

        // Process each ordered list
        orderedLists.each(function(index) {
            // Get the first list item in this ordered list
            var mainPoint = $(this).find('li').first();

            // If no list item found, skip this ordered list
            if (mainPoint.length === 0) return;

            // Create a new list item for our new ordered list
            var newPoint = $('<li></li>').html(mainPoint.html());

            // Find the unordered list that follows this ordered list
            var detailsList = $(this).next('ul');

            // If there's an unordered list, add it to the new list item
            if (detailsList.length > 0) {
                newPoint.append(detailsList.clone());
            }

            // Add the new list item to our new ordered list
            newOrderedList.append(newPoint);
        });

        // Store all content that isn't lists
        var otherContent = $(containerSelector).contents().not('ol, ul').clone();

        // Clear the container
        $(containerSelector).empty();

        // Add back the non-list content
        $(containerSelector).append(otherContent);

        // Add the new ordered list
        $(containerSelector).append(newOrderedList);

        console.log("List numbering fixed successfully");
        return true;
    }
    catch (error) {
        // If an error occurs, restore the original content
        console.error("Error fixing list numbering:", error);
        $(containerSelector).html(originalContent);
        return false;
    }
}
// Eventos
/*window.onerror = function(message, source, lineno, colno, error) {
    var errorMessage = error ? error.stack : `${message} at ${lineno}:${colno}`;
    addNotificationToQueue('Script: <b>'+errorMessage+'</b>', 'color-red');
    return true;
};

window.addEventListener('unhandledrejection', function(event) {
    addNotificationToQueue('Script: <b>'+event.reason+'</b>', 'color-red');
});

(function() {
    var oldLog = console.log;
    console.log = function(message) {
        addNotificationToQueue('Log: <b>'+message+'</b>', 'color-orange');
        oldLog.apply(console, arguments);
    };
})()*/;
(function() {
    var oldLog = console.log;
    console.log = function(message) {
       return false;
    };
})