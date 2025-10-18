'use strict';

window.config = {};

/*
|------------------------------------------------------------------------------
| App
|------------------------------------------------------------------------------
*/

window.config.app = {
    id: 'com.woodocs.calc',
    version: '0.1',
    title: 'SIMBA',
    tagline: 'SIMBA',
    description: 'Simulators Based Assistant',
    logos: {
        logomarkLight: 'assets/custom/img/logomark-light.png',
        logomarkDark: 'assets/custom/img/logomark-light.png',
        logotypeLight: 'assets/custom/img/logotype-light.svg',
        logotypeDark: 'assets/custom/img/logotype-dark.svg',
        logomarkSquareLight: 'assets/custom/img/logomark-square-light.svg',
        logomarkSquareDark: 'assets/custom/img/logomark-square-dark.svg'
    },
    themeforestUrl: 'https://themeforest.net/item/nectar-mobile-web-app-kit/20466093?ref=pmsgz',
    gitbookUrl: 'https://pmsgz.gitbook.io/nectar'
}

/*
|------------------------------------------------------------------------------
| Add to Home Screen
|------------------------------------------------------------------------------
*/

window.config.a2hs = {
    enabled: true,
    autoPrompt: true,
    autoPromptDelay: 60000
}

/*
|------------------------------------------------------------------------------
| CoinCap API
|------------------------------------------------------------------------------
*/

window.config.coincap = {
    rootEndpoint: 'https://api.coincap.io/v2'
}

/*
|------------------------------------------------------------------------------
| CORS Proxy
|------------------------------------------------------------------------------
*/

window.config.cors = {
    proxy: Framework7.device.cordova ? 'https://nectar.website/demo/assets/custom/php/cors-proxy.php' : 'assets/custom/php/cors-proxy.php'
}

/*
|------------------------------------------------------------------------------
| Facebook
|------------------------------------------------------------------------------
*/

window.config.facebook = {
    appId: '2282002328754626'
}

/*
|------------------------------------------------------------------------------
| Google AdMob
|------------------------------------------------------------------------------
*/

window.config.admob = {
    enabled: true,
    ads: {
        banner: {
            ad: {
                android: {
                    id: 'ca-app-pub-3940256099942544/6300978111'
                },
                ios: {
                    id: 'ca-app-pub-3940256099942544/2934735716'
                }
            }
        },
        interstitial: {
            ad: {
                android: {
                    id: 'ca-app-pub-3940256099942544/1033173712'
                },
                ios: {
                    id: 'ca-app-pub-3940256099942544/4411468910'
                }
            }
        },
        interstitialVideo: {
            ad: {
                android: {
                    id: 'ca-app-pub-3940256099942544/8691691433'
                },
                ios: {
                    id: 'ca-app-pub-3940256099942544/5135589807'
                }
            }
        },
        rewarded: {
            ad: {
                android: {
                    id: 'ca-app-pub-3940256099942544/5224354917'
                },
                ios: {
                    id: 'ca-app-pub-3940256099942544/1712485313'
                }
            }
        },
        rewardedInterstitial: {
            ad: {
                android: {
                    id: 'ca-app-pub-3940256099942544/5354046379'
                },
                ios: {
                    id: 'ca-app-pub-3940256099942544/6978759866'
                }
            }
        }
    }
}

/*
|------------------------------------------------------------------------------
| Google Maps
|------------------------------------------------------------------------------
*/

window.config.googleMaps = {
    apiKey: 'AIzaSyCtiPGi_U05PWnEaFdu6SY62pxz57kBNvw'
}

/*
|------------------------------------------------------------------------------
| i18n
|------------------------------------------------------------------------------
*/

window.config.i18n = {
    enabled: true,
    languages: {
        en: {
            name: 'English',
            slug: 'english',
            code: 'en',
            locale: 'en-UK',
            dir: 'ltr',
            flag: 'https://flagcdn.com/gb.svg'
        },
        hi: {
            name: 'Hindi',
            slug: 'hindi',
            code: 'hi',
            locale: 'hi-IN',
            dir: 'ltr',
            flag: 'https://flagcdn.com/in.svg'
        },
        ar: {
            name: 'Arabic',
            slug: 'arabic',
            code: 'ar',
            locale: 'ar-AE',
            dir: 'rtl',
            flag: 'https://flagcdn.com/ae.svg'
        }
    },
    defaultLanguage: 'en',
    fallbackLanguage: 'en',
    namespaces: ['common']
}

/*
|------------------------------------------------------------------------------
| Layout
|------------------------------------------------------------------------------
*/

window.config.layout = {
    singleView: {
        sidebar: {
            enabled: true
        },
        tabbar: {
            enabled: false
        }
    },
    tabView: {
        sidebar: {
            enabled: false
        }
    },
    default: Framework7.device.cordova ? 'tabView' : 'singleView'
}

/*
|------------------------------------------------------------------------------
| Lottie
|------------------------------------------------------------------------------
*/

window.config.lottie = {
    assetUrl: Framework7.device.cordova ? 'assets/custom/lottie/' : `${location.origin + document.querySelector('base').getAttribute('href') + 'assets/custom/lottie/'}`
}

/*
|------------------------------------------------------------------------------
| Mailchimp
|------------------------------------------------------------------------------
*/

window.config.mailchimp = {
    subscribeUrl: 'https://gmail.us20.list-manage.com/subscribe/post-json',
    userId: '61e096fdff69bc5a03377380c',
    audienceId: 'edf9a19615'
}

/*
|------------------------------------------------------------------------------
| Navigation
|------------------------------------------------------------------------------
*/

window.config.navigation = {
    splash: {
        enabled: false,//!Framework7.device.standalone && !Framework7.device.cordova
    },
    walkthrough: {
        enabled: false,
        showFirstTimeOnly: false
    },
    authentication: {
        required: false,
        guestAccess: false,
        ignoreRoutes: [
            '/',
            '/404/',
            '/about/',
            '/cookie-policy/',
            '/faq/', '/feedback/', '/forgot-password/',
            '/home/',
            '/login/',
            '/privacy-policy/',
            '/select-language/', '/select-appearance/', '/sidebar/', '/signup/', '/splash/',
            '/terms/',
            '/under-maintenance/',
            '/walkthrough/'
        ]
    },
    home: {
        url: './partials/screens/conversation.html'
    }
}

/*
|------------------------------------------------------------------------------
| REST Countries API
|------------------------------------------------------------------------------
*/

window.config.restCountries = {
    rootEndpoint: 'https://restcountries.com/v3.1'
}

/*
|------------------------------------------------------------------------------
| Telegram Comments
|------------------------------------------------------------------------------
*/

window.config.telegram = {
    siteId: '9exyE2HK'
}

/*
|------------------------------------------------------------------------------
| Theming
|------------------------------------------------------------------------------
*/

window.config.theming = {
    enabled: true,
    theme: 'auto',
    color: '#1877F2',
    mode: 'dark'
}

/*
|------------------------------------------------------------------------------
| WordPress
|------------------------------------------------------------------------------
*/

window.config.wordpress = {
    url: 'https://techcrunch.com',
    type: 'org'
}

/*
|------------------------------------------------------------------------------
| Zooming
|------------------------------------------------------------------------------
*/

window.config.zooming = {
    enabled: true,
    levels: {
        small: {
            name: 'Small',
            slug: 'small',
            value: '90%'
        },
        normal: {
            name: 'Normal',
            slug: 'normal',
            value: '100%'
        },
        large: {
            name: 'Large',
            slug: 'large',
            value: '110%'
        }
    },
    defaultLevel: 'normal'
}

/*
|------------------------------------------------------------------------------
| myEyes configuration
|------------------------------------------------------------------------------
*/
window.config.voice = {
    enabled: true,
    defaultLanguage: 'en-US'
};
window.config.domain = "https://survey.simeng.es"
window.config.api_url = "https://survey.simeng.es/api/v1/assistant/";
window.config.api_urlbase = "https://survey.simeng.es/api/v1/";
window.config.token = "acec116fe48e1f788e76afbebc678e52a1bb3dfc";//localStorage.getItem('Jobify_User_Access_Token') || null;
window.config.completion = {
    url:  'https://daisei-api.ad6d-daiseicloudlab.aws.cloud.airbus-v.corp/api/v1/chat/completions',//'https://daisei-api.ad6d-daiseicloudlab.aws.cloud.airbus-v.corp/api/v1/chat/completions',//https://daisei-api.ad6d-daiseicloudlab.aws.cloud.airbus.corp/api/v1/chat/completions',
    apiKey: "sk-9532ebabfd8aff986fc36657f87512ef",//"sk-9532ebabfd8aff986fc36657f87512ef"//"sk-663592038ca171795e3226b441628922"
    models: 'https://daisei-api.ad6d-daiseicloudlab.aws.cloud.airbus-v.corp/api/v1/models',
    vision: 'phi-3-5-instruct-vision'
}
window.config.sse_hub = 'https://push.woodocs.com/wss2/.well-known/mercure';
window.config.api_methods = {
    login:window.config.api_urlbase + 'myeyes/login',
    conversation:window.config.api_url+'conversation',
    cancel_streaming_conversation:window.config.api_url+'cancel-streaming-conversation',
    load_conversation:window.config.api_url+'load-conversation',
    load_conversations:window.config.api_url+'load-conversations',
    load_assistants:window.config.api_url+'load-assistants',
    load_assistant:window.config.api_url+'load-assistant',
    delete_conversation: window.config.api_url + 'delete-conversation',
    create_chat:window.config.api_url+'create-chat',
    call_tool:window.config.api_url+'call-tool'
};
