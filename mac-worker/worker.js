const sqlite3 = require('sqlite3').verbose();
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const WORKER_ID = process.env.WORKER_ID || os.hostname();
const CHAT_DB_PATH = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');

let lastCheckedRowId = 0; 
let isRunning = false;
let apiUrl = '';
let apiSecret = '';
let uiLogger = () => {};
let reportedFailures = new Set();

/**
 * Executes AppleScript to send an iMessage, optionally with an attachment.
 */
function sendAppleScriptMessage(phone, body, attachmentPath = null) {
    return new Promise((resolve, reject) => {
        const safePhone = phone.replace(/"/g, '\\"');
        const safeBody = body ? body.replace(/"/g, '\\"') : "";

        let script = `
        tell application "Messages"
            set targetService to 1st service whose service type = iMessage
            set targetBuddy to buddy "${safePhone}" of targetService
        `;
        
        if (attachmentPath) {
            script += `
            set theAttachment to POSIX file "${attachmentPath}"
            send theAttachment to targetBuddy
            delay 1
            `;
        }

        if (safeBody) {
            script += `
            send "${safeBody}" to targetBuddy
            `;
        }

        script += `
        end tell
        `;

        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) return reject(error);
            if (stderr) return reject(new Error(stderr));
            resolve(stdout);
        });
    });
}

/**
 * Polls the Chat.db for inbound messages safely using exponential backoff on SQLITE_BUSY.
 */
async function pollInboundMessages() {
    let retries = 0;
    const maxRetries = 3;

    const attemptQuery = () => new Promise((resolve, reject) => {
        const db = new sqlite3.Database(CHAT_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });
        db.configure('busyTimeout', 3000);

        const query = `
            SELECT m.ROWID, m.text, h.id as phone, m.date, m.is_from_me 
            FROM message m 
            JOIN handle h ON m.handle_id = h.ROWID
            WHERE m.is_from_me IN (0, 1)
            AND m.ROWID > ? 
            ORDER BY m.ROWID ASC
        `;

        db.all(query, [lastCheckedRowId], (err, rows) => {
            db.close(); 
            if (err) return reject(err);
            resolve(rows);
        });
    });

    while (retries < maxRetries) {
        try {
            const rows = await attemptQuery();
            for (const row of rows) {
                if (row.ROWID > lastCheckedRowId) lastCheckedRowId = row.ROWID;
                if (row.text) {
                    const direction = row.is_from_me === 1 ? 'Outbound' : 'Inbound';
                    uiLogger(`${direction} msg ${row.is_from_me === 1 ? 'to' : 'from'} ${row.phone}`, 'success');
                    await axios.post(`${apiUrl}/inbound`, {
                        workerId: WORKER_ID,
                        phone: row.phone,
                        body: row.text,
                        isFromMe: row.is_from_me === 1
                    }, {
                        headers: { 'Authorization': `Bearer ${apiSecret}` }
                    }).catch(e => uiLogger(`Failed sync post: ${e.message}`, 'error'));
                }
            }
            break; 
        } catch (err) {
            if (err.code === 'SQLITE_BUSY') {
                retries++;
                await new Promise(res => setTimeout(res, 1000));
            } else if (err.code === 'SQLITE_CANTOPEN') {
                uiLogger(`SQLite query failed: ${err.message}. Need Full Disk Access.`, 'error');
                if (global.onPermissionError) global.onPermissionError();
                break;
            } else {
                uiLogger(`SQLite query failed: ${err.message}`, 'error');
                break;
            }
        }
    }
}

/**
 * Polls the Chat.db for delayed failures safely.
 */
async function pollFailedMessages() {
    if (lastCheckedRowId === 0) return;
    
    const startRowId = Math.max(0, lastCheckedRowId - 500);
    const attemptQuery = () => new Promise((resolve, reject) => {
        const db = new sqlite3.Database(CHAT_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });
        db.configure('busyTimeout', 3000);

        const query = `
            SELECT m.ROWID, m.text, h.id as phone
            FROM message m 
            JOIN handle h ON m.handle_id = h.ROWID
            WHERE m.is_from_me = 1 
            AND m.error > 0
            AND m.ROWID > ? 
        `;

        db.all(query, [startRowId], (err, rows) => {
            db.close(); 
            if (err) return reject(err);
            resolve(rows);
        });
    });

    try {
        const rows = await attemptQuery();
        for (const row of rows) {
            if (!reportedFailures.has(row.ROWID) && row.text) {
                reportedFailures.add(row.ROWID);
                uiLogger(`Detected delayed delivery failure to ${row.phone}`, 'error');
                await axios.post(`${apiUrl}/failed-sync`, {
                    workerId: WORKER_ID,
                    phone: row.phone,
                    body: row.text
                }, {
                    headers: { 'Authorization': `Bearer ${apiSecret}` }
                }).catch(e => uiLogger(`Failed to sync failure: ${e.message}`, 'error'));
                
                // Keep set small to prevent memory leaks over months of uptime
                if (reportedFailures.size > 2000) {
                    reportedFailures = new Set(Array.from(reportedFailures).slice(-1000));
                }
            }
        }
    } catch (err) {
        if (err.code !== 'SQLITE_BUSY') {
            uiLogger(`Failure query err: ${err.message}`, 'error');
        }
    }
}

const fs = require('fs');

async function downloadAttachment(url) {
    try {
        const urlObj = new URL(url);
        const filename = path.basename(urlObj.pathname) || `attachment_${Date.now()}`;
        const destPath = path.join(os.tmpdir(), filename);
        const writer = fs.createWriteStream(destPath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(destPath));
            writer.on('error', reject);
        });
    } catch (e) {
        throw new Error(`Download failed: ${e.message}`);
    }
}

/**
 * Polls the Central Hub for outbound tasks.
 */
async function pollOutboundTasks() {
    try {
        const res = await axios.get(`${apiUrl}/poll`, {
            params: { workerId: WORKER_ID },
            headers: { 'Authorization': `Bearer ${apiSecret}` }
        });

        const actions = res.data.actions || [];
        for (const action of actions) {
            if (action.type === 'send_sms') {
                uiLogger(`Sending outbound to ${action.phone}...`, 'info');
                try {
                    let localAttachmentPath = null;
                    if (action.attachments && action.attachments.length > 0) {
                        uiLogger(`Downloading attachment...`, 'info');
                        localAttachmentPath = await downloadAttachment(action.attachments[0]);
                    }

                    await sendAppleScriptMessage(action.phone, action.body, localAttachmentPath);
                    await axios.post(`${apiUrl}/status`, {
                        workerId: WORKER_ID,
                        messageId: action.id,
                        status: 'sent'
                    }, { headers: { 'Authorization': `Bearer ${apiSecret}` } });
                    
                    uiLogger(`Sent to ${action.phone}.`, 'success');
                } catch (err) {
                    uiLogger(`Failed sending: ${err.message}`, 'error');
                    let parsedError = err.message;
                    if (err.message.toLowerCase().includes('not registered')) {
                        parsedError = 'failed_not_imessage';
                    }
                    await axios.post(`${apiUrl}/status`, {
                        workerId: WORKER_ID,
                        messageId: action.id,
                        status: 'failed',
                        errorDetails: parsedError
                    }, { headers: { 'Authorization': `Bearer ${apiSecret}` } });
                }
            }
        }
    } catch (err) {
        uiLogger(`Poll failed: ${err.message}`, 'error');
    }
}

async function startWorker(url, secret, logger) {
    if (isRunning) return true;
    
    apiUrl = url;
    apiSecret = secret;
    uiLogger = logger;
    isRunning = true;

    uiLogger(`Started macOS Worker Daemon - Worker ID: ${WORKER_ID}`, 'info');
    
    try {
        const db = new sqlite3.Database(CHAT_DB_PATH, sqlite3.OPEN_READONLY);
        db.get('SELECT MAX(ROWID) as maxId FROM message', (err, row) => {
            if (!err && row) lastCheckedRowId = row.maxId;
            db.close();
        });
    } catch (e) {
        uiLogger(`Could not init DB RowID: ${e.message}`, 'error');
    }

    const pollInboundLoop = async () => {
        if (!isRunning) return;
        await pollInboundMessages();
        setTimeout(pollInboundLoop, 5000); 
    };

    const pollOutboundLoop = async () => {
        if (!isRunning) return;
        await pollOutboundTasks();
        setTimeout(pollOutboundLoop, 5000); 
    };

    const pollFailedLoop = async () => {
        if (!isRunning) return;
        await pollFailedMessages();
        setTimeout(pollFailedLoop, 15000); // Check every 15s
    };

    pollInboundLoop();
    pollOutboundLoop();
    pollFailedLoop();
    
    return true;
}

function stopWorker() {
    isRunning = false;
}

module.exports = { startWorker, stopWorker };

if (require.main === module) {
    require('dotenv').config();
    console.log('Starting Kortex iMessage worker CLI...');
    startWorker();
}
