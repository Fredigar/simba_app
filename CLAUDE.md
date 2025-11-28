# CLAUDE.md - AI Assistant Guide for SIMBA Codebase

**Last Updated**: 2025-11-28
**Project**: SIMBA (Simulators Based Assistant)
**Repository**: Fredigar/simba_app

## Table of Contents

1. [Project Overview](#project-overview)
2. [Codebase Structure](#codebase-structure)
3. [Technology Stack](#technology-stack)
4. [Architecture Patterns](#architecture-patterns)
5. [Key Conventions](#key-conventions)
6. [Development Workflows](#development-workflows)
7. [Important Files Reference](#important-files-reference)
8. [Common Tasks](#common-tasks)
9. [Best Practices for AI Assistants](#best-practices-for-ai-assistants)
10. [Quick Reference](#quick-reference)

---

## Project Overview

**SIMBA** is a Progressive Web Application (PWA) designed as an AI-powered conversational assistant for technical support and simulator-based training, with focus on aviation simulation systems. Built on Framework7, it provides a mobile-first, cross-platform experience with advanced AI capabilities.

### Key Features
- AI-powered conversational interface with streaming responses
- Multi-modal support (text, images, documents, voice)
- Real-time document processing (OCR, PDF, DOCX, XLSX)
- Citation tracking and source management
- Tool/function calling capabilities
- Voice input/output
- Offline PWA support
- Internationalization (English, Spanish, Hindi, Arabic)
- Augmented Reality (AR) features

### Project Type
- **Framework**: Framework7 v6.x (mobile-first UI framework)
- **Architecture**: Component-based SPA with manager pattern
- **Deployment**: Static PWA (can be packaged as Cordova/Capacitor app)
- **Build Process**: None (development-focused, direct file serving)

---

## Codebase Structure

```
/home/user/simba_app/
├── index.html                    # Main entry point
├── index2.html                   # Alternative entry point
├── calc.html                     # Calculator interface
├── manifest.json                 # PWA manifest
├── service-worker.js             # Service worker for offline support
├── package.json                  # Project metadata (minimal)
├── README.md                     # Spanish documentation
│
├── AR/                           # Augmented Reality features
│   ├── index.html                # AR demos and examples
│   ├── markers/                  # AR marker patterns
│   ├── models/                   # 3D models
│   └── js/                       # AR-specific JavaScript
│
├── assets/
│   ├── js/
│   │   └── conversation_refactored.js    # Main conversation module (5,718 lines)
│   │
│   ├── vendor/                   # 46+ third-party libraries
│   │   ├── framework7/           # Framework7 core
│   │   ├── jquery/               # jQuery 3.6.0
│   │   ├── markdown-it/          # Markdown processor
│   │   ├── katex/                # Math rendering
│   │   ├── highlight/            # Code syntax highlighting
│   │   ├── pdfjs/                # PDF rendering
│   │   ├── tesseract/            # OCR
│   │   └── ... (40+ more)
│   │
│   └── custom/
│       ├── js/                   # Application JavaScript
│       │   ├── app.js            # Global app utilities (249 lines)
│       │   ├── config.js         # App configuration (344 lines)
│       │   ├── routes.js         # Route definitions (230 lines)
│       │   ├── init.js           # App initialization (200+ lines)
│       │   ├── store.js          # State management (126 lines)
│       │   ├── simba.js          # SIMBA core managers (3,814 lines)
│       │   ├── custom.js         # Custom utilities (1,575 lines)
│       │   ├── filedropezone.js  # File upload handling
│       │   ├── sources-manager.js        # Citation management
│       │   ├── conversation-optimizer.js # Context optimization
│       │   ├── flowfollow.js             # Workflow management
│       │   ├── chartgen.js               # Chart generation
│       │   └── MCPClientAdapter.js       # MCP protocol adapter
│       │
│       ├── css/
│       │   ├── custom.css                # Global custom styles
│       │   └── conversation_refactored.css  # Conversation-specific styles (214 lines)
│       │
│       ├── dataset/              # JSON data files
│       │   ├── users.json
│       │   ├── articles.json
│       │   ├── products.json
│       │   ├── events.json
│       │   ├── jobs.json
│       │   └── flowfollow/       # Workflow definitions
│       │
│       ├── i18n/                 # Internationalization
│       │   ├── en/               # English
│       │   ├── es/               # Spanish
│       │   ├── hi/               # Hindi
│       │   └── ar/               # Arabic
│       │
│       ├── img/, audio/, lottie/, favicon/  # Assets
│       └── php/                  # Backend scripts (CORS proxy)
│
└── partials/                     # HTML templates/components
    ├── app.html                  # Main app shell template
    ├── tabbar.html               # Bottom tab bar
    ├── sidebar.html              # Side navigation
    │
    ├── screens/                  # Screen templates (58+ files)
    │   ├── conversation_refactored.html  # Main chat interface (1,265 lines)
    │   ├── conversation.html             # Legacy chat (7,891 lines - deprecated)
    │   ├── conversation-list.html        # Chat history
    │   ├── conversation-settings.html    # Chat settings
    │   ├── home.html, settings.html, login.html, signup.html
    │   └── ... (50+ more screens)
    │
    ├── components/               # Reusable UI components
    ├── integrations/             # Third-party integrations
    └── web-apis/                 # Web API demonstrations (27 files)
```

---

## Technology Stack

### Core Framework
- **Framework7 v6.x**: Mobile-first UI framework with iOS, Android, and desktop themes
- **jQuery 3.6.0**: DOM manipulation and utilities
- **Nectar Theme**: Commercial template/theme built on Framework7

### Frontend Libraries

**Content Processing**:
- **Markdown-it**: Primary markdown processor with TeX/Math support
- **Showdown**: Alternative markdown with KaTeX integration
- **KaTeX**: Math typesetting (TeX rendering)
- **Highlight.js**: Code syntax highlighting (40+ languages)

**Document Handling**:
- **PDF.js**: PDF rendering and text extraction
- **Mammoth**: Word document (.docx) processing
- **XLSX**: Excel file handling
- **Tesseract.js**: OCR (Optical Character Recognition)

**Data & Visualization**:
- **SQL.js**: Client-side SQL database
- **Chart.js**: Data visualization
- **Moment.js**: Date/time manipulation

**UI Components**:
- **Lottie Player**: Animation playback
- **RateYo**: Rating widgets
- **Circle Audio Player**: Audio playback
- **QR Scanner**: QR code functionality
- **LazyLoad**: Image lazy loading

**Utilities**:
- **i18next**: Internationalization
- **jQuery Validation**: Form validation
- **Anime.js**: JavaScript animation
- **EXIF.js**: Image metadata extraction

### Backend Integration
- **AI Models**: Mistral AI (magistral-2509, mistral-small-24B-instruct)
- **Tokenization**: Mistral tokenizer for context management
- **SSE (Server-Sent Events)**: Real-time streaming responses
- **RESTful APIs**: Assistant API and Completions API endpoints

### Build & Deployment
- **PWA**: Service Worker with Workbox caching
- **Web App Manifest**: For installation and app-like experience
- **Cordova Compatible**: Can be packaged as native mobile app
- **No Build Process**: Direct file serving (development mode)

---

## Architecture Patterns

### 1. Manager Pattern (Core Architecture)

All core functionality is encapsulated in manager classes under the `window.SIMBA` namespace.

**Location**: `/assets/custom/js/simba.js` (3,814 lines)

#### Core Managers

**ConfigManager**
- Manages AI model configuration
- Handles API endpoints and authentication
- Persists to localStorage
```javascript
SIMBA.ConfigManager {
  config: { completionsApiUrl, model, temperature, maxTokens, ... }
  loadFromStorage(), updateConfig(), saveToStorage(), isValid()
}
```

**MessageManager**
- Maintains conversation history
- Token estimation and optimization
- Message deduplication
```javascript
SIMBA.MessageManager {
  messagesHistory: [{ role, content, tool_calls, id }]
  addMessage(), updateSystemMessage(), getHistory(), clearHistory()
  estimateTokens(), removeSecondToLastAssistant()
}
```

**SourceManager**
- Manages citations and references
- Groups and counts sources
```javascript
SIMBA.SourceManager {
  addSource(), getSources(), clearSources(), renderSources()
}
```

**HighlightManager**
- Tracks highlighted/bookmarked content
- Persists to localStorage
```javascript
SIMBA.HighlightManager {
  addHighlight(), removeHighlight(), getHighlights(), renderHighlights()
}
```

**ToolManager**
- Handles AI function/tool calling
- Manages tool execution lifecycle
```javascript
SIMBA.ToolManager {
  executeToolCall(), registerTool(), getAvailableTools()
}
```

**ConversationManager**
- CRUD operations for conversations
- Loads/saves conversation state
```javascript
SIMBA.ConversationManager {
  loadConversation(), saveConversation(), deleteConversation()
  listConversations(), createConversation()
}
```

**VoiceManager**
- Speech-to-text functionality
- Multiple engine support (Web Speech API)
```javascript
VoiceManager {
  startRecording(), stopRecording(), getTranscript()
  engines: [WebSpeechEngine, ...]
}
```

**ContextManager**
- Document context management
- Handles file attachments and context injection
```javascript
SIMBA.ContextManager {
  addDocument(), removeDocument(), getContext()
}
```

### 2. Component-Based Architecture

**File**: `/assets/js/conversation_refactored.js` (5,718 lines)

The conversation module uses a clean class-based structure:

```javascript
export class ConversationContext {
  // Wraps Framework7 props and context
  constructor(props, frameworkContext) { ... }
}

export class ConversationManagers {
  // Centralizes all SIMBA managers
  constructor() {
    this.configManager = new SIMBA.ConfigManager();
    this.messageManager = new SIMBA.MessageManager();
    this.sourceManager = new SIMBA.SourceManager();
    // ... other managers
  }
}

export class ConversationLifecycle {
  // Encapsulates initialization and rendering
  render(context, managers) {
    // Setup state, listeners, UI
    // Return Framework7 component render function
  }
}

// Default export for Framework7 component
export default ConversationLifecycle.render;
```

**Key Sections** (see line comments in code):
- **INITIALIZATION** (L164-L565): Setup, data loading, listeners
- **EVENT HANDLERS** (L566-L1512): User interactions, API calls
- **HELPERS** (L1513-L2699): Utility functions, rendering logic
- **ADVANCED FEATURES**: Reasoning mode, voice, OCR, tickets

### 3. State Management

**File**: `/assets/custom/js/store.js`

Framework7's built-in store pattern (Vuex-like):

```javascript
window.store = Framework7.createStore({
  state: {
    isWebAppInstallable: false,
    themeColor: null,
    themeMode: null,
    isUserLoggedIn: sessionStorage.getItem('isLogin'),
    currentUser: JSON.parse(sessionStorage.getItem('userinfo'))
  },
  actions: {
    loginUser(context, user) { ... },
    logoutUser(context) { ... },
    setUserSession(context, data) { ... },
    clearUserSession(context) { ... }
  },
  getters: {
    isUserLoggedIn(state) { return state.isUserLoggedIn; },
    currentUser(state) { return state.currentUser; }
  }
});
```

### 4. Routing System

**File**: `/assets/custom/js/routes.js`

Declarative route definitions:

```javascript
window.routes = [
  {
    path: '/conversation1',
    alias: ['/screens/conversation1', '/screens/conversation1/:guid'],
    componentUrl: './partials/screens/conversation_refactored.html',
    options: { reloadCurrent: true }
  },
  // ... more routes
];
```

**Route Guards**: `beforeEnter` checks authentication via `app.store.state.isUserLoggedIn`

### 5. Event-Driven Communication

Heavy use of Framework7 events for component communication:

```javascript
// Global app events
app.on('pageInit', (page) => { ... });
app.on('popoverOpen', (popover) => { ... });

// Component-specific events
$f7.$on('conversationUpdated', (data) => { ... });
```

### 6. Separation of Concerns

- **Presentation**: HTML templates in `/partials/`
- **Logic**: JavaScript modules in `/assets/custom/js/` and `/assets/js/`
- **Styling**: CSS in `/assets/custom/css/`
- **Data**: JSON files in `/assets/custom/dataset/`
- **Assets**: Images, audio, animations in `/assets/custom/`

---

## Key Conventions

### Naming Conventions

**Files**: kebab-case
```
conversation-refactored.js
sources-manager.js
conversation_refactored.html
```

**Classes**: PascalCase
```javascript
class ConversationManager { ... }
class MessageManager { ... }
```

**Functions/Methods**: camelCase
```javascript
function loadConversation() { ... }
function estimateTokens() { ... }
```

**Constants**: UPPER_SNAKE_CASE
```javascript
const TOKEN_LIMIT = 4096;
const DEFAULT_MODEL = 'mistral-small';
```

**CSS Classes**: kebab-case with BEM-like structure
```css
.message-toolbar
.file-card-overlay
.reference-group-item
```

### Code Organization

**Manager Classes**: All in `simba.js`
```javascript
window.SIMBA = window.SIMBA || {};
SIMBA.ConfigManager = class { ... };
SIMBA.MessageManager = class { ... };
```

**Page-Specific Logic**: Separate modules
```javascript
// conversation_refactored.js
export class ConversationLifecycle { ... }
export default ConversationLifecycle.render;
```

**Utility Functions**: In `custom.js` and `app.js`
```javascript
window.app = {
  showToast(message) { ... },
  showPreloader() { ... }
};
```

**Configuration**: Centralized in `config.js`
```javascript
window.config = {
  app: { ... },
  layout: { ... },
  i18n: { ... }
};
```

### Comment Conventions

**Section Headers**:
```javascript
// ===========================================
// SECTION NAME
// ===========================================
```

**JSDoc-Style for Classes**:
```javascript
/**
 * Manages conversation history and state
 * @class ConversationManager
 */
```

**Inline Comments**:
```javascript
// Check if user is authenticated before proceeding
if (!app.store.state.isUserLoggedIn) { ... }
```

**Language**:
- Code and inline comments: English
- README documentation: Spanish
- User-facing strings: Internationalized via i18next

### HTML Template Conventions

Framework7 templates use template literals with reactive binding:

```html
<template>
  <div class="page" data-name="conversation">
    <div class="navbar">
      <div class="title">${title}</div>
    </div>

    <div class="page-content">
      ${messages.map(msg => $h`
        <div class="message message-${msg.type}">
          ${msg.content}
        </div>
      `)}
    </div>
  </div>
</template>

<script>
  return {
    data() {
      return { title: 'Chat', messages: [] };
    },
    methods: {
      sendMessage() { ... }
    }
  };
</script>
```

**Key Points**:
- Use `${}` for variable interpolation
- Use `$h` template tag for sanitized HTML in loops
- Use `@event` syntax for event handlers: `@click="${handleClick}"`
- Return `data()` and `methods` from component script

---

## Development Workflows

### Application Initialization Flow

```
index.html loads
  ↓
Framework7 + Vendor Libraries loaded
  ↓
Custom JS loaded in order:
  1. config.js     → window.config
  2. routes.js     → window.routes
  3. store.js      → window.store
  4. simba.js      → window.SIMBA.*
  5. init.js       → Framework7.App initialization
  6. app.js        → window.app utilities
  ↓
Framework7 App initialized
  ↓
Renders app.html (main shell)
  ↓
Routes to initial screen:
  splash → walkthrough → login → home
```

### Conversation Flow

```
User navigates to /screens/conversation1/:guid
  ↓
Load conversation_refactored.html template
  ↓
Initialize ConversationManagers (all SIMBA managers)
  ↓
Load chat history (if GUID provided)
  ↓
Initialize MessageBar, attach event listeners
  ↓
User types message + clicks send
  ↓
Validate input
  ↓
Add user message to MessageManager
  ↓
Render user message in UI
  ↓
Call Completions API (SSE streaming)
  ↓
Stream response chunks
  ↓
Update UI in real-time (incremental rendering)
  ↓
Parse citations/sources → SourceManager
  ↓
Execute tool calls (if any) → ToolManager
  ↓
Finalize assistant message
  ↓
Save conversation state → ConversationManager
```

### File Upload Flow

```
User drags file onto dropzone
  ↓
Detect file type (image, PDF, DOCX, etc.)
  ↓
Generate preview/thumbnail
  ↓
Process file:
  - Image → OCR via Tesseract
  - PDF → Extract text via PDF.js
  - DOCX → Extract text via Mammoth
  - XLSX → Parse via XLSX library
  ↓
Add to context → ContextManager
  ↓
Display attachment card in UI
  ↓
Include in next message payload to API
```

### Route Navigation Flow

```
User clicks link or navigates
  ↓
Framework7 router matches route in routes.js
  ↓
Check beforeEnter guard (if defined)
  - Verify authentication
  - Check permissions
  ↓
Load component:
  - componentUrl → fetch HTML template
  - component → inline component definition
  ↓
Initialize component lifecycle:
  - data() → setup reactive data
  - on: { pageInit, pageBeforeIn, ... }
  ↓
Render template with data
  ↓
Attach event listeners
  ↓
Page ready for interaction
```

---

## Important Files Reference

### Core Application Files

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `index.html` | Main entry point | ~500 | Loads all libraries, initializes app |
| `manifest.json` | PWA manifest | ~30 | App metadata, icons, display mode |
| `service-worker.js` | Offline support | ~100 | Workbox caching strategies |

### Configuration & Setup

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `assets/custom/js/config.js` | App configuration | 344 | App settings, API URLs, theming, i18n |
| `assets/custom/js/routes.js` | Route definitions | 230 | All app routes with components |
| `assets/custom/js/store.js` | State management | 126 | Global reactive state |
| `assets/custom/js/init.js` | App initialization | 200+ | Framework7 initialization logic |

### Core Logic

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `assets/custom/js/simba.js` | SIMBA managers | 3,814 | All manager classes (Config, Message, Source, etc.) |
| `assets/js/conversation_refactored.js` | Main conversation | 5,718 | Conversation UI and logic (refactored) |
| `assets/custom/js/app.js` | Global utilities | 249 | Toast, preloader, helpers |
| `assets/custom/js/custom.js` | Custom utilities | 1,575 | Various helper functions |

### Specialized Modules

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `assets/custom/js/sources-manager.js` | Citation management | ~300 | Source tracking and rendering |
| `assets/custom/js/conversation-optimizer.js` | Context optimization | ~400 | Token management, summarization |
| `assets/custom/js/filedropezone.js` | File uploads | ~200 | Drag-and-drop handling |
| `assets/custom/js/flowfollow.js` | Workflow management | ~500 | Simulator procedure workflows |
| `assets/custom/js/chartgen.js` | Chart generation | ~300 | Dynamic chart creation |
| `assets/custom/js/MCPClientAdapter.js` | MCP protocol | ~400 | MCP client implementation |

### Templates

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `partials/app.html` | App shell | ~200 | Main layout, sidebar, navbar |
| `partials/screens/conversation_refactored.html` | Chat interface | 1,265 | Main conversation screen |
| `partials/screens/conversation.html` | Legacy chat | 7,891 | Old conversation (deprecated) |
| `partials/screens/home.html` | Dashboard | ~300 | Home screen |
| `partials/screens/settings.html` | Settings | ~400 | App settings |

### Styling

| File | Purpose | Lines | Key Contents |
|------|---------|-------|--------------|
| `assets/custom/css/custom.css` | Global styles | ~1,000 | Custom global styles |
| `assets/custom/css/conversation_refactored.css` | Chat styles | 214 | Conversation-specific styles |

---

## Common Tasks

### 1. Adding a New Route

**Step 1**: Edit `/assets/custom/js/routes.js`
```javascript
window.routes = [
  // ... existing routes
  {
    path: '/my-new-screen',
    alias: ['/screens/my-new-screen', '/screens/my-new-screen/:id'],
    componentUrl: './partials/screens/my-new-screen.html',
    options: {
      reloadCurrent: false
    }
  }
];
```

**Step 2**: Create template `/partials/screens/my-new-screen.html`
```html
<template>
  <div class="page" data-name="my-new-screen">
    <div class="navbar">
      <div class="navbar-bg"></div>
      <div class="navbar-inner">
        <div class="left">
          <a href="#" class="link back">
            <i class="icon icon-back"></i>
            <span class="if-not-md">Back</span>
          </a>
        </div>
        <div class="title">My New Screen</div>
      </div>
    </div>

    <div class="page-content">
      <div class="block">
        <p>Content here</p>
      </div>
    </div>
  </div>
</template>

<script>
  return {
    data() {
      return {
        // reactive data
      };
    },
    on: {
      pageInit(e, page) {
        // initialization logic
      }
    },
    methods: {
      // component methods
    }
  };
</script>
```

**Step 3**: Add navigation link
```html
<a href="/screens/my-new-screen" class="link">Go to New Screen</a>
```

### 2. Adding a New SIMBA Manager

**Edit**: `/assets/custom/js/simba.js`

```javascript
window.SIMBA = window.SIMBA || {};

/**
 * New manager description
 * @class NewManager
 */
SIMBA.NewManager = class {
  constructor() {
    this.data = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    const stored = localStorage.getItem('simba_new_data');
    if (stored) {
      this.data = JSON.parse(stored);
    }
  }

  saveToStorage() {
    localStorage.setItem('simba_new_data', JSON.stringify(this.data));
  }

  addItem(item) {
    this.data.push(item);
    this.saveToStorage();
  }

  getItems() {
    return this.data;
  }

  clearItems() {
    this.data = [];
    this.saveToStorage();
  }
};
```

**Usage**:
```javascript
const newManager = new SIMBA.NewManager();
newManager.addItem({ name: 'Test' });
console.log(newManager.getItems());
```

### 3. Modifying App Configuration

**Edit**: `/assets/custom/js/config.js`

```javascript
window.config = {
  app: {
    id: 'com.woodocs.calc',
    version: '0.1',
    title: 'SIMBA',
    description: 'Simulators Based Assistant'
  },

  // Add new configuration section
  myNewFeature: {
    enabled: true,
    apiUrl: 'https://api.example.com',
    timeout: 5000
  },

  // ... rest of config
};
```

**Access**:
```javascript
if (window.config.myNewFeature.enabled) {
  // use feature
}
```

### 4. Adding Internationalization

**Step 1**: Add translations to language files

`/assets/custom/i18n/en/translation.json`:
```json
{
  "my_new_key": "Hello World",
  "welcome_message": "Welcome, {{username}}!"
}
```

`/assets/custom/i18n/es/translation.json`:
```json
{
  "my_new_key": "Hola Mundo",
  "welcome_message": "¡Bienvenido, {{username}}!"
}
```

**Step 2**: Use in templates
```html
<div>${$t('my_new_key')}</div>
<div>${$t('welcome_message', { username: 'Alice' })}</div>
```

**Step 3**: Use in JavaScript
```javascript
const message = i18next.t('my_new_key');
```

### 5. Adding Custom Styles

**Option A**: Global styles in `/assets/custom/css/custom.css`
```css
/* Add to end of file */
.my-custom-class {
  background-color: #f0f0f0;
  padding: 1rem;
  border-radius: 8px;
}
```

**Option B**: Component-specific styles (recommended)

Create `/assets/custom/css/my-component.css`:
```css
/* My Component Styles */
.my-component-container {
  display: flex;
  flex-direction: column;
}

.my-component-item {
  padding: 0.5rem;
  border-bottom: 1px solid #ddd;
}
```

Import in component HTML:
```html
<template>
  <!-- component markup -->
</template>

<style>
  @import url('../../assets/custom/css/my-component.css');
</style>
```

### 6. Making API Calls

**Using Framework7 Request (Recommended)**:
```javascript
app.request({
  url: 'https://api.example.com/data',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  data: {
    message: 'Hello'
  },
  dataType: 'json',
  success: (data) => {
    console.log('Success:', data);
  },
  error: (xhr, status) => {
    console.error('Error:', status);
    app.dialog.alert('Request failed');
  }
});
```

**Using Fetch API**:
```javascript
try {
  const response = await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'Hello' })
  });

  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  console.error('Error:', error);
  app.dialog.alert('Request failed');
}
```

**SSE Streaming (for AI responses)**:
```javascript
const eventSource = new EventSource(apiUrl, {
  headers: { Authorization: `Bearer ${apiKey}` }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const chunk = data.choices[0].delta.content;

  // Update UI with streaming chunk
  responseText += chunk;
  updateUI();
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

### 7. Working with State Management

**Updating State**:
```javascript
// Dispatch action
app.store.dispatch('loginUser', {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com'
});

// Direct state mutation (not recommended)
app.store.state.themeMode = 'dark';
```

**Reading State**:
```javascript
// Using getter
const isLoggedIn = app.store.getters.isUserLoggedIn.value;
const currentUser = app.store.getters.currentUser.value;

// Direct state access
const themeMode = app.store.state.themeMode;
```

**Adding New State**:

Edit `/assets/custom/js/store.js`:
```javascript
window.store = Framework7.createStore({
  state: {
    // ... existing state
    myNewState: null
  },
  actions: {
    // ... existing actions
    setMyNewState(context, value) {
      context.state.myNewState = value;
    }
  },
  getters: {
    // ... existing getters
    myNewState(state) {
      return state.myNewState;
    }
  }
});
```

### 8. Adding Tool/Function Calling

**Step 1**: Define tool in ToolManager

Edit `/assets/custom/js/simba.js`:
```javascript
SIMBA.ToolManager = class {
  constructor() {
    this.tools = {
      // ... existing tools
      get_weather: {
        name: 'get_weather',
        description: 'Get current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'City name'
            }
          },
          required: ['location']
        }
      }
    };
  }

  async executeToolCall(toolCall) {
    const { name, arguments: args } = toolCall.function;

    switch (name) {
      case 'get_weather':
        return await this.getWeather(args.location);
      // ... other tools
    }
  }

  async getWeather(location) {
    // Implementation
    const response = await fetch(`https://api.weather.com/${location}`);
    return await response.json();
  }
};
```

**Step 2**: Include tools in API request
```javascript
const tools = Object.values(toolManager.tools);

const response = await fetch(apiUrl, {
  method: 'POST',
  body: JSON.stringify({
    messages: messageHistory,
    tools: tools,
    tool_choice: 'auto'
  })
});
```

---

## Best Practices for AI Assistants

### 1. Always Read Before Modifying

**CRITICAL**: Never modify a file without reading it first. Understand the existing structure and patterns.

```javascript
// ❌ Bad: Modifying without context
// AI directly edits simba.js without reading it

// ✅ Good: Read first, then modify
// AI reads simba.js, understands existing managers, then adds new one
```

### 2. Follow Existing Patterns

Maintain consistency with existing code:

```javascript
// ❌ Bad: Introducing new pattern
class MyManager {  // Different from existing managers
  getData = () => { ... }  // Arrow function in class
}

// ✅ Good: Following existing pattern
SIMBA.MyManager = class {  // Matches existing managers
  getData() { ... }  // Regular method
  loadFromStorage() { ... }  // Standard method name
  saveToStorage() { ... }  // Standard method name
}
```

### 3. Preserve Existing Comments

When modifying code, keep existing section markers:

```javascript
// ===========================================
// INITIALIZATION
// ===========================================
// ... existing code

// Add new code here, respecting the section

// ===========================================
// EVENT HANDLERS
// ===========================================
```

### 4. Use Appropriate Tools

- **For file search**: Use `Glob` tool with patterns
- **For content search**: Use `Grep` tool with regex
- **For reading files**: Use `Read` tool
- **For editing files**: Use `Edit` tool (prefer over `Write` for existing files)
- **For new files**: Use `Write` tool (only when necessary)

### 5. Understand the Component Lifecycle

Framework7 components have specific lifecycle hooks:

```javascript
return {
  on: {
    pageInit(e, page) {
      // Page initialized, DOM ready
      // Good place for setup, event listeners
    },
    pageBeforeIn(e, page) {
      // Before page transition starts
      // Good for loading data
    },
    pageAfterIn(e, page) {
      // After page transition completes
      // Good for animations, focus
    },
    pageBeforeOut(e, page) {
      // Before leaving page
      // Good for saving state
    },
    pageBeforeRemove(e, page) {
      // Before page removed from DOM
      // Good for cleanup, removing listeners
    }
  }
};
```

### 6. Handle Errors Gracefully

Always implement error handling:

```javascript
// ❌ Bad: No error handling
const data = await fetch(url).then(r => r.json());
processData(data);

// ✅ Good: Proper error handling
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  processData(data);
} catch (error) {
  console.error('Failed to fetch data:', error);
  app.toast.create({
    text: 'Failed to load data',
    closeTimeout: 3000
  }).open();
}
```

### 7. Respect LocalStorage Conventions

SIMBA uses prefixed keys:

```javascript
// ✅ Good: Prefixed keys
localStorage.setItem('simba_config', JSON.stringify(config));
localStorage.setItem('simba_conversations', JSON.stringify(conversations));

// ❌ Bad: Unprefixed keys
localStorage.setItem('config', JSON.stringify(config));
```

### 8. Use Framework7 APIs

Prefer Framework7 built-in methods over vanilla JS:

```javascript
// ❌ Avoid: Vanilla JS
document.querySelector('.my-element').addEventListener('click', handler);

// ✅ Prefer: Framework7 API
app.$('.my-element').on('click', handler);

// ❌ Avoid: alert()
alert('Message');

// ✅ Prefer: Framework7 dialog
app.dialog.alert('Message');

// ❌ Avoid: Native fetch with manual loading indicator
fetch(url).then(...);

// ✅ Prefer: Framework7 request with automatic loading
app.request({
  url: url,
  success: (data) => { ... }
});
```

### 9. Maintain Separation of Concerns

Keep logic, presentation, and styling separate:

```javascript
// ❌ Bad: Inline styles, mixed concerns
function renderMessage(msg) {
  return `<div style="padding: 10px; background: #fff;">${msg}</div>`;
}

// ✅ Good: Use CSS classes
function renderMessage(msg) {
  return `<div class="message-item">${msg}</div>`;
}
// CSS in conversation_refactored.css:
// .message-item { padding: 10px; background: #fff; }
```

### 10. Document Complex Logic

Add comments for non-obvious code:

```javascript
// ❌ Bad: No explanation
const tokens = msgs.reduce((sum, m) =>
  sum + Math.ceil(m.content.length / 4), 0);

// ✅ Good: Explained
// Estimate tokens using rough heuristic: 1 token ≈ 4 characters
// This is an approximation for quick client-side calculation
const tokens = msgs.reduce((sum, m) =>
  sum + Math.ceil(m.content.length / 4), 0);
```

### 11. Test Responsive Behavior

SIMBA is mobile-first, so consider all screen sizes:

```css
/* ✅ Good: Mobile-first approach */
.my-component {
  /* Base styles for mobile */
  padding: 0.5rem;
}

@media (min-width: 768px) {
  /* Tablet and desktop */
  .my-component {
    padding: 1rem;
  }
}
```

### 12. Internationalize User-Facing Text

Never hardcode user-facing strings:

```javascript
// ❌ Bad: Hardcoded string
app.toast.create({ text: 'Message sent successfully' }).open();

// ✅ Good: Internationalized
app.toast.create({ text: i18next.t('message_sent') }).open();
```

---

## Quick Reference

### Access Framework7 Instance
```javascript
// In component context
$f7

// Globally
app
```

### jQuery-Like DOM Selection
```javascript
// Framework7's Dom7
app.$('.my-selector')
app.$$('.multiple-items')  // Returns array

// Or use jQuery
$('.my-selector')
```

### Show Toast Notification
```javascript
app.toast.create({
  text: 'Message here',
  position: 'center',  // top, center, bottom
  closeTimeout: 2000
}).open();
```

### Show Loading Indicator
```javascript
app.preloader.show();
// ... do work
app.preloader.hide();
```

### Show Dialog
```javascript
// Alert
app.dialog.alert('Message', 'Title');

// Confirm
app.dialog.confirm('Question?', 'Title', () => {
  // confirmed
});

// Prompt
app.dialog.prompt('Enter value:', 'Title', (value) => {
  // handle value
});
```

### Navigate to Route
```javascript
// Push to history
app.views.main.router.navigate('/screens/conversation1');

// Replace current
app.views.main.router.navigate('/screens/home', {
  reloadCurrent: true
});

// Go back
app.views.main.router.back();
```

### Update Component Data
```javascript
// In component methods
this.$update();  // Re-render component

// Update specific data
this.$setState({ messages: newMessages });
```

### Access SIMBA Managers
```javascript
// Create instance
const configManager = new SIMBA.ConfigManager();
const messageManager = new SIMBA.MessageManager();

// Use methods
configManager.loadFromStorage();
messageManager.addMessage({ role: 'user', content: 'Hello' });
```

### Make API Call
```javascript
app.request({
  url: 'https://api.example.com/data',
  method: 'POST',
  data: { key: 'value' },
  success: (data) => { ... },
  error: (xhr, status) => { ... }
});
```

### Format Date
```javascript
// Using moment.js
moment().format('YYYY-MM-DD HH:mm:ss');
moment(date).fromNow();  // "2 hours ago"
```

### Render Markdown
```javascript
// Using markdown-it (available globally)
const html = window.markdownit().render('# Hello\n\nWorld');
```

### Highlight Code
```javascript
// Syntax highlighting (highlight.js)
const highlighted = hljs.highlightAuto(code).value;
```

### Render Math
```javascript
// KaTeX for math typesetting
katex.render('E = mc^2', element);
```

### LocalStorage Operations
```javascript
// Save
localStorage.setItem('simba_key', JSON.stringify(data));

// Load
const data = JSON.parse(localStorage.getItem('simba_key') || '{}');

// Remove
localStorage.removeItem('simba_key');

// Clear all
localStorage.clear();
```

---

## Git Workflow

### Branch Naming Convention
```
claude/claude-md-{session-id}-{hash}
```

Example: `claude/claude-md-miihyybu562a4n1d-01DVjF2XdUpCoUErjDCgfC4e`

### Commit Message Format
```
<type>: <short description>

<optional detailed description>

<optional footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat: Add weather tool to SIMBA ToolManager

Implemented get_weather tool that fetches current weather data
for a given location using OpenWeatherMap API.

fix: Correct token estimation in MessageManager

The previous calculation didn't account for special tokens,
causing context overflow. Now uses proper tokenizer.

docs: Update CLAUDE.md with new manager examples
```

### Pushing Changes
```bash
# CRITICAL: Always push to claude/* branch with -u flag
git push -u origin claude/claude-md-{session-id}-{hash}

# If network errors occur, retry up to 4 times with exponential backoff:
# - Wait 2s, retry
# - Wait 4s, retry
# - Wait 8s, retry
# - Wait 16s, retry
```

---

## Troubleshooting Common Issues

### Issue: Component Not Re-rendering

**Solution**: Call `this.$update()` after data changes
```javascript
methods: {
  loadData() {
    this.messages = [...newMessages];
    this.$update();  // Force re-render
  }
}
```

### Issue: Manager Not Persisting Data

**Solution**: Ensure `saveToStorage()` is called after modifications
```javascript
messageManager.addMessage(msg);
messageManager.saveToStorage();  // Don't forget this!
```

### Issue: Route Not Loading

**Solution**: Check route definition and file path
```javascript
// Ensure componentUrl path is correct relative to index.html
{
  path: '/my-screen',
  componentUrl: './partials/screens/my-screen.html'  // Must start with ./
}
```

### Issue: i18n Key Not Found

**Solution**: Check translation file exists and key is correct
```javascript
// Verify file exists: /assets/custom/i18n/{lang}/translation.json
// Verify key exists in JSON file
// Use correct syntax: ${$t('key')} in templates, i18next.t('key') in JS
```

### Issue: API CORS Error

**Solution**: Use CORS proxy if available
```javascript
// Option 1: Use proxy (if available)
const proxyUrl = '/assets/custom/php/cors-proxy.php?url=';
const apiUrl = proxyUrl + encodeURIComponent('https://api.example.com/data');

// Option 2: Ensure backend has CORS headers
// Access-Control-Allow-Origin: *
```

### Issue: Service Worker Not Updating

**Solution**: Clear cache and unregister service worker
```javascript
// In browser console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(registration => registration.unregister());
});

// Then hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
```

---

## Performance Optimization Tips

### 1. Lazy Load Images
```html
<img data-src="image.jpg" class="lazy" />
<script>
  const lazy = new LazyLoad();
</script>
```

### 2. Virtual Scrolling for Long Lists
```html
<div class="virtual-list">
  <!-- Framework7 will virtualize long lists -->
</div>
```

### 3. Debounce Expensive Operations
```javascript
let debounceTimer;
function onInput(e) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Expensive operation
    processInput(e.target.value);
  }, 300);
}
```

### 4. Optimize Token Usage
```javascript
// Use conversation optimizer to summarize old messages
const optimizer = new ConversationOptimizer();
const optimized = optimizer.optimize(messageHistory);
```

### 5. Cache API Responses
```javascript
const cache = {};
async function fetchWithCache(url) {
  if (cache[url]) return cache[url];
  const response = await fetch(url);
  const data = await response.json();
  cache[url] = data;
  return data;
}
```

---

## Resources

### Official Documentation
- **Framework7**: https://framework7.io/docs/
- **Mistral AI**: https://docs.mistral.ai/
- **i18next**: https://www.i18next.com/

### Internal Documentation
- **README.md**: Spanish documentation (conversation screen focus)
- **AR/README.md**: Augmented Reality features documentation

### Key Libraries Documentation
- **markdown-it**: https://github.com/markdown-it/markdown-it
- **KaTeX**: https://katex.org/docs/api.html
- **Highlight.js**: https://highlightjs.org/
- **PDF.js**: https://mozilla.github.io/pdf.js/
- **Tesseract.js**: https://tesseract.projectnaptha.com/
- **Chart.js**: https://www.chartjs.org/docs/

---

## Changelog

### 2025-11-28
- Initial CLAUDE.md creation
- Comprehensive codebase analysis
- Documented architecture, conventions, and workflows
- Added common tasks and best practices
- Created quick reference guide

---

## Contributing

When working on this codebase:

1. **Read this guide first** to understand the architecture
2. **Follow existing patterns** for consistency
3. **Test on multiple screen sizes** (mobile, tablet, desktop)
4. **Internationalize** all user-facing text
5. **Document** complex logic with comments
6. **Maintain separation** of concerns (logic/presentation/styling)
7. **Use Framework7 APIs** instead of vanilla JS where possible
8. **Handle errors** gracefully with user feedback
9. **Commit often** with clear, descriptive messages
10. **Update this guide** if you add major features or patterns

---

*This documentation is maintained for AI assistants working with the SIMBA codebase. Keep it updated as the project evolves.*
