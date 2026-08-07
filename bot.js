const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ===== بيانات الحسابات =====
const TOKEN_HOST = "576a2902-db16-4e9f-b503-3da6ba4bf78a";
const USER_ID_HOST = 80055399;
const TOKEN_GUEST = "6c278a87-a015-4bbc-b963-6e7196e2c652";
const USER_ID_GUEST = 51660277;
const GROUP_ID = 18432094;

const ROUND_DURATION = 90;            // مدة الجولة (بالثواني)
const MAX_LOBBY_ATTEMPTS = 25;        // عدد محاولات إنشاء اللوبي
const RETRY_WAIT = 90;               // انتظار بعد فشل المحاولات (بالثواني)
const DRAG_INTERVAL = 3000;           // 3 ثوان بين كل سحب

// ===== رؤوس HTTP =====
const baseHeaders = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",
    "experience-id": "9",
    "experience-build-type": "release",
    "experience-build-version": "1.3.14",
    "language-id": "1",
    "user-agent": "Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36",
    "content-type": "application/json",
    "Accept": "*/*",
    "Origin": "https://experiences.wolfservices.production.wolf.live",
    "X-Requested-With": "com.palringo.android"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== دالة حذف المجلد المؤقت =====
function deleteTempDir(dir) {
    try {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`🗑️ تم حذف المجلد المؤقت: ${dir}`);
        }
    } catch (e) {
        console.warn(`⚠️ فشل حذف المجلد المؤقت ${dir}:`, e.message);
    }
}

// ===== دوال API =====
async function createSession(token, accountName) {
    console.log(`[${accountName}] جاري إنشاء الجلسة...`);
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const body = {
        experienceId: 9,
        experienceBuildType: "release",
        experienceBuildVersion: "1.3.14",
        platform: "android",
        contextType: "group",
        contextId: GROUP_ID,
        screenState: "full",
        screenStatePreviously: "full",
        data: ""
    };
    try {
        const res = await fetch("https://experience.palringo.com/experience/session", {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const sessionToken = data.token;
        if (!sessionToken) throw new Error("لا يوجد token");
        await fetch(`https://experience.palringo.com/experience/session/token/${sessionToken}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(body)
        });
        console.log(`[${accountName}] ✅ تم تفعيل الجلسة`);
        return sessionToken;
    } catch (e) {
        console.error(`[${accountName}] خطأ في الجلسة:`, e.message);
        return null;
    }
}

async function createLobby(token) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const body = {
        typeId: 13,
        groupId: GROUP_ID,
        visibility: "global",
        access: "public",
        displayName: "ㅤ⚽ Penalty Shootout ㅤ",
        data: "",
        ownerUserData: "",
        ownerPlayerIp: "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b"
    };
    try {
        const res = await fetch("https://experience.palringo.com/lobby", {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ تم إنشاء اللوبي: ${data.id}`);
        return data.id;
    } catch (e) {
        console.error("❌ فشل إنشاء اللوبي:", e.message);
        return null;
    }
}

async function joinLobby(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const body = { data: "", playerIp: "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b" };
    try {
        const res = await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/user`, {
            method: "POST",
            headers,
            body: JSON.stringify(body)
        });
        if (res.status === 200) {
            console.log(`✅ انضم الضيف إلى ${lobbyId}`);
            return true;
        }
    } catch (e) {
        console.error("خطأ في الانضمام:", e.message);
    }
    return false;
}

async function startGame(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}`, "content-length": "0" };
    try {
        await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/start`, { method: "POST", headers });
        await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/close`, { method: "POST", headers });
        console.log(`✅ تم بدء اللوبي ${lobbyId}`);
        return true;
    } catch (e) {
        console.error("خطأ في البدء:", e.message);
        return false;
    }
}

// ===== دوال المتصفح =====
async function navigateToLobby(page, token, lobbyId) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/golden_goal/1.3.14/index.html?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
    console.log(`[الضيف] 🌐 توجيه إلى ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setCacheEnabled(true);
    console.log(`[الضيف] ✅ تم تحميل الصفحة.`);
}

async function injectData(page, token, userId, lobbyId) {
    await page.evaluate((token, userId, groupId, lobbyId) => {
        window.Gamepad = {
            _listeners: {},
            on: function(event, cb) {
                if (!this._listeners[event]) this._listeners[event] = [];
                this._listeners[event].push(cb);
            },
            emit: function(event, data) {
                try {
                    if (event === 'setUserData') {
                        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                        window.__userData = parsed;
                        setTimeout(() => window.postMessage({ type: 'experienceStateChanged', args: { experienceState: 'ready' } }, '*'), 500);
                    }
                } catch(e) {}
            },
            localEmit: function(event, data) {
                try {
                    if (event === 'setUserData') {
                        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                        window.__userData = parsed;
                        setTimeout(() => window.postMessage({ type: 'experienceStateChanged', args: { experienceState: 'ready' } }, '*'), 500);
                        setTimeout(() => window.postMessage({ type: 'startGame', args: { lobbyId: parsed.lobbyId } }, '*'), 1000);
                    }
                } catch(e) {}
            },
            showKeyboard: function(){},
            hideKeyboard: function(){},
            setKeyboardEnabled: function(){},
            showPane: function(){},
            hidePane: function(){},
            setPaneEnabled: function(){},
            openPopup: function(){},
            openPopupWithActions: function(){},
            requestInGamePurchase: function(){},
            loadExternalUrl: function(){}
        };
        window.WebViewChannel = {
            postMessage: function(message) {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'setUserData') {
                        window.__userData = data.args;
                        setTimeout(() => window.postMessage({ type: 'experienceStateChanged', args: { experienceState: 'ready' } }, '*'), 500);
                        setTimeout(() => window.postMessage({ type: 'startGame', args: { lobbyId: data.args.lobbyId } }, '*'), 1000);
                        setTimeout(() => window.postMessage({ type: 'screenStateChanged', args: { screenState: 'full' } }, '*'), 1500);
                    }
                } catch (e) {}
            }
        };
        const userData = {
            platform: 'android',
            contextType: 'group',
            contextID: groupId.toString(),
            clientToken: token,
            expSessionToken: token,
            externalLink: '',
            launchData: '',
            userId: userId,
            lobbyId: lobbyId
        };
        window.postMessage({ type: 'setUserData', args: userData }, '*');
        window.Gamepad.localEmit('setUserData', userData);
        window.Gamepad.emit('setUserData', userData);
        console.log(`✅ تم إرسال setUserData`);
    }, token, userId, GROUP_ID, lobbyId);
    await sleep(1000);
    console.log(`[الضيف] ✅ تم حقن البيانات.`);
}

// ===== دالة السحب =====
async function performDrag(page) {
    try {
        await page.mouse.move(300, 338);
        await sleep(200);
        await page.mouse.down();
        await sleep(300);
        await page.mouse.move(264, 470, { steps: 15 });
        await sleep(300);
        await page.mouse.up();
        console.log(`[الضيف] ✅ تم السحب.`);
    } catch (e) {
        console.warn(`[الضيف] ⚠️ فشل السحب:`, e.message);
    }
}

// ===== تشغيل السحب لمدة محددة =====
async function runDragForDuration(page, durationSeconds) {
    console.log(`🔄 بدء السحب لمدة ${durationSeconds} ثانية (كل ${DRAG_INTERVAL/1000} ثانية)...`);
    const endTime = Date.now() + durationSeconds * 1000;
    let dragInterval = setInterval(async () => {
        if (Date.now() >= endTime) {
            clearInterval(dragInterval);
            console.log(`⏹️ تم إيقاف السحب (انتهت المدة).`);
            return;
        }
        await performDrag(page);
    }, DRAG_INTERVAL);
    // ننتظر حتى انتهاء المدة
    while (Date.now() < endTime) {
        await sleep(1000);
    }
    clearInterval(dragInterval);
    console.log(`✅ انتهت فترة السحب.`);
}

// ===== الدالة الرئيسية =====
async function main() {
    let browser = null;
    let page = null;
    let tempDir = null;
    let isRunning = true;

    // تنظيف عند الخروج
    const cleanup = () => {
        isRunning = false;
        if (tempDir) deleteTempDir(tempDir);
        if (browser) browser.close().catch(() => {});
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        // 1. فتح متصفح واحد للضيف (مع مجلد مؤقت)
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        console.log(`📁 مجلد مؤقت للضيف: ${tempDir}`);

        browser = await puppeteer.launch({
            headless: 'new',
            userDataDir: tempDir,
            args: [
                '--disable-web-security',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=600,600',
                '--disable-session-crashed-bubble',
                '--disable-features=TranslateUI'
            ]
        });
        page = await browser.newPage();
        await page.setViewport({ width: 600, height: 600 });

        // 2. الحلقة الرئيسية للجولات
        let round = 1;
        while (isRunning) {
            console.log(`\n🔄 === جولة ${round} ===`);

            // 2.1 إنشاء جلسات جديدة (لتحديث التوكنات)
            const sessionHost = await createSession(TOKEN_HOST, "المنشئ");
            if (!sessionHost) {
                console.log("❌ فشل جلسة المنشئ، انتظار 30 ثانية...");
                await sleep(30000);
                continue;
            }
            const sessionGuest = await createSession(TOKEN_GUEST, "الضيف");
            if (!sessionGuest) {
                console.log("❌ فشل جلسة الضيف، انتظار 30 ثانية...");
                await sleep(30000);
                continue;
            }

            // 2.2 محاولة إنشاء لوبي (حتى 25 محاولة)
            let lobbyId = null;
            for (let attempt = 1; attempt <= MAX_LOBBY_ATTEMPTS; attempt++) {
                console.log(`[API] 🏗️ محاولة إنشاء لوبي رقم ${attempt}/${MAX_LOBBY_ATTEMPTS}...`);
                lobbyId = await createLobby(TOKEN_HOST);
                if (!lobbyId) {
                    await sleep(3000);
                    continue;
                }

                // انضمام الضيف
                const joined = await joinLobby(TOKEN_GUEST, lobbyId);
                if (!joined) {
                    console.log("❌ فشل انضمام الضيف، إلغاء اللوبي...");
                    lobbyId = null;
                    await sleep(3000);
                    continue;
                }

                // بدء اللعبة
                const started = await startGame(TOKEN_HOST, lobbyId);
                if (!started) {
                    lobbyId = null;
                    await sleep(3000);
                    continue;
                }

                console.log(`✅ تم إنشاء اللوبي وبدء اللعبة بنجاح (id: ${lobbyId})`);
                break;
            }

            // إذا فشلت كل المحاولات
            if (!lobbyId) {
                console.log(`❌ فشل إنشاء لوبي بعد ${MAX_LOBBY_ATTEMPTS} محاولات. انتظار ${RETRY_WAIT} ثانية (بدون سحب)...`);
                await sleep(RETRY_WAIT * 1000);
                round++;
                continue; // نعيد المحاولة من البداية (جولة جديدة)
            }

            // 2.3 توجيه صفحة الضيف إلى اللوبي الجديد
            await navigateToLobby(page, TOKEN_GUEST, lobbyId);
            await sleep(5000);
            await injectData(page, TOKEN_GUEST, USER_ID_GUEST, lobbyId);
            await sleep(3000);

            // 2.4 تشغيل السحب لمدة الجولة (90 ثانية)
            await runDragForDuration(page, ROUND_DURATION);

            console.log(`✅ انتهت الجولة ${round}. سيتم إنشاء لوبي جديد.`);
            round++;
        }

    } catch (e) {
        console.error("❌ خطأ رئيسي:", e.message, e.stack);
    } finally {
        cleanup();
        console.log("🛑 تم إنهاء البرنامج.");
    }
}

main();
