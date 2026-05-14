import fs from 'fs'

// 从 SKILL 文档提取格局名称
const skillContent = fs.readFileSync('sysfiles/sysalldoc/SKILL_宫位原生能级评估.md', 'utf-8')
const skillPatterns: string[] = []
const lines = skillContent.split('\n')
for (const line of lines) {
  const match = line.match(/^\| ([^|]+) \| (紫微|廉贞|武曲|巨门|日月|杀破狼|天府|机梁同|其他) \|/)
  if (match && !line.includes('格局名称') && !line.includes(':---')) {
    skillPatterns.push(match[1].trim())
  }
}

// 从 patterns.json 提取格局名称
const data = JSON.parse(fs.readFileSync('data/patterns.json', 'utf-8'))
const jsonPatterns: string[] = []
for (const [cat, patterns] of Object.entries(data.categories)) {
  for (const p of patterns as string[]) {
    jsonPatterns.push(p)
  }
}

// 找差异
const skillSet = new Set(skillPatterns)
const jsonSet = new Set(jsonPatterns)

const onlyInJson = jsonPatterns.filter(p => !skillSet.has(p))
const onlyInSkill = skillPatterns.filter(p => !jsonSet.has(p))

console.log('SKILL 文档格局数:', skillPatterns.length)
console.log('patterns.json 格局数:', jsonPatterns.length)
console.log('')
console.log('只在 patterns.json 中:', onlyInJson.length)
for (const p of onlyInJson) {
  console.log('  -', p)
}
console.log('')
console.log('只在 SKILL 文档中:', onlyInSkill.length)
for (const p of onlyInSkill) {
  console.log('  -', p)
}
