import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { UPDATE_PROPOSAL_TOOL } from '@/lib/ai/tools'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'

// Extend Vercel serverless function timeout to 60 s (max on Hobby, well within Pro).
// Without this, Vercel's default 10 s timeout kills the function mid-stream and
// the client receives an empty response with the loading spinner stuck on.
export const maxDuration = 60

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

      // Buffer tool input JSON as it streams so we can send tool_result
      // the moment the block ends — no need to wait for finalMessage().
      let toolInputBuffer = ''
      let currentToolName = ''
      let toolResultSent = false

      // Streaming extraction of follow_up_question from the tool JSON delta.
      // follow_up_question is the first field in the schema so it generates first.
      // As its characters arrive we forward them as text events — the client sees
      // the reaction text appear in real time instead of waiting for the full JSON.
      let fupState: 'search' | 'stream' | 'done' = 'search'
      let fupCursor = 0   // position in toolInputBuffer up to which we have streamed
      let fupEscaped = false

      function streamFollowUpChars() {
        if (fupState === 'done') return

        if (fupState === 'search') {
          const FIELD = '"follow_up_question"'
          const fi = toolInputBuffer.indexOf(FIELD)
          if (fi === -1) return
          // Advance past the field name, colon, and any whitespace to the opening quote
          let i = fi + FIELD.length
          while (i < toolInputBuffer.length && toolInputBuffer[i] !== '"') i++
          if (i >= toolInputBuffer.length) return  // opening quote not yet in buffer
          fupCursor = i + 1  // position right after the opening quote
          fupState = 'stream'
        }

        // Stream characters of the value until the closing unescaped quote
        while (fupCursor < toolInputBuffer.length) {
          const ch = toolInputBuffer[fupCursor++]
          if (fupEscaped) {
            if      (ch === 'n')  send('text', { text: '\n' })
            else if (ch === '"')  send('text', { text: '"' })
            else if (ch === '\\') send('text', { text: '\\' })
            else if (ch === 't')  send('text', { text: '\t' })
            else if (ch === 'u' && fupCursor + 4 <= toolInputBuffer.length) {
              // \uXXXX unicode escape
              const code = parseInt(toolInputBuffer.slice(fupCursor, fupCursor + 4), 16)
              if (!isNaN(code)) send('text', { text: String.fromCharCode(code) })
              fupCursor += 4
            }
            // else: unknown escape — skip
            fupEscaped = false
          } else if (ch === '\\') {
            fupEscaped = true
          } else if (ch === '"') {
            fupState = 'done'  // reached end of follow_up_question value
            break
          } else {
            send('text', { text: ch })
          }
        }
      }

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_start') {
            if (chunk.content_block.type === 'tool_use') {
              currentToolName = chunk.content_block.name
              toolInputBuffer = ''
              // Reset extraction state for each new tool block
              fupState = 'search'
              fupCursor = 0
              fupEscaped = false
            }
          } else if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              send('text', { text: chunk.delta.text })
            } else if (chunk.delta.type === 'input_json_delta') {
              toolInputBuffer += chunk.delta.partial_json
              // Forward follow_up_question characters as text events in real time
              streamFollowUpChars()
            }
          } else if (chunk.type === 'content_block_stop') {
            // Tool block finished — parse buffered JSON and send result immediately
            if (currentToolName && toolInputBuffer) {
              try {
                const input = JSON.parse(toolInputBuffer)
                send('tool_result', { name: currentToolName, input })
                toolResultSent = true
              } catch {
                console.warn('Failed to parse tool JSON on block_stop')
              }
              currentToolName = ''
              toolInputBuffer = ''
            }
          }
        }

        // Fallback: if buffer parse failed for any reason, try finalMessage
        if (!toolResultSent) {
          const finalMessage = await stream.finalMessage()
          const toolBlock = finalMessage.content.find((b) => b.type === 'tool_use')
          if (toolBlock && toolBlock.type === 'tool_use') {
            send('tool_result', { name: toolBlock.name, input: toolBlock.input })
          }
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
      'Connection': 'keep-alive',
      // Tell nginx/Vercel edge layer not to buffer this response —
      // chunks must reach the client as soon as they are enqueued.
      'X-Accel-Buffering': 'no',
    },
  })
}
