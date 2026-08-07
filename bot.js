const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const os = require('os');

// ===== قراءة التوكنات من متغيرات البيئة =====
const TOKEN_1 = process.env.TOKEN_1;
const TOKEN_2 = process.env.TOKEN_2;
const USER_ID_1 = parseInt(process.env.USER_ID_1) || 80055399;
const USER_ID_2 = parseInt(process.env.USER_ID_2) || 51660277;
const GROUP_ID = parseInt(process.env.GROUP_ID) || 18432094;

if (!TOKEN_1 || !TOKEN_2) {
    console.error('❌ التوكنات غير موجودة في متغيرات البيئة!');
    process.exit(1);
}

// ===== إعدادات الجولات =====
const WAIT_TIME = 130;
const MAX_ATTEMPTS = 20;
const RETRY_DELAY = 180;

// ===== إعدادات السحب =====
const DRAG_START = { x: 300, y: 338 };
const DRAG_END = { x: 264, y: 470 };
const DRAG_INTERVAL = 3000; // 3 ثوانٍ

// ===== رؤوس HTTP (Golden Goal) =====
const baseHeaders = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",
    "experience-id": "9",
    "experience-build-type": "release",
    "sec-ch-ua-platform": '"Android"',
    "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
    "sec-ch-ua-mobile": "?1",
    "experience-build-version": "1.3.14",
    "language-id": "1",
    "user-agent": "Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36",
    "content-type": "application/json",
    "Accept": "*/*",
    "Origin": "https://experiences.wolfservices.production.wolf.live",
    "X-Requested-With": "com.palringo.android"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err && err.stack ? err.stack : err);
});
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err && err.stack ? err.stack : err);
});

// ===== دوال الجلسات واللوبي (نفس السابق ولكن معدلة للـ Golden Goal) =====
async function initializeAccountSession(token, accountName) {
    console.log(`[${accountName}] جاري إنشاء الجلسة...`);
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    try {
        const res = await fetch("https://experience.palringo.com/experience/session", {
            method: "POST",
            headers,
            body: JSON.stringify({
                experienceId: 9,
                experienceBuildType: "release",
                experienceBuildVersion: "1.3.14",
                platform: "android",
                contextType: "group",
                contextId: GROUP_ID,
                screenState: "full",
                screenStatePreviously: "full",
                data: ""
            })
        });
        if (res.ok) {
            const data = await res.json();
            const sessionToken = data.token;
            if (sessionToken) {
                await fetch(`https://experience.palringo.com/experience/session/token/${sessionToken}`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify({
                        experienceId: 9,
                        experienceBuildType: "release",
                        experienceBuildVersion: "1.3.14",
                        platform: "android",
                        contextType: "group",
                        contextId: GROUP_ID,
                        screenState: "full",
                        screenStatePreviously: "full",
                        data: ""
                    })
                });
                console.log(`[${accountName}] ✅ تم تفعيل الجلسة`);
                return sessionToken;
            }
        } else {
            console.error(`[${accountName}] ❌ فشل إنشاء الجلسة، status: ${res.status}`);
        }
    } catch (e) {
        console.error(`[${accountName}] خطأ:`, e.stack || e.message);
    }
    return null;
}

async function createLobby(token) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const res = await fetch("https://experience.palringo.com/lobby", {
        method: "POST",
        headers,
        body: JSON.stringify({
            typeId: 13,
            groupId: GROUP_ID,
            visibility: "global",
            access: "public",
            displayName: "ㅤ⚽ Penalty Shootout ㅤ",
            data: "",
            ownerUserData: "",
            ownerPlayerIp: "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b"
        })
    });
    const data = await res.json();
    return data.id;
}

async function joinLobby(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const res = await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/user`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: "", playerIp: "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b" })
    });
    return res.status === 200;
}

async function closeLobby(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}`, "content-length": "0" };
    await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/close`, { method: "POST", headers });
    console.log(`[API] 🚪 تم إغلاق اللوبي ${lobbyId}`);
}

async function startGame(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}`, "content-length": "0" };
    console.log(`[API] ✅ جاري بدء اللوبي ${lobbyId}...`);
    await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/start`, { method: "POST", headers });
    await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/close`, { method: "POST", headers });
    console.log(`[API] ✅ تم إرسال Start & Close`);
}

async function getLobbyUsers(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const res = await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}`, { headers });
    if (res.status === 200) {
        const data = await res.json();
        return data.users || [];
    }
    return [];
}

// ===== حقن البيانات (نفس الكود) =====
async function injectData(page, token, userId, accountName, lobbyId) {
    await page.evaluate((token, userId, groupId, lobbyId, accountName) => {
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
        console.log(`✅ تم إرسال setUserData للـ ${accountName}`);
    }, token, userId, GROUP_ID, lobbyId, accountName);
    await sleep(1000);
    console.log(`[${accountName}] ✅ تم حقن البيانات.`);
}

// ===== توجيه الصفحة (Golden Goal) =====
async function navigateToLobby(page, token, accountName, lobbyId) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/golden_goal/1.3.14/index.html?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
    console.log(`[${accountName}] 🌐 توجيه إلى ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setCacheEnabled(true);
    console.log(`[${accountName}] ✅ تم تحميل الصفحة.`);
}

// ===== إغلاق النوافذ =====
async function closeWindows(page1, page2) {
    console.log(`🔄 إغلاق النوافذ الحالية...`);
    try { await page1.close(); } catch(e) {}
    try { await page2.close(); } catch(e) {}
    console.log(`✅ تم إغلاق النوافذ.`);
}

// ===== دالة السحب =====
async function performDrag(page, accountName) {
    try {
        console.log(`[${accountName}] 🖱️ السحب من (${DRAG_START.x},${DRAG_START.y}) إلى (${DRAG_END.x},${DRAG_END.y})`);
        await page.mouse.move(DRAG_START.x, DRAG_START.y);
        await sleep(200);
        await page.mouse.down();
        await sleep(300);
        await page.mouse.move(DRAG_END.x, DRAG_END.y, { steps: 15 });
        await sleep(300);
        await page.mouse.up();
        console.log(`[${accountName}] ✅ تم السحب.`);
    } catch (e) {
        console.error(`[${accountName}] ❌ فشل السحب:`, e.message);
    }
}

function startAutoDrag(page, accountName) {
    console.log(`[${accountName}] 🖱️ بدء السحب التلقائي كل ${DRAG_INTERVAL/1000} ثانية...`);
    const interval = setInterval(async () => {
        await performDrag(page, accountName);
    }, DRAG_INTERVAL);
    return interval;
}

// ===== تشغيل جولة واحدة =====
async function runRound(roundNumber, browser1, browser2) {
    console.log(`\n🔄 === جولة ${roundNumber} ===`);

    let lobbyId = null;
    let attempt = 0;

    while (attempt < MAX_ATTEMPTS) {
        attempt++;
        console.log(`[API] 🏗️ محاولة إنشاء لوبي رقم ${attempt}...`);

        try {
            lobbyId = await createLobby(TOKEN_1);
            console.log(`✅ تم إنشاء اللوبي: ${lobbyId}`);

            const joined = await joinLobby(TOKEN_2, lobbyId);
            if (!joined) {
                console.log("❌ فشل انضمام الحساب الثاني. إعادة المحاولة...");
                await closeLobby(TOKEN_1, lobbyId);
                await sleep(2000);
                continue;
            }
            console.log("✅ الحساب الثاني انضم");

            const users = await getLobbyUsers(TOKEN_1, lobbyId);
            const userCount = users ? users.length : 0;
            console.log(`👥 عدد اللاعبين في اللوبي: ${userCount}`);

            if (userCount === 2) {
                console.log(`✅ اللوبي ${lobbyId} يحتوي على لاعبين فقط. سيتم بدء اللعبة.`);
                break;
            } else {
                console.log(`⚠️ اللوبي ${lobbyId} يحتوي على ${userCount} لاعب (متوقع 2). إلغاء هذا اللوبي...`);
                await closeLobby(TOKEN_1, lobbyId);
                await sleep(3000);
                lobbyId = null;
            }
        } catch (error) {
            console.error(`❌ خطأ في محاولة إنشاء اللوبي:`, error.stack || error.message);
            if (lobbyId) await closeLobby(TOKEN_1, lobbyId);
            await sleep(5000);
        }
    }

    if (!lobbyId) {
        console.log(`❌ فشل في إنشاء لوبي باعبين فقط بعد ${MAX_ATTEMPTS} محاولات.`);
        return false;
    }

    try {
        await startGame(TOKEN_1, lobbyId);
        const roundStartTime = Date.now();

        const page1 = await browser1.newPage();
        const page2 = await browser2.newPage();

        await Promise.all([
            navigateToLobby(page1, TOKEN_1, "الحساب الأول", lobbyId),
            navigateToLobby(page2, TOKEN_2, "الحساب الثاني", lobbyId)
        ]);

        console.log("⏳ انتظار 5 ثوانٍ قبل حقن البيانات...");
        await sleep(5000);

        console.log("📤 حقن بيانات الحسابين...");
        await Promise.all([
            injectData(page1, TOKEN_1, USER_ID_1, "الحساب الأول", lobbyId),
            injectData(page2, TOKEN_2, USER_ID_2, "الحساب الثاني", lobbyId)
        ]);

        const autoDragInterval = startAutoDrag(page2, "الحساب الثاني");

        console.log(`⏳ انتظار ${WAIT_TIME} ثانية (${WAIT_TIME/60} دقيقة)...`);
        await sleep(WAIT_TIME * 1000);

        clearInterval(autoDragInterval);
        console.log(`[الحساب الثاني] 🛑 تم إيقاف السحب التلقائي.`);

        await closeWindows(page1, page2);

        const elapsed = (Date.now() - roundStartTime) / 1000;
        const remaining = Math.max(0, 120 - elapsed);
        if (remaining > 0) {
            console.log(`⏳ انتظار ${remaining.toFixed(1)} ثانية حتى بدء الجولة التالية...`);
            await sleep(remaining * 1000);
        }

        console.log("⏳ انتظار 5 ثوانٍ قبل الجولة التالية...");
        await sleep(5000);

        return true;
    } catch (error) {
        console.error(`❌ خطأ في الجولة ${roundNumber}:`, error.stack || error.message);
        return false;
    }
}

// ===================== MAIN =====================
async function main() {
    console.log(`🚀 بدء التشغيل لمدة 6 ساعات (21600 ثانية)...`);
    console.log(`🚀 بدء البوت (مدة الانتظار: ${WAIT_TIME} ثانية)`);
    console.log(`📌 إعدادات السحب: من (${DRAG_START.x},${DRAG_START.y}) إلى (${DRAG_END.x},${DRAG_END.y}) كل ${DRAG_INTERVAL/1000} ثانية`);

    // توليد معرف فريد لهذه التشغيلة لتجنب تعارض ملفات التعريف
    const uniqueId = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const tempDir = path.join(os.tmpdir(), `chrome-profiles-${uniqueId}`);
    const userDataDir1 = path.join(tempDir, 'account1');
    const userDataDir2 = path.join(tempDir, 'account2');

    // تنظيف المجلدات إذا كانت موجودة
    await fs.ensureDir(userDataDir1);
    await fs.ensureDir(userDataDir2);

    let browser1, browser2;

    // ===== حلقة إعادة محاولة للتهيئة (جلسات + متصفحات) =====
    while (true) {
        try {
            const session1 = await initializeAccountSession(TOKEN_1, "الحساب الأول");
            if (!session1) {
                console.error('❌ فشل جلسة الحساب الأول، إعادة المحاولة بعد 60 ثانية');
                await sleep(60000);
                continue;
            }
            const session2 = await initializeAccountSession(TOKEN_2, "الحساب الثاني");
            if (!session2) {
                console.error('❌ فشل جلسة الحساب الثاني، إعادة المحاولة بعد 60 ثانية');
                await sleep(60000);
                continue;
            }

            console.log("🚀 فتح المتصفحين (ثابتان طوال الجلسة) بحجم 600x600...");
            browser1 = await puppeteer.launch({
                headless: true,
                userDataDir: userDataDir1,
                args: [
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-size=600,600',
                    '--disable-single-process',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });
            browser2 = await puppeteer.launch({
                headless: true,
                userDataDir: userDataDir2,
                args: [
                    '--disable-web-security',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--window-size=600,600',
                    '--disable-single-process',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            });

            break;
        } catch (initError) {
            console.error('❌ خطأ فادح أثناء التهيئة:', initError.stack || initError.message);
            try { if (browser1) await browser1.close(); } catch (e) {}
            try { if (browser2) await browser2.close(); } catch (e) {}
            // حذف المجلدات المؤقتة لإعادة المحاولة
            try { await fs.remove(tempDir); } catch (e) {}
            console.log('⏳ انتظار 60 ثانية ثم إعادة محاولة التهيئة...');
            await sleep(60000);
        }
    }

    // جدولة تنظيف المجلدات عند الخروج
    const cleanup = async () => {
        console.log('🧹 تنظيف الملفات المؤقتة...');
        try { await fs.remove(tempDir); } catch (e) {}
        console.log('✅ تم التنظيف.');
    };
    process.on('exit', cleanup);
    process.on('SIGINT', async () => {
        console.log('\n🛑 تم استلام SIGINT، إيقاف البوت...');
        try { if (browser1) await browser1.close(); } catch (e) {}
        try { if (browser2) await browser2.close(); } catch (e) {}
        await cleanup();
        process.exit(0);
    });

    let round = 1;
    const startTime = Date.now();
    const maxRunTime = 21600 * 1000; // 6 ساعات

    while (true) {
        // التحقق من الوقت المنقضي
        if (Date.now() - startTime > maxRunTime) {
            console.log('⏰ انتهت مدة التشغيل (6 ساعات). إنهاء البوت.');
            break;
        }

        try {
            const success = await runRound(round, browser1, browser2);
            if (!success) {
                console.log(`⚠️ فشلت الجولة ${round}. انتظار ${RETRY_DELAY} ثانية ثم المحاولة مرة أخرى...`);
                await sleep(RETRY_DELAY * 1000);
            }
            round++;
        } catch (error) {
            console.error(`❌ خطأ غير متوقع:`, error.stack || error.message);
            console.log(`⏳ انتظار ${RETRY_DELAY} ثانية ثم المحاولة مرة أخرى...`);
            await sleep(RETRY_DELAY * 1000);
        }
    }

    // إغلاق المتصفحات وتنظيف الملفات
    try { if (browser1) await browser1.close(); } catch (e) {}
    try { if (browser2) await browser2.close(); } catch (e) {}
    await cleanup();
    console.log('✅ تم إنهاء البوت بنجاح.');
}

main().catch(async (err) => {
    console.error('❌ خطأ فادح في main():', err.stack || err.message);
    // تنظيف
    try { await fs.remove(path.join(os.tmpdir(), 'chrome-profiles-*')); } catch (e) {}
});
