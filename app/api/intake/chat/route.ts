import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { UPDATE_PROPOSAL_TOOL } from '@/lib/ai/tools'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic()

const MAX_MESSAGES = 50

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Invalid messages' }), { status: 400 })
  }

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [UPDATE_PROPOSAL_TOOL],
    tool_choice: { type: 'any' },
    messages,
  })

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
        )
      }

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              send('text', { text: chunk.delta.text })
            } else if (chunk.delta.type === 'input_json_delta') {
              send('tool_delta', { partial_json: chunk.delta.partial_json })
            }
          } else if (chunk.type === 'content_block_start') {
            if (chunk.content_block.type === 'tool_use') {
              send('tool_start', { name: chunk.content_block.name, id: chunk.content_block.id })
            }
          } else if (chunk.type === 'content_block_stop') {
            send('block_stop', {})
          }
        }

        // Await finalMessage after loop completes — SDK guarantees resolution here
        const finalMessage = await stream.finalMessage()
        const toolBlock = finalMessage.content.find((b) => b.type === 'tool_use')
        if (toolBlock && toolBlock.type === 'tool_use') {
          send('tool_result', { name: toolBlock.name, input: toolBlock.input })
        }
        send('done', {})
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Unknown error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
