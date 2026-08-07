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

const ROUND_DURATION = 90;
const MAX_LOBBY_ATTEMPTS = 25;
const RETRY_WAIT = 90;
const DRAG_INTERVAL = 3000;

// ===== رؤوس HTTP (نفس السابق) =====
const baseHeaders = { /* ... */ };
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ===== دوال API (نفس السابق) =====
async function createSession(token, accountName) { /* ... */ }
async function createLobby(token) { /* ... */ }
async function joinLobby(token, lobbyId) { /* ... */ }
async function startGame(token, lobbyId) { /* ... */ }

// ===== دوال المتصفح (مشتركة) =====
async function navigateToLobby(page, token, lobbyId) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; NTH-NX9 Build/HONORNTH-N29; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/150.0.7871.124 Mobile Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Authorization': `Bearer ${token}`,
        'Origin': 'https://experiences.wolfservices.production.wolf.live',
        'X-Requested-With': 'com.palringo.android'
    });
    const url = `https://experiences.wolfservices.production.wolf.live/experience/golden_goal/1.3.14/index.html?groupId=${GROUP_ID}&lobbyId=${lobbyId}`;
    console.log(`🌐 توجيه إلى ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setCacheEnabled(true);
    console.log(`✅ تم تحميل الصفحة.`);
}

async function injectData(page, token, userId, lobbyId) {
    // نفس الكود السابق
    await page.evaluate((token, userId, groupId, lobbyId) => {
        // ... (نفس الحقن)
    }, token, userId, GROUP_ID, lobbyId);
    await sleep(1000);
}

// ===== دالة السحب (للضيف فقط) =====
async function performDrag(page) {
    try {
        await page.mouse.move(300, 338);
        await sleep(200);
        await page.mouse.down();
        await sleep(300);
        await page.mouse.move(264, 470, { steps: 15 });
        await sleep(300);
        await page.mouse.up();
    } catch (e) {
        // تجاهل
    }
}

// ===== تشغيل السحب لمدة محددة =====
async function runDragForDuration(page, durationSeconds) {
    console.log(`🔄 بدء السحب لمدة ${durationSeconds} ثانية...`);
    const endTime = Date.now() + durationSeconds * 1000;
    let interval = setInterval(async () => {
        if (Date.now() >= endTime) {
            clearInterval(interval);
            return;
        }
        await performDrag(page);
    }, DRAG_INTERVAL);
    while (Date.now() < endTime) {
        await sleep(1000);
    }
    clearInterval(interval);
    console.log(`✅ انتهت فترة السحب.`);
}

// ===== دالة حذف المجلد المؤقت =====
function deleteTempDir(dir) {
    try {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    } catch (e) {}
}

// ===== الرئيسية =====
async function main() {
    let browserHost = null, browserGuest = null;
    let pageHost = null, pageGuest = null;
    let tempDir1 = null, tempDir2 = null;
    let isRunning = true;

    const cleanup = () => {
        isRunning = false;
        if (browserHost) browserHost.close().catch(() => {});
        if (browserGuest) browserGuest.close().catch(() => {});
        if (tempDir1) deleteTempDir(tempDir1);
        if (tempDir2) deleteTempDir(tempDir2);
    };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        // 1. إنشاء مجلدات مؤقتة
        tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-host-'));
        tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-guest-'));
        console.log(`📁 مجلد المنشئ: ${tempDir1}`);
        console.log(`📁 مجلد الضيف: ${tempDir2}`);

        // 2. فتح متصفحين
        browserHost = await puppeteer.launch({
            headless: 'new',
            userDataDir: tempDir1,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=600,600']
        });
        browserGuest = await puppeteer.launch({
            headless: 'new',
            userDataDir: tempDir2,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=600,600']
        });

        pageHost = await browserHost.newPage();
        pageGuest = await browserGuest.newPage();
        await pageHost.setViewport({ width: 600, height: 600 });
        await pageGuest.setViewport({ width: 600, height: 600 });

        let round = 1;
        while (isRunning) {
            console.log(`\n🔄 === جولة ${round} ===`);

            // إنشاء جلسات
            const sessionHost = await createSession(TOKEN_HOST, "المنشئ");
            if (!sessionHost) { await sleep(30000); continue; }
            const sessionGuest = await createSession(TOKEN_GUEST, "الضيف");
            if (!sessionGuest) { await sleep(30000); continue; }

            // محاولة إنشاء لوبي
            let lobbyId = null;
            for (let attempt = 1; attempt <= MAX_LOBBY_ATTEMPTS; attempt++) {
                console.log(`[API] محاولة ${attempt}/${MAX_LOBBY_ATTEMPTS}...`);
                lobbyId = await createLobby(TOKEN_HOST);
                if (!lobbyId) { await sleep(3000); continue; }

                const joined = await joinLobby(TOKEN_GUEST, lobbyId);
                if (!joined) { lobbyId = null; await sleep(3000); continue; }

                const started = await startGame(TOKEN_HOST, lobbyId);
                if (!started) { lobbyId = null; await sleep(3000); continue; }

                console.log(`✅ تم إنشاء اللوبي: ${lobbyId}`);
                break;
            }

            if (!lobbyId) {
                console.log(`❌ فشل بعد ${MAX_LOBBY_ATTEMPTS} محاولة. انتظار ${RETRY_WAIT} ثانية...`);
                await sleep(RETRY_WAIT * 1000);
                round++;
                continue;
            }

            // توجيه كلا المتصفحين إلى اللوبي
            await Promise.all([
                navigateToLobby(pageHost, TOKEN_HOST, lobbyId),
                navigateToLobby(pageGuest, TOKEN_GUEST, lobbyId)
            ]);
            await sleep(5000);

            // حقن البيانات لكلا الحسابين
            await Promise.all([
                injectData(pageHost, TOKEN_HOST, USER_ID_HOST, lobbyId),
                injectData(pageGuest, TOKEN_GUEST, USER_ID_GUEST, lobbyId)
            ]);
            await sleep(3000);

            // تشغيل السحب للضيف فقط لمدة ROUND_DURATION
            await runDragForDuration(pageGuest, ROUND_DURATION);

            // بعد انتهاء المدة، نغلق الصفحات (أو نعيد توجيهها) – لا نضغط خروج
            console.log(`✅ انتهت الجولة ${round}. سيتم إنشاء لوبي جديد.`);
            // نغلق الصفحات الحالية ونفتح صفحات جديدة (أو نعيد التوجيه)
            await pageHost.close().catch(() => {});
            await pageGuest.close().catch(() => {});
            pageHost = await browserHost.newPage();
            pageGuest = await browserGuest.newPage();
            await pageHost.setViewport({ width: 600, height: 600 });
            await pageGuest.setViewport({ width: 600, height: 600 });

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
