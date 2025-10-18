'use strict';

window.routes = [];

/*
|------------------------------------------------------------------------------
| Home Route (/)
|------------------------------------------------------------------------------
*/

window.routes.push({
    path: '/',
    async: function({to, from, resolve, reject}) {
        if (window.config.navigation.splash.enabled) {
            resolve({
                componentUrl: './partials/screens/splash.html'
            });
        }
        else if (window.config.navigation.walkthrough.enabled && (!window.config.navigation.walkthrough.showFirstTimeOnly || (window.config.navigation.walkthrough.showFirstTimeOnly && localStorage.getItem('Nectar_Walkthrough_Shown') == null))) {
            resolve({
                componentUrl: './partials/screens/walkthrough.html'
            });
        }
        else if (window.config.navigation.authentication.required && !window.config.navigation.authentication.guestAccess) {
            resolve({
                componentUrl: './partials/screens/login.html'
            });
        }
        else {
            if (window.config.layout.default == 'singleView' && window.config.layout.singleView.tabbar.enabled) {
                resolve({
                    componentUrl: './partials/tabbar.html'
                });
            }
            else {
                resolve({
                    componentUrl: window.config.navigation.home.url
                });
            }
        }
    }
});

/*
|------------------------------------------------------------------------------
| Sidebar Route (For Both The Single View Layout & Tab View Layout)
|------------------------------------------------------------------------------
*/

if (window.config.layout[window.config.layout.default].sidebar.enabled) {
    window.routes.push({
        path: '/sidebar',
        componentUrl: './screens/conversation-list'
    });
}

/*
|------------------------------------------------------------------------------
| Tabbar Routes (For Single View Layout)
|------------------------------------------------------------------------------
*/

if (window.config.layout.default == 'singleView' && window.config.layout.singleView.tabbar.enabled) {
    window.routes.push({
        path: '/',
        alias: ['/home'],

       // componentUrl: './partials/components/checkbox.html',
        componentUrl: './partials/tabbar.html',
        tabs: [
            {
                id: 'tab-main',
                path: '/',
                componentUrl: window.config.navigation.home.url,
            },
            {
                id: 'tab-assistant',
                path: '/screens/conversation-list',
                componentUrl: './partials/screens/conversation-list.html'
            },
            {
                id: 'tab-more',
                path: '/more',
                componentUrl: './partials/screens/settings.html'
            }
        ]
    });
}

/*
|------------------------------------------------------------------------------
| Appearance & Language Settings Routes
|------------------------------------------------------------------------------
*/

window.routes.push(
    {
        path: '/select-appearance',
        componentUrl: './partials/select-appearance.html'
    },
    {
        path: '/select-language',
        componentUrl: './partials/select-language.html'
    }
);

/*
|------------------------------------------------------------------------------
| Screens Routes
|------------------------------------------------------------------------------
*/

window.routes.push({
    path: '/screens',
    componentUrl: './partials/screens.html'
});

window.routes.push(
    {
        path: '/404',
        alias: ['/screens/404'],
        componentUrl: './partials/screens/404.html'
    },
    {
        path: '/about',
        alias: ['/screens/about'],
        componentUrl: './partials/screens/about.html'
    },
    {
        path: '/conversation',
        alias: ['/screens/conversation','/screens/conversation/:guid'],
        componentUrl: './partials/screens/conversation.html',
        options:{
            reloadCurrent:true,
        }
    },
    {
        path: '/coversations',
        alias: ['/screens/conversation-list','/screens/conversation-list/:guid'],
        componentUrl: './partials/screens/conversation-list.html',
        options:{
            reloadCurrent:true,
        }
    },
    {
        path: '/home',
        alias: ['/screens/home'],
        componentUrl: './partials/screens/home.html?id=4'
    },
    {
        path: '/login',
        alias: ['/screens/login'],
        componentUrl: './partials/screens/login.html',
        beforeEnter: function ({to, from, resolve, reject}) {
            if (!app.store.state.isUserLoggedIn) {
                resolve();
            }
            else {
                reject();
            }
        }
    },
    {
        path: '/settings',
        alias: ['/screens/settings'],
        componentUrl: './partials/screens/settings.html'
    },
    {
        path: '/conversation-settings',
        alias: ['/screens/conversation-settings/:guid'],
        componentUrl: './partials/screens/conversation-settings.html'
    },
    {
        path: '/signup',
        alias: ['/screens/signup'],
        componentUrl: './partials/screens/signup.html',
        beforeEnter: function ({to, from, resolve, reject}) {
            if (!app.store.state.isUserLoggedIn) {
                resolve();
            }
            else {
                reject();
            }
        }
    },
    {
        path: '/splash',
        alias: ['/screens/splash'],
        componentUrl: './partials/screens/splash.html'
    },
    {
        path: '/terms',
        alias: ['/screens/terms'],
        componentUrl: './partials/screens/terms.html'
    },
    {
        path: '/under-maintenance',
        alias: ['/screens/under-maintenance'],
        componentUrl: './partials/screens/under-maintenance.html'
    },
    {
        path: '/walkthrough',
        alias: ['/screens/walkthrough'],
        componentUrl: './partials/screens/walkthrough.html'
    },{
        path: '/coming-soon',
        alias: ['/screens/coming-soon'],
        componentUrl: './partials/screens/coming-soon.html'
    }
);
/*
|------------------------------------------------------------------------------
| Add Your Routes Here
|------------------------------------------------------------------------------
*/

/*
window.routes.push({

});
*/