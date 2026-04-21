export function buildContent(prompt: string, ocrResults: string[]) {
  return `
[文本内容]

${prompt}

***

[图片OCR识别结果]
${ocrResults.join('\n')}`
}
