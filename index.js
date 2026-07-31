const puppeteer = require('puppeteer');

// ===== بيانات الحسابات =====
const TOKEN_1 = "576a2902-db16-4e9f-b503-3da6ba4bf78a";
const USER_ID_1 = 80055399;

const TOKEN_2 = "6c278a87-a015-4bbc-b963-6e7196e2c652";
const USER_ID_2 = 51660277;

const GROUP_ID = 18432094;

// ===== رؤوس HTTP =====
const baseHeaders = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",
    "experience-id": "5",
    "experience-build-type": "release",
    "sec-ch-ua-platform": '"Android"',
    "sec-ch-ua": '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"',
    "sec-ch-ua-mobile": "?1",
    "experience-build-version": "2.11.0",
    "language-id": "1",
    "user-agent": "Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36",
    "content-type": "application/json",
    "Accept": "*/*",
    "Origin": "https://experiences.wolfservices.production.wolf.live",
    "X-Requested-With": "com.palringo.android"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== 1. إنشاء جلسة حساب =====
async function initializeAccountSession(token, accountName) {
    console.log(`[${accountName}] جاري إنشاء الجلسة...`);
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    try {
        const res = await fetch("https://experience.palringo.com/experience/session", {
            method: "POST",
            headers,
            body: JSON.stringify({
                experienceId: 5,
                experienceBuildType: "release",
                experienceBuildVersion: "2.11.0",
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
                        experienceId: 5,
                        experienceBuildType: "release",
                        experienceBuildVersion: "2.11.0",
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
        }
    } catch (e) {
        console.error(`[${accountName}] خطأ:`, e.message);
    }
    return null;
}

// ===== 2. إنشاء لوبي =====
async function createLobby(token) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const res = await fetch("https://experience.palringo.com/lobby", {
        method: "POST",
        headers,
        body: JSON.stringify({
            typeId: 4,
            groupId: GROUP_ID,
            visibility: "global",
            access: "public",
            displayName: "ㅤ🐈⬛ ㅤ",
            data: "",
            ownerUserData: "",
            ownerPlayerIp: "188.52.62.51"
        })
    });
    const data = await res.json();
    return data.id;
}

// ===== 3. انضمام حساب إلى لوبي =====
async function joinLobby(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}` };
    const res = await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/user`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: "", playerIp: "2001:16a2:32c0:b300:50f:fbd0:fd5a:d326" })
    });
    return res.status === 200;
}

// ===== 4. بدء اللعبة عبر API =====
async function startGame(token, lobbyId) {
    const headers = { ...baseHeaders, "authorization": `Bearer ${token}`, "content-length": "0" };
    console.log(`[API] جاري بدء اللوبي ${lobbyId}...`);
    await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/start`, { method: "POST", headers });
    await fetch(`https://experience.palringo.com/lobby/id/${lobbyId}/close`, { method: "POST", headers });
    console.log(`[API] ✅ تم إرسال Start & Close`);
}

// ===== 5. تشغيل متصفح (متوافق مع سيرفرات قيت هب) =====
async function runGameInBrowser(token, userId, accountName, lobbyId, gameStartTimestamp) {
    console.log(`[${accountName}] 🚀 تشغيل متصفح (Headless)...`);
    const browser = await puppeteer.launch({
        headless: true, // ✅ يجب أن يكون true ليعمل على سيرفرات قيت هب
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--window-size=800,600'
        ],
        defaultViewport: { width: 800, height: 600 }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });

    const url = `https://experiences.wolfservices.production.wolf.live/experience/lonoo/2.11.0/index.html?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
    console.log(`[${accountName}] 🌐 فتح ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log(`[${accountName}] ⏳ انتظار 15 ثانية لتحميل اللعبة...`);
    await sleep(15000);

    // ===== حقن WebViewChannel و Gamepad =====
    console.log(`[${accountName}] 📤 حقن WebViewChannel وإرسال البيانات...`);
    await page.evaluate((token, userId, groupId, lobbyId) => {
        if (!window.Gamepad) {
            window.Gamepad = {
                emit: function(ev, data) { console.log('[Gamepad] emit', ev, data); },
                localEmit: function(ev, data) { console.log('[Gamepad] localEmit', ev, data); }
            };
        }
        window.WebViewChannel = {
            postMessage: function(message) {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'setUserData') {
                        window.__userData = data.args;
                        setTimeout(() => {
                            window.postMessage({ type: 'experienceStateChanged', args: { experienceState: 'ready' } }, '*');
                        }, 500);
                        setTimeout(() => {
                            window.postMessage({ type: 'startGame', args: { lobbyId: data.args.lobbyId } }, '*');
                        }, 1000);
                        setTimeout(() => {
                            window.postMessage({ type: 'screenStateChanged', args: { screenState: 'full' } }, '*');
                        }, 1500);
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
        if (window.Gamepad) {
            window.Gamepad.localEmit('setUserData', userData);
        }
        console.log('✅ تم إرسال setUserData');
    }, token, userId, GROUP_ID, lobbyId);

    console.log(`[${accountName}] ⏳ بدء حلقة سحب الورق (كل 3 ثوانٍ)...`);

    const drawInterval = setInterval(async () => {
        try {
            await page.evaluate(() => {
                const btns = document.querySelectorAll('button, [role="button"]');
                for (let b of btns) {
                    const txt = b.innerText || '';
                    if (txt.includes('Draw') || txt.includes('سحب') || txt.includes('Pick') || txt.includes('Card')) {
                        b.click();
                        console.log('🃏 [زر] تم سحب ورق');
                        return;
                    }
                }
                window.postMessage({ type: 'drawCard', args: {} }, '*');
                window.postMessage({ type: 'draw', args: {} }, '*');
                window.postMessage({ type: 'pickCard', args: {} }, '*');
                if (window.Gamepad) {
                    window.Gamepad.emit('drawCard', {});
                    window.Gamepad.localEmit('drawCard', {});
                    window.Gamepad.emit('draw', {});
                    window.Gamepad.localEmit('draw', {});
                }
                console.log('🃏 [أمر] تم إرسال أوامر السحب');
            });
        } catch (e) {}
    }, 3000);

    const now = Date.now();
    const elapsed = (now - gameStartTimestamp) / 1000;
    const remaining = Math.max(0, 120 - elapsed);
    console.log(`[${accountName}] ⏳ انقضى ${elapsed.toFixed(1)} ثانية، متبقي ${remaining.toFixed(1)} ثانية للانسحاب.`);
    if (remaining > 0) await sleep(remaining * 1000);

    clearInterval(drawInterval);
    if (accountName === "الحساب الأول") {
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
                if (txt.includes('Back') || txt.includes('خروج') || txt.includes('Exit') || txt.includes('Confirm')) {
                    b.click();
                }
            }
        });
        await sleep(3000);
    }

    await browser.close();
    console.log(`[${accountName}] 🛑 إغلاق المتصفح.`);
}

// ===================== MAIN =====================
async function main() {
    try {
        const session1 = await initializeAccountSession(TOKEN_1, "الحساب الأول");
        if (!session1) return;
        const session2 = await initializeAccountSession(TOKEN_2, "الحساب الثاني");
        if (!session2) return;

        console.log("[الحساب الأول] جاري إنشاء اللوبي...");
        const lobbyId = await createLobby(TOKEN_1);
        console.log(`✅ تم إنشاء اللوبي: ${lobbyId}`);

        console.log("[الحساب الثاني] جاري الانضمام إلى اللوبي...");
        const joined = await joinLobby(TOKEN_2, lobbyId);
        if (!joined) {
            console.log("❌ فشل انضمام الحساب الثاني.");
            return;
        }
        console.log("✅ الحساب الثاني انضم");

        await startGame(TOKEN_1, lobbyId);
        const gameStartTimestamp = Date.now();

        console.log("🚀 تشغيل المتصفحين...");
        const task1 = runGameInBrowser(TOKEN_1, USER_ID_1, "الحساب الأول", lobbyId, gameStartTimestamp);
        await sleep(3000);
        const task2 = runGameInBrowser(TOKEN_2, USER_ID_2, "الحساب الثاني", lobbyId, gameStartTimestamp);

        await Promise.all([task1, task2]);

        console.log("✅ تمت العملية بنجاح.");
    } catch (e) {
        console.error("❌ خطأ رئيسي:", e.message);
        console.error(e.stack);
    }
}

main();
