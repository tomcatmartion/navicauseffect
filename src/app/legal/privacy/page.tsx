import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策 · 紫微问道",
  description: "紫微问道平台用户隐私保护政策",
};

const UPDATED_AT = "2026-06-25";

export default function PrivacyPage() {
  return (
    <article style={{ fontSize: 14, lineHeight: 1.85 }}>
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "var(--font-serif-sc, serif)",
          color: "var(--brand, #8b6f47)",
          marginBottom: 8,
        }}
      >
        隐私政策
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted, #888)", marginBottom: 32 }}>
        最近更新：{UPDATED_AT}
      </p>

      <p
        style={{
          background: "var(--soft, #f4efe5)",
          border: "1px solid var(--line, #e8e0d3)",
          borderRadius: 8,
          padding: 14,
          fontSize: 13,
          color: "var(--text-muted, #666)",
        }}
      >
        <i className="ti ti-info-circle" style={{ marginRight: 6, color: "var(--brand)" }} />
        本平台高度重视您的个人隐私。本政策说明我们收集哪些信息、如何使用、如何存储与保护，以及您享有的权利。
      </p>

      <Section title="一、我们收集的信息">
        <p>
          <strong>1. 注册信息：</strong>手机号（用于登录与身份验证）、昵称、可选填的邮箱。
        </p>
        <p>
          <strong>2. 业务数据：</strong>您主动提交的命主档案（姓名、性别、出生日期时间、出生城市、父母生肖等）、AI 对话记录、命盘快照、报告内容。
        </p>
        <p>
          <strong>3. 第三方授权信息：</strong>当您使用微信登录时，获取经授权的微信开放信息（OpenID、昵称、头像）。
        </p>
        <p>
          <strong>4. 设备与日志信息：</strong>访问时间、IP 地址、浏览器类型、操作日志（用于安全风控与服务优化）。
        </p>
        <p>
          <strong>5. 充值与消费记录：</strong>订单号、支付渠道（脱敏）、星币余额与流水（用于财务对账）。
        </p>
      </Section>

      <Section title="二、信息使用方式">
        <p>1. 提供命盘排盘、AI 解析、报告生成、合盘等核心服务；</p>
        <p>2. 维护账号安全，防范风险注册、自邀请作弊、接口滥用；</p>
        <p>3. 处理充值订单、推广返点、兑换码核销；</p>
        <p>4. 优化 AI 模型与服务体验（去标识化处理后用于分析）；</p>
        <p>5. 在取得您单独同意后，用于产品营销或个性化推荐；</p>
        <p>6. 法律法规要求或为维护合法权益所必需的其他用途。</p>
      </Section>

      <Section title="三、信息存储与保护">
        <p>1. 您的信息存储于中华人民共和国境内的服务器，存储期限不超过实现服务目的所必需的时间。</p>
        <p>2. 我们采用 HTTPS 加密传输、密码哈希存储、敏感字段加密、严格权限管控等技术手段保护您的信息安全。</p>
        <p>3. 仅授权员工在必要情况下可访问您的信息，并签署保密义务。</p>
        <p>4. 如发生信息泄露事件，我们将在法定时限内通知您并启动应急预案。</p>
      </Section>

      <Section title="四、信息共享与披露">
        <p>我们不会向第三方出售您的个人信息。仅在以下情形下共享或披露：</p>
        <p>1. 获得您的明确同意；</p>
        <p>2. 与您使用的支付渠道（微信支付、支付宝等）共享必要的订单信息以完成支付；</p>
        <p>3. 与短信服务商共享手机号以发送验证码；</p>
        <p>4. 法律法规要求、行政或司法机关合法调取；</p>
        <p>5. 与关联方或合作伙伴在签订保密协议前提下，为实现服务功能所必需的共享。</p>
      </Section>

      <Section title="五、您的权利">
        <p>1. <strong>查询、更正：</strong>您可在「个人中心」查询并修改昵称、手机号等基本信息。</p>
        <p>2. <strong>删除：</strong>命主档案、命盘、报告等业务数据您可自行删除；账号注销请联系客服。</p>
        <p>3. <strong>撤回授权：</strong>您可解绑微信、退出登录，或要求停止使用相关信息进行个性化推荐。</p>
        <p>4. <strong>账号注销：</strong>注销后将删除您的可识别信息，但法律法规要求保留的除外。</p>
      </Section>

      <Section title="六、未成年人保护">
        <p>
          本平台面向 18 周岁以上成年人提供服务。如您是未成年人，请在监护人陪同下阅读本政策并使用本平台，且应在监护人同意后提交个人信息。
        </p>
      </Section>

      <Section title="七、Cookie 与同类技术">
        <p>
          我们使用 localStorage 与 Cookie 存储您的登录态、主题偏好、邀请码追踪等信息。您可通过浏览器设置清除这些数据，但可能影响部分功能使用。
        </p>
      </Section>

      <Section title="八、政策变更">
        <p>
          本政策可能适时修订，重大变更时我们将在平台内显著位置公示。继续使用即视为您接受修订后的政策。
        </p>
      </Section>

      <Section title="九、联系我们">
        <p>如对本政策有任何疑问、建议或投诉，可通过以下方式联系：</p>
        <p>反馈邮箱：support@ziyunpai.com</p>
        <p>备案号：辽ICP备2026007904号-1</p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--brand, #8b6f47)",
          marginBottom: 12,
          fontFamily: "var(--font-serif-sc, serif)",
        }}
      >
        {title}
      </h2>
      <div style={{ color: "var(--ink, #2a2520)" }}>{children}</div>
    </section>
  );
}
