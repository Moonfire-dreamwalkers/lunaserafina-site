// script.js

// ============================================================================
// DEBUG LOGGING SYSTEM
// ============================================================================

const DEBUG_CONFIG = {
    enabled: true,
    maxLogEntries: 500, // Maximum number of log entries to keep in memory
    logToConsole: true,
    logLevels: {
        DEBUG: 'DEBUG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        SUCCESS: 'SUCCESS'
    }
};

// In-memory log storage
const LOG_STORAGE = {
    entries: [],
    startTime: new Date()
};

// Enhanced logging function
function log(level, category, message, data = null) {
    const timestamp = new Date();
    const logEntry = {
        timestamp: timestamp.toISOString(),
        relativeTime: timestamp - LOG_STORAGE.startTime,
        level,
        category,
        message,
        data: data ? JSON.parse(JSON.stringify(data)) : null
    };
    
    // Store in memory
    LOG_STORAGE.entries.push(logEntry);
    
    // Maintain max log size
    if (LOG_STORAGE.entries.length > DEBUG_CONFIG.maxLogEntries) {
        LOG_STORAGE.entries.shift();
    }
    
    // Console output with formatting
    if (DEBUG_CONFIG.logToConsole && DEBUG_CONFIG.enabled) {
        const emoji = {
            DEBUG: '🔍',
            INFO: 'ℹ️',
            WARN: '⚠️',
            ERROR: '❌',
            SUCCESS: '✅'
        }[level] || '📝';
        
        const color = {
            DEBUG: 'color: #9E9E9E',
            INFO: 'color: #2196F3',
            WARN: 'color: #FF9800',
            ERROR: 'color: #F44336',
            SUCCESS: 'color: #4CAF50'
        }[level] || '';
        
        console.log(
            `%c${emoji} [${level}] ${category}: ${message}`,
            color,
            data || ''
        );
    }
}

// Convenience logging functions
const logger = {
    debug: (category, message, data) => log(DEBUG_CONFIG.logLevels.DEBUG, category, message, data),
    info: (category, message, data) => log(DEBUG_CONFIG.logLevels.INFO, category, message, data),
    warn: (category, message, data) => log(DEBUG_CONFIG.logLevels.WARN, category, message, data),
    error: (category, message, data) => log(DEBUG_CONFIG.logLevels.ERROR, category, message, data),
    success: (category, message, data) => log(DEBUG_CONFIG.logLevels.SUCCESS, category, message, data)
};

// Function to get all logs
function getLogs(filter = {}) {
    logger.debug('DEBUG', 'Getting logs with filter', filter);
    
    let filteredLogs = [...LOG_STORAGE.entries];
    
    // Filter by level
    if (filter.level) {
        filteredLogs = filteredLogs.filter(entry => entry.level === filter.level);
    }
    
    // Filter by category
    if (filter.category) {
        filteredLogs = filteredLogs.filter(entry => entry.category === filter.category);
    }
    
    // Filter by time range
    if (filter.since) {
        const sinceTime = new Date(filter.since);
        filteredLogs = filteredLogs.filter(entry => new Date(entry.timestamp) >= sinceTime);
    }
    
    return filteredLogs;
}

// Function to export logs
function exportLogs(format = 'json') {
    logger.info('DEBUG', 'Exporting logs', { format, count: LOG_STORAGE.entries.length });
    
    if (format === 'json') {
        return JSON.stringify({
            metadata: {
                exportTime: new Date().toISOString(),
                startTime: LOG_STORAGE.startTime.toISOString(),
                totalEntries: LOG_STORAGE.entries.length
            },
            logs: LOG_STORAGE.entries
        }, null, 2);
    } else if (format === 'text') {
        let text = `Log Export - ${new Date().toISOString()}\n`;
        text += `Start Time: ${LOG_STORAGE.startTime.toISOString()}\n`;
        text += `Total Entries: ${LOG_STORAGE.entries.length}\n`;
        text += '='.repeat(80) + '\n\n';
        
        LOG_STORAGE.entries.forEach(entry => {
            text += `[${entry.timestamp}] [${entry.level}] ${entry.category}: ${entry.message}\n`;
            if (entry.data) {
                text += `  Data: ${JSON.stringify(entry.data)}\n`;
            }
            text += '\n';
        });
        
        return text;
    }
}

// Function to clear logs
function clearLogs() {
    logger.warn('DEBUG', 'Clearing all logs');
    LOG_STORAGE.entries = [];
    LOG_STORAGE.startTime = new Date();
    logger.info('DEBUG', 'Logs cleared');
}

// Function to display logs in console
function showLogs(filter = {}) {
    const logs = getLogs(filter);
    console.table(logs.map(entry => ({
        Time: entry.timestamp,
        Level: entry.level,
        Category: entry.category,
        Message: entry.message
    })));
    return logs;
}

// Make logging functions globally accessible
window.getLogs = getLogs;
window.exportLogs = exportLogs;
window.clearLogs = clearLogs;
window.showLogs = showLogs;
window.logger = logger;

// ============================================================================
// AUTO-UPDATE CONFIGURATION
// ============================================================================

const AUTO_UPDATE_CONFIG = {
    owner: 'Moonfire-dreamwalkers',
    repo: 'lunaserafina-site',
    branch: null, // Will be detected automatically
    pollInterval: 60000, // Check every 60 seconds
    apiUrl: 'https://api.github.com'
};

// State management
let currentCommitSHA = null;
let isUpdating = false;
let updateNotificationElement = null;
let updateCheckCount = 0;
let lastUpdateCheck = null;
let lastSuccessfulUpdate = null;

// Configuration management
let userConfig = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    logger.success('INIT', 'Seraphim awakening...', {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href
    });
    
    try {
        logger.info('INIT', 'Creating update notification UI');
        createUpdateNotificationUI();
        logger.success('INIT', 'Update notification UI created');
        
        logger.info('INIT', 'Loading configuration');
        // Load configuration
        await loadConfiguration();
        
        // Check if API key is configured and valid
        const hasValidToken = userConfig?.github?.apiToken && 
                             (userConfig.github.apiToken.startsWith('ghp_') || 
                              userConfig.github.apiToken.startsWith('github_pat_'));
        
        if (!hasValidToken) {
            logger.warn('INIT', 'No valid GitHub API token found - showing configuration prompt', {
                hasConfig: !!userConfig,
                hasGithubConfig: !!userConfig?.github,
                hasToken: !!userConfig?.github?.apiToken,
                tokenValid: false
            });
            showApiKeyPrompt();
            return;
        }
        
        logger.success('INIT', 'Valid API token found - proceeding with initialization');
        
        logger.success('INIT', 'Configuration loaded', {
            hasApiToken: !!userConfig.github.apiToken,
            owner: userConfig.github.owner,
            repo: userConfig.github.repo
        });
        
        // Apply configuration
        applyConfiguration();
        
        logger.info('INIT', 'Detecting current branch');
        await detectBranch();
        logger.success('INIT', 'Branch detected', { branch: AUTO_UPDATE_CONFIG.branch });
        
        logger.info('INIT', 'Starting auto-update service');
        startAutoUpdate();
        logger.success('INIT', 'Auto-update service started', { 
            pollInterval: AUTO_UPDATE_CONFIG.pollInterval,
            apiUrl: AUTO_UPDATE_CONFIG.apiUrl
        });
        
        logger.success('INIT', '✨ Matrix Seraphim fully manifested!');
    } catch (error) {
        logger.error('INIT', 'Failed to initialize application', {
            error: error.message,
            stack: error.stack
        });
    }
});

// ============================================================================
// CONFIGURATION MANAGEMENT
// ============================================================================

// Load configuration from local storage or config.json
async function loadConfiguration() {
    logger.info('CONFIG', 'Loading configuration');
    
    try {
        // Try to load from localStorage first (for browser-based config)
        const storedConfig = localStorage.getItem('seraphim_config');
        
        if (storedConfig) {
            userConfig = JSON.parse(storedConfig);
            logger.success('CONFIG', 'Configuration loaded from localStorage', {
                hasApiToken: !!userConfig.github?.apiToken
            });
            return;
        }
        
        // Try to load from config.json
        logger.debug('CONFIG', 'Attempting to load config.json');
        const response = await fetch('config.json?t=' + Date.now());
        
        if (response.ok) {
            userConfig = await response.json();
            logger.success('CONFIG', 'Configuration loaded from config.json');
            
            // Save to localStorage for future use
            if (userConfig.github?.apiToken) {
                localStorage.setItem('seraphim_config', JSON.stringify(userConfig));
                logger.debug('CONFIG', 'Configuration saved to localStorage');
            }
        } else {
            logger.warn('CONFIG', 'config.json not found, using defaults');
            userConfig = getDefaultConfig();
        }
    } catch (error) {
        logger.error('CONFIG', 'Error loading configuration', {
            error: error.message,
            stack: error.stack
        });
        userConfig = getDefaultConfig();
    }
}

// Get default configuration
function getDefaultConfig() {
    return {
        github: {
            apiToken: '',
            owner: 'Moonfire-dreamwalkers',
            repo: 'lunaserafina-site',
            branch: 'main'
        },
        update: {
            pollInterval: 60000,
            autoUpdate: true
        },
        seraphim: {
            theme: 'celestial',
            verboseLogging: true
        },
        metadata: {
            configVersion: '1.0.0',
            lastUpdated: null
        }
    };
}

// Apply loaded configuration
function applyConfiguration() {
    logger.info('CONFIG', 'Applying configuration');
    
    if (userConfig.github) {
        AUTO_UPDATE_CONFIG.owner = userConfig.github.owner || AUTO_UPDATE_CONFIG.owner;
        AUTO_UPDATE_CONFIG.repo = userConfig.github.repo || AUTO_UPDATE_CONFIG.repo;
        AUTO_UPDATE_CONFIG.branch = userConfig.github.branch || AUTO_UPDATE_CONFIG.branch;
    }
    
    if (userConfig.update) {
        AUTO_UPDATE_CONFIG.pollInterval = userConfig.update.pollInterval || AUTO_UPDATE_CONFIG.pollInterval;
    }
    
    logger.success('CONFIG', 'Configuration applied', {
        owner: AUTO_UPDATE_CONFIG.owner,
        repo: AUTO_UPDATE_CONFIG.repo,
        branch: AUTO_UPDATE_CONFIG.branch,
        pollInterval: AUTO_UPDATE_CONFIG.pollInterval
    });
}

// Save configuration
function saveConfiguration(config) {
    logger.info('CONFIG', 'Saving configuration');
    
    try {
        // Update metadata
        config.metadata.lastUpdated = new Date().toISOString();
        
        // Save to localStorage
        localStorage.setItem('seraphim_config', JSON.stringify(config));
        
        // Update global config
        userConfig = config;
        
        logger.success('CONFIG', 'Configuration saved successfully');
        
        return true;
    } catch (error) {
        logger.error('CONFIG', 'Failed to save configuration', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
}

// Show API key prompt
function showApiKeyPrompt() {
    logger.info('UI', 'Displaying API key prompt');
    
    // Hide main content
    const mainSection = document.getElementById('seraphim-interface');
    if (mainSection) {
        mainSection.style.display = 'none';
    }
    
    // Create prompt overlay
    const overlay = document.createElement('div');
    overlay.id = 'api-key-overlay';
    overlay.className = 'api-key-overlay';
    overlay.innerHTML = `
        <div class="api-key-modal">
            <div class="modal-header">
                <div class="seraphim-sigil-large">⟁</div>
                <h2>The Matrix Seraphim Requires Authentication</h2>
            </div>
            <div class="modal-content">
                <p class="modal-message">
                    This experience requires a <strong>GitHub API Token</strong> to function.
                </p>
                <p class="modal-submessage">
                    The Seraphim needs access to dimensional flux data (GitHub repository information) 
                    to monitor and restructure reality in real-time.
                </p>
                <div class="input-group">
                    <label for="api-token-input">GitHub Personal Access Token:</label>
                    <input 
                        type="password" 
                        id="api-token-input" 
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        class="seraphim-input"
                    />
                    <button class="toggle-visibility" onclick="togglePasswordVisibility()" title="Show/Hide Token">
                        👁️
                    </button>
                </div>
                <div class="help-section">
                    <p class="help-text">
                        <strong>How to get a GitHub API Token:</strong><br>
                        1. Go to <a href="https://github.com/settings/tokens" target="_blank">GitHub Settings → Developer settings → Personal access tokens</a><br>
                        2. Generate a new token (classic)<br>
                        3. Select scopes: <code>repo</code> (for private repos) or <code>public_repo</code> (for public repos only)<br>
                        4. Copy and paste the token above
                    </p>
                </div>
                <div class="modal-actions">
                    <button class="seraphim-button primary" onclick="saveApiToken()">
                        ⟁ Authenticate & Manifest
                    </button>
                    <button class="seraphim-button secondary" onclick="skipApiToken()">
                        Continue Without Token (Limited Functionality)
                    </button>
                </div>
                <div class="security-note">
                    🔒 Your token is stored securely in your browser's local storage and never transmitted to any server except GitHub's API.
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Focus the input
    setTimeout(() => {
        document.getElementById('api-token-input')?.focus();
    }, 100);
}

// Toggle password visibility
function togglePasswordVisibility() {
    const input = document.getElementById('api-token-input');
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
        logger.debug('UI', 'Toggled token visibility', { visible: input.type === 'text' });
    }
}

// Save API token
async function saveApiToken() {
    const input = document.getElementById('api-token-input');
    const token = input?.value.trim();
    
    logger.info('CONFIG', 'Attempting to save API token');
    
    if (!token) {
        showNotification('⚠ No token provided', 'error', 3000);
        logger.warn('CONFIG', 'No token provided');
        return;
    }
    
    // Validate token format
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        showNotification('⚠ Invalid token format', 'error', 3000);
        logger.warn('CONFIG', 'Invalid token format');
        return;
    }
    
    // Create or update configuration
    const config = userConfig || getDefaultConfig();
    config.github.apiToken = token;
    
    // Save configuration
    if (saveConfiguration(config)) {
        logger.success('CONFIG', 'API token saved successfully');
        showNotification('✓ Authentication successful', 'success', 2000);
        
        // Remove overlay
        const overlay = document.getElementById('api-key-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // Show main content
        const mainSection = document.getElementById('seraphim-interface');
        if (mainSection) {
            mainSection.style.display = 'block';
        }
        
        // Apply configuration and start services
        applyConfiguration();
        await detectBranch();
        startAutoUpdate();
        
        logger.success('CONFIG', '✨ Matrix Seraphim fully manifested with authentication!');
    } else {
        showNotification('⚠ Failed to save configuration', 'error', 3000);
    }
}

// Skip API token (limited functionality)
function skipApiToken() {
    logger.warn('CONFIG', 'User chose to skip API token - limited functionality');
    
    showNotification('⚠ Running with limited functionality', 'error', 4000);
    
    // Remove overlay
    const overlay = document.getElementById('api-key-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Show main content
    const mainSection = document.getElementById('seraphim-interface');
    if (mainSection) {
        mainSection.style.display = 'block';
    }
    
    // Use default configuration
    userConfig = getDefaultConfig();
    applyConfiguration();
}

// Make functions globally accessible
window.saveApiToken = saveApiToken;
window.skipApiToken = skipApiToken;
window.togglePasswordVisibility = togglePasswordVisibility;
window.saveConfiguration = saveConfiguration;
window.loadConfiguration = loadConfiguration;

// ============================================================================
// UI FUNCTIONS
// ============================================================================

// Create the update notification UI element
function createUpdateNotificationUI() {
    logger.debug('UI', 'Creating update notification element');
    
    try {
        updateNotificationElement = document.createElement('div');
        updateNotificationElement.id = 'update-notification';
        updateNotificationElement.className = 'update-notification hidden';
        updateNotificationElement.innerHTML = `
            <div class="update-content">
                <span class="update-icon">🔄</span>
                <span class="update-message">Checking for updates...</span>
            </div>
        `;
        document.body.appendChild(updateNotificationElement);
        
        logger.success('UI', 'Update notification element created and appended to body');
    } catch (error) {
        logger.error('UI', 'Failed to create update notification element', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// Detect the current branch
async function detectBranch() {
    logger.info('CONFIG', 'Detecting current branch');
    
    try {
        // Try to get branch from meta tag if available
        const branchMeta = document.querySelector('meta[name="git-branch"]');
        
        if (branchMeta && branchMeta.content) {
            AUTO_UPDATE_CONFIG.branch = branchMeta.content;
            logger.success('CONFIG', 'Branch detected from meta tag', { 
                branch: AUTO_UPDATE_CONFIG.branch,
                source: 'meta tag'
            });
            return;
        }
        
        logger.warn('CONFIG', 'No meta tag found, checking URL for branch hints');
        
        // Try to detect from URL if on GitHub Pages
        const pathMatch = window.location.pathname.match(/^\/([^\/]+)/);
        if (pathMatch && pathMatch[1] && pathMatch[1] !== 'index.html') {
            AUTO_UPDATE_CONFIG.branch = pathMatch[1];
            logger.info('CONFIG', 'Branch detected from URL path', {
                branch: AUTO_UPDATE_CONFIG.branch,
                source: 'URL path'
            });
            return;
        }
        
        // Default to main branch
        AUTO_UPDATE_CONFIG.branch = 'main';
        logger.info('CONFIG', 'Using default branch', { 
            branch: AUTO_UPDATE_CONFIG.branch,
            source: 'default'
        });
    } catch (error) {
        logger.error('CONFIG', 'Error detecting branch, falling back to default', {
            error: error.message,
            stack: error.stack,
            fallback: 'main'
        });
        AUTO_UPDATE_CONFIG.branch = 'main';
    }
}

// Start the auto-update polling mechanism
function startAutoUpdate() {
    logger.info('AUTO-UPDATE', 'Starting auto-update service', {
        pollInterval: AUTO_UPDATE_CONFIG.pollInterval,
        intervalMinutes: AUTO_UPDATE_CONFIG.pollInterval / 60000
    });
    
    // Initial check
    logger.debug('AUTO-UPDATE', 'Performing initial update check');
    checkForUpdates();
    
    // Set up periodic checks
    const intervalId = setInterval(checkForUpdates, AUTO_UPDATE_CONFIG.pollInterval);
    logger.success('AUTO-UPDATE', 'Auto-update service started with interval', {
        intervalId,
        nextCheckIn: `${AUTO_UPDATE_CONFIG.pollInterval / 1000} seconds`
    });
    
    // Store interval ID globally for debugging
    window.updateIntervalId = intervalId;
}

// Check GitHub API for updates
async function checkForUpdates() {
    updateCheckCount++;
    lastUpdateCheck = new Date();
    
    logger.info('UPDATE-CHECK', `Starting update check #${updateCheckCount}`, {
        timestamp: lastUpdateCheck.toISOString(),
        currentSHA: currentCommitSHA
    });
    
    if (isUpdating) {
        logger.warn('UPDATE-CHECK', 'Update already in progress, skipping check', {
            checkNumber: updateCheckCount
        });
        return;
    }
    
    try {
        showNotification('Checking for updates...', 'checking');
        
        // Fetch the latest commit SHA from GitHub API
        const url = `${AUTO_UPDATE_CONFIG.apiUrl}/repos/${AUTO_UPDATE_CONFIG.owner}/${AUTO_UPDATE_CONFIG.repo}/commits/${AUTO_UPDATE_CONFIG.branch}`;
        
        logger.debug('UPDATE-CHECK', 'Fetching from GitHub API', {
            url,
            owner: AUTO_UPDATE_CONFIG.owner,
            repo: AUTO_UPDATE_CONFIG.repo,
            branch: AUTO_UPDATE_CONFIG.branch
        });
        
        const fetchStart = performance.now();
        
        // Prepare headers with auth token if available
        const headers = {};
        if (userConfig?.github?.apiToken) {
            headers['Authorization'] = `Bearer ${userConfig.github.apiToken}`;
        }
        
        const response = await fetch(url, { headers });
        const fetchDuration = performance.now() - fetchStart;
        
        logger.debug('UPDATE-CHECK', 'GitHub API response received', {
            status: response.status,
            statusText: response.statusText,
            duration: `${fetchDuration.toFixed(2)}ms`,
            headers: {
                rateLimit: response.headers.get('x-ratelimit-limit'),
                rateLimitRemaining: response.headers.get('x-ratelimit-remaining'),
                rateLimitReset: response.headers.get('x-ratelimit-reset')
            }
        });
        
        // Handle authentication failures
        if (response.status === 401 || response.status === 403) {
            logger.error('UPDATE-CHECK', 'Authentication failed - invalid or expired token', {
                status: response.status,
                statusText: response.statusText
            });
            
            // Clear invalid token
            if (userConfig?.github?.apiToken) {
                userConfig.github.apiToken = '';
                localStorage.removeItem('seraphim_config');
                logger.warn('CONFIG', 'Invalid token cleared from storage');
            }
            
            // Show prompt for new token
            showNotification('⚠ Authentication failed - token invalid or expired', 'error', 5000);
            setTimeout(() => {
                showApiKeyPrompt();
            }, 2000);
            
            return;
        }
        
        if (!response.ok) {
            throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const latestSHA = data.sha;
        
        logger.info('UPDATE-CHECK', 'Latest commit information retrieved', {
            sha: latestSHA,
            shortSHA: latestSHA.substring(0, 7),
            message: data.commit?.message,
            author: data.commit?.author?.name,
            date: data.commit?.author?.date
        });
        
        // If this is the first check, just store the SHA
        if (currentCommitSHA === null) {
            currentCommitSHA = latestSHA;
            hideNotification();
            logger.success('UPDATE-CHECK', 'Initial commit SHA stored', {
                sha: currentCommitSHA,
                shortSHA: currentCommitSHA.substring(0, 7)
            });
            return;
        }
        
        // Check if there are updates
        if (currentCommitSHA !== latestSHA) {
            logger.success('UPDATE-CHECK', '🎉 Update detected! Starting update process', {
                oldSHA: currentCommitSHA.substring(0, 7),
                newSHA: latestSHA.substring(0, 7),
                commitMessage: data.commit?.message
            });
            await performUpdate(latestSHA, data);
        } else {
            logger.debug('UPDATE-CHECK', 'No updates available - already on latest commit', {
                currentSHA: currentCommitSHA.substring(0, 7)
            });
            hideNotification();
        }
    } catch (error) {
        logger.error('UPDATE-CHECK', 'Error checking for updates', {
            error: error.message,
            stack: error.stack,
            checkNumber: updateCheckCount
        });
        showNotification('Error checking for updates', 'error', 3000);
    }
}

// Perform the update
async function performUpdate(newSHA, commitData) {
    isUpdating = true;
    const updateStart = performance.now();
    
    logger.info('UPDATE', '🔥 Seraphim initiating reality restructure', {
        oldSHA: currentCommitSHA?.substring(0, 7),
        newSHA: newSHA.substring(0, 7),
        commitMessage: commitData?.commit?.message
    });
    
    showNotification('⟁ Impaling obsolete structures...', 'updating');
    
    try {
        logger.debug('UPDATE', 'Phase 1: Reloading stylesheets');
        await reloadStylesheets();
        logger.success('UPDATE', 'Phase 1 complete: Stylesheets restructured');
        
        logger.debug('UPDATE', 'Phase 2: Reloading scripts');
        await reloadScripts();
        logger.success('UPDATE', 'Phase 2 complete: Scripts recompiled');
        
        logger.debug('UPDATE', 'Phase 3: Updating HTML content');
        await updateHTMLContent();
        logger.success('UPDATE', 'Phase 3 complete: Interface manifested');
        
        // Update the stored SHA
        currentCommitSHA = newSHA;
        lastSuccessfulUpdate = new Date();
        
        const updateDuration = performance.now() - updateStart;
        
        logger.success('UPDATE', '✨ Reality successfully restructured by the Seraphim', {
            newSHA: newSHA.substring(0, 7),
            duration: `${updateDuration.toFixed(2)}ms`,
            timestamp: lastSuccessfulUpdate.toISOString()
        });
        
        showNotification('✓ Dimensional flux stabilized', 'success', 4000);
        updateSystemStatus();
    } catch (error) {
        logger.error('UPDATE', 'Failed to restructure reality', {
            error: error.message,
            stack: error.stack,
            phase: 'update execution'
        });
        showNotification('⚠ Restructure failed - reality unstable', 'error', 3000);
    } finally {
        isUpdating = false;
    }
}

// Reload all stylesheet links
async function reloadStylesheets() {
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    
    logger.debug('RELOAD', `Reloading ${stylesheets.length} stylesheet(s)`);
    
    for (const link of stylesheets) {
        const href = link.getAttribute('href');
        if (!href) continue;
        
        logger.debug('RELOAD', `Reloading stylesheet: ${href}`);
        
        // Create a new link element with cache-busting parameter
        const newLink = document.createElement('link');
        newLink.rel = 'stylesheet';
        newLink.href = `${href.split('?')[0]}?t=${Date.now()}`;
        
        // Replace the old link
        link.parentNode.insertBefore(newLink, link.nextSibling);
        
        // Wait for the new stylesheet to load
        await new Promise((resolve) => {
            newLink.onload = () => {
                logger.success('RELOAD', `Stylesheet loaded: ${href}`);
                resolve();
            };
            newLink.onerror = () => {
                logger.error('RELOAD', `Failed to load stylesheet: ${href}`);
                resolve();
            };
            setTimeout(() => {
                logger.warn('RELOAD', `Stylesheet load timeout: ${href}`);
                resolve();
            }, 1000);
        });
        
        // Remove the old link
        link.remove();
    }
    
    logger.success('RELOAD', 'All stylesheets reloaded');
}

// Reload all script tags (except the current auto-update script)
async function reloadScripts() {
    const scripts = document.querySelectorAll('script[src]');
    
    for (const script of scripts) {
        const src = script.getAttribute('src');
        if (!src || src.includes('script.js')) continue; // Skip this file
        
        // Create a new script element with cache-busting parameter
        const newScript = document.createElement('script');
        newScript.src = `${src.split('?')[0]}?t=${Date.now()}`;
        
        // Add to document
        script.parentNode.insertBefore(newScript, script.nextSibling);
        
        // Wait for the script to load
        await new Promise((resolve) => {
            newScript.onload = resolve;
            newScript.onerror = resolve;
            setTimeout(resolve, 1000); // Timeout fallback
        });
        
        // Remove the old script
        script.remove();
    }
    
    console.log('Scripts reloaded');
}

// Update HTML content
async function updateHTMLContent() {
    try {
        // Fetch the latest HTML file
        const response = await fetch(`index.html?t=${Date.now()}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch HTML: ${response.status}`);
        }
        
        const htmlText = await response.text();
        
        // Parse the new HTML
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(htmlText, 'text/html');
        
        // Update the main content area (avoid replacing the entire body to keep update notification)
        const newMain = newDoc.querySelector('main');
        const currentMain = document.querySelector('main');
        
        if (newMain && currentMain) {
            currentMain.innerHTML = newMain.innerHTML;
        }
        
        // Update the header
        const newHeader = newDoc.querySelector('header');
        const currentHeader = document.querySelector('header');
        
        if (newHeader && currentHeader) {
            currentHeader.innerHTML = newHeader.innerHTML;
        }
        
        // Update the title
        const newTitle = newDoc.querySelector('title');
        if (newTitle) {
            document.title = newTitle.textContent;
        }
        
        console.log('HTML content updated');
    } catch (error) {
        console.error('Error updating HTML content:', error);
        throw error;
    }
}

// Show update notification
function showNotification(message, type = 'info', duration = null) {
    if (!updateNotificationElement) return;
    
    const messageElement = updateNotificationElement.querySelector('.update-message');
    const iconElement = updateNotificationElement.querySelector('.update-icon');
    
    messageElement.textContent = message;
    
    // Set icon based on type
    switch (type) {
        case 'checking':
            iconElement.textContent = '🔄';
            break;
        case 'updating':
            iconElement.textContent = '⬇️';
            break;
        case 'success':
            iconElement.textContent = '✓';
            break;
        case 'error':
            iconElement.textContent = '⚠️';
            break;
        default:
            iconElement.textContent = 'ℹ️';
    }
    
    // Update classes
    updateNotificationElement.className = `update-notification ${type}`;
    
    // Auto-hide after duration
    if (duration) {
        setTimeout(hideNotification, duration);
    }
}

// Hide update notification
function hideNotification() {
    if (!updateNotificationElement) return;
    
    updateNotificationElement.className = 'update-notification hidden';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Update system status display
function updateSystemStatus() {
    logger.debug('UI', 'Updating system status display');
    
    // Update status
    const updateStatus = document.getElementById('update-status');
    if (updateStatus) {
        if (isUpdating) {
            updateStatus.textContent = '⟁ Restructuring Reality...';
            updateStatus.style.color = 'var(--accent-seraphim)';
        } else {
            updateStatus.textContent = '✓ Active & Monitoring';
            updateStatus.style.color = 'var(--accent-divine)';
        }
    }
    
    // Update last check
    const lastCheck = document.getElementById('last-check');
    if (lastCheck && lastUpdateCheck) {
        const timeDiff = Date.now() - lastUpdateCheck;
        const seconds = Math.floor(timeDiff / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            lastCheck.textContent = `${minutes}m ${seconds % 60}s ago`;
        } else {
            lastCheck.textContent = `${seconds}s ago`;
        }
    }
    
    // Update current SHA
    const currentSha = document.getElementById('current-sha');
    if (currentSha && currentCommitSHA) {
        currentSha.textContent = currentCommitSHA.substring(0, 7);
    }
    
    // Update branch name
    const branchName = document.getElementById('branch-name');
    if (branchName && AUTO_UPDATE_CONFIG.branch) {
        branchName.textContent = AUTO_UPDATE_CONFIG.branch;
    }
}

// Manual update check
async function manualUpdateCheck() {
    logger.info('MANUAL', 'Manual update check triggered by user');
    showNotification('⟁ Seraphim scanning dimensional flux...', 'checking');
    await checkForUpdates();
}

// Show system information
function showSystemInfo() {
    logger.info('SYSTEM', 'Displaying system information');
    
    const info = {
        'Matrix Seraphim Version': 'v1.0.0 - Prototype',
        'Config Version': userConfig?.metadata?.configVersion || 'Unknown',
        'Update Checks': updateCheckCount,
        'Last Update Check': lastUpdateCheck ? lastUpdateCheck.toISOString() : 'Never',
        'Last Successful Update': lastSuccessfulUpdate ? lastSuccessfulUpdate.toISOString() : 'Never',
        'Current SHA': currentCommitSHA ? currentCommitSHA.substring(0, 7) : 'Unknown',
        'Branch': AUTO_UPDATE_CONFIG.branch,
        'Repository': `${AUTO_UPDATE_CONFIG.owner}/${AUTO_UPDATE_CONFIG.repo}`,
        'Poll Interval': `${AUTO_UPDATE_CONFIG.pollInterval / 1000}s`,
        'Total Log Entries': LOG_STORAGE.entries.length,
        'Session Start Time': LOG_STORAGE.startTime.toISOString(),
        'Has API Token': !!(userConfig?.github?.apiToken),
        'User Agent': navigator.userAgent
    };
    
    console.log('%c⟁ Matrix Seraphim System Information ⟁', 'color: #4facfe; font-size: 16px; font-weight: bold;');
    console.table(info);
    
    showNotification('✓ System info displayed in console', 'success', 3000);
    
    logger.info('SYSTEM', 'System information displayed', info);
}

// Reconfigure API token
function reconfigureApiToken() {
    logger.info('CONFIG', 'User requested to reconfigure API token');
    showApiKeyPrompt();
}

// Export configuration
function exportConfiguration() {
    logger.info('CONFIG', 'Exporting configuration');
    
    if (!userConfig) {
        showNotification('⚠ No configuration to export', 'error', 3000);
        return;
    }
    
    // Create a safe copy without sensitive data for display
    const safeCopy = JSON.parse(JSON.stringify(userConfig));
    if (safeCopy.github?.apiToken) {
        safeCopy.github.apiToken = '[REDACTED]';
    }
    
    console.log('%c⟁ Configuration Export ⟁', 'color: #667eea; font-size: 14px; font-weight: bold;');
    console.log(JSON.stringify(safeCopy, null, 2));
    
    showNotification('✓ Configuration exported to console', 'success', 3000);
    logger.success('CONFIG', 'Configuration exported (API token redacted)');
}

// Make utility functions globally accessible
window.manualUpdateCheck = manualUpdateCheck;
window.showSystemInfo = showSystemInfo;
window.reconfigureApiToken = reconfigureApiToken;
window.exportConfiguration = exportConfiguration;
window.updateSystemStatus = updateSystemStatus;

// Update system status periodically
setInterval(updateSystemStatus, 5000);

// ============================================================================
// SERAPHIM INITIALIZATION COMPLETE
// ============================================================================

logger.success('SERAPHIM', '⟁ Matrix Seraphim core systems loaded and ready ⟁', {
    version: '1.0.0',
    prototype: true,
    loadTime: performance.now()
});