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
const WAIT_TIME = 145; // 145 ثانية قبل الخروج
const DRAG_INTERVAL = 3000; // 3 ثوان بين كل سحب

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

// ===== 1. إنشاء جلسة =====
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

// ===== 2. حذف الجلسة (DELETE) =====
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

// ===== 3. إنشاء لوبي (Penalty Shootout - typeId=13) =====
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
        console.log(`✅ تم إنشاء اللوبي (typeId=13): ${data.id}`);
        return data.id;
    } catch (e) {
        console.error("❌ فشل إنشاء اللوبي:", e.message);
        return null;
    }
}

// ===== 4. انضمام =====
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

// ===== 5. بدء اللعبة =====
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

// ===== 6. فتح اللوبي في المتصفح =====
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

// ===== 7. حقن البيانات =====
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

// ===== 8. الخروج (surrender) =====
async function surrender(page, accountName) {
    console.log(`[${accountName}] 📤 إرسال أمر الخروج...`);
    await page.evaluate(() => {
        window.postMessage({ type: 'requestExit', args: '{}' }, '*');
        if (window.Gamepad) {
            window.Gamepad.emit('requestExit', {});
            window.Gamepad.localEmit('requestExit', {});
        }
        const btns = document.querySelectorAll('button');
        for (let b of btns) {
            const txt = b.innerText || '';
            if (/back|خروج|exit/i.test(txt)) {
                b.click();
                break;
            }
        }
    });
    await sleep(2000);
    try {
        await page.waitForSelector('button', { timeout: 3000 });
        await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (let b of btns) {
                const txt = b.innerText || '';
                if (/نعم|yes|confirm|تأكيد/i.test(txt)) {
                    b.click();
                    break;
                }
            }
        });
        console.log(`[${accountName}] ✅ تم تأكيد الخروج.`);
    } catch (e) {
        console.log(`[${accountName}] ℹ️ لم تظهر رسالة تأكيد، تم الخروج مباشرة.`);
    }
    await sleep(3000);
}

// ===== 9. دالة السحب المتكرر =====
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

// ===== الدالة الرئيسية =====
async function main() {
    let browser1, browser2;
    let tempDir1, tempDir2;
    let dragInterval = null;

    // تنظيف المجلدات المؤقتة عند الخروج
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
        // 1. إنشاء الجلسات
        const sessionHost = await createSession(TOKEN_HOST, "الحساب المنشئ");
        if (!sessionHost) throw new Error("فشل جلسة المنشئ");
        const sessionGuest = await createSession(TOKEN_GUEST, "الحساب الضيف");
        if (!sessionGuest) throw new Error("فشل جلسة الضيف");

        // 2. إنشاء لوبي Penalty Shootout
        const lobbyId = await createLobby(TOKEN_HOST);
        if (!lobbyId) throw new Error("فشل إنشاء اللوبي");
        console.log(`✅ اللوبي: ${lobbyId}`);

        // 3. انضمام الحساب الضيف
        const joined = await joinLobby(TOKEN_GUEST, lobbyId);
        if (!joined) throw new Error("فشل انضمام الضيف");

        // 4. بدء اللعبة
        await startGame(TOKEN_HOST, lobbyId);

        // 5. إنشاء مجلدات مؤقتة فريدة لكل متصفح
        tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'));
        console.log(`📁 مجلد مؤقت 1: ${tempDir1}`);
        console.log(`📁 مجلد مؤقت 2: ${tempDir2}`);

        // 6. فتح المتصفحات في وضع headless (لـ GitHub Actions)
        console.log("🚀 فتح المتصفحين في وضع headless...");
        browser1 = await puppeteer.launch({
            headless: 'new', // أو true
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

        const page1 = await browser1.newPage();
        const page2 = await browser2.newPage();
        await page1.setViewport({ width: 600, height: 600 });
        await page2.setViewport({ width: 600, height: 600 });

        // 7. الانتقال إلى اللوبي
        await Promise.all([
            navigateToLobby(page1, TOKEN_HOST, "الحساب المنشئ", lobbyId),
            navigateToLobby(page2, TOKEN_GUEST, "الحساب الضيف", lobbyId)
        ]);

        console.log("⏳ انتظار 5 ثوانٍ قبل حقن البيانات...");
        await sleep(5000);

        // 8. حقن البيانات (تسجيل وقت البدء)
        console.log("📤 حقن البيانات...");
        const startTime = Date.now();
        await Promise.all([
            injectData(page1, TOKEN_HOST, USER_ID_HOST, "الحساب المنشئ", lobbyId),
            injectData(page2, TOKEN_GUEST, USER_ID_GUEST, "الحساب الضيف", lobbyId)
        ]);

        // 9. بدء التكرار كل 3 ثوانٍ
        console.log("⏳ انتظار 3 ثوانٍ بعد الحقن لضمان ظهور اللعبة...");
        await sleep(3000);
        console.log("🔄 بدء السحب المتكرر كل 3 ثوانٍ...");

        dragInterval = setInterval(async () => {
            await performDrag(page2, "الحساب الضيف");
        }, DRAG_INTERVAL);

        // 10. انتظار المدة المتبقية حتى الخروج (145 ثانية من وقت الحقن)
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, WAIT_TIME - elapsed);
        console.log(`⏳ انتظار ${remaining.toFixed(1)} ثانية حتى الخروج...`);
        if (remaining > 0) await sleep(remaining * 1000);

        // 11. إيقاف التكرار
        if (dragInterval) {
            clearInterval(dragInterval);
            dragInterval = null;
        }
        console.log("⏹️ تم إيقاف التكرار.");

        // 12. الخروج للحساب المنشئ فقط
        await surrender(page1, "الحساب المنشئ");

        // 13. حذف جلسة المنشئ (DELETE)
        await deleteSession(TOKEN_HOST, sessionHost, "الحساب المنشئ");

        // 14. إغلاق المتصفحات (سيتم حذف المجلدات المؤقتة تلقائياً بواسطة cleanup)
        await browser1.close();
        await browser2.close();

        console.log("✅ تمت العملية بنجاح.");
    } catch (e) {
        console.error("❌ خطأ رئيسي:", e.message);
        console.error(e.stack);
        // التأكد من التنظيف
        cleanup();
        process.exit(1);
    }
}

main();
