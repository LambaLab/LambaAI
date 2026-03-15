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

      // transition_text streaming — runs after fupState === 'done'.
      // transition_text is optional (model may produce "" or omit it entirely).
      // When non-empty, we send a bubble_split event first so the client creates a
      // second assistant message, then stream the transition chars as text events
      // into that second bubble.  When empty or absent, txState resolves to 'empty'
      // immediately and everything behaves exactly as before (one bubble).
      //
      // States:
      //   'search' — scanning buffer for "transition_text" or "question" key
      //   'split'  — found opening quote; peeking at first char to decide
      //   'stream' — streaming non-empty value chars as text events (bubble 2)
      //   'done'   — closing quote reached; transition complete
      //   'empty'  — model produced "" or skipped the field; no second bubble
      let txState: 'search' | 'split' | 'stream' | 'done' | 'empty' = 'search'
      let txCursor = 0
      let txEscaped = false
      let bubbleSplitSent = false

      function streamTransitionChars() {
        // Only runs once follow_up_question is fully streamed
        if (fupState !== 'done') return
        if (txState === 'done' || txState === 'empty') return

        if (txState === 'search') {
          const TX_FIELD = '"transition_text"'
          const Q_FIELD  = '"question"'
          const txi = toolInputBuffer.indexOf(TX_FIELD)
          const qi  = toolInputBuffer.indexOf(Q_FIELD)
          if (txi === -1 && qi === -1) return  // neither visible yet
          // If "question" appears before "transition_text" the model skipped it
          if (qi !== -1 && (txi === -1 || qi < txi)) { txState = 'empty'; return }
          // transition_text key found — advance past key, colon, whitespace to opening quote
          let i = txi + TX_FIELD.length
          while (i < toolInputBuffer.length && toolInputBuffer[i] !== '"') i++
          if (i >= toolInputBuffer.length) return  // opening quote not yet in buffer
          txCursor = i + 1  // position right after opening quote
          txState = 'split'
        }

        if (txState === 'split') {
          if (txCursor >= toolInputBuffer.length) return
          if (toolInputBuffer[txCursor] === '"') { txState = 'empty'; return }  // empty string ""
          // Non-empty value — fire bubble_split once, then start streaming chars
          if (!bubbleSplitSent) { send('bubble_split', {}); bubbleSplitSent = true }
          txState = 'stream'
        }

        if (txState === 'stream') {
          while (txCursor < toolInputBuffer.length) {
            const ch = toolInputBuffer[txCursor++]
            if (txEscaped) {
              if      (ch === 'n')  send('text', { text: '\n' })
              else if (ch === '"')  send('text', { text: '"' })
              else if (ch === '\\') send('text', { text: '\\' })
              else if (ch === 't')  send('text', { text: '\t' })
              else if (ch === 'u' && txCursor + 4 <= toolInputBuffer.length) {
                const code = parseInt(toolInputBuffer.slice(txCursor, txCursor + 4), 16)
                if (!isNaN(code)) send('text', { text: String.fromCharCode(code) })
                txCursor += 4
              }
              // else: unknown escape — skip char
              txEscaped = false
            } else if (ch === '\\') {
              txEscaped = true
            } else if (ch === '"') {
              txState = 'done'; break
            } else {
              send('text', { text: ch })
            }
          }
        }
      }

      // Partial-result detection: question and quick_replies come after transition_text
      // in the schema order, so they generate after the transition is done.
      // As soon as both are complete in the buffer (and txState is terminal), send a
      // partial_result event so the client can show the QR card without waiting for
      // the full JSON (which includes the heavy product_overview and module_summaries).
      let partialResultSent = false

      // Partial-modules detection: detected_modules comes right after quick_replies
      // in the schema so it generates within ~100ms of the QR card appearing.
      // Fire partial_modules as soon as the array is complete — this makes the module
      // cards appear immediately instead of waiting for product_overview and
      // module_summaries (which can add 4–6 extra seconds before tool_result fires).
      let partialModulesSent = false

      function tryEmitPartialModules() {
        // Only fire after the QR card is visible, and only once per turn
        if (partialModulesSent || !partialResultSent) return

        const detectedModules = extractArrayField('detected_modules')
        if (detectedModules === null) return  // array not yet complete in buffer

        send('partial_modules', { detected_modules: detectedModules })
        partialModulesSent = true
      }

      // Extract a complete JSON string value for the given field name from the buffer.
      // Returns the decoded string, or null if the value is not yet fully present.
      function extractStringField(fieldName: string): string | null {
        const FIELD = `"${fieldName}"`
        const fi = toolInputBuffer.indexOf(FIELD)
        if (fi === -1) return null
        let i = fi + FIELD.length
        // Skip colon and whitespace to opening quote
        while (i < toolInputBuffer.length && toolInputBuffer[i] !== '"') i++
        if (i >= toolInputBuffer.length) return null
        i++ // past opening quote
        let value = ''
        let escaped = false
        while (i < toolInputBuffer.length) {
          const ch = toolInputBuffer[i++]
          if (escaped) {
            if      (ch === 'n')  value += '\n'
            else if (ch === '"')  value += '"'
            else if (ch === '\\') value += '\\'
            else if (ch === 't')  value += '\t'
            else if (ch === 'u' && i + 3 < toolInputBuffer.length) {
              const code = parseInt(toolInputBuffer.slice(i, i + 4), 16)
              if (!isNaN(code)) value += String.fromCharCode(code)
              i += 4
            }
            escaped = false
          } else if (ch === '\\') {
            escaped = true
          } else if (ch === '"') {
            return value  // closing quote found — value is complete
          } else {
            value += ch
          }
        }
        return null  // closing quote not yet in buffer
      }

      // Extract a complete JSON array value for the given field name from the buffer.
      // Uses bracket depth tracking to find the closing ]. Returns the parsed array,
      // or null if the array is not yet fully present in the buffer.
      function extractArrayField(fieldName: string): unknown[] | null {
        const FIELD = `"${fieldName}"`
        const fi = toolInputBuffer.indexOf(FIELD)
        if (fi === -1) return null
        let i = fi + FIELD.length
        // Skip colon and whitespace to opening bracket
        while (i < toolInputBuffer.length && toolInputBuffer[i] !== '[') i++
        if (i >= toolInputBuffer.length) return null
        const start = i
        let depth = 0
        let inStr = false
        let strEsc = false
        let end = -1
        for (let j = start; j < toolInputBuffer.length; j++) {
          const ch = toolInputBuffer[j]
          if (inStr) {
            if (strEsc)           { strEsc = false }
            else if (ch === '\\') { strEsc = true }
            else if (ch === '"')  { inStr = false }
          } else {
            if      (ch === '"')              { inStr = true }
            else if (ch === '{' || ch === '[') { depth++ }
            else if (ch === '}' || ch === ']') {
              depth--
              if (depth === 0) { end = j; break }
            }
          }
        }
        if (end === -1) return null
        try {
          return JSON.parse(toolInputBuffer.slice(start, end + 1)) as unknown[]
        } catch {
          return null
        }
      }

      // Extract a complete JSON object value for the given field name from the buffer.
      // Uses brace/bracket depth tracking to find the closing }. Returns the parsed
      // object, or null if the object is not yet fully present.
      function extractObjectField(fieldName: string): Record<string, unknown> | null {
        const FIELD = `"${fieldName}"`
        const fi = toolInputBuffer.indexOf(FIELD)
        if (fi === -1) return null
        let i = fi + FIELD.length
        // Skip colon and whitespace to opening brace
        while (i < toolInputBuffer.length && toolInputBuffer[i] !== '{') i++
        if (i >= toolInputBuffer.length) return null
        const start = i
        let depth = 0
        let inStr = false
        let strEsc = false
        let end = -1
        for (let j = start; j < toolInputBuffer.length; j++) {
          const ch = toolInputBuffer[j]
          if (inStr) {
            if (strEsc)       { strEsc = false }
            else if (ch === '\\') { strEsc = true }
            else if (ch === '"')  { inStr = false }
          } else {
            if      (ch === '"')              { inStr = true }
            else if (ch === '{' || ch === '[') { depth++ }
            else if (ch === '}' || ch === ']') {
              depth--
              if (depth === 0) { end = j; break }
            }
          }
        }
        if (end === -1) return null
        try {
          return JSON.parse(toolInputBuffer.slice(start, end + 1)) as Record<string, unknown>
        } catch {
          return null
        }
      }

      function tryEmitPartialResult() {
        if (partialResultSent || fupState !== 'done') return
        // Block until transition_text is resolved — QR card must not appear while
        // the second bubble is still streaming (it would flash in mid-sentence)
        if (txState !== 'done' && txState !== 'empty') return

        // suggest_pause now appears before question/quick_replies in the schema, so it's
        // always generated before we reach this point. Wait for it to arrive — we must
        // know whether this is a pause turn before deciding to emit partial_result.
        const suggestPauseMatch = toolInputBuffer.match(/"suggest_pause"\s*:\s*(true|false)/)
        if (suggestPauseMatch === null) return  // not yet generated — wait

        if (suggestPauseMatch[1] === 'true') {
          // Pause turn: the checkpoint is created in tool_result on the client.
          // Suppressing partial_result here prevents QRs from being attached to the
          // reaction bubble prematurely and keeps isStreaming=true until the checkpoint
          // message exists and isStreaming is reset by the tool_result handler.
          send('debug', { why: 'suppressed_pause' })
          partialResultSent = true
          return
        }

        const question = extractStringField('question')
        if (question === null) return

        const quickReplies = extractObjectField('quick_replies')
        if (quickReplies === null) return

        // Validate quick_replies has at least one option
        const options = quickReplies.options
        if (!Array.isArray(options) || options.length === 0) {
          send('debug', { why: 'invalid_options', opts: JSON.stringify(options ?? null).slice(0, 100) })
          partialResultSent = true  // invalid QR — don't retry; full tool_result will handle
          return
        }

        send('partial_result', { question, quick_replies: quickReplies, suggest_pause: false })
        partialResultSent = true
      }

      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_start') {
            if (chunk.content_block.type === 'tool_use') {
              currentToolName = chunk.content_block.name
              toolInputBuffer = ''
              // Reset fup extraction state for each new tool block
              fupState = 'search'
              fupCursor = 0
              fupEscaped = false
              partialResultSent = false
              partialModulesSent = false
              // Reset transition_text extraction state
              txState = 'search'
              txCursor = 0
              txEscaped = false
              bubbleSplitSent = false
            }
          } else if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              send('text', { text: chunk.delta.text })
            } else if (chunk.delta.type === 'input_json_delta') {
              toolInputBuffer += chunk.delta.partial_json
              // 1. Stream follow_up_question chars as text events (bubble 1)
              streamFollowUpChars()
              // 2. Stream transition_text chars as text events (bubble 2, if present)
              //    Also fires bubble_split event to create the second bubble on the client
              streamTransitionChars()
              // 3. Once transition is resolved, watch for question + quick_replies
              //    completing so we can show the QR card without waiting for full JSON
              tryEmitPartialResult()
              // 4. Once QR card is shown, watch for detected_modules completing so we
              //    can update the module panel immediately — before the heavy
              //    product_overview and module_summaries fields finish generating
              tryEmitPartialModules()
            }
          } else if (chunk.type === 'content_block_stop') {
            // Diagnostic: capture state at end of tool block to understand partial_result behaviour
            if (currentToolName && !partialResultSent) {
              const spMatch = toolInputBuffer.match(/"suggest_pause"\s*:\s*(true|false)/)
              send('debug', {
                why: 'no_partial_result_at_stop',
                fup: fupState,
                tx: txState,
                suggestPause: spMatch?.[1] ?? null,
                hasQ: toolInputBuffer.includes('"question"'),
                hasQR: toolInputBuffer.includes('"quick_replies"'),
                bufLen: toolInputBuffer.length,
              })
            }
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
