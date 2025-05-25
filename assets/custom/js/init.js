'use strict';

/*
|------------------------------------------------------------------------------
| Check For Layout URL Parameter
|------------------------------------------------------------------------------
*/

if (location.search.indexOf('layout=')>=0) {
    let layout = location.search.split('layout=')[1].split('&')[0];
    if (layout in window.config.layout && layout != 'default') {
        window.config.layout.default = layout;
    }
}

/*
|------------------------------------------------------------------------------
| Set Configuration Variables
|------------------------------------------------------------------------------
*/

Framework7.prototype.config = window.config;

/*
|------------------------------------------------------------------------------
| Set 404 Route
|------------------------------------------------------------------------------
*/

window.routes.push({
    path: '(.*)',
    componentUrl: './partials/screens/404.html'
});

/*
|------------------------------------------------------------------------------
| Import Framework7 Plugins
|------------------------------------------------------------------------------
*/

if ('Framework7Keypad' in window) {
    Framework7.use(Framework7Keypad);
}

/*
|------------------------------------------------------------------------------
| Initialize App
|------------------------------------------------------------------------------
*/

window.app = new Framework7({
    el: '#app',
    componentUrl: './partials/app.html',
    id: window.config.app.id,
    name: window.config.app.title,
    version: window.config.app.version,
    theme: location.search.indexOf('theme=')>=0 ? location.search.split('theme=')[1].split('&')[0] : window.config.theming.theme == 'auto' ? (Framework7.device.desktop ? 'aurora' : 'auto') : window.config.theming.theme,
    autoDarkMode: window.config.theming.enabled && localStorage.getItem('Nectar_Theme_Mode') == 'system' || window.config.theming.mode == 'system',
    language: document.querySelector('html').getAttribute('lang'),
    rtl: document.querySelector('html').getAttribute('dir') == 'rtl',
    routes: window.routes,
    store: window.store,
    serviceWorker: {
        path: '',//./service-worker.js',
        scope: '.'
    },
    init: false,
    initOnDeviceReady: false,
    actions: {
        closeByOutsideClick: true,
        closeOnEscape: true
    },
    autocomplete: {
        autoFocus: true,
        closeOnSelect: true,
        notFoundText: 'No Search Results',
        popupPush: true,
        popupSwipeToClose: Framework7.device.standalone,
        preloader: true,
        searchbarPlaceholder: 'Search'
    },
    calendar: {
        locale: document.querySelector('html').getAttribute('lang'),
        header: true,
        headerPlaceholder: 'Select Date',
        timePickerPlaceholder: 'Select Time'
    },
    card: {
        backdrop: false
    },
    colorPicker: {
        navbarTitleText: 'Select Color',
        popupPush: true
    },
    dialog: {
        buttonOk: 'OK'
    },
    iosTranslucentBars: false,
    iosTranslucentModals: false,
    lazy: {
        threshold: 56
    },
    navbar: {
        mdCenterTitle: true,
        showOnPageScrollEnd: false
    },
    notification: {
        title: window.config.app.title,
        icon: `<img class="shape-auto if-not-dark" src="${window.config.app.logos.logomarkSquareLight || window.config.app.logos.logomarkLight}" alt="" /><img class="shape-auto if-dark" src="${window.config.app.logos.logomarkSquareDark || window.config.app.logos.logomarkDark}" alt="" />`,
        closeButton: true
    },
    photoBrowser: {
        popupCloseLinkText: '<i class="icon material-icons">cancel</i>',
        popupPush: true,
        swipeToClose: Framework7.device.standalone,
        type: 'popup'
    },
    picker: {
        rotateEffect: true
    },
    popover: {
        closeOnEscape: true
    },
    popup: {
        closeByBackdropClick: false,
        closeOnEscape: true,
        push: true,
        swipeToClose: Framework7.device.standalone
    },
    sheet: {
        backdrop: true,
        closeByOutsideClick: true,
        closeOnEscape: true
    },
    smartSelect: {
        appendSearchbarNotFound: `
            <div class="empty-state empty-state-strong inset margin-vertical">
                <div class="empty-state-media">
                    <span class="shape-container shape-auto bg-color-chrome">
                        <i class="icon material-icons font-size-32">search_off</i>
                    </span>
                </div>
                <div class="empty-state-subtitle" data-i18n="no-search-results">No Search Results</div>
            </div>
        `,
        popupCloseLinkText: 'Done',
        popupPush: true,
        scrollToSelectedItem: true,
        searchbar: true,
        sheetBackdrop: true
    },
    textEditor: {
        imageUrlText: 'Insert Image URL',
        linkUrlText: 'Insert Link URL',
        placeholder: 'Enter Text...'
    },
    toast: {
        closeButtonText: 'OK',
        closeTimeout: 3750
    },
    touch: {
        activeStateOnMouseMove: true,
        disableContextMenu: true,
        tapHold: true
    },
    view: {
        iosDynamicNavbar: false,
        routesBeforeEnter: [checkAuthStatus]
    },
    panel: {
        swipe: 'right', // o 'both' si quieres desde izquierda y derecha
    }
});

/*
|------------------------------------------------------------------------------
| App Events
|------------------------------------------------------------------------------
*/

app.on('init', function() {
    app.getComputedStyles();
    app.layout.initialize();
    app.theming.initialize();
    app.i18n.initialize();
    app.a2hs.initialize();
    app.zooming.initialize();

    app.admob.initialize();
    app.wordpress.initialize();
});

/* Show Message When App Goes Online */
app.on('online', function() {
    app.toast.show({
        text: app.i18n.translate('connected-to-internet', 'Connected to Internet'),
        horizontalPosition: 'center',
        position: 'top',
        cssClass: 'color-green'
    });
});

/* Show Message When App Goes Offline */
app.on('offline', function() {
    app.toast.show({
        text: app.i18n.translate('no-internet-connection', 'No Internet Connection'),
        horizontalPosition: 'center',
        position: 'top',
        cssClass: 'color-red'
    });
});

/* Show Preloader Before Route Is Loaded */
app.on('routerAjaxStart', function(xhr, options) {
    app.preloader.show();
});

/* Hide Preloader After Route Is Loaded */
app.on('routerAjaxComplete', function(xhr, options) {
    app.preloader.hide();
});

/* Show Error If Unable To Load Route */
app.on('routerAjaxError', function(xhr, options) {
    app.toast.show({
        text: app.i18n.translate('error-loading-route', 'An error occured while loading page. Please make sure that you are connected to the Internet.'),
        horizontalPosition: 'center',
        position: 'bottom',
        cssClass: 'color-red'
    });
});

/* Close Modals Before Page Is Removed */
app.on('pageBeforeRemove', function(page) {
    app.actions.close();
    app.calendar.close();
    app.dialog.close();
    app.notification.close();
    app.picker.close();
    app.popover.close();
    app.popup.close();
    app.sheet.close();
});

/*
|------------------------------------------------------------------------------
| Get Computed Styles
|------------------------------------------------------------------------------
*/

app.getComputedStyles = function() {
    app.stylesheet = window.getComputedStyle(document.documentElement);
}

/*
|------------------------------------------------------------------------------
| Layout
|------------------------------------------------------------------------------
*/

app.layout = {
    config: app.config.layout,
    initialize: function() {
        let _self = this;
        _self.handleNoSidebar();
        _self.handleNoTabbar();
        _self.handleOpenIn();
        if (app.device.cordova) {
            document.addEventListener('backbutton', function(event) {
                event.preventDefault();
                _self.handleBackButton();
            });
        }
        else if (_self.config.default == 'tabView' && !app.device.standalone && !app.device.ios) {
            history.pushState(null, document.title, location.href);
            window.onpopstate = function() {
                history.pushState(null, document.title, location.href);
                _self.handleBackButton();
            }
        }
        else {
            return;
        }
    },
    handleNoSidebar: function() {
        let _self = this;
        app.on('pageAfterIn', function(page) {
            let noSidebar = page.$el.hasClass('no-sidebar');
            if (noSidebar) {
                setTimeout(function() {
                    app.sidebar.hide();
                }, 100);
            }
        });
        app.on('pageBeforeRemove', function(page) {
            let noSidebar = page.$el.hasClass('no-sidebar');
            if (noSidebar) {
                app.sidebar.show();
            }
        });
    },
    handleNoTabbar: function() {
        let _self = this;
        app.on('pageAfterIn', function(page) {
            let noTabbar = page.$el.hasClass('no-tabbar');
            if (noTabbar) {
                setTimeout(function() {
                    app.tabbar.hide();
                }, 100);
            }
        });
        app.on('pageBeforeRemove', function(page) {
            let noTabbar = page.$el.hasClass('no-tabbar');
            if (noTabbar) {
                app.tabbar.show();
            }
        });
    },
    handleOpenIn: function() {
        let _self = this;
        app.on('pageAfterIn', function(page) {
            page.$el.find('.back').addClass('login-screen-close panel-close popover-close popup-close sheet-close');
        });
    },
    handleBackButton: function() {
        let _self = this;
        if (app.$('.notification.modal-in').length) {
            app.notification.close('.notification.modal-in');
            return;
        }
        if (app.$('.toast.modal-in').length) {
            app.toast.close('.toast.modal-in');
            return;
        }
        if (app.$('.dialog.modal-in').length) {
            return;
        }
        if (app.$('.calendar-modal.modal-in').length) {
            app.calendar.close('.calendar-modal.modal-in');
            return;
        }
        if (app.$('.actions-modal.modal-in').length) {
            app.actions.close('.actions-modal.modal-in');
            return;
        }
        if (app.$('.popover.modal-in').length) {
            app.popover.close('.popover.modal-in');
            return;
        }
        if (app.$('.sheet-modal.modal-in').length) {
            app.sheet.close('.sheet-modal.modal-in');
            return;
        }
        if (app.$('.popup.modal-in').length) {
            if (app.$('.popup.modal-in > .view').length) {
                let currentView = app.views.get('.popup.modal-in > .view');
                if (currentView && currentView.router && currentView.router.history.length > 1) {
                    currentView.router.back();
                    return;
                }
            }
            app.popup.close('.popup.modal-in');
            return;
        }
        if (app.$('.login-screen.modal-in').length) {
            app.loginScreen.close('.login-screen.modal-in');
            return;
        }
        if (app.$('.page-current .card-expandable.card-opened').length) {
            app.card.close('.page-current .card-expandable.card-opened');
            return;
        }
        if (app.$('.panel.panel-in').length) {
            app.panel.close('.panel.panel-in');
            return;
        }
        if (app.$('.searchbar.searchbar-enabled').length) {
            app.searchbar.disable('.searchbar.searchbar-enabled');
            return;
        }
        let tabView = _self.config.default == 'tabView' && app.$('.views.tabs').length;
        let currentView = app.views.current;
        let hasPreviousRoutes = currentView.router.history.length > 1;
        if (app.device.cordova && currentView.main && !hasPreviousRoutes) {
            app.dialog.confirm(
                app.i18n.translate('app-exit-confirm-text', 'Are you sure you want to exit?'),
                app.i18n.translate('app-exit-confirm-title', 'Exit'),
                function() {
                    navigator.app.exitApp();
                }
            );
        }
        else if (tabView && !currentView.main && !hasPreviousRoutes) {
            app.tab.show('#view-main');
        }
        else {
            currentView.router.back();
        }
    }
}

/*
|------------------------------------------------------------------------------
| Sidebar
|------------------------------------------------------------------------------
*/

app.sidebar = {
    show: function() {
        let sidebar = app.panel.get('#sidebar');
        if (sidebar) {
            setTimeout(function() {
                sidebar.enableVisibleBreakpoint();
                sidebar.enableCollapsedBreakpoint();
                sidebar.enableSwipe();
                sidebar.enableResizable();
            }, 0);
        }
    },
    hide: function() {
        let sidebar = app.panel.get('#sidebar');
        if (sidebar) {
            setTimeout(function() {
                sidebar.disableVisibleBreakpoint();
                sidebar.disableCollapsedBreakpoint();
                sidebar.disableSwipe();
                sidebar.disableResizable();
            }, 100);
        }
    },
    toggle: function() {
        let sidebar = app.panel.get('#sidebar');
        if (sidebar) {
            let viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            if (viewportWidth >= sidebar.params.collapsedBreakpoint && viewportWidth < sidebar.params.visibleBreakpoint) {
                sidebar.toggleCollapsedBreakpoint();
            }
            else {
                sidebar.toggle();
            }
        }
    }
}

/*
|------------------------------------------------------------------------------
| Tabbar
|------------------------------------------------------------------------------
*/

app.tabbar = {
    show: function() {
        let tabbar = app.$('#tabbar');
        if (tabbar) {
            app.toolbar.show(tabbar, false);
        }
    },
    hide: function() {
        let tabbar = app.$('#tabbar');
        if (tabbar) {
            app.toolbar.hide(tabbar, false);
        }
    }
}

/*
|------------------------------------------------------------------------------
| Theming
|------------------------------------------------------------------------------
*/

app.theming = {
    config: app.config.theming,
    initialize: function() {
        let _self = this;
        let currentColor = _self.config.enabled ? localStorage.getItem('Nectar_Theme_Color') || _self.config.color : _self.config.color;
        let currentMode = _self.config.enabled ? localStorage.getItem('Nectar_Theme_Mode') || _self.config.mode : _self.config.mode;
        _self.changeColor(currentColor);
        _self.changeMode(currentMode);
    },
    currentColor: function() {
        let _self = this;
        return app.stylesheet.getPropertyValue('--f7-theme-color').trim();
    },
    currentMode: function() {
        let _self = this;
        return app.$('html').hasClass('dark') ? 'dark' : app.params.autoDarkMode ? 'system' : 'light';
    },
    changeColor: function(color) {
        let _self = this;
        let colorThemeCSSProperties = app.utils.colorThemeCSSProperties(color);
        let colorThemeStyles = '';
        if (Object.keys(colorThemeCSSProperties).length) {
            colorThemeStyles += `
                :root {
                    ${Object.keys(colorThemeCSSProperties)
                        .map(key => `${key}: ${colorThemeCSSProperties[key]};`)
                        .join('\n')}
                }`;
            let stylesheet = document.createElement('style');
            stylesheet.innerHTML = colorThemeStyles;
            document.head.appendChild(stylesheet);
        }
        app.store.dispatch('setThemeColor', color);
        if (_self.config.enabled) {
            localStorage.setItem('Nectar_Theme_Color', color || _self.config.color);
        }
    },
    changeMode: function(mode) {
        let _self = this;
        switch (mode) {
            case 'dark':
                app.$('html').addClass('dark');
                app.disableAutoDarkMode();
                app.params.autoDarkMode = false;
            break;
            case 'light':
                app.$('html').removeClass('dark');
                app.disableAutoDarkMode();
                app.params.autoDarkMode = false;
            break;
            case 'system':
                app.enableAutoDarkMode();
                app.params.autoDarkMode = true;
            break;
            default:
                app.enableAutoDarkMode();
                app.params.autoDarkMode = true;
        }
        app.store.dispatch('setThemeMode', mode);
        if (_self.config.enabled) {
            localStorage.setItem('Nectar_Theme_Mode', mode || _self.config.mode);
        }
    }
}

/*
|------------------------------------------------------------------------------
| i18n
|------------------------------------------------------------------------------
*/

app.i18n = {
    config: app.config.i18n,
    initialized: false,
    initialize: function() {
        let _self = this;
        if (!_self.config.enabled) {
            return;
        }
        i18next
            .use(i18nextXHRBackend)
            .init({
                lng: _self.config.defaultLanguage,
                fallbackLng: _self.config.fallbackLanguage,
                supportedLngs: Object.keys(_self.config.languages),
                nonExplicitSupportedLngs: true,
                preload: Object.keys(_self.config.languages),
                ns: _self.config.namespaces,
                backend: {
                    loadPath: 'assets/custom/i18n/{{lng}}/{{ns}}.json'
                }
            })
            .then(function() {
                _self.initialized = true;
                _self.changeLanguage(_self.currentLanguage().code);
            });
    },
    currentLanguage: function() {
        let _self = this;
        let supportedLanguages = Object.keys(_self.config.languages);
        let localStorageLanguage = _self.config.enabled ? localStorage.getItem('Nectar_Language') : null;
        let metaLanguage = app.$('html').attr('lang');
        if (supportedLanguages.includes(localStorageLanguage)) {
            return _self.config.languages[localStorageLanguage];
        }
        else if (supportedLanguages.includes(metaLanguage)) {
            return _self.config.languages[metaLanguage];
        }
        else if (supportedLanguages.includes(_self.config.defaultLanguage)) {
            return _self.config.languages[_self.config.defaultLanguage];
        }
        else if (supportedLanguages.includes(_self.config.fallbackLanguage)) {
            return _self.config.languages[_self.config.fallbackLanguage];
        }
        else {
            return {
                name: 'English',
                slug: 'english',
                code: 'en',
                locale: 'en-UK',
                dir: 'ltr',
                flag: 'https://flagcdn.com/gb.svg'
            };
        }
    },
    changeLanguage: function(language) {
        let _self = this;
        if (!_self.initialized) {
            return;
        }
        let supportedLanguages = Object.keys(_self.config.languages);
        if (supportedLanguages.includes(language)) {
            let newLanguage = _self.config.languages[language];
            let directionChanged = app.$('html').attr('dir') != newLanguage.dir;
            i18next.changeLanguage(newLanguage.code)
                .then(function() {
                    localStorage.setItem('Nectar_Language', newLanguage.code);
                    app.$('html').attr('lang', newLanguage.code);
                    app.$('html').attr('dir', newLanguage.dir);
                    if (newLanguage.dir == 'rtl') {
                        app.$('.f7[rel=stylesheet]').attr('href', 'assets/vendor/framework7/framework7-bundle-rtl.min.css');
                        app.rtl = true;
                        app.params.rtl = true;
                    }
                    else {
                        app.$('.f7[rel=stylesheet]').attr('href', 'assets/vendor/framework7/framework7-bundle.min.css');
                        app.rtl = false;
                        app.params.rtl = false;
                    }
                    app.emit('languageChanged', newLanguage);
                    _self.localize();
                    if (directionChanged) {
                        if (app.views.current.router.url == '/select-language/') {
                            app.views.current.router.back();
                            app.popup.close('.popup[data-url="/select-language/"]');
                        }
                    }
                    setTimeout(function() {
                        app.views.current.router.refreshPage();
                    }, 1000);
                    app.on('pageBeforeIn', function() {
                        _self.localize();
                    });
                });
        }
    },
    localize: function() {
        let _self = this;
        if (!_self.initialized) {
            return;
        }
        let localizer = locI18next.init(i18next, {
            selectorAttr: 'data-i18n',
            optionsAttr: 'data-i18n-options',
            targetAttr: 'data-i18n-target',
            useOptionsAttr: true,
            parseDefaultValueFromContent: true
        });
        localizer('body');
    },
    translate: function(key, fallback, options) {
        let _self = this;
        if (!_self.initialized) {
            return fallback || key;
        }
        else if (i18next.exists(key)) {
            return i18next.t(key, options);
        }
        else {
            return fallback || key;
        }
    }
}

app.on('languageChanged', function(language) {
    return false;
    app.language = language.code;
    app.params.language = language.code;
    app.params.calendar.locale = language.code;

    app.config.app.title = app.i18n.translate('app-title');
    app.config.app.tagline = app.i18n.translate('app-tagline');
    app.config.app.description = app.i18n.translate('app-description');

    app.setDefaultTranslations();

    if ('moment' in window) {
        if (moment.locales().includes(language.code)) {
            moment.locale(language.code);
        }
        else {
            LazyLoad.js([`assets/vendor/moment/locale/${language.code}.js`], function() {
                moment.locale(language.code);
            });
        }
    }

    app.toast.show({
        text: app.i18n.translate('app-language-changed', null, {language: app.i18n.translate(language.slug)})
    });
});

app.setDefaultTranslations = function() {
    app.name = app.i18n.translate('app-title');
    app.params.name = app.i18n.translate('app-title');
    app.params.autocomplete.notFoundText = app.i18n.translate('autocomplete-not-found-text');
    app.params.autocomplete.pageBackLinkText = app.i18n.translate('autocomplete-page-back-link-text');
    app.params.autocomplete.popupCloseLinkText = app.i18n.translate('autocomplete-popup-close-link-text');
    app.params.autocomplete.searchbarDisableText = app.i18n.translate('autocomplete-searchbar-disable-text');
    app.params.autocomplete.searchbarPlaceholder = app.i18n.translate('autocomplete-searchbar-placeholder');
    app.params.calendar.headerPlaceholder = app.i18n.translate('calendar-header-placeholder');
    app.params.calendar.timePickerLabel = app.i18n.translate('calendar-time-picker-label');
    app.params.calendar.timePickerPlaceholder = app.i18n.translate('calendar-time-picker-placeholder');
    app.params.calendar.toolbarCloseText = app.i18n.translate('calendar-toolbar-close-text');
    app.params.colorPicker.navbarBackLinkText = app.i18n.translate('color-picker-navbar-back-link-text');
    app.params.colorPicker.navbarCloseText = app.i18n.translate('color-picker-navbar-close-text');
    app.params.colorPicker.navbarTitleText = app.i18n.translate('color-picker-navbar-title-text');
    app.params.colorPicker.toolbarCloseText = app.i18n.translate('color-picker-toolbar-close-text');
    app.params.dialog.buttonCancel = app.i18n.translate('dialog-button-cancel');
    app.params.dialog.buttonOk = app.i18n.translate('dialog-button-ok');
    app.params.dialog.passwordPlaceholder = app.i18n.translate('dialog-password-placeholder');
    app.params.dialog.preloaderTitle = app.i18n.translate('dialog-preloader-title');
    app.params.dialog.progressTitle = app.i18n.translate('dialog-progress-title');
    app.params.dialog.usernamePlaceholder = app.i18n.translate('dialog-username-placeholder');
    app.params.keypad.toolbarCloseText = app.i18n.translate('keypad-toolbar-close-text');
    app.params.notification.title = app.i18n.translate('app-title');
    app.params.photoBrowser.navbarOfText = app.i18n.translate('photo-browser-navbar-of-text');
    app.params.photoBrowser.pageBackLinkText = app.i18n.translate('photo-browser-page-back-link-text');
    app.params.picker.toolbarCloseText = app.i18n.translate('picker-toolbar-close-text');
    app.params.smartSelect.pageBackLinkText = app.i18n.translate('smart-select-page-back-link-text');
    app.params.smartSelect.popupCloseLinkText = app.i18n.translate('smart-select-popup-close-link-text');
    app.params.smartSelect.searchbarDisableText = app.i18n.translate('smart-select-searchbar-disable-text');
    app.params.smartSelect.searchbarPlaceholder = app.i18n.translate('smart-select-searchbar-placeholder');
    app.params.smartSelect.sheetCloseLinkText = app.i18n.translate('smart-select-sheet-close-link-text');
    app.params.textEditor.imageUrlText = app.i18n.translate('text-editor-image-url-text');
    app.params.textEditor.linkUrlText = app.i18n.translate('text-editor-link-url-text');
    app.params.textEditor.placeholder = app.i18n.translate('text-editor-placeholder');
    app.params.toast.closeButtonText = app.i18n.translate('toast-close-button-text');
}

app.on('tooltipShow', function(tooltip) {
    if (app.config.i18n.enabled && tooltip.$targetEl.attr('data-i18n')) {
        tooltip.setText(tooltip.$targetEl.attr('data-tooltip'));
    }
});

/*
|------------------------------------------------------------------------------
| Add To Home Screen
|------------------------------------------------------------------------------
*/

app.a2hs = {
    config: app.config.a2hs,
    isAvailable: app.config.a2hs.enabled && !app.device.cordova && !app.device.standalone,
    nativePrompt: null,
    initialize: function() {
        let _self = this;
        if (!_self.isAvailable) {
            return;
        }
        app.store.dispatch('setWebAppInstallableStatus', true);
        if ('onbeforeinstallprompt' in window) {
            window.addEventListener('beforeinstallprompt', function(event) {
                event.preventDefault();
                _self.nativePrompt = event;
                if (_self.config.autoPrompt) {
                    setTimeout(function() {
                        _self.showPrompt();
                    }, _self.config.autoPromptDelay);
                }
            }, {once: true});
            window.addEventListener('appinstalled', function(event) {
                event.preventDefault();
                app.store.dispatch('setWebAppInstallableStatus', false);
                _self.nativePrompt = null;
                app.toast.show({
                    text: app.i18n.translate('a2hs-install-success', `${app.name} has been added to the home screen.`, {app_name: app.name}),
                    cssClass: 'color-green'
                });
            }, {once: true});
        }
        else {
            if (_self.config.autoPrompt) {
                setTimeout(function() {
                    _self.showPrompt();
                }, _self.config.autoPromptDelay);
            }
        }
    },
    showPrompt: function() {
        return false;
        let _self = this;
        if (!_self.isAvailable) {
            return;
        }
        let dialog = app.dialog.create({
            title: '',
            content: `
                <div class="text-align-center">
                    <img class="if-not-dark" src="${app.config.app.logos.logomarkLight}" height="80" alt="" />
                    <img class="if-dark" src="${app.config.app.logos.logomarkDark}" height="80" alt="" />
                    <div class="font-size-16 font-weight-600 margin-top" data-i18n="a2hs-prompt-title" data-i18n-options="{'app_name': '${app.name}'}">Add ${app.name} to your Home Screen?</div>
                    <div class="margin-top" data-i18n="a2hs-prompt-text" data-i18n-options="{'app_name': '${app.name}'}">Install ${app.name} on your home screen for quick and easy access when you\'re on the go.</div>
                </div>
            `,
            verticalButtons: true,
            buttons: [
                {
                    text: app.i18n.translate('a2hs-prompt-accept', 'Add to Home Screen'),
                    onClick: function(dialog, event) {
                        dialog.close();
                        if (_self.nativePrompt) {
                            _self.nativePrompt.prompt();
                            _self.nativePrompt.userChoice
                                .then(function(choice) {
                                    _self.nativePrompt = null;
                                    if (choice.outcome == 'accepted') {
                                        app.toast.show({
                                            text: app.i18n.translate('a2hs-install-success', `${app.name} has been added to the home screen.`, {app_name: app.name}),
                                            cssClass: 'color-green'
                                        });
                                    }
                                    else {
                                        app.toast.show({
                                            text: app.i18n.translate('a2hs-install-fail', `Oops! Could not add ${app.name} to the home screen.`, {app_name: app.name}),
                                            cssClass: 'color-red'
                                        });
                                    }
                                });
                        }
                        else {
                            _self.showInstallTutorial();
                        }
                    }
                },
                {
                    text: app.i18n.translate('a2hs-prompt-reject', 'No, Thanks'),
                    color: 'gray',
                    onClick: function(dialog, event) {
                        dialog.close();
                    }
                }
            ]
        });
        dialog.open();
        app.i18n.localize();
    },
    showInstallTutorial: function() {
        let _self = this;
        if (!_self.isAvailable) {
            return;
        }
        let instructions = `
            <ol class="no-margin text-align-start" style="padding-inline-start: var(--f7-dialog-inner-padding);">
                <li class="margin-vertical-half">
                    <div class="margin-vertical-half" data-i18n="a2hs-instruction-step-1">Press any of these icons present in the address bar or the bottom toolbar.</div>
                    <div class="margin-vertical">
                        <i class="icon material-icons">ios_share</i>
                        <i class="icon material-icons margin-horizontal-half">install_mobile</i>
                        <i class="icon material-icons margin-horizontal-half">install_desktop</i>
                        <i class="icon material-icons margin-horizontal-half">more_vert</i>
                        <i class="icon material-icons margin-horizontal-half">more_horiz</i>
                    </div>
                </li>
                <li class="margin-vertical-half" data-i18n="a2hs-instruction-step-2">When the menu appears, press the 'Add to Home Screen' or 'Install' button.</li>
                <li class="margin-vertical-half" data-i18n="a2hs-instruction-step-3" data-i18n-options="{'app_name': '${app.name}'}">${app.name} will be added to the home screen.</li>
            </ol>
        `;
        app.dialog.alert(instructions, '');
        app.i18n.localize();
    }
}

/*
|------------------------------------------------------------------------------
| Web API Support
|------------------------------------------------------------------------------
*/

app.support.webApi = {
    appBadging: function() {
        return 'setAppBadge' in navigator;
    }(),
    batteryStatus: function() {
        return 'getBattery' in navigator || 'battery' in navigator;
    }(),
    clipboard: function() {
        return 'clipboard' in navigator;
    }(),
    contactPicker: function() {
        return 'contacts' in navigator && 'ContactsManager' in window;
    }(),
    deviceMemory: function() {
        return 'deviceMemory' in navigator;
    }(),
    deviceOrientation: function() {
        return 'DeviceOrientationEvent' in window;
    }(),
    file: function() {
        return 'File' in window && 'FileReader' in window;
    }(),
    fullscreen: function() {
        return 'requestFullscreen' in document.documentElement || 'webkitRequestFullscreen' in document.documentElement || 'mozRequestFullScreen' in document.documentElement || 'msRequestFullscreen' in document.documentElement;
    }(),
    geolocation: function() {
        return 'geolocation' in navigator;
    }(),
    getInstalledRelatedApps: function() {
        return 'getInstalledRelatedApps' in navigator;
    }(),
    localStorage: function() {
        return 'localStorage' in window;
    }(),
    networkInformation: function() {
        return 'connection' in navigator || 'webkitConnection' in navigator || 'mozConnection' in navigator || 'msConnection' in navigator;
    }(),
    notifications: function() {
        return 'Notification' in window;
    }(),
    onlineOfflineStatus: function() {
        return typeof navigator.onLine !== 'undefined';
    }(),
    pageVisibility: function() {
        return typeof document.hidden !== 'undefined' || typeof document.webkitHidden !== 'undefined' || typeof document.mozHidden !== 'undefined' || typeof document.msHidden !== 'undefined';
    }(),
    permissions: function() {
        return 'permissions' in navigator;
    }(),
    pictureInPicture: function() {
        return 'pictureInPictureEnabled' in document;
    }(),
    quotaEstimation: function() {
        return 'storage' in navigator && 'estimate' in navigator.storage;
    }(),
    screenOrientation: function() {
        return 'orientation' in screen;
    }(),
    screenWakeLock: function() {
        return 'wakeLock' in navigator;
    }(),
    serverSentEvents: function() {
        return 'EventSource' in window;
    }(),
    sessionStorage: function() {
        return 'sessionStorage' in window;
    }(),
    vibration: function() {
        return 'vibrate' in navigator;
    }(),
    webShare: function() {
        return 'share' in navigator;
    }()
}

/*
|------------------------------------------------------------------------------
| Component - Chip
|------------------------------------------------------------------------------
*/

app.on('init', function() {
    app.$(document).on('click', '.chip-deletable .chip-delete', function() {
        let chip = app.$(this).parent();
        let confirm = chip.hasClass('chip-deletable-confirm');
        if (confirm) {
            let dialogTitle = chip.attr('data-confirm-title') ? chip.attr('data-confirm-title') : app.i18n.translate('chip-delete-confirm-title','Delete');
            let dialogText = chip.attr('data-confirm-text') ? chip.attr('data-confirm-text') : app.i18n.translate('chip-delete-confirm-text', 'Do you want to delete this item?');
            app.dialog.confirm(
                dialogText,
                dialogTitle,
                function() {
                    chip.remove();
                    chip.trigger('chip:delete');
                    app.emit('chipDelete', chip[0]);
                },
                null
            );
        }
        else {
            chip.remove();
            chip.trigger('chip:delete');
            app.emit('chipDelete', chip[0]);
        }
    });
});

app.chip = {
    delete: function(el) {
        el.remove();
        el.trigger('chip:delete');
        app.emit('chipDelete', el[0]);
    }
}

/*
|------------------------------------------------------------------------------
| Component - Expandable Card
|------------------------------------------------------------------------------
*/

app.on('cardBeforeOpen', function(cardEl) {
    app.$(cardEl).find('* > .card-expandable-transform').each(function(transformEl, index) {
        app.$(transformEl).css('opacity', 0);
    });
});

app.on('cardOpened', function(cardEl) {
    let cardContentEl = app.$(cardEl).find('.card-content');
    if (cardContentEl.length) {
        let transform = app.$(cardContentEl).css('transform');
        let pattern = /-?\d+\.?\d*/g;
        let matrix = transform.match(pattern);
        app.$(cardEl).find('* > .card-expandable-transform').each(function(transformEl, index) {
            let x = app.$(cardContentEl).width() - 48;
            let translateX = (app.rtl ? (x * -1) : x) + 'px';
            let translateY = app.stylesheet.getPropertyValue('--f7-safe-area-top').trim();
            if (app.$(transformEl).hasClass('card-close-link')) {
                app.$(transformEl).css('transform', `scaleX(${matrix[0]}) scaleY(${matrix[3]}) translateX(${translateX}) translateY(${translateY}) translateZ(1px)`);
            }
            else {
                app.$(transformEl).css('transform', `scaleX(${matrix[0]}) scaleY(${matrix[3]}) translateZ(1px)`);
            }
            app.$(transformEl).css('opacity', 1);
        });
        app.$(cardEl).find('.overlay-container .overlay-content').each(function(overlayContentEl, index) {
            app.$(overlayContentEl).css('transform', `translateZ(1px)`);
        });
    }
});

app.on('cardClose', function(cardEl) {
    app.$(cardEl).find('* > .card-expandable-transform').each(function(transformEl, index) {
        app.$(transformEl).css('opacity', 0);
    });
});

/*
|------------------------------------------------------------------------------
| Component - Flip Card
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.flipCard.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.flipCard.initialize(tabEl);
});

app.flipCard = {
    initialize: function(containerEl) {
        app.$(containerEl).find('.flip-card').each(function(cardEl, index) {
            let cardFrontEl = app.$(cardEl).find('.flip-card-front');
            let cardBackEl = app.$(cardEl).find('.flip-card-back');
            if (cardFrontEl.length) {
                let flipToggles = app.$(cardFrontEl).find('.card-toggle-flip');
                if (flipToggles.length) {
                    app.$(flipToggles).each(function(flipToggleEl, index) {
                        app.$(flipToggleEl).on('click', function(event) {
                            app.flipCard.flip(cardEl);
                        });
                    });
                }
                else {
                    app.$(cardFrontEl).on('click', function(event) {
                        if (app.$(event.target).hasClass('card-prevent-flip') || app.$(event.target).parent().hasClass('card-prevent-flip')) {
                            return;
                        }
                        app.flipCard.flip(cardEl);
                    });
                }
            }
            if (cardBackEl.length) {
                let flipToggles = app.$(cardBackEl).find('.card-toggle-flip');
                if (flipToggles.length) {
                    app.$(flipToggles).each(function(flipToggleEl, index) {
                        app.$(flipToggleEl).on('click', function(event) {
                            app.flipCard.flip(cardEl);
                        });
                    });
                }
                else {
                    app.$(cardBackEl).on('click', function(event) {
                        if (app.$(event.target).hasClass('card-prevent-flip') || app.$(event.target).parent().hasClass('card-prevent-flip')) {
                            return;
                        }
                        app.flipCard.flip(cardEl);
                    });
                }
            }
        });
    },
    flip: function(cardEl) {
        app.$(cardEl).toggleClass('flip-card-flipped');
    }
}

/*
|------------------------------------------------------------------------------
| Component - Form Validator
|------------------------------------------------------------------------------
*/

app.on('init', function() {
    app.formValidator.initialize();
});

app.formValidator = {
    initialize: function() {
        if ('jQuery' in window && 'validator' in jQuery) {
            jQuery.validator.setDefaults({
                ignore: [],
                errorClass: 'item-input-error-message',
                errorElement : 'div',
                errorPlacement: function(error, element) {
                    jQuery(element).parents('.item-input').addClass('item-input-with-error-message');
                    jQuery(element).parents('.item-input').addClass('item-input-invalid');
                    error.appendTo(element.parents('.item-input-wrap'));
                },
                highlight: function(element, errorClass, validClass) {
                    jQuery(element).parents('.item-input').addClass('item-input-with-error-message');
                    jQuery(element).parents('.item-input').addClass('item-input-invalid');
                    jQuery(element).removeClass(errorClass);
                },
                unhighlight: function(element, errorClass, validClass) {
                    jQuery(element).parents('.item-input').removeClass('item-input-with-error-message');
                    jQuery(element).parents('.item-input').removeClass('item-input-invalid');
                },
                success: function(label, element) {
                    jQuery(element).parents('.item-input').removeClass('item-input-with-error-message');
                    jQuery(element).parents('.item-input').removeClass('item-input-invalid');
                    jQuery(element).parents('.item-input').find('.item-input-error-message').remove();
                }
            });
            jQuery.validator.addMethod(
                'regex',
                function(value, element, regexp) {
                    if (regexp.constructor != RegExp) {
                        regexp = new RegExp(regexp);
                    }
                    else if (regexp.global) {
                        regexp.lastIndex = 0;
                    }
                    return this.optional(element) || regexp.test(value);
                }, ''
            );
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - Marquee
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.marquee.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.marquee.initialize(tabEl);
});

app.marquee = {
    initialize: function(containerEl) {
        if ('jQuery' in window && jQuery.isFunction(jQuery.fn.marquee)) {
            let options = {
                delayBeforeStart: 0,
                duration: 5000,
                gap: 16,
                pauseOnHover: true
            }
            let mq = jQuery(containerEl).find('.marquee-init').marquee(options);
            jQuery(window).resize(function() {
                mq.marquee('destroy');
                mq.marquee(options);
            });
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - Navbar
|------------------------------------------------------------------------------
*/

app.on('pageInit, pageBeforeIn', function(page) {
    app.$('.navbar').each(function(navbarEl, index) {
        app.navbar.size(navbarEl);
    });
});

app.on('tabMounted, tabInit', function(tabEl, tabRoute) {
    app.$('.navbar').each(function(navbarEl, index) {
        app.navbar.size(navbarEl);
    });
});

/*
|------------------------------------------------------------------------------
| Component - Note
|------------------------------------------------------------------------------
*/

app.on('init', function() {
    app.$(document).on('click', '.note .note-close', function() {
        let note = app.$(this).parent();
        note.remove();
        note.trigger('note:close');
        app.emit('noteClose', note[0]);
    });
});

app.note = {
    close: function(el) {
        el.remove();
        el.trigger('note:close');
        app.emit('noteClose', el[0]);
    }
}

/*
|------------------------------------------------------------------------------
| Component - Rating
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.rating.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.rating.initialize(tabEl);
});

app.rating = {
    initialize: function(containerEl) {
        if ('jQuery' in window && jQuery.isFunction(jQuery.fn.rateYo)) {
            app.$(containerEl).find('.rating-init').each(function(el, index) {
                jQuery(el).rateYo({
                    halfStar: true,
                    normalFill: app.stylesheet.getPropertyValue('--color-gray-300'),
                    ratedFill: app.stylesheet.getPropertyValue('--color-amber-500'),
                    readOnly: true,
                    rtl: app.rtl,
                    spacing: '2px',
                    starWidth: '16px'
                });
            });
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - Show More/Less
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.showMoreLess.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.showMoreLess.initialize(tabEl);
});

app.showMoreLess = {
    initialize: function(containerEl) {
        if ('ShowMore' in window) {
            new ShowMore('.show-more-less-init', {
                config: {
                    more: 'Read More',
                    less: 'Read Less',
                    element: 'div'
                }
            });
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - State Toggle
|------------------------------------------------------------------------------
*/

app.on('init', function() {
    app.$(document).on('click', '.state-toggle', function() {
        let toggle = app.$(this);
        let state = toggle.hasClass('state-toggle-active') ? 1 : 0;
        if (state) {
            toggle.removeClass('state-toggle-active');
            toggle.trigger('stateChange', 0);
            app.emit('toggleStateChange', 0);
        }
        else {
            toggle.addClass('state-toggle-active');
            toggle.trigger('stateChange', 1);
            app.emit('toggleStateChange', 1);
        }
    });
});

/*
|------------------------------------------------------------------------------
| Component - Syntax Highlighter
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.syntaxHighlighter.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.syntaxHighlighter.initialize(tabEl);
});

app.syntaxHighlighter = {
    initialize: function(containerEl) {
        if ('hljs' in window) {
            hljs.highlightAll();
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - Timer
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.timer.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.timer.initialize(tabEl);
});

app.timer = {
    initialize: function(containerEl) {
        if ('easytimer' in window) {
            app.$(containerEl).find('.timer-countdown.countdown-init').each(function(countdownEl, index) {
                app.$(countdownEl).find('.countdown-result').css('display', 'none');
                app.$(countdownEl).find('.countdown-inner').css('display', 'initial');
                let countdownDateTime = app.$(countdownEl).attr('data-countdown-datetime');
                if (!countdownDateTime) return;
                let startDateTime = new Date();
                let endDateTime = new Date(countdownDateTime);
                let secondsDiff = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 1000);
                let timerCountdown = new easytimer.Timer();
                timerCountdown.start({
                    countdown: true,
                    startValues: {
                        seconds: secondsDiff > 0 ? secondsDiff : 1
                    },
                    callback: function(timer) {
                        let days = (timer.getTimeValues().days).toLocaleString('en-US', {minimumIntegerDigits: 2});
                        let hours = (timer.getTimeValues().hours).toLocaleString('en-US', {minimumIntegerDigits: 2});
                        let minutes = (timer.getTimeValues().minutes).toLocaleString('en-US', {minimumIntegerDigits: 2});
                        let seconds = (timer.getTimeValues().seconds).toLocaleString('en-US', {minimumIntegerDigits: 2});
                        app.$(countdownEl).find('.countdown-days').text(days);
                        app.$(countdownEl).find('.countdown-hours').text(hours);
                        app.$(countdownEl).find('.countdown-minutes').text(minutes);
                        app.$(countdownEl).find('.countdown-seconds').text(seconds);
                        app.$(countdownEl).find('.countdown-value').text(`${days}:${hours}:${minutes}:${seconds}`);
                    }
                });
                timerCountdown.on('targetAchieved', function(event) {
                    app.$(countdownEl).find('.countdown-result').css('display', 'initial');
                    app.$(countdownEl).find('.countdown-inner').css('display', 'none');
                });
            });
        }
    }
}

/*
|------------------------------------------------------------------------------
| Component - Tooltip
|------------------------------------------------------------------------------
*/

app.on('pageInit', function(page) {
    app.tooltipCustom.initialize(page.$el);
});

app.on('tabMounted', function(tabEl) {
    app.tooltipCustom.initialize(tabEl);
});

app.tooltipCustom = {
    initialize: function(containerEl) {
        app.$(containerEl).find('.tooltip-custom-init').each(function(el, index) {
            let text = app.$(el).attr('data-tooltip');
            let classes = app.$(el).attr('data-tooltip-class');
            app.tooltip.create({
                targetEl: el,
                text: text,
                cssClass: classes
            });
        });
    }
}

/*
|------------------------------------------------------------------------------
| Random Color Class Generator
|------------------------------------------------------------------------------
*/

app.on('tabMounted', function(tabEl) {
    app.randomColorClassGenerator.initialize(tabEl);
});

app.on('pageInit', function(page) {
    app.randomColorClassGenerator.initialize(page.$el);
});

app.randomColorClassGenerator = {
    colorClasses: ['red', 'pink', 'purple', 'deeppurple', 'indigo', 'blue', 'lightblue', 'cyan', 'teal', 'green', 'lightgreen', 'lime', 'yellow', 'amber', 'orange', 'deeporange', 'brown', 'gray', 'bluegray'],
    initialize: function(containerEl) {
        app.$(containerEl).find('.color-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'color-' + color;
            app.$(colorEl).removeClass('color-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.text-color-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'text-color-' + color;
            app.$(colorEl).removeClass('text-color-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.bg-color-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'bg-color-' + color;
            app.$(colorEl).removeClass('bg-color-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.border-color-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'border-color-' + color;
            app.$(colorEl).removeClass('border-color-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.ripple-color-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'ripple-color-' + color;
            app.$(colorEl).removeClass('ripple-color-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.text-gradient-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'text-gradient-' + color;
            app.$(colorEl).removeClass('text-gradient-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.bg-gradient-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'bg-gradient-' + color;
            app.$(colorEl).removeClass('bg-gradient-random');
            app.$(colorEl).addClass(colorClass);
        });
        app.$(containerEl).find('.color-theme-random').each(function(colorEl, index) {
            let color = app.randomColorClassGenerator.colorClasses[Math.floor(Math.random() * app.randomColorClassGenerator.colorClasses.length)];
            let colorClass = 'color-theme-' + color;
            app.$(colorEl).removeClass('color-theme-random');
            app.$(colorEl).addClass(colorClass);
        });
    }
}

/*
|------------------------------------------------------------------------------
| Utility Functions
|------------------------------------------------------------------------------
*/

/* Get Random Value From Array */
Array.prototype.random = function(count) {
    let array = this;
    if (count) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
    else {
        return array[Math.floor(Math.random() * array.length)];
    }
}

/* Convert Data URL To Blob */
app.dataUrlToBlob = function(dataUrl) {
    let byteString = atob(dataUrl.split(',')[1]);
    let mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i=0; i<byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    let blob = new Blob([ab], {type: mimeString});
    return blob;
}

/* Check If Element Is In Viewport */
app.elementInViewport = function(element) {
    let bounding = element.getBoundingClientRect();
    return (
        Math.trunc(bounding.top) >= -32 &&
        Math.trunc(bounding.left) >= 32 &&
        Math.trunc(bounding.bottom) <= (window.innerHeight + 32 || document.documentElement.clientHeight + 32) &&
        Math.trunc(bounding.right) <= (window.innerWidth + 32 || document.documentElement.clientWidth + 32)
    );
}

/* Get App Version */
app.getAppVersion = function() {
    return app.device.cordova && BuildInfo ? BuildInfo.version : app.version;
}

/* Get External URL Target */
app.getExternalUrlTarget = function() {
    if (app.device.cordova && cordova.InAppBrowser) {
        return '_system';
    }
    else {
        return '_blank';
    }
}

/* Open External URL */
app.openExternalUrl = function(url, target) {
    if (app.device.cordova && cordova.InAppBrowser) {
        cordova.InAppBrowser.open(url, target || '_system');
    }
    else {
        window.open(url, target || '_blank');
    }
}

/* Remove Diacritics */
app.removeDiacritics = function(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* Render Unicode */
app.renderUnicode = function(unicode) {
    return String.fromCodePoint(parseInt(unicode, 16));
}

/* Scroll To Element */
app.scrollTo = function(selector) {
    let el = app.$(selector);
    if (el) {
        app.$(el)[0].scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });
    }
}

/*
|------------------------------------------------------------------------------
| AdMob
|------------------------------------------------------------------------------
*/

app.admob = {
    config: app.config.admob,
    initialize: function() {
        let _self = this;
        if (!_self.config.enabled) {
            return;
        }
        if (app.device.cordova && window.admob) {
            admob.start();
        }
    }
}

/*
|------------------------------------------------------------------------------
| WordPress
|------------------------------------------------------------------------------
*/

app.wordpress = {
    config: app.config.wordpress,
    initialize: function(url, type) {
        let _self = this;
        _self.url = url || localStorage.getItem('Nectar_WordPress_Site_URL') || _self.config.url;
        _self.type = type || localStorage.getItem('Nectar_WordPress_Site_Type') || _self.config.type;
        switch (_self.type) {
            case 'com':
                _self.rootEndpoint = 'https://public-api.wordpress.com/wp/v2/sites/' + new URL(_self.url).host;
            break;
            case 'org':
                _self.rootEndpoint = _self.url + '/wp-json';
            break;
            default:
                _self.rootEndpoint = _self.url + '/wp-json';
        }
    },
    generateEndpoint: function(namespace, route) {
        let _self = this;
        return _self.rootEndpoint + namespace + route;
    },
    parseHttpError: function(response) {
        let _self = this;
        let message;
        switch (response.status) {
            case 0:
                message = app.i18n.translate('wordpress-error-connect', `Unable to connect to the site at ${_self.url}`, {url: _self.url, interpolation: {escapeValue: false}});
                return message;
            break;
            case 401:
                message = app.i18n.translate('wordpress-error-authentication', 'Authentication is required to access the resource.');
                return message;
            break;
            case 403:
                message = app.i18n.translate('wordpress-error-authorization', 'You are not authorized to access the resource.');
                return message;
            break;
            case 404:
                message = app.i18n.translate('wordpress-error-not-exists', 'The resource at requested URL does not exists.');
                return message;
            break;
        }
        if (response.message) {
            message = response.message;
            return message;
        }
        else if (response.xhr) {
            try {
                message = JSON.parse(response.xhr.response).message;
                return message;
            }
            catch(error) {
                message = error.message;
                return message;
            }
        }
        else {
            message = app.i18n.translate('wordpress-error-unknown', 'An unknown error occured.');
            return message;
        }
    }
}

/*
|------------------------------------------------------------------------------
| Zooming
|------------------------------------------------------------------------------
*/

app.zooming = {
    config: app.config.zooming,
    initialize: function() {
        let _self = this;
        if (!_self.config.enabled) {
            return;
        }
        let currentLevel = _self.currentLevel();
        _self.changeLevel(currentLevel.slug);
    },
    currentLevel: function() {
        let _self = this;
        if (!_self.config.enabled) {
            return;
        }
        let supportedLevels = Object.keys(_self.config.levels);
        let localStorageLevel = _self.config.enabled ? localStorage.getItem('Nectar_Zooming') : null;
        if (supportedLevels.includes(localStorageLevel)) {
            return _self.config.levels[localStorageLevel];
        }
        else if (supportedLevels.includes(_self.config.defaultLevel)) {
            return _self.config.levels[_self.config.defaultLevel];
        }
        else {
            return {
                name: 'Normal',
                slug: 'normal',
                value: '100%'
            };
        }
    },
    changeLevel: function(level) {
        let _self = this;
        if (!_self.config.enabled) {
            return;
        }
        let supportedLevels = Object.keys(_self.config.levels);
        if (supportedLevels.includes(level)) {
            let newLevel = _self.config.levels[level];
            app.$('body').css('zoom', newLevel.value);
            app.$('body').css('-webkit-text-size-adjust', newLevel.value);
            app.$('body').css('text-size-adjust', newLevel.value);
            localStorage.setItem('Nectar_Zooming', level);
        }
    }
}

/*
|------------------------------------------------------------------------------
| Check Auth Status
|------------------------------------------------------------------------------
*/

function checkAuthStatus({to, from, resolve, reject}) {
    let router = this;
    if (app.config.navigation.authentication.required) {
        if (app.store.state.isUserLoggedIn) {
            resolve();
        }
        else {
            if (app.config.navigation.authentication.ignoreRoutes.includes(to.path)) {
                resolve();
            }
            else {
                reject();
                router.navigate(
                    {
                        url: '/login/?redirect=' + to.path,
                    },
                    {
                        reloadCurrent: true
                    }
                );
                return;
            }
        }
    }
    else {
        resolve();
    }
}