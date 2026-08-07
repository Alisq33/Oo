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
const WAIT_TIME = 90; // 90 ثانية (دقيقة ونصف)
const DRAG_INTERVAL = 3000; // 3 ثوان بين كل سحب
const MAX_LOBBY_ATTEMPTS = 25; // عدد محاولات إنشاء اللوبي
const RETRY_WAIT = 90; // انتظار 90 ثانية بعد فشل 25 محاولة

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

// ===== دوال API (نفسها مع إضافة بعض التحسينات) =====
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

async function createLobby(token, attempt) {
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
        console.log(`✅ تم إنشاء اللوبي (محاولة ${attempt}): ${data.id}`);
        return data.id;
    } catch (e) {
        console.error(`❌ فشل إنشاء اللوبي (محاولة ${attempt}):`, e.message);
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
            console.log(`✅ الحساب الضيف انضم إلى ${lobbyId}`);
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
async function navigateToLobby(page, token, accountName, lobbyId) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/golden_goal/1.3.14/index.html?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
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

async function performDrag(page, accountName) {
    try {
        console.log(`[${accountName}] 🖱️ السحب من (300,338) إلى (264,470)...`);
        await page.mouse.move(300, 338);
        await sleep(200);
        await page.mouse.down();
        await sleep(300);
        await page.mouse.move(264, 470, { steps: 15 });
        await sleep(300);
        await page.mouse.up();
        console.log(`[${accountName}] ✅ تم السحب.`);
    } catch (e) {
        console.error(`[${accountName}] خطأ في السحب:`, e.message);
    }
}

// ===== الدالة الرئيسية المعدلة =====
async function main() {
    let browser1, browser2;
    let tempDir1, tempDir2;
    let dragInterval = null;
    let stopDragging = false; // للتحكم في إيقاف التكرار

    // تنظيف عند الخروج
    const cleanup = () => {
        if (dragInterval) clearInterval(dragInterval);
        if (tempDir1) deleteTempDir(tempDir1);
        if (tempDir2) deleteTempDir(tempDir2);
        try { if (browser1) browser1.close(); } catch (e) {}
        try { if (browser2) browser2.close(); } catch (e) {}
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

        // فتح المتصفحين (مرة واحدة وإعادة استخدامهما)
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
                    await sleep(2000); // انتظار بسيط بين المحاولات
                }
            }

            if (!lobbyId) {
                // فشل بعد 25 محاولة
                console.log(`❌ فشل إنشاء اللوبي بعد ${MAX_LOBBY_ATTEMPTS} محاولة، ننتظر ${RETRY_WAIT} ثانية ثم نعيد الدورة`);
                // حذف الجلسات (اختياري)
                await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
                await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
                await sleep(RETRY_WAIT * 1000);
                continue; // العودة إلى بداية الحلقة
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

            // 5. فتح صفحات جديدة في المتصفحين (نغلق القديمة إن وجدت)
            // نفتح صفحة جديدة لكل متصفح
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

            console.log("⏳ انتظار 3 ثوانٍ بعد الحقن لضمان ظهور اللعبة...");
            await sleep(3000);

            // 8. بدء السحب المتكرر لمدة WAIT_TIME (90 ثانية)
            console.log(`🔄 بدء السحب كل ${DRAG_INTERVAL/1000} ثانية لمدة ${WAIT_TIME} ثانية...`);
            stopDragging = false;
            const dragStartTime = Date.now();
            // نستخدم setInterval مع شرط الإيقاف
            dragInterval = setInterval(async () => {
                if (stopDragging) return;
                await performDrag(page2, "الحساب الضيف");
            }, DRAG_INTERVAL);

            // انتظار المدة المحددة
            await sleep(WAIT_TIME * 1000);

            // 9. إيقاف التكرار
            stopDragging = true;
            if (dragInterval) {
                clearInterval(dragInterval);
                dragInterval = null;
            }
            console.log("⏹️ تم إيقاف التكرار.");

            // 10. إغلاق الصفحات (بدون خروج) وعدم حذف الجلسات (سنعيد استخدامها؟)
            // لكننا سنغلق الصفحات فقط
            await page1.close();
            await page2.close();
            console.log("🗑️ تم إغلاق الصفحات.");

            // 11. حذف الجلسات (ننهيها نظيفاً)
            await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");
            await deleteSession(TOKEN_GUEST, sessionGuest, "الحساب الضيف");
            console.log("✅ تم إنهاء الجلسات.");

            // 12. ننتظر قليلاً قبل الدورة التالية (اختياري)
            await sleep(3000);
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
