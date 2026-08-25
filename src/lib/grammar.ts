// 基于规则的新闻英语语法检测器：命中即给出中文讲解
export interface GrammarRule {
  id: string
  name: string // 中文名称
  pattern: RegExp
  explain: string // 中文讲解
}

export const GRAMMAR_RULES: GrammarRule[] = [
  {
    id: 'passive',
    name: '被动语态',
    pattern: /\b(?:is|are|was|were|has been|have been|had been|be|being)\s+[a-z]+(?:ed|en)\b/i,
    explain: '“be + 动词过去分词”表示被动。新闻常省略动作发出者，如 was arrested（被逮捕）。找 be 动词和 -ed/-en 结尾的动词即可识别。',
  },
  {
    id: 'present-perfect',
    name: '现在完成时',
    pattern: /\b(?:has|have)\s+[a-z]+(?:ed|en)\b/i,
    explain: '“have/has + 过去分词”表示动作已完成且与现在有关，如 has announced（已经宣布了）。新闻开头常用它报道刚发生的事件。',
  },
  {
    id: 'past-perfect',
    name: '过去完成时',
    pattern: /\bhad\s+[a-z]+ed\b/i,
    explain: '“had + 过去分词”表示“过去的过去”，如 had left（在那之前已经离开）。用于交代先于某个过去时刻发生的事。',
  },
  {
    id: 'future',
    name: '将来时',
    pattern: /\bwill\s+(?:be\s+)?[a-z]+\b|\bbe going to\b|\bbe set to\b/i,
    explain: 'will + 动词原形表示将来；be going to 表示计划好的将来；be set to 是新闻高频的“预计将要”。',
  },
  {
    id: 'continuous',
    name: '进行时',
    pattern: /\b(?:is|are|was|were)\s+[a-z]+ing\b/i,
    explain: '“be + 动词-ing”表示正在进行的动作，如 is rising（正在上升）。描述持续变化的新闻常用。',
  },
  {
    id: 'relative-clause',
    name: '定语从句',
    pattern: /,\s*which\b|\b(?:who|that|whose)\s+(?:is|are|was|were|has|have|will|would|could|[a-z]+s)\b/i,
    explain: 'who/which/that 引导的从句用来修饰前面的名词，如 the man who…（……的那个人）。看到逗号 + which 几乎可以确定是非限制性定语从句。',
  },
  {
    id: 'modal',
    name: '情态动词',
    pattern: /\b(?:could|may|might|must|should|would)\s+[a-z]+\b/i,
    explain: 'could/may/might 表可能性（程度递减），should 表应该，would 表假设或过去将来。后接动词原形。',
  },
  {
    id: 'conditional',
    name: '条件句',
    pattern: /\bif\b[^.?!]*\b(?:will|would|could)\b/i,
    explain: 'if 引导条件从句：主句用 will 表示真实条件（可能发生）；用 would 表示虚拟条件（不太可能）。',
  },
  {
    id: 'comparative',
    name: '比较级 / 最高级',
    pattern: /\b\w+er\s+than\b|\bmore\s+[a-z]+\s+than\b|\bthe\s+most\s+[a-z]+\b/i,
    explain: '-er than / more … than 是比较级；the most … 是最高级。财经新闻常用来比较数据变化。',
  },
  {
    id: 'there-be',
    name: 'There be 句型',
    pattern: /\bthere\s+(?:is|are|was|were|has been|have been)\b/i,
    explain: 'There be 表示“存在有”，be 的单复数由后面的名词决定：There is a shortage 存在短缺。',
  },
]

export interface GrammarHit {
  ruleId: string
  name: string
  explain: string
  excerpt: string // 命中的原文片段
}

export function detectGrammar(sentence: string): GrammarHit[] {
  const hits: GrammarHit[] = []
  for (const rule of GRAMMAR_RULES) {
    const m = sentence.match(rule.pattern)
    if (m) {
      hits.push({ ruleId: rule.id, name: rule.name, explain: rule.explain, excerpt: m[0] })
    }
  }
  return hits
}
