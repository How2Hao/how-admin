import { MarkdownTextSplitter } from '@langchain/textsplitters'

const splitter = new MarkdownTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
})

export async function splitMarkdown(md: string): Promise<string[]> {
  return await splitter.splitText(md)
}
