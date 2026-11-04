/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Built-in default, used until an admin saves custom content.
export const defaultSpec = `# DolphinScheduler 开发规范

> 细节查《DolphinScheduler任务开发规范.md》。

## 命名

- **落表的工作流，以结果表命名**：工作流名 = 产出表名，原则上一个工作流只写一张表。例：\`ads_hems_device_report_day\`
- **不落表的工作流，加用途前缀**：\`dq_\` 数据校验、\`mon_\` 系统巡检、\`sync_\` 向外输出、\`tmp_YYYYMMDD_\` 临时作业
- 名称只用**小写字母、数字、下划线**；中文说明写在描述（description）里

## 写 SQL

- **业务时间不要用 \`now()\`**，改用调度参数：天任务用 \`biz_date=$[yyyy-MM-dd-1]\`，小时任务用 \`start_time\` / \`end_time\`，时间窗口左闭右开
- 密码不要写进脚本，统一使用 DS 数据源

## 依赖

- 有上游时，在首位放一个依赖节点 \`wait_upstream\`，**不要靠错开调度时间来猜上游是否跑完**
- 上游修复后，**下游需要一起重跑**

## 上线前确认

- [ ] 已开启失败告警（工作流和定时调度**两处都要配**）
- [ ] 修改工作流后，**确认定时调度仍为上线状态**（DS 下线工作流时会连带下线调度）
- [ ] 描述中写明：产出表、数据来源、负责人
`

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// inline: `code`, **bold**, *italic*, [text](http...)
const inline = (raw: string) => {
  const codes: string[] = []
  let s = escapeHtml(raw).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c)
    return `\u0000${codes.length - 1}\u0000`
  })
  s = s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`)
}

/** Minimal, XSS-safe markdown renderer (all text is escaped before formatting). */
export function renderMarkdown(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let list: 'ul' | null = null
  let para: string[] = []
  let inCode = false
  let code: string[] = []
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  const closeList = () => {
    if (list) out.push('</ul>')
    list = null
  }
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
        code = []
        inCode = false
      } else {
        flushPara()
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      code.push(line)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    const q = line.match(/^>\s?(.*)$/)
    if (h) {
      flushPara()
      closeList()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    } else if (li) {
      flushPara()
      if (!list) {
        out.push('<ul>')
        list = 'ul'
      }
      const task = li[1].match(/^\[( |x|X)\]\s+(.*)$/)
      out.push(
        task
          ? `<li class="task"><span class="box">${task[1] === ' ' ? '☐' : '☑'}</span>${inline(task[2])}</li>`
          : `<li>${inline(li[1])}</li>`
      )
    } else if (q) {
      flushPara()
      closeList()
      out.push(`<blockquote>${inline(q[1])}</blockquote>`)
    } else if (!line.trim()) {
      flushPara()
      closeList()
    } else {
      closeList()
      para.push(line.trim())
    }
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  flushPara()
  closeList()
  return out.join('\n')
}
