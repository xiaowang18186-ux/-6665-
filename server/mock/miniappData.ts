/** 小程序代写静态假数据 */
import { MINIAPP_TYPE_LABEL, type MiniappInput, type MiniappResult } from "@shared/api";

const PAGES: Record<MiniappInput["type"], MiniappResult["pages"]> = {
  booking: [
    { name: "首页", purpose: "服务项目与门店展示" },
    { name: "预约页", purpose: "选择日期、时段、服务人员" },
    { name: "订单页", purpose: "预约记录、取消与改约" },
    { name: "我的", purpose: "会员信息、优惠券" },
  ],
  shop: [
    { name: "首页", purpose: "轮播、分类、推荐商品" },
    { name: "商品详情", purpose: "规格选择、评价" },
    { name: "购物车 / 结算", purpose: "下单与支付" },
    { name: "订单中心", purpose: "物流、售后" },
  ],
  ordering: [
    { name: "扫码点餐", purpose: "桌号识别、菜单分类" },
    { name: "购物车", purpose: "口味备注、加菜" },
    { name: "支付结果", purpose: "取餐号、订单状态" },
    { name: "商家后台", purpose: "接单、出餐、日报" },
  ],
  tool: [
    { name: "首页", purpose: "核心工具入口" },
    { name: "结果页", purpose: "结果展示、保存与分享" },
    { name: "历史记录", purpose: "按时间倒序查看" },
    { name: "设置", purpose: "偏好与反馈" },
  ],
  community: [
    { name: "团购首页", purpose: "今日团品、截单倒计时" },
    { name: "团长中心", purpose: "成员、订单、佣金" },
    { name: "提货点", purpose: "附近自提点" },
    { name: "我的订单", purpose: "提货码、售后" },
  ],
};

const QUOTE: Record<MiniappInput["budget"], MiniappResult["quote"]> = {
  lt5k: { min: 2800, max: 4800, currency: "CNY" },
  "5k-20k": { min: 6800, max: 18000, currency: "CNY" },
  "20k-50k": { min: 22000, max: 45000, currency: "CNY" },
  gt50k: { min: 52000, max: 98000, currency: "CNY" },
};

export function mockMiniapp(input: MiniappInput, recordId: string): MiniappResult {
  return {
    recordId,
    projectName: `${MINIAPP_TYPE_LABEL[input.type]}小程序（示例方案）`,
    pages: PAGES[input.type],
    modules: ["用户登录与授权", "后台管理系统", "数据统计看板", "消息订阅通知", "隐私协议与用户协议页"],
    milestones: [
      { phase: "需求确认与原型", days: 3 },
      { phase: "UI 设计", days: 5 },
      { phase: "前后端开发", days: 12 },
      { phase: "测试与提审", days: 5 },
    ],
    quote: QUOTE[input.budget],
    notes: [
      "报价为示例数据，最终以需求评估为准。",
      "上线需完成主体认证、类目资质与隐私合规（个人信息保护法）。",
      "涉及支付、医疗、金融等类目需额外资质。",
    ],
  };
}
