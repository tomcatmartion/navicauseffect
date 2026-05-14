/**
 * 移动端响应式测试脚本
 * 测试 iPhone 14 (390x844) 和桌面端 (1440x900) 的显示效果
 */
import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const ARTIFACTS_DIR = path.resolve(__dirname, '../artifacts');

interface TestCase {
  name: string;
  url: string;
  viewport: { width: number; height: number };
  deviceScaleFactor?: number;
  isMobile?: boolean;
  screenshotName: string;
}

const testCases: TestCase[] = [
  // 移动端 - iPhone 14
  {
    name: '首页 - 移动端 (iPhone 14)',
    url: 'http://localhost:3333/',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    screenshotName: 'mobile-home.png',
  },
  {
    name: '排盘页面 - 移动端 (iPhone 14)',
    url: 'http://localhost:3333/chart',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    screenshotName: 'mobile-chart.png',
  },
  // 桌面端
  {
    name: '首页 - 桌面端 (1440x900)',
    url: 'http://localhost:3333/',
    viewport: { width: 1440, height: 900 },
    screenshotName: 'desktop-home.png',
  },
  {
    name: '排盘页面 - 桌面端 (1440x900)',
    url: 'http://localhost:3333/chart',
    viewport: { width: 1440, height: 900 },
    screenshotName: 'desktop-chart.png',
  },
];

async function runTests() {
  const browser: Browser = await chromium.launch({ headless: true });

  const results: Array<{
    name: string;
    screenshotPath: string;
    checks: string[];
    issues: string[];
  }> = [];

  for (const tc of testCases) {
    console.log(`\n--- 测试: ${tc.name} ---`);

    const context = await browser.newContext({
      viewport: tc.viewport,
      deviceScaleFactor: tc.deviceScaleFactor || 1,
      isMobile: tc.isMobile || false,
      hasTouch: tc.isMobile || false,
      userAgent: tc.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });

    const page: Page = await context.newPage();

    try {
      // 导航到目标页面
      const response = await page.goto(tc.url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      if (!response || !response.ok()) {
        console.log(`  [错误] 页面加载失败: ${response?.status()}`);
        continue;
      }

      // 等待页面渲染完成
      await page.waitForTimeout(2000);

      // 截图 - 全页
      const screenshotPath = path.join(ARTIFACTS_DIR, tc.screenshotName);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
      console.log(`  截图已保存: ${screenshotPath}`);

      // 检查项目
      const checks: string[] = [];
      const issues: string[] = [];

      // 1. 检查页面标题
      const title = await page.title();
      checks.push(`页面标题: "${title}"`);

      // 2. 检查水平溢出
      const overflowInfo = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        const bodyScrollWidth = body.scrollWidth;
        const htmlScrollWidth = html.scrollWidth;
        const viewportWidth = window.innerWidth;

        // 检查所有直接子元素是否有溢出
        const overflowing: string[] = [];
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          if (el.scrollWidth > el.clientWidth + 2) {
            const tag = el.tagName.toLowerCase();
            const cls = el.className ? `.${String(el.className).split(' ').slice(0, 2).join('.')}` : '';
            const id = el.id ? `#${el.id}` : '';
            overflowing.push(`${tag}${id}${cls}: scrollWidth=${el.scrollWidth}, clientWidth=${el.clientWidth}`);
          }
        }

        return {
          bodyScrollWidth,
          htmlScrollWidth,
          viewportWidth,
          hasHorizontalOverflow: bodyScrollWidth > viewportWidth || htmlScrollWidth > viewportWidth,
          overflowingElements: overflowing.slice(0, 10), // 只取前10个
        };
      });

      if (overflowInfo.hasHorizontalOverflow) {
        issues.push(
          `水平溢出: body.scrollWidth=${overflowInfo.bodyScrollWidth}, viewport=${overflowInfo.viewportWidth}`
        );
        if (overflowInfo.overflowingElements.length > 0) {
          issues.push(`溢出元素: ${overflowInfo.overflowingElements.join(' | ')}`);
        }
      } else {
        checks.push('无水平溢出');
      }

      // 3. 检查导航栏
      const navInfo = await page.evaluate(() => {
        const nav = document.querySelector('nav') || document.querySelector('header');
        if (!nav) return { found: false };
        const rect = nav.getBoundingClientRect();
        return {
          found: true,
          visible: rect.height > 0,
          width: rect.width,
          viewportWidth: window.innerWidth,
          fitsViewport: rect.width <= window.innerWidth + 1,
        };
      });

      if (navInfo.found) {
        if (navInfo.visible && navInfo.fitsViewport) {
          checks.push(`导航栏正常: 宽度=${Math.round(navInfo.width!)}px`);
        } else {
          issues.push(`导航栏异常: visible=${navInfo.visible}, width=${navInfo.width}, viewport=${navInfo.viewportWidth}`);
        }
      } else {
        issues.push('未找到导航栏 (nav/header)');
      }

      // 4. 检查移动端汉堡菜单按钮
      if (tc.isMobile) {
        const hamburgerInfo = await page.evaluate(() => {
          // 查找常见的移动端菜单按钮
          const buttons = document.querySelectorAll('button');
          const menuButtons: string[] = [];
          buttons.forEach((btn) => {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const cls = btn.className || '';
            // 检查是否包含菜单相关图标或文字
            if (
              text.includes('菜单') ||
              text.includes('Menu') ||
              ariaLabel.includes('menu') ||
              cls.includes('menu') ||
              cls.includes('hamburger') ||
              cls.includes('MobileMenu') ||
              btn.querySelector('svg')?.innerHTML.includes('line') ||
              btn.querySelector('[data-testid="menu"]')
            ) {
              menuButtons.push(`button: text="${text}", class="${cls.slice(0, 50)}"`);
            }
          });
          return { menuButtons };
        });

        if (hamburgerInfo.menuButtons.length > 0) {
          checks.push(`移动端菜单按钮存在: ${hamburgerInfo.menuButtons.join(', ')}`);
        } else {
          checks.push('未检测到专用移动端菜单按钮（可能使用其他导航方式）');
        }
      }

      // 5. 检查 Hero 区域（仅首页）
      if (tc.url === 'http://localhost:3333/') {
        const heroInfo = await page.evaluate(() => {
          // 尝试多种方式找到 Hero 区域
          const selectors = [
            'h1',
            '[class*="hero"]',
            '[class*="Hero"]',
            'section:first-of-type',
            'main > div:first-child',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const rect = el.getBoundingClientRect();
              const text = el.textContent?.trim().slice(0, 100) || '';
              return {
                found: true,
                selector: sel,
                text,
                width: rect.width,
                height: rect.height,
                fitsViewport: rect.width <= window.innerWidth + 1,
              };
            }
          }
          return { found: false };
        });

        if (heroInfo.found) {
          checks.push(
            `Hero 区域: 选择器=${heroInfo.selector}, 文本="${heroInfo.text?.slice(0, 50)}", 宽度=${Math.round(heroInfo.width!)}px`
          );
          if (!heroInfo.fitsViewport) {
            issues.push(`Hero 区域溢出: 宽度 ${heroInfo.width}px > 视口 ${tc.viewport.width}px`);
          }
        } else {
          issues.push('未找到 Hero 区域');
        }
      }

      // 6. 检查功能卡片（仅首页）
      if (tc.url === 'http://localhost:3333/') {
        const cardInfo = await page.evaluate(() => {
          const cards = document.querySelectorAll(
            '[class*="card"], [class*="Card"], [class*="feature"], [class*="Feature"]'
          );
          if (cards.length === 0) return { found: false, count: 0 };

          const overflowing = 0;
          let maxWidth = 0;
          cards.forEach((card) => {
            const rect = card.getBoundingClientRect();
            if (rect.width > maxWidth) maxWidth = rect.width;
          });

          return {
            found: true,
            count: cards.length,
            maxWidth,
            viewportWidth: window.innerWidth,
            allFit: maxWidth <= window.innerWidth + 1,
          };
        });

        if (cardInfo.found) {
          checks.push(`功能卡片: 数量=${cardInfo.count}, 最大宽度=${Math.round(cardInfo.maxWidth!)}px`);
          if (!cardInfo.allFit) {
            issues.push(`卡片溢出: 最大宽度 ${cardInfo.maxWidth}px > 视口 ${tc.viewport.width}px`);
          }
        } else {
          checks.push('未检测到卡片元素（可能使用不同布局）');
        }
      }

      // 7. 检查排盘表单（仅排盘页面）
      if (tc.url.includes('/chart')) {
        const formInfo = await page.evaluate(() => {
          const form = document.querySelector('form') || document.querySelector('[class*="form"]');
          const inputs = document.querySelectorAll('input, select, textarea');
          const buttons = document.querySelectorAll('button');
          const labels = document.querySelectorAll('label');

          // 检查表单元素宽度
          let maxInputWidth = 0;
          inputs.forEach((input) => {
            const rect = input.getBoundingClientRect();
            if (rect.width > maxInputWidth) maxInputWidth = rect.width;
          });

          return {
            formFound: !!form,
            inputCount: inputs.length,
            buttonCount: buttons.length,
            labelCount: labels.length,
            maxInputWidth,
            viewportWidth: window.innerWidth,
            inputsFit: maxInputWidth <= window.innerWidth + 1,
          };
        });

        if (formInfo.formFound) {
          checks.push(
            `表单: 输入框=${formInfo.inputCount}, 按钮=${formInfo.buttonCount}, 标签=${formInfo.labelCount}`
          );
          if (!formInfo.inputsFit) {
            issues.push(`输入框溢出: 最大宽度 ${formInfo.maxInputWidth}px > 视口 ${tc.viewport.width}px`);
          } else {
            checks.push(`表单元素宽度正常: 最大 ${Math.round(formInfo.maxInputWidth)}px`);
          }
        } else {
          // 排盘页面可能还没提交表单，检查页面内容
          const pageText = await page.evaluate(() => document.body.textContent?.slice(0, 200));
          checks.push(`页面内容预览: "${pageText?.slice(0, 100)}"`);
        }
      }

      // 8. 截取视口截图（非全页）
      const viewportScreenshotPath = path.join(
        ARTIFACTS_DIR,
        tc.screenshotName.replace('.png', '-viewport.png')
      );
      await page.screenshot({ path: viewportScreenshotPath });
      console.log(`  视口截图已保存: ${viewportScreenshotPath}`);

      results.push({
        name: tc.name,
        screenshotPath,
        checks,
        issues,
      });
    } catch (error) {
      console.log(`  [错误] ${error}`);
      results.push({
        name: tc.name,
        screenshotPath: '',
        checks: [],
        issues: [`测试执行失败: ${error}`],
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();

  // 输出报告
  console.log('\n\n========== 响应式测试报告 ==========\n');

  for (const result of results) {
    console.log(`\n## ${result.name}`);
    if (result.screenshotPath) {
      console.log(`  截图: ${result.screenshotPath}`);
    }
    if (result.checks.length > 0) {
      console.log('  检查项:');
      result.checks.forEach((c) => console.log(`    [OK] ${c}`));
    }
    if (result.issues.length > 0) {
      console.log('  问题:');
      result.issues.forEach((i) => console.log(`    [!!] ${i}`));
    }
  }

  const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
  console.log(`\n========== 总结: ${totalIssues} 个问题需要关注 ==========`);
}

runTests().catch(console.error);
