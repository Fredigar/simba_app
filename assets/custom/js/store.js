'use strict';

window.store = Framework7.createStore({
    state: {
        isWebAppInstallable: false,
        themeColor: null,
        themeMode: null,
        isUserLoggedIn:  sessionStorage.getItem('isLogin') || false,
        currentUser: sessionStorage.getItem('userinfo') ? JSON.parse(sessionStorage.getItem('userinfo') ):null,
    },
    actions: {
        setWebAppInstallableStatus: function({state, dispatch}, status) {
            state.isWebAppInstallable = status;
        },
        setThemeColor: function({state, dispatch}, color) {
            state.themeColor = color;
        },
        setThemeMode: function({state, dispatch}, mode) {
            state.themeMode = mode;
        },
        setAuthorizationHeader: function({state, dispatch}, token) {
            token = token ? 'Bearer ' + token : undefined;
            app.request.setup({
                headers: {
                    Authorization: token
                }
            });
        },
        setUserSession: function({state, dispatch}, token) {
            localStorage.setItem('Jobify_User_Access_Token', token);
            dispatch('setAuthorizationHeader', token);
            state.isUserLoggedIn = true;
            sessionStorage.setItem('isLogin',true);
        },
        clearUserSession: function({state, dispatch}) {
            localStorage.removeItem('Jobify_User_Access_Token');
            sessionStorage.removeItem('isLogin');
            sessionStorage.removeItem('userinfo');
            dispatch('setAuthorizationHeader', 0);
            state.isUserLoggedIn = false;
        },
        loginUser: function({state, dispatch}, credentials) {
            app.preloader.show();
            return app.request({
                url:window.config.api_methods.login,
                method: 'POST',
                data: credentials,
                dataType: 'json'
            })
            .then(function(response) {
                app.preloader.hide();
                if (response.data.status == '200') {
                    dispatch('setUserSession', response.data.data.token || response.data.data.userinfo?.token || 'default-token');
                    state.currentUser = response.data.data.userinfo;
                    window.config.token = response.data.data.userinfo.token
                    sessionStorage.setItem('userinfo', JSON.stringify(response.data.data.userinfo));
                    sessionStorage.setItem('isLogin', true);
                    state.isUserLoggedIn = true;
                    app.toast.show({
                        text: app.i18n.translate('logged-in', 'Logged In!'),
                        cssClass: 'color-green'
                    });
                    return response.data;
                } else {
                    app.toast.show({
                        text: response.data.msg,
                        cssClass: 'color-red'
                    });
                    return null;
                }
            })
            .catch(function(response) {
                app.preloader.hide();
                let error = {
                    code: response.xhr.status,
                    message: JSON.parse(response.xhr.response).message
                }

                app.views.current.router.navigate('/login/', {
                    reloadCurrent: true
                });
                app.toast.show({
                    text: error.message,
                    cssClass: 'color-red'
                });
                return error;
            });
        },
        logoutUser: function({state, dispatch}) {
            app.dialog.confirm(
                app.i18n.translate('logout-confirm', 'Do you want to log out?'),
                app.i18n.translate('logout', 'Log Out'),
                function() {
                    dispatch('clearUserSession');
                    app.views.current.router.navigate('/login/', {
                        reloadCurrent: true
                    });
                    app.toast.show({
                        text: app.i18n.translate('logged-out', 'Logged Out!'),
                        cssClass: 'color-red'
                    });
                },
                function() {

                }
            );
        }
    },
    getters: {
        isWebAppInstallable: function({state}) {
            return state.isWebAppInstallable;
        },
        themeColor: function({state}) {
            return state.themeColor;
        },
        themeMode: function({state}) {
            return state.themeMode;
        },
        isUserLoggedIn: function({state}) {
            return state.isUserLoggedIn;
        },
        currentUser: function({state}) {
            return state.currentUser;
        }
    }
});