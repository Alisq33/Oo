const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const TOKEN_HOST = "576a2902-db16-4e9f-b503-3da6ba4bf78a";
const USER_ID_HOST = 80055399;

const TOKEN_GUEST = "WE-e8e2272d-962c-493a-8e99-afed2959e588";
const USER_ID_GUEST = 51660277;

const GROUP_ID = 18432094;

// ============================================================
// إعدادات Golden Goal
// ============================================================

const EXPERIENCE_ID = 9;
const EXPERIENCE_VERSION = "4.8.14";
const EXPERIENCE_BUILD_TYPE = "release";
const LANGUAGE_ID = "1";

const GAME_URL =
    `https://experiences.wolfservices.production.wolf.live/experience/golden_goal/${EXPERIENCE_VERSION}/index.html`;

const WAIT_TIME = 90;
const DRAG_INTERVAL = 3000;

const MAX_LOBBY_ATTEMPTS = 25;
const RETRY_WAIT = 90;

// ============================================================
// التحقق من التوكنات
// ============================================================

if (!TOKEN_HOST) {
    console.error("❌ TOKEN_HOST غير موجود.");
    console.error("استخدم:");
    console.error("set TOKEN_HOST=YOUR_HOST_TOKEN");
    process.exit(1);
}

if (!TOKEN_GUEST) {
    console.error("❌ TOKEN_GUEST غير موجود.");
    console.error("استخدم:");
    console.error("set TOKEN_GUEST=YOUR_GUEST_TOKEN");
    process.exit(1);
}

// ============================================================
// User Agent
// ============================================================

const USER_AGENT =
    'Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ' +
    'Chrome/150.0.7871.124 Mobile Safari/537.36';

// ============================================================
// Headers
// ============================================================

const baseHeaders = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",

    "experience-id": String(EXPERIENCE_ID),
    "experience-build-type": EXPERIENCE_BUILD_TYPE,
    "experience-build-version": EXPERIENCE_VERSION,

    "language-id": LANGUAGE_ID,

    "user-agent": USER_AGENT,
    "content-type": "application/json",
    "Accept": "*/*",

    "Origin":
        "https://experiences.wolfservices.production.wolf.live",

    "X-Requested-With":
        "com.palringo.android"
};

// ============================================================
// Helpers
// ============================================================

const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

function deleteTempDir(dir) {
    try {
        if (dir && fs.existsSync(dir)) {
            fs.rmSync(dir, {
                recursive: true,
                force: true
            });

            console.log(`🗑️ تم حذف المجلد المؤقت: ${dir}`);
        }
    } catch (e) {
        console.warn(
            `⚠️ فشل حذف المجلد المؤقت ${dir}:`,
            e.message
        );
    }
}

// ============================================================
// إنشاء Experience Session
// ============================================================

async function createSession(token, accountName) {

    console.log(
        `[${accountName}] جاري إنشاء جلسة ${EXPERIENCE_VERSION}...`
    );

    const headers = {
        ...baseHeaders,
        "authorization": `Bearer ${token}`
    };

    const body = {
        experienceId: EXPERIENCE_ID,

        experienceBuildType:
            EXPERIENCE_BUILD_TYPE,

        experienceBuildVersion:
            EXPERIENCE_VERSION,

        platform: "android",

        contextType: "group",

        contextId: GROUP_ID,

        screenState: "full",

        screenStatePreviously: "full",

        data: ""
    };

    try {

        const res = await fetch(
            "https://experience.palringo.com/experience/session",
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            }
        );

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        const sessionToken = data.token;

        if (!sessionToken) {
            throw new Error("لم يرجع السيرفر session token");
        }

        // تفعيل الجلسة
        const activateRes = await fetch(
            `https://experience.palringo.com/experience/session/token/${sessionToken}`,
            {
                method: "PUT",
                headers,
                body: JSON.stringify(body)
            }
        );

        if (!activateRes.ok) {
            throw new Error(
                `فشل تفعيل الجلسة HTTP ${activateRes.status}`
            );
        }

        console.log(
            `[${accountName}] ✅ تم إنشاء وتفعيل الجلسة`
        );

        return sessionToken;

    } catch (e) {

        console.error(
            `[${accountName}] ❌ خطأ في الجلسة:`,
            e.message
        );

        return null;
    }
}

// ============================================================
// حذف الجلسة
// ============================================================

async function deleteSession(
    token,
    sessionToken,
    accountName
) {

    if (!sessionToken) {
        return false;
    }

    const headers = {
        ...baseHeaders,
        "authorization": `Bearer ${token}`
    };

    try {

        const res = await fetch(
            `https://experience.palringo.com/experience/session/token/${sessionToken}`,
            {
                method: "DELETE",
                headers
            }
        );

        if (res.status === 204) {

            console.log(
                `[${accountName}] ✅ تم إنهاء الجلسة`
            );

            return true;
        }

        console.warn(
            `[${accountName}] ⚠️ حذف الجلسة أعاد HTTP ${res.status}`
        );

    } catch (e) {

        console.error(
            `[${accountName}] ❌ خطأ أثناء حذف الجلسة:`,
            e.message
        );
    }

    return false;
}

// ============================================================
// إنشاء Lobby
// ============================================================

async function createLobby(token, attempt) {

    const headers = {
        ...baseHeaders,
        "authorization": `Bearer ${token}`
    };

    const body = {
        typeId: 13,

        groupId: GROUP_ID,

        visibility: "global",

        access: "public",

        displayName: "ㅤ⚽ Penalty Shootout ㅤ",

        data: "",

        ownerUserData: "",

        ownerPlayerIp:
            "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b"
    };

    try {

        const res = await fetch(
            "https://experience.palringo.com/lobby",
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            }
        );

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        console.log(
            `✅ تم إنشاء اللوبي ${data.id} ` +
            `(محاولة ${attempt})`
        );

        return data.id;

    } catch (e) {

        console.error(
            `❌ فشل إنشاء اللوبي (محاولة ${attempt}):`,
            e.message
        );

        return null;
    }
}

// ============================================================
// انضمام الضيف
// ============================================================

async function joinLobby(token, lobbyId) {

    const headers = {
        ...baseHeaders,
        "authorization": `Bearer ${token}`
    };

    const body = {
        data: "",

        playerIp:
            "2001:16a2:3006:9b00:a1a3:23e2:1385:b71b"
    };

    try {

        const res = await fetch(
            `https://experience.palringo.com/lobby/id/${lobbyId}/user`,
            {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            }
        );

        if (res.status === 200) {

            console.log(
                `✅ الحساب الضيف انضم إلى اللوبي ${lobbyId}`
            );

            return true;
        }

        console.error(
            `❌ فشل انضمام الضيف HTTP ${res.status}`
        );

    } catch (e) {

        console.error(
            "❌ خطأ في الانضمام:",
            e.message
        );
    }

    return false;
}

// ============================================================
// بدء اللعبة
// ============================================================

async function startGame(token, lobbyId) {

    const headers = {
        ...baseHeaders,

        "authorization":
            `Bearer ${token}`,

        "content-length":
            "0"
    };

    try {

        const startRes = await fetch(
            `https://experience.palringo.com/lobby/id/${lobbyId}/start`,
            {
                method: "POST",
                headers
            }
        );

        console.log(
            `🎮 Start Lobby HTTP ${startRes.status}`
        );

        if (!startRes.ok) {
            throw new Error(
                `فشل start HTTP ${startRes.status}`
            );
        }

        const closeRes = await fetch(
            `https://experience.palringo.com/lobby/id/${lobbyId}/close`,
            {
                method: "POST",
                headers
            }
        );

        console.log(
            `🔒 Close Lobby HTTP ${closeRes.status}`
        );

        console.log(
            `✅ تم بدء اللوبي ${lobbyId}`
        );

        return true;

    } catch (e) {

        console.error(
            "❌ خطأ في بدء اللعبة:",
            e.message
        );

        return false;
    }
}

// ============================================================
// فتح اللعبة
// ============================================================

async function navigateToLobby(
    page,
    token,
    accountName,
    lobbyId
) {

    await page.setUserAgent(USER_AGENT);

    await page.setExtraHTTPHeaders({

        "Authorization":
            `Bearer ${token}`,

        "Origin":
            "https://experiences.wolfservices.production.wolf.live",

        "X-Requested-With":
            "com.palringo.android"
    });

    const url =
        `${GAME_URL}?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;

    console.log(
        `[${accountName}] 🌐 فتح اللعبة:`
    );

    console.log(url);

    await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    await page.setCacheEnabled(true);

    console.log(
        `[${accountName}] ✅ تم تحميل ${EXPERIENCE_VERSION}`
    );
}

// ============================================================
// حقن بيانات الحساب
// ============================================================

async function injectData(
    page,
    token,
    userId,
    accountName,
    lobbyId
) {

    await page.evaluate(
        (
            token,
            userId,
            groupId,
            lobbyId
        ) => {

            // ==================================================
            // Gamepad compatibility layer
            // ==================================================

            window.Gamepad = {

                _listeners: {},

                on: function(event, cb) {

                    if (!this._listeners[event]) {
                        this._listeners[event] = [];
                    }

                    this._listeners[event].push(cb);
                },

                emit: function(event, data) {

                    try {

                        if (event === "setUserData") {

                            const parsed =
                                typeof data === "string"
                                    ? JSON.parse(data)
                                    : data;

                            window.__userData = parsed;

                            setTimeout(() => {

                                window.postMessage(
                                    {
                                        type:
                                            "experienceStateChanged",

                                        args: {
                                            experienceState:
                                                "ready"
                                        }
                                    },
                                    "*"
                                );

                            }, 500);
                        }

                    } catch (e) {

                        console.warn(
                            "Gamepad.emit error:",
                            e
                        );
                    }
                },

                localEmit: function(event, data) {

                    try {

                        if (event === "setUserData") {

                            const parsed =
                                typeof data === "string"
                                    ? JSON.parse(data)
                                    : data;

                            window.__userData = parsed;

                            setTimeout(() => {

                                window.postMessage(
                                    {
                                        type:
                                            "experienceStateChanged",

                                        args: {
                                            experienceState:
                                                "ready"
                                        }
                                    },
                                    "*"
                                );

                            }, 500);
                        }

                    } catch (e) {

                        console.warn(
                            "Gamepad.localEmit error:",
                            e
                        );
                    }
                },

                showKeyboard: function() {},
                hideKeyboard: function() {},
                setKeyboardEnabled: function() {},

                showPane: function() {},
                hidePane: function() {},
                setPaneEnabled: function() {},

                openPopup: function() {},
                openPopupWithActions: function() {},

                requestInGamePurchase: function() {},

                loadExternalUrl: function() {}
            };

            // ==================================================
            // WebViewChannel
            // ==================================================

            window.WebViewChannel = {

                postMessage: function(message) {

                    try {

                        const data =
                            JSON.parse(message);

                        if (
                            data.type ===
                            "setUserData"
                        ) {

                            window.__userData =
                                data.args;

                            setTimeout(() => {

                                window.postMessage(
                                    {
                                        type:
                                            "experienceStateChanged",

                                        args: {
                                            experienceState:
                                                "ready"
                                        }
                                    },
                                    "*"
                                );

                            }, 500);
                        }

                    } catch (e) {

                        console.warn(
                            "WebViewChannel error:",
                            e
                        );
                    }
                }
            };

            // ==================================================
            // نفس البنية التي ثبت أنها تعمل في 4.8.14
            // ==================================================

            const userData = {

                platform: "android",

                contextType: "group",

                contextID:
                    groupId.toString(),

                clientToken:
                    token,

                expSessionToken:
                    token,

                externalLink: "",

                launchData: "",

                userId:
                    userId,

                lobbyId:
                    lobbyId
            };

            console.log(
                "📤 إرسال setUserData إلى Unity"
            );

            window.postMessage(
                {
                    type: "setUserData",
                    args: userData
                },
                "*"
            );

            // نفس التوافق المستخدم في الكود القديم
            window.Gamepad.localEmit(
                "setUserData",
                userData
            );

            window.Gamepad.emit(
                "setUserData",
                userData
            );

        },

        token,
        userId,
        GROUP_ID,
        lobbyId
    );

    await sleep(1000);

    console.log(
        `[${accountName}] ✅ تم حقن setUserData`
    );
}

// ============================================================
// السحب
// ============================================================

async function performDrag(
    page,
    accountName
) {

    try {

        console.log(
            `[${accountName}] 🖱️ السحب من (300,338) إلى (264,470)...`
        );

        await page.mouse.move(
            300,
            338
        );

        await sleep(200);

        await page.mouse.down();

        await sleep(300);

        await page.mouse.move(
            264,
            470,
            {
                steps: 15
            }
        );

        await sleep(300);

        await page.mouse.up();

        console.log(
            `[${accountName}] ✅ تم السحب`
        );

    } catch (e) {

        console.error(
            `[${accountName}] ❌ خطأ في السحب:`,
            e.message
        );
    }
}

// ============================================================
// MAIN
// ============================================================

async function main() {

    let browser1 = null;
    let browser2 = null;

    let tempDir1 = null;
    let tempDir2 = null;

    let dragInterval = null;

    let stopDragging = false;

    // ========================================================
    // Cleanup
    // ========================================================

    const cleanup = async () => {

        if (dragInterval) {

            clearInterval(
                dragInterval
            );

            dragInterval = null;
        }

        try {

            if (browser1) {
                await browser1.close();
            }

        } catch (e) {}

        try {

            if (browser2) {
                await browser2.close();
            }

        } catch (e) {}

        if (tempDir1) {
            deleteTempDir(tempDir1);
        }

        if (tempDir2) {
            deleteTempDir(tempDir2);
        }
    };

    process.on(
        "SIGINT",
        async () => {

            console.log(
                "\n🛑 إيقاف البرنامج..."
            );

            await cleanup();

            process.exit(0);
        }
    );

    process.on(
        "SIGTERM",
        async () => {

            await cleanup();

            process.exit(0);
        }
    );

    try {

        console.log(
            "========================================"
        );

        console.log(
            `🐺 Golden Goal ${EXPERIENCE_VERSION}`
        );

        console.log(
            "========================================"
        );

        // ====================================================
        // مجلدات المتصفحات
        // ====================================================

        tempDir1 = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "puppeteer-host-"
            )
        );

        tempDir2 = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                "puppeteer-guest-"
            )
        );

        console.log(
            `📁 Host profile: ${tempDir1}`
        );

        console.log(
            `📁 Guest profile: ${tempDir2}`
        );

        // ====================================================
        // Browser 1
        // ====================================================

        console.log(
            "🚀 فتح متصفح الحساب المنشئ..."
        );

        browser1 = await puppeteer.launch({

            headless: "new",

            userDataDir:
                tempDir1,

            args: [

                "--disable-web-security",

                "--no-sandbox",

                "--disable-setuid-sandbox",

                "--window-size=600,600",

                "--disable-session-crashed-bubble",

                "--disable-features=TranslateUI"
            ]
        });

        // ====================================================
        // Browser 2
        // ====================================================

        console.log(
            "🚀 فتح متصفح الحساب الضيف..."
        );

        browser2 = await puppeteer.launch({

            headless: "new",

            userDataDir:
                tempDir2,

            args: [

                "--disable-web-security",

                "--no-sandbox",

                "--disable-setuid-sandbox",

                "--window-size=600,600",

                "--disable-session-crashed-bubble",

                "--disable-features=TranslateUI"
            ]
        });

        // ====================================================
        // Loop
        // ====================================================

        let cycleCount = 0;

        while (true) {

            cycleCount++;

            console.log(
                `\n========== الدورة ${cycleCount} ==========`
            );

            // ==================================================
            // 1. Host Session
            // ==================================================

            const sessionHost =
                await createSession(
                    TOKEN_HOST,
                    "الحساب المنشئ"
                );

            if (!sessionHost) {

                console.log(
                    `❌ فشل جلسة المنشئ، انتظار ${RETRY_WAIT} ثانية...`
                );

                await sleep(
                    RETRY_WAIT * 1000
                );

                continue;
            }

            // ==================================================
            // 2. Guest Session
            // ==================================================

            const sessionGuest =
                await createSession(
                    TOKEN_GUEST,
                    "الحساب الضيف"
                );

            if (!sessionGuest) {

                console.log(
                    `❌ فشل جلسة الضيف، انتظار ${RETRY_WAIT} ثانية...`
                );

                await deleteSession(
                    TOKEN_HOST,
                    sessionHost,
                    "الحساب المنشئ"
                );

                await sleep(
                    RETRY_WAIT * 1000
                );

                continue;
            }

            // ==================================================
            // 3. إنشاء Lobby
            // ==================================================

            let lobbyId = null;

            let attempts = 0;

            while (
                attempts <
                    MAX_LOBBY_ATTEMPTS &&
                !lobbyId
            ) {

                attempts++;

                lobbyId =
                    await createLobby(
                        TOKEN_HOST,
                        attempts
                    );

                if (!lobbyId) {

                    console.log(
                        `⚠️ المحاولة ${attempts}/${MAX_LOBBY_ATTEMPTS} فشلت`
                    );

                    await sleep(2000);
                }
            }

            if (!lobbyId) {

                console.log(
                    `❌ فشل إنشاء اللوبي بعد ${MAX_LOBBY_ATTEMPTS} محاولة`
                );

                await deleteSession(
                    TOKEN_HOST,
                    sessionHost,
                    "الحساب المنشئ"
                );

                await deleteSession(
                    TOKEN_GUEST,
                    sessionGuest,
                    "الحساب الضيف"
                );

                await sleep(
                    RETRY_WAIT * 1000
                );

                continue;
            }

            // ==================================================
            // 4. Join Guest
            // ==================================================

            const joined =
                await joinLobby(
                    TOKEN_GUEST,
                    lobbyId
                );

            if (!joined) {

                console.log(
                    "❌ فشل انضمام الضيف"
                );

                await deleteSession(
                    TOKEN_HOST,
                    sessionHost,
                    "الحساب المنشئ"
                );

                await deleteSession(
                    TOKEN_GUEST,
                    sessionGuest,
                    "الحساب الضيف"
                );

                await sleep(
                    RETRY_WAIT * 1000
                );

                continue;
            }

            // ==================================================
            // 5. Start
            // ==================================================

            const started =
                await startGame(
                    TOKEN_HOST,
                    lobbyId
                );

            if (!started) {

                console.log(
                    "❌ فشل بدء اللوبي"
                );

                await deleteSession(
                    TOKEN_HOST,
                    sessionHost,
                    "الحساب المنشئ"
                );

                await deleteSession(
                    TOKEN_GUEST,
                    sessionGuest,
                    "الحساب الضيف"
                );

                await sleep(
                    RETRY_WAIT * 1000
                );

                continue;
            }

            // ==================================================
            // 6. فتح الصفحات
            // ==================================================

            const page1 =
                await browser1.newPage();

            const page2 =
                await browser2.newPage();

            await page1.setViewport({
                width: 600,
                height: 600
            });

            await page2.setViewport({
                width: 600,
                height: 600
            });

            // ==================================================
            // 7. فتح Golden Goal 4.8.14
            // ==================================================

            await Promise.all([

                navigateToLobby(
                    page1,
                    TOKEN_HOST,
                    "الحساب المنشئ",
                    lobbyId
                ),

                navigateToLobby(
                    page2,
                    TOKEN_GUEST,
                    "الحساب الضيف",
                    lobbyId
                )
            ]);

            // ==================================================
            // 8. انتظار تحميل Unity
            // ==================================================

            console.log(
                "⏳ انتظار 5 ثوانٍ قبل setUserData..."
            );

            await sleep(5000);

            // ==================================================
            // 9. حقن الحسابات
            // ==================================================

            console.log(
                "📤 حقن setUserData في الإصدار 4.8.14..."
            );

            await Promise.all([

                injectData(
                    page1,
                    TOKEN_HOST,
                    USER_ID_HOST,
                    "الحساب المنشئ",
                    lobbyId
                ),

                injectData(
                    page2,
                    TOKEN_GUEST,
                    USER_ID_GUEST,
                    "الحساب الضيف",
                    lobbyId
                )
            ]);

            // ==================================================
            // 10. انتظار اللعبة
            // ==================================================

            console.log(
                "⏳ انتظار 3 ثوانٍ..."
            );

            await sleep(3000);

            // ==================================================
            // 11. Drag Loop
            // ==================================================

            console.log(
                `🔄 بدء السحب كل ${DRAG_INTERVAL / 1000} ثانية لمدة ${WAIT_TIME} ثانية...`
            );

            stopDragging = false;

            dragInterval =
                setInterval(
                    async () => {

                        if (
                            stopDragging
                        ) {
                            return;
                        }

                        await performDrag(
                            page2,
                            "الحساب الضيف"
                        );

                    },
                    DRAG_INTERVAL
                );

            await sleep(
                WAIT_TIME * 1000
            );

            // ==================================================
            // 12. Stop Drag
            // ==================================================

            stopDragging = true;

            if (dragInterval) {

                clearInterval(
                    dragInterval
                );

                dragInterval = null;
            }

            console.log(
                "⏹️ تم إيقاف السحب"
            );

            // ==================================================
            // 13. إغلاق الصفحات
            // ==================================================

            try {
                await page1.close();
            } catch (e) {}

            try {
                await page2.close();
            } catch (e) {}

            console.log(
                "🗑️ تم إغلاق صفحات اللعبة"
            );

            // ==================================================
            // 14. حذف Sessions
            // ==================================================

            await deleteSession(
                TOKEN_HOST,
                sessionHost,
                "الحساب المنشئ"
            );

            await deleteSession(
                TOKEN_GUEST,
                sessionGuest,
                "الحساب الضيف"
            );

            console.log(
                "✅ تم إنهاء جلسات الدورة"
            );

            // ==================================================
            // 15. انتظار قبل الدورة التالية
            // ==================================================

            await sleep(3000);
        }

    } catch (e) {

        console.error(
            "❌ خطأ رئيسي:",
            e.message
        );

        console.error(
            e.stack
        );

        await cleanup();

        process.exit(1);
    }
}

main();
