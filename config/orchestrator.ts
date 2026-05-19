// src/orchestration/orchestrator.ts
import { configLoader } from '../config/config-loader';
import { StateMachine, SessionState } from './state-machine';
import { buildSystemPrompt, buildUserPrompt, buildChartSnapshot, buildPersonalityData, getPhrase } from '../llm/prompt-builder';
import { scorePalace } from '../core/score-engine';
import { matchPatterns } from '../core/pattern-engine';
import { getEventStarDescription } from '../core/event-descriptions';
import { detectIntent, getFirstQuestion, resolvePalaces } from '../core/router-resolver';
import { analyzeTension, getAdjustableAdvice } from '../core/interaction-engine';
import { getMatterMapping, getDirectionJudgment, getDaXianQualitative, getLiuNianTimeWindow } from '../core/limit-engine';

// 模拟 AI 调用函数（实际请替换为真实 API）
async function callAIStream(systemPrompt: string, userPrompt: string): Promise<string> {
  // TODO: 调用 Claude/GPT API 并返回结果
  return `模拟 AI 响应：\n${userPrompt}`;
}

export class Orchestrator {
  private session: any; // 实际应定义 Session 类型
  private stateMachine: StateMachine;

  constructor(session: any) {
    this.session = session;
    this.stateMachine = new StateMachine(session.state || SessionState.INIT);
  }

  async handleUserInput(userInput: string): Promise<{ content: string; state: SessionState }> {
    const currentState = this.stateMachine.getState();
    let responseText = '';
    let nextState = currentState;

    switch (currentState) {
      case SessionState.INIT:
        // 解析出生信息，生成 chartData（简化，实际需调用 iztro）
        const chartData = await this.buildChartFromBirth(userInput);
        this.session.chartData = chartData;
        nextState = SessionState.BASE_IR_READY;
        await this.runStage1And2();      // 评分+性格定性
        nextState = SessionState.PERSONALITY_DONE;
        responseText = await this.generatePersonalityReport();
        break;

      case SessionState.PERSONALITY_DONE:
        const intent = detectIntent(userInput);
        if (!intent || intent === '综合') {
          responseText = this.session.personalityReport || await this.generatePersonalityReport();
        } else if (intent === '互动关系') {
          nextState = SessionState.INTERACTION_ANALYSIS;
          responseText = getPhrase('no_partner_year') || "请提供对方的出生年份（例如：1985年）。";
        } else {
          nextState = SessionState.ROUTING;
          this.session.currentMatter = intent;
          const firstQuestion = getFirstQuestion(intent);
          responseText = firstQuestion?.question || "请告诉我更多关于您的情况。";
        }
        break;

      case SessionState.ROUTING:
        const matter = this.session.currentMatter;
        const nextQ = getNextQuestion(matter, this.session.currentQuestionId, userInput);
        if (nextQ) {
          this.session.currentQuestionId = nextQ.id;
          responseText = nextQ.question;
        } else {
          const answers = this.session.collectedAnswers || {};
          const { primary, secondary, specialConditions, needInteraction } = resolvePalaces(matter, answers);
          const analysis = await this.runEventAnalysis(matter, primary, secondary);
          responseText = await this.generateEventReport(analysis, specialConditions);
          nextState = SessionState.EVENT_ANALYSIS;
        }
        break;

      case SessionState.EVENT_ANALYSIS:
        const newIntent = detectIntent(userInput);
        if (newIntent && newIntent !== this.session.currentMatter) {
          this.session.currentMatter = newIntent;
          this.session.currentQuestionId = undefined;
          this.session.collectedAnswers = {};
          nextState = SessionState.ROUTING;
          const firstQ = getFirstQuestion(newIntent);
          responseText = firstQ?.question || "请告诉我更多关于您的情况。";
        } else {
          responseText = await this.continueEventAnalysis(userInput);
        }
        break;

      case SessionState.INTERACTION_ANALYSIS:
        const partnerYear = this.extractYear(userInput);
        if (!partnerYear) {
          responseText = getPhrase('no_partner_year') || "请提供对方准确的出生年份（例如：1990年）。";
        } else {
          const interactionResult = await this.runInteractionAnalysis(partnerYear);
          responseText = await this.generateInteractionReport(interactionResult);
          nextState = SessionState.PERSONALITY_DONE;
        }
        break;
    }

    this.stateMachine.setState(nextState);
    this.session.state = nextState;
    await this.saveSession();

    return { content: responseText, state: nextState };
  }

  // ---------- 确定性计算引擎 ----------
  private async runStage1And2() {
    const scored = this.session.chartData.palaces.map((p: any) =>
      scorePalace(p, this.session.chartData.skeletonId, this.buildChartContext())
    );
    this.session.stage1Output = { palaces: scored };
    this.session.stage2Output = { personalityTags: [] };
  }

  private async runEventAnalysis(matter: string, primaryPalace: string, secondaryPalaces: string[]) {
    const palaces = this.session.stage1Output.palaces;
    const primaryScore = palaces.find((p: any) => p.name === primaryPalace)?.finalScore || 0;
    const brightness = this.getBrightnessLevel(primaryScore);
    const mainStar = this.getMainStar(primaryPalace);
    const description = getEventStarDescription(matter, primaryPalace, mainStar, brightness);
    const daXianDir = '吉';   // 应由大限四化计算
    const liuNianDir = '吉';  // 应由流年四化计算
    const direction = getDirectionJudgment(liuNianDir, daXianDir);
    const daXianQual = getDaXianQualitative(primaryScore);
    const timeWindow = getLiuNianTimeWindow(daXianDir, liuNianDir);
    return { primaryPalace, primaryScore, brightness, description, direction, daXianQual, timeWindow };
  }

  private async runInteractionAnalysis(partnerYear: string) {
    // 模拟返回数据
    return { jiStars: ['文曲'], quanStars: [], luStars: ['天梁'], palaceDizhi: '午' };
  }

  // ---------- 大模型表达 ----------
  private async generatePersonalityReport(): Promise<string> {
    const snapshot = buildChartSnapshot(this.session.chartData);
    const personalityData = buildPersonalityData(this.session.stage2Output);
    const systemPrompt = buildSystemPrompt('personality');
    const userPrompt = buildUserPrompt('personality', { chartSnapshot: snapshot, personalityData });
    const response = await callAIStream(systemPrompt, userPrompt);
    this.session.personalityReport = response;
    return response;
  }

  private async generateEventReport(analysis: any, specialConditions: string[]): Promise<string> {
    const systemPrompt = buildSystemPrompt('event', `事项：${this.session.currentMatter}`);
    const userPrompt = buildUserPrompt('event', {
      matter: this.session.currentMatter,
      primaryPalace: analysis.primaryPalace,
      primaryScore: analysis.primaryScore,
      brightness: analysis.brightness,
      starDescription: analysis.description,
      eventDescription: analysis.description, // 可单独传入
      daXianDir: analysis.direction?.strength || '平',
      liuNianDir: '吉',
      timeWindow: analysis.timeWindow,
      specialConditions: specialConditions.join('；') || '无',
    });
    return await callAIStream(systemPrompt, userPrompt);
  }

  private async generateInteractionReport(ctx: any): Promise<string> {
    const tension = analyzeTension(ctx);
    const advice = tension ? getAdjustableAdvice(tension.rule.name) : getAdjustableAdvice('default');
    const systemPrompt = buildSystemPrompt('interaction');
    const userPrompt = buildUserPrompt('interaction', { interactionData: JSON.stringify(ctx), tension: tension?.message, advice });
    return await callAIStream(systemPrompt, userPrompt);
  }

  private async continueEventAnalysis(userInput: string): Promise<string> {
    // 简单返回，实际可调用大模型进行多轮对话
    return "您可以继续提问，或切换到其他事项。";
  }

  // ---------- 辅助方法 ----------
  private buildChartContext() {
    // 构建 ChartContext 供评分引擎使用（需根据实际数据结构实现）
    return {
      getPalaceByName: (name: string) => this.session.chartData.palaces.find((p: any) => p.name === name),
      getOpposite: (p: any) => this.session.chartData.palaces.find((op: any) => op.dizhi === this.getOppositeDizhi(p.dizhi)),
      getTrines: (p: any) => this.session.chartData.palaces.filter((tp: any) => this.isTrine(p.dizhi, tp.dizhi)),
      getLeft: (p: any) => this.session.chartData.palaces.find((lp: any) => lp.dizhi === this.getLeftDizhi(p.dizhi)),
      getRight: (p: any) => this.session.chartData.palaces.find((rp: any) => rp.dizhi === this.getRightDizhi(p.dizhi)),
      getCorePalace: () => '命宫',
    };
  }

  private getOppositeDizhi(dizhi: string): string {
    const map: Record<string, string> = { 子:'午',丑:'未',寅:'申',卯:'酉',辰:'戌',巳:'亥',午:'子',未:'丑',申:'寅',酉:'卯',戌:'辰',亥:'巳' };
    return map[dizhi];
  }
  private isTrine(dizhi1: string, dizhi2: string): boolean {
    const order = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const idx1 = order.indexOf(dizhi1);
    const idx2 = order.indexOf(dizhi2);
    return (idx2 - idx1) % 4 === 0;
  }
  private getLeftDizhi(dizhi: string): string {
    const order = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const idx = order.indexOf(dizhi);
    return order[(idx + 11) % 12];
  }
  private getRightDizhi(dizhi: string): string {
    const order = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const idx = order.indexOf(dizhi);
    return order[(idx + 1) % 12];
  }
  private getMainStar(palaceName: string): string {
    return this.session.chartData.palaces.find((p: any) => p.name === palaceName)?.major || '';
  }
  private getBrightnessLevel(score: number): string {
    const thresholds = configLoader.get('star_system')?.全局评分参数?.宫位亮度阈值;
    if (score >= thresholds.实旺) return '实旺';
    if (score >= thresholds.磨炼) return '磨炼';
    if (score >= thresholds.虚浮) return '虚浮';
    if (score >= thresholds.凶危) return '凶危';
    return '绝败';
  }
  private extractYear(text: string): string | null {
    const match = text.match(/\b(\d{4})\b/);
    return match ? match[1] : null;
  }
  private async buildChartFromBirth(userInput: string): Promise<any> {
    // 实际应调用 iztro 排盘并返回标准格式
    return { palaces: [], skeletonId: 'P01', shenPalace: null, taiSuiPalace: null };
  }
  private async saveSession() {
    // 持久化 session（Redis/DB）
  }
}