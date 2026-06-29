import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "用户协议 · 紫微问道",
  description: "紫微问道平台用户服务协议",
};

const UPDATED_AT = "2026-06-25";

export default function TermsPage() {
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
        用户服务协议
      </h1>
      <p style={{ fontSize: 12, color: "var(--text-muted, #888)", marginBottom: 32 }}>
        最近更新：{UPDATED_AT}
      </p>

      <Section title="一、总则">
        <p>
          欢迎您使用「紫微问道」（以下简称"本平台"）。本平台由相应运营主体提供，致力于以紫微斗数与心理科学相融合，为用户提供命理排盘、AI 智能解析、性格与运势分析等服务。
        </p>
        <p>
          您在注册、登录或使用本平台任意功能前，请仔细阅读并同意本协议。您勾选「同意」或继续使用即视为您已充分理解并接受本协议全部条款。
        </p>
      </Section>

      <Section title="二、账号注册与管理">
        <p>1. 用户须使用本人真实有效的手机号完成注册，并对账号、密码及验证码的安全性负全部责任。</p>
        <p>2. 用户不得转让、出借账号，亦不得使用他人身份信息注册。</p>
        <p>3. 如发现账号被盗用或异常使用，请立即联系客服。因用户个人原因导致的账号损失，本平台不承担责任。</p>
      </Section>

      <Section title="三、服务内容">
        <p>1. 本平台提供以下服务：命盘排盘、AI 智能对话解析、命盘资产化管理、命理报告生成、双人合盘分析、推广分享等。</p>
        <p>2. 部分服务需要消耗「星币」或开通会员订阅，具体计费规则以平台内展示为准。</p>
        <p>3. 本平台命理分析结果仅供文化研究与心理参考，不构成任何医疗、法律、投资建议。</p>
      </Section>

      <Section title="四、用户行为规范">
        <p>用户在使用本平台时，不得有以下行为：</p>
        <p>1. 发布违法、有害、胁迫、辱骂、诽谤、淫秽或暴力内容；</p>
        <p>2. 冒充他人或虚构与他人的关系；</p>
        <p>3. 利用技术手段批量注册、自邀请返利、攻击服务接口；</p>
        <p>4. 对平台内容进行未经授权的复制、爬取、二次发行；</p>
        <p>5. 其他违反法律法规或损害他人合法权益的行为。</p>
      </Section>

      <Section title="五、知识产权">
        <p>1. 本平台的算法、命盘引擎、UI 设计、文案、AI 提示词等知识产权均归本平台或其权利人所有。</p>
        <p>2. 未经书面授权，用户不得复制、修改、传播上述内容用于商业用途。</p>
        <p>3. 用户在平台内生成的命盘、对话记录、报告内容，用户享有使用权，但不得恶意爬取或批量导出。</p>
      </Section>

      <Section title="六、付费与退款">
        <p>1. 会员订阅、星币充值、按次付费等付费服务，一经支付原则上不予退款。</p>
        <p>2. 因平台原因导致服务不可用的，可联系客服按比例补偿或退还相应费用。</p>
        <p>3. 推广返点获得的星币不可提现，仅可在平台内消费使用。</p>
      </Section>

      <Section title="七、推广与邀请">
        <p>1. 用户可通过专属邀请码邀请好友注册，双方按平台规则获得星币奖励。</p>
        <p>2. 严禁通过小号自邀请、刷单、虚假注册等方式套取奖励，一经发现将取消奖励并封禁账号。</p>
        <p>3. 好友充值时，邀请人可按比例获得返点，具体比例以平台公示为准。</p>
      </Section>

      <Section title="八、免责声明">
        <p>1. 因不可抗力（自然灾害、网络中断、政策变更等）导致服务中断，本平台不承担责任。</p>
        <p>2. 用户应理性看待命理分析结果，平台不对用户基于分析结果做出的任何决策承担责任。</p>
        <p>3. 因用户个人原因（账号泄露、误操作等）导致的损失，平台不承担责任。</p>
      </Section>

      <Section title="九、协议变更">
        <p>
          本平台有权根据业务发展与法律法规变化更新本协议，更新后将在平台内公示。用户继续使用即视为接受变更；不同意变更的用户应停止使用并申请注销账号。
        </p>
      </Section>

      <Section title="十、争议解决">
        <p>
          本协议的订立、执行与解释适用中华人民共和国法律。因本协议产生的争议，双方应首先协商解决；协商不成的，提交本平台运营主体所在地有管辖权的人民法院诉讼解决。
        </p>
      </Section>

      <Section title="十一、联系方式">
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
