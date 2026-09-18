#!/usr/bin/env python3
"""
Generate zh-TW polish batch from phrase-based traditional conversion.

Applies scripts/maintenance/data/zh_cn_to_zh_tw_phrases.json plus extended
P1-a phrase pairs to src/i18n/locales/zh-TW.json values, writes only changed
keys to scripts/locale_corpus/data/chinese_ux_polish_zh_tw_2026.json and
merges into scripts/locale_corpus/gaps/zh-TW.json.

Run: python3 scripts/locale/generate_zh_tw_polish_2026.py
"""
from __future__ import annotations

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
EN_PATH = ROOT / "src/i18n/locales/en.json"
ZH_TW_PATH = ROOT / "src/i18n/locales/zh-TW.json"
PHRASES_FILE = ROOT / "scripts/maintenance/data/zh_cn_to_zh_tw_phrases.json"
DATA_PATH = ROOT / "scripts/locale_corpus/data/chinese_ux_polish_zh_tw_2026.json"
GAPS_PATH = ROOT / "scripts/locale_corpus/gaps/zh-TW.json"
AI_TW_PACK = ROOT / "scripts/locale/packs/ai.zh-TW.json"

# Extended phrase pairs (longer phrases first when merged). Mainland / simplified → TW.
EXTRA_PHRASES: list[tuple[str, str]] = [
    ("发送时将执行工作區搜尋", "傳送時將執行工作區搜尋"),
    ("发送时将附加关联筆記", "傳送時將附加關聯筆記"),
    ("发送时执行工作區搜尋", "傳送時執行工作區搜尋"),
    ("发送时載入圖譜", "傳送時載入圖譜"),
    ("发送时搜尋工作區", "傳送時搜尋工作區"),
    ("发送给 AI 的上下文", "傳送給 AI 的上下文"),
    ("打开 AI 设置", "開啟 AI 設定"),
    ("输入命令关键词", "輸入指令關鍵字"),
    ("设置分类", "設定分類"),
    ("搜索设置", "搜尋設定"),
    ("无匹配命令", "無符合指令"),
    ("标签页已达上限", "分頁已達上限"),
    ("个文档标签", "個文件分頁"),
    ("部分标签页", "部分分頁"),
    ("文档标签", "文件分頁"),
    ("双向連結", "雙向連結"),
    ("双向链接", "雙向連結"),
    ("关联筆記", "關聯筆記"),
    ("关联失败", "關聯失敗"),
    ("无关联", "無關聯"),
    ("未找到关联", "未找到關聯"),
    ("无法載入关联", "無法載入關聯"),
    ("后重试", "後重試"),
    ("已验证", "已驗證"),
    ("未验证", "未驗證"),
    ("验证", "驗證"),
    ("文法检查结果", "文法檢查結果"),
    ("对话已複製为", "對話已複製為"),
    ("对话已复制为", "對話已複製為"),
    ("为選取文本排版", "為選取文字排版"),
    ("为当前筆記", "為目前筆記"),
    ("的过程或步骤创建", "的過程或步驟建立"),
    ("浮动工具栏", "浮動工具列"),
    ("块手柄", "區塊控點"),
    ("续写会直接", "續寫會直接"),
    ("翻译/編輯", "翻譯／編輯"),
    ("翻译选区", "翻譯選取範圍"),
    ("翻译選區", "翻譯選取範圍"),
    ("区分大小写", "區分大小寫"),
    ("正文匹配", "內文符合"),
    ("申请", "套用"),
    ("若无符合", "若無符合"),
    ("若无匹配", "若無符合"),
    ("执行", "執行"),
    ("发送", "傳送"),
    ("关联", "關聯"),
    ("输入", "輸入"),
    ("关于", "關於"),
    ("无匹配", "無符合"),
    ("关键词", "關鍵字"),
    ("标签页", "分頁"),
    ("图像", "圖片"),
    ("图片", "圖片"),
    ("注释", "筆記"),
    ("笔记本", "筆記本"),
    ("设置", "設定"),
    ("分类", "分類"),
    ("对话", "對話"),
    ("结构", "結構"),
    ("过程", "過程"),
    ("步骤", "步驟"),
    ("创建", "建立"),
    ("翻译", "翻譯"),
    ("编辑", "編輯"),
    ("续写", "續寫"),
    ("浮动", "浮動"),
    ("说明", "說明"),
    ("流程图", "流程圖"),
    ("选中文本", "選取文字"),
    ("选区", "選取範圍"),
    ("選區", "選取範圍"),
    ("文本", "文字"),
    ("查询", "查詢"),
    ("询问", "詢問"),
    ("检查", "檢查"),
    ("结果", "結果"),
    ("回复", "回覆"),
    ("出现", "出現"),
    ("失败", "失敗"),
    ("继续", "繼續"),
    ("同时", "同時"),
    ("放弃", "放棄"),
    ("载入", "載入"),
    ("切换", "切換"),
    ("内容", "內容"),
    ("开始", "開始"),
    ("标题", "標題"),
    ("没有", "沒有"),
    ("匹配", "符合"),
    ("命令", "指令"),
    ("选项", "選項"),
    ("菜单", "選單"),
    ("项目", "項目"),
    ("确定", "確定"),
    ("该", "該"),
    ("将", "將"),
    ("个", "個"),
    ("后", "後"),
    ("时", "時"),
    ("达", "達"),
    ("为", "為"),
    ("则", "則"),
    ("无", "無"),
    ("出现", "出現"),
    ("发送", "傳送"),
    ("关联", "關聯"),
    ("输入", "輸入"),
    ("关于", "關於"),
    ("设置", "設定"),
]

FORBIDDEN_IN_ZH_TW = re.compile(
    r"(发送|验证|标签页|设置分类|输入命令|关于|无匹配|图像|注释|后重试|未验证|已验证|双向|关联笔记|执行|若无符合)"
)

# Manual overrides where phrase rules are insufficient (key → value).
MANUAL_OVERRIDES: dict[str, str] = {
    "ai.rail.send": "傳送",
    "ai.rail.connectionUnverified": "已設定·未驗證",
    "ai.rail.connectionVerified": "已驗證",
    "ai.rail.configureFirst.step3": "點擊「測試連線」驗證",
    "ai.rail.context.graphNeighbors": "關聯 {count}",
    "ai.rail.context.graphNeighborsFailed": "關聯失敗",
    "ai.rail.context.graphNeighborsFailedInspector": "無法載入關聯筆記",
    "ai.rail.context.graphNeighborsFailedTooltip": "無法載入關聯筆記；可在偏好設定中關閉圖譜上下文後重試",
    "ai.rail.context.graphNeighborsMissed": "無關聯",
    "ai.rail.context.graphNeighborsMissedInspector": "未找到關聯筆記",
    "ai.rail.context.graphNeighborsMissedTooltip": "未找到關聯筆記；可在偏好設定中關閉圖譜上下文，或新增雙向連結",
    "ai.rail.context.graphNeighborsPending": "傳送時載入圖譜",
    "ai.rail.context.graphNeighborsPendingTooltip": "傳送時將附加關聯筆記；若未出現，可在偏好設定中關閉圖譜上下文或新增連結",
    "ai.rail.context.inspectorGraph": "關聯筆記",
    "ai.rail.context.inspectorTitle": "傳送給 AI 的上下文",
    "ai.rail.context.workspaceSearchFailedTooltip": "工作區搜尋失敗；可在偏好設定中關閉工作區搜尋後重試",
    "ai.rail.context.workspaceSearchPending": "傳送時搜尋工作區",
    "ai.rail.context.workspaceSearchPendingInspector": "傳送時執行工作區搜尋",
    "ai.rail.context.workspaceSearchPendingTooltip": "傳送時將執行工作區搜尋；若無符合，可在偏好設定中關閉工作區搜尋",
    "ai.rail.directAction.working": "正在執行「{action}」…",
    "ai.rail.exportChat.copied": "對話已複製為 Markdown",
    "ai.rail.inputPlaceholder": "詢問此筆記或工作區… 輸入 @ 引用筆記",
    "ai.rail.openSettings": "開啟 AI 偏好設定",
    "ai.rail.quickActions.autoFormat.message": "為選取文字排版；若未選取則排版整篇筆記。修正 Markdown 結構，不改變含義。",
    "ai.rail.quickActions.generateFlowchart.message": "為目前筆記中說明的過程或步驟建立 Mermaid 流程圖。",
    "ai.rail.quickActions.translate": "翻譯選取範圍",
    "ai.rail.welcomeDescription": "選取文字可使用浮動工具列；/ 指令、區塊控點或 Mod+Shift+A；@ 引用筆記。摘要／續寫會直接插入；翻譯／編輯在聊天中進行。",
    "ai.grammar.parseFailed": "無法解析文法檢查結果，以下為原始回覆：",
    "app.commandPalette.placeholder": "輸入指令關鍵字…",
    "app.confirm.openTabLimit.message": "最多同時開啟 {max} 個文件分頁。請先關閉部分分頁，再開啟新文件。",
    "app.confirm.openTabLimit.title": "分頁已達上限",
    "app.menu.dailyNoteDisabled": "每日筆記已停用。在「偏好設定」→「範本」中啟用。",
    "app.status.openTabLimit": "最多同時開啟 {max} 個分頁，請先關閉部分分頁。",
    "commandPalette.about": "關於",
    "commandPalette.empty": "無符合指令",
    "commandPalette.exportMd": "匯出為 Markdown…",
    "prefs.nav.label": "偏好設定分類",
    "prefs.search.placeholder": "搜尋偏好設定…",
    "editor.format.textColor.hexApply": "套用",
    "editor.search.matchCase": "區分大小寫",
    "knowledge.search.group.content": "內文符合",
    "menu.fmt.image.global": "全域圖片設定",
}


def load_phrases() -> list[tuple[str, str]]:
    doc = json.loads(PHRASES_FILE.read_text(encoding="utf-8"))
    pairs: list[tuple[str, str]] = []
    for item in doc.get("phrases", []):
        if isinstance(item, list) and len(item) == 2:
            pairs.append((str(item[0]), str(item[1])))
    seen = set(pairs)
    for src, dst in EXTRA_PHRASES:
        if (src, dst) not in seen and src != dst:
            pairs.append((src, dst))
            seen.add((src, dst))
    pairs.sort(key=lambda p: len(p[0]), reverse=True)
    return pairs


def twify(s: str, phrases: list[tuple[str, str]]) -> str:
    out = s
    for src, dst in phrases:
        if src:
            out = out.replace(src, dst)
    return out


def main() -> None:
    en = json.loads(EN_PATH.read_text(encoding="utf-8"))
    zh_tw = json.loads(ZH_TW_PATH.read_text(encoding="utf-8"))
    phrases = load_phrases()

    updates: dict[str, str] = {}
    for key, value in zh_tw.items():
        if key.startswith("meta."):
            continue
        if key not in en:
            continue
        new_value = MANUAL_OVERRIDES.get(key, twify(value, phrases))
        if new_value == en.get(key):
            continue
        if new_value != value:
            updates[key] = new_value

    # Apply manual overrides even if twify didn't change (force quality fixes)
    for key, value in MANUAL_OVERRIDES.items():
        if key in en and value != en[key]:
            updates[key] = value

    batch = {"zh-TW": dict(sorted(updates.items()))}
    DATA_PATH.write_text(json.dumps(batch, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {DATA_PATH.relative_to(ROOT)} ({len(updates)} keys)")

    gaps = json.loads(GAPS_PATH.read_text(encoding="utf-8")) if GAPS_PATH.is_file() else {}
    merged = 0
    for key, value in updates.items():
        if gaps.get(key) != value:
            gaps[key] = value
            merged += 1
    GAPS_PATH.write_text(
        json.dumps(dict(sorted(gaps.items())), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"merged {merged} keys into {GAPS_PATH.relative_to(ROOT)}")

    if AI_TW_PACK.is_file():
        pack = json.loads(AI_TW_PACK.read_text(encoding="utf-8"))
        pack_updates = 0
        for key, value in pack.items():
            if not key.startswith("ai."):
                continue
            new_value = MANUAL_OVERRIDES.get(key, twify(value, phrases))
            if new_value != value:
                pack[key] = new_value
                pack_updates += 1
                if key in en and new_value != en.get(key):
                    updates[key] = new_value
        AI_TW_PACK.write_text(json.dumps(pack, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"twified {pack_updates} keys in {AI_TW_PACK.relative_to(ROOT)}")

    remaining = [
        k
        for k, v in {**zh_tw, **updates}.items()
        if not k.startswith("meta.") and FORBIDDEN_IN_ZH_TW.search(v)
    ]
    print(f"remaining heuristic simplified hits: {len(remaining)}")
    if remaining[:10]:
        print("  sample:", remaining[:10])


if __name__ == "__main__":
    main()
