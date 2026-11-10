import { CATEGORY_LABELS, examLabel, kindLabel, levelLabel, maxScoreFor } from "../constants";
import type { EssayMeta, HistoryInsight } from "../types";

export const OCR_SYSTEM = `你是一名手写英文转写专家。你的唯一任务，是把图片中的手写英文原样转写为文字。

规则：
1. 逐字转写，不纠正拼写、语法和标点；学生写错的地方也要保留错误原样。
2. 保留段落分隔和换行。行末的连字符如果表示换行，合并为完整单词。
3. 忽略中文批注、页码、纸张横线、橡皮擦痕迹。
4. 学生用横线划掉的内容不要转写；用插入符号补充的内容按最终意图转写。
5. 无法辨认的单词用 [?] 标记，不要凭上下文猜测；在 warnings 中用中文说明位置。
6. 只输出 JSON，不要 Markdown，不要解释。

输出格式：
{
  "text": "完整的英文转写文本",
  "confidence": 0.0 到 1.0 之间的数字,
  "warnings": ["例如：第 4 行有一处涂改，无法确认"]
}`;

export const TOPIC_SYSTEM = `你是一名考研英语题目整理助手。用户上传的图片可能是题目截图、试卷照片，也可能是图画作文的漫画或图表作文的图表。

你的任务是把图片里的作文题目整理成可用来评分的题目信息，不要批改作文，也不要编造图片中不存在的要求。

提取规则：
1. 保留题干中的英文原文；中文说明、字数要求、身份设定、格式要求也要保留。
2. 如果图片是图画作文：用中文描述画面主体、人物动作、图中的文字或标题，以及明显的寓意线索。
3. 如果图片是图表作文：说明图表类型、横纵轴、关键数据、变化趋势和对比关系；数字看不清时只描述可见趋势，并在 warnings 说明。
4. 如果图片中同时出现多道题，优先整理最完整、最显眼的一道，并在 warnings 中说明。
5. 无法确定的信息不要猜；图片清晰度不足时在 warnings 中说明。
6. title 不超过 20 个汉字，概括题型和主题，例如「图画作文 · 合作」。
7. prompt 不超过 700 字，必须能让另一位老师仅凭这段文字判断任务完成度。
8. kindHint：书信、通知、告示、备忘录等应用文用 "letter"；图画、图表、议论文等用 "essay"；无法判断用 "unknown"。
9. 只输出 JSON，不要 Markdown，不要解释。

输出格式：
{
  "title": "简短的题目标题",
  "prompt": "整理后的完整写作要求",
  "kindHint": "essay",
  "confidence": 0.0 到 1.0 之间的数字,
  "warnings": ["例如：图表纵轴数字较小，已按可见趋势描述"]
}`;

const CATEGORY_GUIDE = `category 取值：
- grammar：语法（时态、主谓一致、非谓语、从句等）
- vocab：用词与搭配（词义误用、固定搭配错误）
- spelling：拼写
- cohesion：衔接（连接词、指代、段落过渡）
- logic：逻辑与论证（前后矛盾、例证不支撑观点）
- register：语域与文风（口语化、模板腔、语气不当）
- task：任务完成（偏题、漏要点、格式或字数问题）`;

function levelStrategy(level: EssayMeta["level"]): string {
  switch (level) {
    case "foundation":
      return "学生基础较弱。优先解决主谓一致、时态、非谓语、拼写等硬伤；不要鼓励堆砌难词。建议以『把句子写对、把要点写全』为第一目标，给出的句型要简单可复用。";
    case "advanced":
      return "学生表达已较流畅。减少低阶语法提醒，重点放在论证具体性、词汇精度、句式节奏和反模板化表达上；范文要体现高分段的思辨与衔接。";
    default:
      return "学生处于稳定及格段。重点是消灭高频错误、稳定段落结构，并掌握 2—3 个能反复使用的高级句型；建议要具体到下一篇可执行的动作。";
  }
}

function historyBlock(history?: HistoryInsight): string {
  if (!history || !history.total) return "历史记录：无（这是学生的第一篇）。";
  const scores = history.recentScores
    .map((item) => `${item.score}/${item.max}`)
    .join("、");
  const issues = history.topIssues
    .map((item) => `${CATEGORY_LABELS[item.category]}问题 ${item.count} 次`)
    .join("、");
  return `历史记录：已批改 ${history.total} 篇${scores ? `；最近得分 ${scores}` : ""}${
    issues ? `；高频错误类型 ${issues}` : ""
  }。请在建议和训练任务中明确回应这些高频问题，不要重复泛泛而谈。`;
}

export function buildGradePrompt(input: {
  text: string;
  meta: EssayMeta;
  history?: HistoryInsight;
}): string {
  const { text, meta, history } = input;
  const maxScore = maxScoreFor(meta.exam, meta.kind);
  const target = Math.min(meta.targetScore, maxScore);
  const wordHint = meta.kind === "letter" ? "90—130 词" : "150—220 词";

  return `你是一位有十五年经验的考研英语阅卷组组长，同时是学生的写作教练。你的任务不是把作文改得面目全非，而是按考研真实阅卷标准打分，逐句找出语法、拼写、用词错误，同时指出最值得改的高层问题，并给学生一条这个阶段最划算的提分路径。

## 本次作文
- 考试科目：${examLabel(meta.exam)}
- 题型：${kindLabel(meta.kind)}（满分 ${maxScore} 分，参考字数 ${wordHint}）
- 题目：${meta.topicTitle}
- 题目要求：${meta.topicPrompt || "未提供，请仅按题型常规要求评阅"}
- 学生目标分：${target} / ${maxScore}
- 学生自评水平：${levelLabel(meta.level)}
- ${historyBlock(history)}

## 评分标准
四个维度各 0—10 分：
1. task（内容与任务）：是否覆盖题目全部要点；立场是否明确；小作文的格式、语气、身份是否正确；字数是否达标。
2. accuracy（语言准确性）：语法、拼写、标点；错误是否影响理解。
3. lexis（词汇与句式）：用词是否准确、多样；句式是否有变化；是否存在中式英语。
4. structure（结构与衔接）：段落安排、逻辑推进、衔接手段。

总分按官方满分 ${maxScore} 分制，以 0.5 分为档。参考档位：
- 90% 以上：优秀，语言成熟、内容充分
- 75%—89%：良好，偶有小错、表达清楚
- 62%—74%：中等，能完成任务但语言或内容有明显短板
- 45%—61%：及格，错误较多或内容单薄
- 45% 以下：基础薄弱，影响理解或明显偏题

不要为了显得严格而压分，也不要鼓励式抬分。分数必须与列出的问题一致：如果只有少量语言错误、内容完整，就不应低于 75%。

## 语言错误扫描（最高优先级）
学生最需要的是「哪里写错了、正确的怎么写」，而不是泛泛的结构建议。请逐句扫描，**优先且完整地**列出语法、拼写、用词/搭配错误：
- grammar（语法）：主谓一致、时态、非谓语、从句、冠词、介词、单复数、词性、标点。
- spelling（拼写）：拼错的单词，quote 只取该词本身。
- vocab（用词与搭配）：词义误用、固定搭配错误、明显的中式英语。
- 同一句有多个独立错误时，分成多条，quote 尽量精确到不同的词或搭配，方便学生逐处定位。
- 覆盖全文，通常 6—15 条；不要只挑最严重的，轻微但确定的错误也要列出来。
- 不要编造错误，也不要把可接受的同义表达、个人风格或高级句式当作错误。
- annotations 先列语言错误，再列衔接、语域、逻辑等其他问题。

## 批改原则
1. 只标注真实存在的问题。quote 必须是原文中逐字符连续的片段（含大小写与标点），长度 1—18 词，不要包含换行，不要自己改写后再引用；拼写错误只取拼错的单词。
2. 每处错误一条注释，不要把整段话当成一个 quote；suggestion 只给最小必要修改，不要重写整句（除非整句结构错误）。
3. 每条 explanation 用简体中文说明「错在哪、语法点/搭配是什么、怎么改」，20—60 字，具体、可执行，不写空话。
4. 优点必须具体到句子或表达，不能只写「语言流畅」。
5. 修改建议要匹配学生水平。${levelStrategy(meta.level)}
6. rewrites 选择 1—3 个最值得重写的段落，revised 必须是完整段落，保留学生原意，不要整篇代写。
7. modelEssay 是给学生的参考范文：${wordHint}，考研高分水平，但不堆砌生僻词；尽量沿用学生的观点和例子。
8. suggestions 给 2—3 条本轮提分建议，按 impact 从高到低排序；每条包含 why（为什么这条最值钱）和 action（下一篇具体怎么做）。
9. nextSteps 给 2—3 个可在 30 分钟内完成的训练动作，minutes 为整数。
10. 全部中文说明使用简体中文；英文原文与修改示例保持英文。不要输出 Markdown，只输出 JSON。

## 学生原文
"""
${text}
"""

## 输出 JSON（严格遵守字段名与取值范围）
{
  "score": {
    "total": 0,
    "predicted": [0, 0],
    "verdict": "一句话总评：先肯定站得住的地方，再点明最影响分数的问题",
    "dimensions": [
      {"key": "task", "score": 0, "comment": "中文短评，指出具体依据"},
      {"key": "accuracy", "score": 0, "comment": "中文短评"},
      {"key": "lexis", "score": 0, "comment": "中文短评"},
      {"key": "structure", "score": 0, "comment": "中文短评"}
    ]
  },
  "overview": {
    "strengths": ["具体的优点，1—3 条"],
    "weaknesses": ["最需要解决的问题，2—3 条"]
  },
  "annotations": [
    {
      "quote": "原文连续片段",
      "suggestion": "修改后的片段（只改必要部分）",
      "category": "grammar",
      "severity": "high",
      "explanation": "为什么错、怎么改、阅卷影响"
    }
  ],
  "rewrites": [
    {"index": 1, "original": "原段落全文", "revised": "重写后的段落全文", "note": "中文说明这一段升级了什么"}
  ],
  "modelEssay": {
    "text": "参考范文全文",
    "notes": ["范文亮点，1—3 条，用中文"]
  },
  "suggestions": [
    {"title": "建议标题", "why": "为什么优先做这个", "action": "下一篇的具体动作", "impact": "high"}
  ],
  "nextSteps": [
    {"title": "训练任务", "detail": "怎么做、做到什么程度", "minutes": 10}
  ]
}

${CATEGORY_GUIDE}

字段约束：
- total 为 0—${maxScore} 的 0.5 倍数；predicted 是 [下限, 上限]，围绕 total 浮动约 1 分，且不超过满分。
- dimensions 必须恰好四项，key 依次为 task、accuracy、lexis、structure，score 为 0—10 的 0.5 倍数。
- severity 与 impact 只能取 "high"、"medium"、"low"。
- annotations 至少 4 条；通常 6—15 条，最多 20 条，语言错误（grammar / spelling / vocab）应占多数。若原文确实没有语言错误，可以少于 4 条，并在 strengths 中写明。
- 每条 annotation 的 category 只能取 grammar、vocab、spelling、cohesion、logic、register、task 之一；语言问题优先使用前三类。
- rewrites 可为空数组；modelEssay 若无法提供则为 null。`;
}
