import asyncio
import time
import requests
from playwright.async_api import async_playwright

TOKEN_1 = "6c278a87-a015-4bbc-b963-6e7196e2c652"
USER_ID_1 = 80055399

TOKEN_2 = "eb25248e-b0ad-489f-9d5a-103670e1ec49"
USER_ID_2 = 51660277

GROUP_ID = 18432094

base_headers = {
    "Host": "experience.palringo.com",
    "Connection": "keep-alive",
    "experience-id": "5",
    "experience-build-type": "release",
    "sec-ch-ua-platform": '"Android"',
    "sec-ch-ua": (
        '"Not;A=Brand";v="8", "Chromium";v="150", "Android WebView";v="150"'
    ),
    "sec-ch-ua-mobile": "?1",
    "experience-build-version": "2.11.0",
    "language-id": "1",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        " (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "content-type": "application/json",
    "Accept": "*/*",
    "Origin": "https://experiences.wolfservices.production.wolf.live",
    "X-Requested-With": "com.palringo.android",
    "Sec-Fetch-Site": "cross-site",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "Referer": "https://experiences.wolfservices.production.wolf.live/",
}


def initialize_account_session(session, token, account_name):
  print(f"[*] ({account_name}) جاري إنشاء الجلسة وتفعيلها...")
  res = session.post(
      "https://experience.palringo.com/experience/session",
      json={
          "experienceId": 5,
          "experienceBuildType": "release",
          "experienceBuildVersion": "2.11.0",
          "platform": "web",
          "contextType": "group",
          "contextId": GROUP_ID,
          "screenState": "partial",
          "screenStatePreviously": "partial",
          "data": "",
      },
  )
  if res.status_code == 200:
    data = res.json()
    session_token = data.get("token")
    if session_token:
      put_res = session.put(
          f"https://experience.palringo.com/experience/session/token/{session_token}",
          json={
              "experienceId": 5,
              "experienceBuildType": "release",
              "experienceBuildVersion": "2.11.0",
              "platform": "web",
              "contextType": "group",
              "contextId": GROUP_ID,
              "screenState": "partial",
              "screenStatePreviously": "partial",
              "data": "",
          },
      )
      if put_res.status_code in [200, 204]:
        print(f"[*] ({account_name}) تم تفعيل جلسة الـ Token بنجاح.")
        return session_token
  return None


async def run_browser_session(session_token, account_name):
  async with async_playwright() as p:
    # تشغيل متصفح كروم بشكل مخفي ليعمل بسلاسة على سيرفرات قت هب
    browser = await p.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()

    # الانتقال لبيئة اللعبة مع تمرير رمز الجلسة المستخرج
    target_url = (
        f"https://experiences.wolfservices.production.wolf.live/?token={session_token}"
    )
    print(f"[*] ({account_name}) فتح نافذة المتصفح والانتقال للعبة...")
    await page.goto(target_url)

    # بقاء نافذة المتصفح نشطة مدة اللعب (121 ثانية)
    await asyncio.sleep(121)
    await browser.close()
    print(f"[*] ({account_name}) تم إغلاق المتصفح وجلسة اللعب.")


async def main_async():
  session_1 = requests.Session()
  headers_1 = base_headers.copy()
  headers_1["authorization"] = f"Bearer {TOKEN_1}"
  session_1.headers.update(headers_1)

  session_token_1 = initialize_account_session(
      session_1, TOKEN_1, "الحساب الأول"
  )
  if not session_token_1:
    return

  print("[*] (الحساب الأول) جاري إنشاء اللوبي...")
  lobby_res = session_1.post(
      "https://experience.palringo.com/lobby",
      json={
          "typeId": 4,
          "groupId": GROUP_ID,
          "visibility": "global",
          "access": "public",
          "displayName": "ㅤ🐈⬛ ㅤ",
          "data": "",
          "ownerUserData": "",
          "ownerPlayerIp": "188.52.62.51",
      },
  )
  lobby_data = lobby_res.json()
  lobby_id = lobby_data.get("id")
  if not lobby_id:
    print("[-] تعذر إنشاء اللوبي.")
    return
  print(f"[*] تم إنشاء اللوبي بنجاح برقم: {lobby_id}")
  time.sleep(1)

  session_2 = requests.Session()
  headers_2 = base_headers.copy()
  headers_2["authorization"] = f"Bearer {TOKEN_2}"
  session_2.headers.update(headers_2)

  session_token_2 = initialize_account_session(
      session_2, TOKEN_2, "الحساب الثاني"
  )
  if not session_token_2:
    return

  print(f"[*] (الحساب الثاني) جاري الانضمام للوبي {lobby_id}...")
  check_lobby = None
  for _ in range(8):
    check_lobby = session_2.get(
        f"https://experience.palringo.com/lobby/id/{lobby_id}"
    )
    if check_lobby.status_code == 200:
      break
    time.sleep(1)

  join_res = session_2.post(
      f"https://experience.palringo.com/lobby/id/{lobby_id}/user",
      json={"data": "", "playerIp": "2001:16a2:32c0:b300:50f:fbd0:fd5a:d326"},
  )
  if join_res.status_code != 200:
    print("[-] فشل انضمام الحساب الثاني.")
    return
  print("[*] انضم الحساب الثاني بنجاح للوبي!")
  time.sleep(2)

  close_headers = headers_1.copy()
  close_headers["content-length"] = "0"
  session_1.post(
      f"https://experience.palringo.com/lobby/id/{lobby_id}/close",
      headers=close_headers,
  )

  print("[*] تشغيل نوافذ المتصفح المتوازية للحسابين عبر Playwright...")
  await asyncio.gather(
      run_browser_session(session_token_1, "الحساب الأول"),
      run_browser_session(session_token_2, "الحساب الثاني"),
  )

  session_1.post(
      f"https://experience.palringo.com/lobby/id/{lobby_id}/close",
      headers=close_headers,
  )
  print("[*] تمت العملية بنجاح وإغلاق الجلسة.")


if __name__ == "__main__":
  asyncio.run(main_async())

