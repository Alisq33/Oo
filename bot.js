const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ===== بيانات الحسابات =====
const TOKEN_HOST = "576a2902-db16-4e9f-b503-3da6ba4bf78a";
const USER_ID_HOST = 80055399;
const TOKEN_GUEST = "6d3ce792-7fce-40cd-aa0f-0ab34aca6354";
const USER_ID_GUEST = 51660277;
const GROUP_ID = 18432094;

// ===== إعدادات اللعبة =====
const GAME_TYPE_ID = 2;
const GAME_URL_PATH = 'carrom/4.6.9';
const EXPERIENCE_ID = '2';
const EXPERIENCE_BUILD_VERSION = '4.6.9';
const EXPERIENCE_BUILD_TYPE = 'release';
const GAME_DISPLAY_NAME = 'ㅤ🏏 Carrom ㅤ';

// ===== أوقات الانتظار =====
const CACHE_WARMUP_WAIT = 10;
const POST_OPEN_WAIT = 5;
const POST_INJECT_WAIT = 120;
const CLICK_WAIT = 1;
const RETRY_WAIT = 90;
const MAX_LOBBY_ATTEMPTS = 25;

// ===== حجم النافذة =====
const WINDOW_WIDTH = 400;
const WINDOW_HEIGHT = 600;

// ===== نقاط النقر =====
const CLICK_POINTS = [
    { x: 36, y: 39 },
    { x: 35, y: 311 },
    { x: 294, y: 372 }
];

// ===== رؤوس HTTP =====
const baseHeaders = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",
    "experience-id": EXPERIENCE_ID,
    "experience-build-type": EXPERIENCE_BUILD_TYPE,
    "experience-build-version": EXPERIENCE_BUILD_VERSION,
    "language-id": "1",
    "user-agent": "Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36",
    "content-type": "application/json",
    "Accept": "*/*",
    "Origin": "https://experiences.wolfservices.production.wolf.live",
    "X-Requested-With": "com.palringo.android"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        experienceId: parseInt(EXPERIENCE_ID),
        experienceBuildType: EXPERIENCE_BUILD_TYPE,
        experienceBuildVersion: EXPERIENCE_BUILD_VERSION,
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

async function deleteSession(token, sessionToken, accountName) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    try {
        const res = await fetch(`https://experience.palringo.com/experience/session/token/${sessionToken}`, {
            method: "DELETE",
            headers
        });
        if (res.status === 204) {
            console.log(`[${accountName}] ✅ تم إنهاء الجلسة رسمياً (DELETE)`);
            return true;
        }
    } catch (e) {
        console.error(`[${accountName}] خطأ أثناء الحذف:`, e.message);
    }
    return false;
}

async function createLobby(token) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const body = {
        typeId: GAME_TYPE_ID,
        groupId: GROUP_ID,
        visibility: "global",
        access: "public",
        displayName: GAME_DISPLAY_NAME,
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
        console.error(`❌ فشل إنشاء اللوبي:`, e.message);
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
            console.log(`✅ الحساب انضم إلى ${lobbyId}`);
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

// ===== دوال Puppeteer =====
async function warmUpCache(browser, token, accountName) {
    console.log(`[${accountName}] 🔥 تسخين الكاش...`);
    const page = await browser.newPage();
    await page.setViewport({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android',
        'Experience-Id': EXPERIENCE_ID,
        'Experience-Build-Type': EXPERIENCE_BUILD_TYPE,
        'Experience-Build-Version': EXPERIENCE_BUILD_VERSION,
        'Service-Worker': 'script'
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/${GAME_URL_PATH}/index.html?groupId=${GROUP_ID}&experienceBuildType=${EXPERIENCE_BUILD_TYPE}&experienceId=${EXPERIENCE_ID}`;
    console.log(`[${accountName}] 🌐 فتح ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.setCacheEnabled(true);
    console.log(`[${accountName}] ✅ تم تحميل الصفحة وتخزين الكاش.`);
    await page.close();
}

async function openPage(browser, token, accountName) {
    const page = await browser.newPage();
    await page.setViewport({ width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android',
        'Experience-Id': EXPERIENCE_ID,
        'Experience-Build-Type': EXPERIENCE_BUILD_TYPE,
        'Experience-Build-Version': EXPERIENCE_BUILD_VERSION
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/${GAME_URL_PATH}/index.html?groupId=${GROUP_ID}&experienceBuildType=${EXPERIENCE_BUILD_TYPE}&experienceId=${EXPERIENCE_ID}`;
    console.log(`[${accountName}] 🌐 فتح الصفحة (من الكاش)...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setCacheEnabled(true);
    console.log(`[${accountName}] ✅ تم تحميل الصفحة (من الكاش).`);
    return page;
}

async function injectData(page, token, userId, accountName, lobbyId) {
    await page.evaluate((token, userId, groupId, lobbyId, expId) => {
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
                        setTimeout(() => window.postMessage({ type: 'start', args: { lobbyId: parsed.lobbyId } }, '*'), 1000);
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
                        setTimeout(() => window.postMessage({ type: 'start', args: { lobbyId: data.args.lobbyId } }, '*'), 1000);
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
            lobbyId: lobbyId,
            experienceId: expId,
            experienceBuildType: 'release',
            experienceBuildVersion: '4.6.9'
        };

        window.postMessage({ type: 'setUserData', args: userData }, '*');
        window.Gamepad.localEmit('setUserData', userData);
        window.Gamepad.emit('setUserData', userData);
        console.log(`✅ تم إرسال setUserData للمستخدم ${userId}`);
    }, token, userId, GROUP_ID, lobbyId, EXPERIENCE_ID);
    await sleep(1000);
    console.log(`[${accountName}] ✅ تم حقن البيانات في اللوبي ${lobbyId}.`);
}

async function clickAt(page, x, y, accountName) {
    console.log(`[${accountName}] 🖱️ النقر عند (${x}, ${y})`);
    await page.mouse.click(x, y);
    await sleep(1000);
}

// ===== الدالة الرئيسية =====
async function main() {
    let browser1, browser2;
    let tempDir1, tempDir2;
    let page1 = null, page2 = null;
    let failedLobbyAttempts = 0;

    const cleanup = () => {
        if (tempDir1) deleteTempDir(tempDir1);
        if (tempDir2) deleteTempDir(tempDir2);
        try { if (browser1) browser1.close(); } catch (e) {}
        try { if (browser2) browser2.close(); } catch (e) {}
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        console.log(`📁 مجلد مؤقت 1: ${tempDir1}`);
        console.log(`📁 مجلد مؤقت 2: ${tempDir2}`);

        console.log(`🚀 فتح المتصفحين (مرئيين) بحجم ${WINDOW_WIDTH}x${WINDOW_HEIGHT}...`);
        browser1 = await puppeteer.launch({
            headless: false,
            userDataDir: tempDir1,
            args: [
                '--disable-web-security',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
                '--disable-session-crashed-bubble',
                '--disable-features=TranslateUI'
            ]
        });
        browser2 = await puppeteer.launch({
            headless: false,
            userDataDir: tempDir2,
            args: [
                '--disable-web-security',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--window-size=${WINDOW_WIDTH},${WINDOW_HEIGHT}`,
                '--disable-session-crashed-bubble',
                '--disable-features=TranslateUI'
            ]
        });

        // ===== 1. تسخين الكاش (مرة واحدة) =====
        console.log("\n🔥 مرحلـة تسخين الكاش (مرة واحدة)...");
        await Promise.all([
            warmUpCache(browser1, TOKEN_HOST, "الحساب الأول (80055399)"),
            warmUpCache(browser2, TOKEN_GUEST, "الحساب الثاني (51660277)")
        ]);
        console.log("⏳ انتظار 10 ثوانٍ لتثبيت الكاش...");
        await sleep(CACHE_WARMUP_WAIT * 1000);
        console.log("✅ تم تسخين الكاش بنجاح.\n");

        // ===== 2. فتح الصفحات الرئيسية (مرة واحدة وتبقى مفتوحة) =====
        console.log("📂 فتح الصفحات الرئيسية (ستبقى مفتوحة طوال الوقت)...");
        page1 = await openPage(browser1, TOKEN_HOST, "الحساب الأول (80055399)");
        page2 = await openPage(browser2, TOKEN_GUEST, "الحساب الثاني (51660277)");

        console.log("⏳ انتظار 5 ثوانٍ بعد فتح الصفحات...");
        await sleep(POST_OPEN_WAIT * 1000);

        let cycleCount = 0;

        // ===== الحلقة الرئيسية (الصفحات مفتوحة) =====
        while (true) {
            cycleCount++;
            console.log(`\n========== الدورة رقم ${cycleCount} ==========`);

            // 1. إنشاء جلسات جديدة لكل دورة
            const sessionHost = await createSession(TOKEN_HOST, "الحساب الأول (80055399)");
            if (!sessionHost) {
                console.log("❌ فشل جلسة الحساب الأول، ننتظر 90 ثانية ونعيد المحاولة...");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }
            const sessionGuest = await createSession(TOKEN_GUEST, "الحساب الثاني (51660277)");
            if (!sessionGuest) {
                console.log("❌ فشل جلسة الحساب الثاني، ننتظر 90 ثانية ونعيد المحاولة...");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }

            // 2. الحساب الثاني (الضيف) ينشئ لوبي
            let lobbyId = null;
            let attempts = 0;
            while (attempts < MAX_LOBBY_ATTEMPTS && !lobbyId) {
                attempts++;
                console.log(`🔍 محاولة إنشاء لوبي بالحساب الثاني (${attempts}/${MAX_LOBBY_ATTEMPTS})...`);
                lobbyId = await createLobby(TOKEN_GUEST);
                if (!lobbyId) {
                    console.log(`⚠️ فشلت المحاولة ${attempts}`);
                    // تنفيذ النقرات على صفحة الحساب الأول (page1)
                    console.log("🔄 تنفيذ سلسلة النقرات على الحساب الأول (80055399)...");
                    for (const point of CLICK_POINTS) {
                        await clickAt(page1, point.x, point.y, "الحساب الأول (80055399)");
                    }
                    await sleep(2000);
                }
            }

            if (!lobbyId) {
                // فشل إنشاء اللوبي بعد 25 محاولة
                console.log(`❌ فشل إنشاء اللوبي بعد ${MAX_LOBBY_ATTEMPTS} محاولة.`);
                failedLobbyAttempts++;
                console.log(`📊 عدد المحاولات الفاشلة المتتالية: ${failedLobbyAttempts}`);

                if (failedLobbyAttempts >= MAX_LOBBY_ATTEMPTS) {
                    console.log(`⏳ بلغ عدد المحاولات الفاشلة ${MAX_LOBBY_ATTEMPTS}، ننتظر ${RETRY_WAIT} ثانية ثم نعيد...`);
                    await sleep(RETRY_WAIT * 1000);
                    failedLobbyAttempts = 0;
                }

                // لا نغلق الصفحات، نستمر في المحاولة
                continue;
            }

            // نجح إنشاء اللوبي
            failedLobbyAttempts = 0;  // إعادة ضبط العداد

            // 3. الحساب الأول ينضم إلى اللوبي
            const joined = await joinLobby(TOKEN_HOST, lobbyId);
            if (!joined) {
                console.log("❌ فشل انضمام الحساب الأول، نعيد المحاولة...");
                continue;
            }

            // 4. بدء اللعبة (الحساب الثاني هو المنشئ)
            const started = await startGame(TOKEN_GUEST, lobbyId);
            if (!started) {
                console.log("❌ فشل بدء اللعبة، نعيد المحاولة...");
                continue;
            }

            // 5. حقن البيانات في كلا الصفحتين (مع الأدوار الثابتة)
            console.log("📤 حقن البيانات...");
            await Promise.all([
                injectData(page1, TOKEN_HOST, USER_ID_HOST, "الحساب الأول (80055399)", lobbyId),
                injectData(page2, TOKEN_GUEST, USER_ID_GUEST, "الحساب الثاني (51660277)", lobbyId)
            ]);

            console.log(`⏳ انتظار ${POST_INJECT_WAIT} ثانية (مدة اللعبة)...`);
            await sleep(POST_INJECT_WAIT * 1000);

            // 6. بعد 120 ثانية، الحساب الأول ينقر سلسلة النقرات
            console.log("🔄 تنفيذ سلسلة النقرات على الحساب الأول (80055399)...");
            for (const point of CLICK_POINTS) {
                await clickAt(page1, point.x, point.y, "الحساب الأول (80055399)");
            }

            // 7. إنهاء الجلسات (بدون إغلاق الصفحات)
            await deleteSession(TOKEN_HOST, sessionHost, "الحساب الأول (80055399)");
            await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الثاني (51660277)");
            console.log("✅ تم إنهاء الجلسات.");

            // 8. انتظار بسيط ثم العودة لبداية الحلقة (محاولة إنشاء لوبي جديد)
            await sleep(3000);
        }

    } catch (e) {
        console.error("❌ خطأ رئيسي:", e.message);
        console.error(e.stack);
        cleanup();
        process.exit(1);
    }
}

main();
