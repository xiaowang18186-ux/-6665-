/**
 * 国内平台内容合规规则（本地规则库，不调用任何外部服务）。
 * 覆盖：医疗伪科学、封建迷信、广告法绝对化用语、引流与低俗等常见违规点。
 * 规则只做初筛，正式上线需叠加平台方内容安全接口与人工复核。
 */
export type ComplianceIssue = { rule: string; level: "block" | "warn"; match: string; suggestion: string };

type Rule = { rule: string; level: "block" | "warn"; pattern: RegExp; suggestion: string };

const RULES: Rule[] = [
  // 医疗伪科学
  { rule: "医疗伪科学", level: "block", pattern: /(包治|根治|治愈率|偏方治|祖传秘方|神药|特效药|无副作用|代替药物|停药|抗癌食物|排毒养颜|三天见效|一周见效)/g, suggestion: "删除疗效承诺，改为“建议遵医嘱 / 咨询专业医生”" },
  { rule: "医疗伪科学", level: "warn", pattern: /(降血压|降血糖|治失眠|治胃病|增强免疫力|延年益寿)/g, suggestion: "养生类内容避免功效断言，改为生活习惯建议并附免责声明" },
  // 封建迷信
  { rule: "封建迷信", level: "block", pattern: /(转运|改运|化煞|驱邪|招财符|开光|风水改命|算命|看相|鬼上身|做法事|请神|保平安符)/g, suggestion: "删除迷信表述；传统文化内容仅可作民俗知识介绍" },
  // 广告法绝对化用语
  { rule: "绝对化用语", level: "warn", pattern: /(最好|第一|顶级|唯一|100%|百分百|国家级|全网最低)/g, suggestion: "改为相对、可证实的表述" },
  // 引流与站外导流
  { rule: "站外导流", level: "block", pattern: /(加微信|加V|vx|私信领取|扫码进群|QQ群)/gi, suggestion: "删除站外联系方式与导流话术" },
  // 低俗与煽动
  { rule: "低俗煽动", level: "warn", pattern: /(震惊|吓死人|不转不是中国人|速看|马上删)/g, suggestion: "避免标题党和煽动性用语" },
];

export function checkCompliance(text: string) {
  const issues: ComplianceIssue[] = [];
  for (const r of RULES) {
    for (const m of text.matchAll(r.pattern)) issues.push({ rule: r.rule, level: r.level, match: m[0], suggestion: r.suggestion });
  }
  return { passed: !issues.some((i) => i.level === "block"), issues };
}

export const HEALTH_DISCLAIMER = "本内容仅为生活经验分享，不构成医疗建议，身体不适请及时就医。";
export const CULTURE_DISCLAIMER = "本内容仅作传统文化知识介绍与娱乐参考，不构成任何决策依据。";
