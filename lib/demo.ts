import { TOPICS } from "./constants";
import type { GradeResult } from "./types";

const TOPIC = TOPICS.english1.essay[0];

const P1 =
  "The picture vividly depicts two men are climbing a steep cliff. One of them is reaching down to pull the other up, and they finally stand on the top together. Simple as the picture is, the symbolic meaning behind it is far-reaching.";

const P2 =
  "There is no doubt that cooperation plays an important role in our daily life. In modern society, no one can accomplish great things lonely. When we meet difficulties, working with others can not only save time, but also let us learn different ways of thinking. For example, when I prepared a group presentation last term, my teammates and I divided the work and discussed the slides again and again. Each member contributed what he or she was good at, which made the whole process much more efficent. As a result, we got a high score and became good friends.";

const P3 =
  "Therefore, we should learn to cooperate with others. Only in this way can we overcome challenges and achieve our goals. As the saying goes, \"Two heads are better than one.\"";

export const DEMO_ESSAY = `${P1}\n\n${P2}\n\n${P3}`;

const MODEL_ESSAY = `The drawing presents a striking scene: two climbers are scaling a steep cliff, with one reaching down to pull the other up until both stand on the summit. Simple as the image is, it carries a profound message about the power of cooperation.

Cooperation is indispensable in almost every walk of life. In a society built on specialization, individual strength has limits, while coordinated effort multiplies what a team can achieve. Working with others not only saves time but also exposes us to different ways of thinking. Last term, when I was preparing a group presentation, my teammates and I divided the task according to our strengths, reviewed each other's drafts, and refined the slides late into the night. Each member contributed what he or she did best, which made the whole process far more efficient. As a result, we earned an excellent grade and built a stronger team bond.

Admittedly, cooperation does not mean avoiding responsibility. It begins with a clear division of labor and honest communication. Therefore, when we face a demanding task, we should first identify what we can contribute and then reach out to others. Only by combining our strengths can we overcome challenges that no one could handle alone.`;

export function createDemoResult(): GradeResult {
  return {
    version: 1,
    id: "demo",
    createdAt: new Date().toISOString(),
    meta: {
      exam: "english1",
      kind: "essay",
      topicTitle: TOPIC.title,
      topicPrompt: TOPIC.prompt,
      targetScore: 16,
      level: "steady",
      maxScore: 20,
      promptStyle: "标准阅卷"
    },
    text: DEMO_ESSAY,
    score: {
      total: 14,
      band: "中等档",
      predicted: [13, 15],
      verdict:
        "内容完整、结构清楚，主要失分在语法和用词精度上；先把动词形式和拼写做稳，这一篇就能进入 16 分档。",
      dimensions: [
        {
          key: "task",
          name: "内容与任务",
          score: 7.5,
          comment: "图画描述完整，观点明确；但第三段只有口号，缺少具体建议。"
        },
        {
          key: "accuracy",
          name: "语言准确性",
          score: 6.5,
          comment: "7 处语言错误，集中在非谓语、平行结构和拼写。"
        },
        {
          key: "lexis",
          name: "词汇与句式",
          score: 7,
          comment: "有 Simple as...、Only in this way 等亮点，但动词搭配偏弱。"
        },
        {
          key: "structure",
          name: "结构与衔接",
          score: 7.5,
          comment: "三段式完整，例证自然；段内衔接词略单一。"
        }
      ]
    },
    overview: {
      strengths: [
        "首段用 Simple as the picture is 倒装，句式有变化，且没有跑题。",
        "第二段用个人经历作例证，比空喊口号更有说服力。",
        "结尾用 Only in this way 倒装收束，观点明确。"
      ],
      weaknesses: [
        "一个句子里同时出现两个谓语（depicts ... are climbing）。",
        "近义词辨析不准：lonely 与 alone 混用。",
        "介词搭配不准：stand on the top 应为 stand at the top。",
        "拼写细节不稳：efficent 应为 efficient。",
        "结尾建议空泛，缺少可执行的具体做法。"
      ]
    },
    annotations: [
      {
        id: "a1",
        quote: "depicts two men are climbing",
        suggestion: "depicts two men climbing",
        category: "grammar",
        severity: "high",
        explanation:
          "depict 后面接「宾语 + 分词」作补足语，不能再接一个完整句子。同类动词还有 see、watch、find、hear。"
      },
      {
        id: "a2",
        quote: "accomplish great things lonely",
        suggestion: "accomplish great things alone",
        category: "vocab",
        severity: "medium",
        explanation:
          "lonely 表示「感到孤独」，强调情绪；alone 才表示「独自一人」。这里描述客观状态，应用 alone。"
      },
      {
        id: "a3",
        quote: "can not only save time, but also let us learn different ways of thinking",
        suggestion: "not only saves time but also helps us learn different ways of thinking",
        category: "grammar",
        severity: "medium",
        explanation:
          "not only... but also... 连接两个谓语时，形式必须一致。前面是 can save，后面却用了 let，破坏了平行结构。"
      },
      {
        id: "a4",
        quote: "when I prepared a group presentation",
        suggestion: "when I was preparing a group presentation",
        category: "grammar",
        severity: "medium",
        explanation:
          "when 从句用过去进行时，表示「正在准备」的背景动作，与主句的 divided、discussed 形成时间层次，叙事更自然。"
      },
      {
        id: "a5",
        quote: "As a result, we got a high score and became good friends.",
        suggestion: "As a result, we earned an excellent grade and built a stronger team bond.",
        category: "logic",
        severity: "medium",
        explanation:
          "「拿高分」和「成为朋友」之间没有必然因果，放在 As a result 后显得逻辑跳跃。改成团队关系更紧密，因果才站得住。"
      },
      {
        id: "a6",
        quote: "There is no doubt that cooperation plays an important role in our daily life.",
        suggestion: "Cooperation has become indispensable in almost every part of campus life.",
        category: "register",
        severity: "low",
        explanation:
          "There is no doubt that... 是阅卷人最熟悉的模板句之一。换成具体判断句，开头更有信息量，也避免模板腔。"
      },
      {
        id: "a7",
        quote: "stand on the top",
        suggestion: "stand at the top",
        category: "vocab",
        severity: "medium",
        explanation:
          "表示「在山顶」用 at the top；on the top 更像「在某个物体的上表面」，此处搭配不自然。"
      },
      {
        id: "a8",
        quote: "discussed the slides again and again",
        suggestion: "revised the slides repeatedly",
        category: "vocab",
        severity: "low",
        explanation:
          "discuss 侧重讨论内容；这里实际是修改幻灯片，用 revise / refine 更准确，again and again 可换成 repeatedly。"
      },
      {
        id: "a9",
        quote: "efficent",
        suggestion: "efficient",
        category: "spelling",
        severity: "medium",
        explanation:
          "拼写错误：efficient 是双 f、双 c。这是写作高频词，考场上写错会直接影响语言分。"
      }
    ],
    rewrites: [
      {
        index: 1,
        original: P1,
        revised:
          "The drawing presents a striking scene: two climbers are scaling a steep cliff, one reaching down to pull the other up until both stand on the summit. Simple as the image is, it carries a profound message about the power of cooperation.",
        note: "用现在分词 reaching 和 with 式的独立结构替代第二个谓语，首段只保留一个主句；同时把 stand on the top 改为 stand on the summit，避免口语化。"
      },
      {
        index: 2,
        original: P2,
        revised:
          "Cooperation is indispensable in almost every walk of life. In a society built on specialization, individual strength has limits, while coordinated effort multiplies what a team can achieve. Working with others not only saves time but also exposes us to different ways of thinking. Last term, when I was preparing a group presentation, my teammates and I divided the task according to our strengths, reviewed each other's drafts, and refined the slides late into the night. Each member contributed what he or she did best, which made the whole process far more efficient. As a result, we earned an excellent grade and built a stronger team bond.",
        note: "把 save / let 改成平行结构 saves / exposes；用 Last term 替代 For example 开头，例证更具体；同时修正 efficent 的拼写，补上分工细节。"
      },
      {
        index: 3,
        original: P3,
        revised:
          "Cooperation, however, does not mean avoiding responsibility. It begins with a clear division of labor and honest communication. Therefore, when we face a demanding task, we should first identify what we can contribute and then reach out to others. Only by combining our strengths can we overcome challenges that no one could handle alone.",
        note: "增加让步句，避免结尾一边倒；给出「分工 + 沟通」的具体做法，再把 Only in this way 升级为 Only by doing，句式更高级。"
      }
    ],
    modelEssay: {
      text: MODEL_ESSAY,
      notes: [
        "用 with 复合结构替代第二个谓语，句子更干净。",
        "Admittedly 让步一句，让论证不止于一边倒。",
        "结尾给出「分工 + 沟通」的具体做法，比空喊 should 更有内容。"
      ]
    },
    suggestions: [
      {
        title: "先消灭「一句两谓语」",
        why: "阅卷人最先注意到的就是句子结构错误；这类错误每出现一次，语言分就往下掉一档。",
        action: "动笔前给每个句子划出唯一谓语；写完用 30 秒专查 depict / see / find / watch 后面的形式。",
        impact: "high"
      },
      {
        title: "把结尾从口号改成建议",
        why: "第三段是 14 分和 17 分作文的分水岭，空泛的 we should 体现不出思辨。",
        action: "结尾固定写两步：先给一条具体做法，再用 Only by... 倒装收束。",
        impact: "high"
      },
      {
        title: "近义词成对记，而不是单独背",
        why: "lonely / alone、affect / effect 这类混淆在考场上很难靠语感救回来。",
        action: "每遇到一组易混词，造两个与自己生活相关的句子，写进作文素材本。",
        impact: "medium"
      }
    ],
    nextSteps: [
      {
        title: "重写首段和尾段",
        detail: "不看答案，用 10 分钟把首段和第三段各重写一遍，再对照报告里的升级版逐句比较。",
        minutes: 10
      },
      {
        title: "非谓语动词三句型",
        detail: "整理 depict + 宾语 + doing、with 复合结构、Only by doing 倒装各 2 句，并各造 1 句自己的版本。",
        minutes: 20
      },
      {
        title: "下一篇先列提纲",
        detail: "写作前用 3 分钟列出三段主旨和每段的关键例证，避免第三段无话可写。",
        minutes: 5
      }
    ],
    stats: {
      words: DEMO_ESSAY.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0,
      sentences: DEMO_ESSAY.match(/[.!?]+(?=\s|$)/g)?.length ?? 0,
      paragraphs: 3
    },
    source: "demo",
    model: "研墨示例"
  };
}
