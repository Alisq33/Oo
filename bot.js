const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ===== بيانات الحسابات (استبدل التوكنات بتوكنات صالحة) =====
const TOKEN_HOST = "576a2902-db16-4e9f-b503-3da6ba4bf78a";  // غيّر إلى توكن صالح
const USER_ID_HOST = 80055399;
const TOKEN_GUEST = "6c278a87-a015-4bbc-b963-6e7196e2c652"; // غيّر إلى توكن صالح
const USER_ID_GUEST = 51660277;
const GROUP_ID = 18432094;
const WAIT_TIME = 120; // 120 ثانية (دقيقتان)
const MAX_LOBBY_ATTEMPTS = 25;
const RETRY_WAIT = 90; // انتظار 90 ثانية بعد فشل 25 محاولة
const WAIT_BETWEEN_ROUNDS = 110; // انتظار 110 ثانية بين الجولات

// ===== إعدادات لعبة XO Battles (القيم الصحيحة) =====
const EXPERIENCE_ID = 6;
const LOBBY_TYPE_ID = 5;
const EXPERIENCE_BUILD_VERSION = "2.11.0";
const EXPERIENCE_PATH = `/experience/xo_battles/${EXPERIENCE_BUILD_VERSION}/index.html`;

// ===== إعدادات النقرات المتسلسلة =====
// الضيف: 3 نقرات
const CLICKS_GUEST = [
    { x: 234, y: 271 },
    { x: 228, y: 338 },
    { x: 222, y: 413 }
];
// المنشئ: 3 نقرات
const CLICKS_HOST = [
    { x: 353, y: 350 },
    { x: 360, y: 397 },
    { x: 312, y: 389 }
];
const DELAY_BETWEEN_CLICKS = 200; // 200 مللي ثانية بين النقرات المتتالية
const DELAY_AFTER_GUEST = 1000;   // 1 ثانية بعد نقرات الضيف
const DELAY_AFTER_HOST = 2000;    // 2 ثانية بعد نقرات المنشئ

// ===== رؤوس HTTP =====
function buildHeaders(token, contentLength = null) {
    const headers = {
        "Host": "experience.palringo.com",
        "Connection": "keep-alive",
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
        "experience-id": String(EXPERIENCE_ID),
        "experience-build-type": "release",
        "sec-ch-ua-mobile": "?1",
        "experience-build-version": EXPERIENCE_BUILD_VERSION,
        "language-id": "1",
        "user-agent": "Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.181 Mobile Safari/537.36",
        "content-type": "application/json",
        "Accept": "*/*",
        "Origin": "https://experiences.wolfservices.production.wolf.live",
        "X-Requested-With": "com.palringo.android",
        "sec-fetch-site": "cross-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "Referer": "https://experiences.wolfservices.production.wolf.live/",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-SA,en;q=0.9,ar-SA;q=0.8,ar;q=0.7,en-TR;q=0.6,en-US;q=0.5",
        "priority": "u=1, i",
        "authorization": `Bearer ${token}`
    };
    if (contentLength !== null) {
        headers["content-length"] = String(contentLength);
    }
    return headers;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== دالة حذف المجلد المؤقت =====
function deleteTempDir(dir) {
    try {
        if (fs.existsSync(dir)) {
            setTimeout(() => {
                try {
                    fs.rmSync(dir, { recursive: true, force: true });
                    console.log(`🗑️ تم حذف المجلد المؤقت: ${dir}`);
                } catch (e) {
                    console.warn(`⚠️ فشل حذف المجلد المؤقت ${dir}:`, e.message);
                }
            }, 2000);
        }
    } catch (e) {
        console.warn(`⚠️ فشل حذف المجلد المؤقت ${dir}:`, e.message);
    }
}

// ===== دوال API =====
async function createSession(token, accountName) {
    console.log(`[${accountName}] جاري إنشاء الجلسة...`);
    const headers = buildHeaders(token);
    delete headers["content-length"];
    delete headers["sec-fetch-site"];
    delete headers["sec-fetch-mode"];
    delete headers["sec-fetch-dest"];
    delete headers["priority"];
    delete headers["Referer"];

    const body = {
        experienceId: EXPERIENCE_ID,
        experienceBuildType: "release",
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
    const headers = buildHeaders(token);
    delete headers["content-length"];
    delete headers["sec-fetch-site"];
    delete headers["sec-fetch-mode"];
    delete headers["sec-fetch-dest"];
    delete headers["priority"];
    delete headers["Referer"];
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

async function createLobby(token, attempt) {
    const body = {
        typeId: LOBBY_TYPE_ID,
        groupId: GROUP_ID,
        visibility: "global",
        access: "public",
        displayName: "❌ XO Battles",
        data: "",
        ownerUserData: "",
        ownerPlayerIp: "188.51.179.94"
    };
    const bodyStr = JSON.stringify(body);
    const headers = buildHeaders(token, Buffer.byteLength(bodyStr));

    try {
        const res = await fetch("https://experience.palringo.com/lobby", {
            method: "POST",
            headers,
            body: bodyStr
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log(`✅ تم إنشاء اللوبي (محاولة ${attempt}): ${data.id}`);
        return data.id;
    } catch (e) {
        console.error(`❌ فشل إنشاء اللوبي (محاولة ${attempt}):`, e.message);
        return null;
    }
}

async function joinLobby(token, lobbyId) {
    const body = { data: "", playerIp: "188.51.179.94" };
    const bodyStr = JSON.stringify(body);
    const headers = buildHeaders(token, Buffer.byteLength(bodyStr));
    try {
        const res = await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/user`, {
            method: "POST",
            headers,
            body: bodyStr
        });
        if (res.status === 200) {
            console.log(`✅ الحساب الضيف انضم إلى ${lobbyId}`);
            return true;
        }
        console.log(`⚠️ فشل الانضمام، status ${res.status}`);
        return false;
    } catch (e) {
        console.error("خطأ في الانضمام:", e.message);
        return false;
    }
}

async function startGame(token, lobbyId) {
    const headers = buildHeaders(token, 0);
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
async function navigateToLobby(page, token, accountName, lobbyId) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });
    const url = `https://experiences.wolfservices.production.wolf.live${EXPERIENCE_PATH}?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
    console.log(`[${accountName}] 🌐 فتح ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setCacheEnabled(true);
    console.log(`[${accountName}] ✅ تم تحميل الصفحة.`);
}

async function injectData(page, token, userId, accountName, lobbyId) {
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
    console.log(`[${accountName}] ✅ تم حقن البيانات.`);
}

// ===== دوال النقرات المتسلسلة =====
async function clickSequence(page, clicks, accountName) {
    for (const [index, click] of clicks.entries()) {
        console.log(`[${accountName}] 🖱️ Click at (${click.x}, ${click.y})`);
        await page.mouse.click(click.x, click.y);
        if (index < clicks.length - 1) {
            await sleep(DELAY_BETWEEN_CLICKS);
        }
    }
}

async function performFullCycle(pageGuest, pageHost) {
    // الضيف ينقر 3 نقرات
    await clickSequence(pageGuest, CLICKS_GUEST, "الضيف");
    await sleep(DELAY_AFTER_GUEST);

    // المنشئ ينقر 3 نقرات
    await clickSequence(pageHost, CLICKS_HOST, "المنشئ");
    await sleep(DELAY_AFTER_HOST);
}

// ===== الدالة الرئيسية =====
async function main() {
    let browser1, browser2;
    let tempDir1, tempDir2;
    let stopCycle = false;

    // تنظيف عند الخروج
    const cleanup = () => {
        if (tempDir1) deleteTempDir(tempDir1);
        if (tempDir2) deleteTempDir(tempDir2);
        try { if (browser1) browser1.close(); } catch (e) {}
        try { if (browser2) browser2.close(); } catch (e) {}
        console.log("🛑 تم التنظيف والخروج.");
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        // إنشاء المجلدات المؤقتة للمتصفحات (مرة واحدة)
        tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        console.log(`📁 مجلد مؤقت 1: ${tempDir1}`);
        console.log(`📁 مجلد مؤقت 2: ${tempDir2}`);

        // فتح المتصفحين في وضع headless (لـ GitHub Actions)
        console.log("🚀 فتح المتصفحين في وضع headless...");
        browser1 = await puppeteer.launch({
            headless: 'new',
            userDataDir: tempDir1,
            args: [
                '--disable-web-security',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=600,600',
                '--disable-session-crashed-bubble',
                '--disable-features=TranslateUI'
            ]
        });
        browser2 = await puppeteer.launch({
            headless: 'new',
            userDataDir: tempDir2,
            args: [
                '--disable-web-security',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=600,600',
                '--disable-session-crashed-bubble',
                '--disable-features=TranslateUI'
            ]
        });

        let cycleCount = 0;

        // الحلقة الرئيسية (غير محدودة)
        while (true) {
            cycleCount++;
            console.log(`\n========== الدورة رقم ${cycleCount} ==========`);

            // 1. إنشاء جلسات جديدة لكل دورة
            const sessionHost = await createSession(TOKEN_HOST, "الحساب المنشئ");
            if (!sessionHost) {
                console.log("❌ فشل جلسة المنشئ، ننتظر 90 ثانية ونعيد المحاولة...");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }
            const sessionGuest = await createSession(TOKEN_GUEST, "الحساب الضيف");
            if (!sessionGuest) {
                console.log("❌ فشل جلسة الضيف، ننتظر 90 ثانية ونعيد المحاولة...");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }

            // 2. محاولة إنشاء لوبي (حتى 25 محاولة)
            let lobbyId = null;
            let attempts = 0;
            while (attempts < MAX_LOBBY_ATTEMPTS && !lobbyId) {
                attempts++;
                lobbyId = await createLobby(TOKEN_HOST, attempts);
                if (!lobbyId) {
                    console.log(`⚠️ فشلت المحاولة ${attempts}/${MAX_LOBBY_ATTEMPTS}`);
                    await sleep(2000);
                }
            }

            if (!lobbyId) {
                console.log(`❌ فشل إنشاء اللوبي بعد ${MAX_LOBBY_ATTEMPTS} محاولة، ننتظر ${RETRY_WAIT} ثانية ثم نعيد الدورة`);
                await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
                await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }

            // 3. انضمام الضيف
            const joined = await joinLobby(TOKEN_GUEST, lobbyId);
            if (!joined) {
                console.log("❌ فشل انضمام الضيف، ننتظر 90 ثانية ونعيد الدورة");
                await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
                await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }

            // 4. بدء اللعبة
            const started = await startGame(TOKEN_HOST, lobbyId);
            if (!started) {
                console.log("❌ فشل بدء اللعبة، ننتظر 90 ثانية ونعيد الدورة");
                await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
                await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
                await sleep(RETRY_WAIT * 1000);
                continue;
            }

            // 5. فتح صفحات جديدة في المتصفحين
            const page1 = await browser1.newPage();
            const page2 = await browser2.newPage();
            await page1.setViewport({ width: 600, height: 600 });
            await page2.setViewport({ width: 600, height: 600 });

            // 6. الانتقال إلى اللوبي
            await Promise.all([
                navigateToLobby(page1, TOKEN_HOST, "الحساب المنشئ", lobbyId),
                navigateToLobby(page2, TOKEN_GUEST, "الحساب الضيف", lobbyId)
            ]);

            console.log("⏳ انتظار 5 ثوانٍ قبل حقن البيانات...");
            await sleep(5000);

            // 7. حقن البيانات
            console.log("📤 حقن البيانات...");
            await Promise.all([
                injectData(page1, TOKEN_HOST, USER_ID_HOST, "الحساب المنشئ", lobbyId),
                injectData(page2, TOKEN_GUEST, USER_ID_GUEST, "الحساب الضيف", lobbyId)
            ]);

            console.log("⏳ انتظار 3 ثوانٍ بعد الحقن...");
            await sleep(3000);

            // 8. بدء النقرات المتسلسلة المتكررة لمدة WAIT_TIME (120 ثانية)
            console.log(`🔄 بدء النقرات المتسلسلة لمدة ${WAIT_TIME} ثانية...`);
            const startTime = Date.now();
            let cycleCountLocal = 0;
            stopCycle = false;

            // حلقة النقرات حتى انتهاء المدة
            while (Date.now() - startTime < WAIT_TIME * 1000) {
                if (stopCycle) break;
                cycleCountLocal++;
                console.log(`\n--- دورة نقرات ${cycleCountLocal} ---`);
                await performFullCycle(page2, page1);
                // بعد كل دورة ننتظر قليلاً (اختياري) لكن التأخيرات موجودة داخل الدالة
            }

            console.log(`⏹️ تم إيقاف النقرات بعد ${WAIT_TIME} ثانية. (${cycleCountLocal} دورة)`);

            // 9. إغلاق الصفحات (بدون خروج)
            await page1.close();
            await page2.close();
            console.log("🗑️ تم إغلاق الصفحات.");

            // 10. حذف الجلسات (ننهيها نظيفاً)
            await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
            await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
            console.log("✅ تم إنهاء الجلسات.");

            // 11. انتظار 110 ثانية قبل بدء الدورة التالية
            console.log(`⏳ انتظار ${WAIT_BETWEEN_ROUNDS} ثانية قبل الدورة التالية...`);
            await sleep(WAIT_BETWEEN_ROUNDS * 1000);
            // الدورة تنتهي، ستبدأ من جديد
        }

    } catch (e) {
        console.error("❌ خطأ رئيسي:", e.message);
        console.error(e.stack);
        cleanup();
        process.exit(1);
    }
}

main();
