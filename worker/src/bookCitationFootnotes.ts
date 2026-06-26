/**
 * Stream transform: [1] / [1, 2] → [^n] and append [^n]: [label](url) definitions (askit cag parity).
 */
export function bookCitationFootnotes(
  footnotes: string[],
): TransformStream<string, string> {
  const used = new Set<number>()
  let state: 'text' | 'citation' = 'text'
  let digits = ''

  function emitCitation(
    controller: TransformStreamDefaultController<string>,
    raw: string,
  ) {
    const index = Number(raw)
    if (Number.isInteger(index) && index >= 1 && index <= footnotes.length) {
      used.add(index)
      controller.enqueue(`[^${index}]`)
    } else {
      controller.enqueue(`[${raw}]`)
    }
  }

  return new TransformStream<string, string>({
    transform(chunk, controller) {
      for (const char of chunk) {
        if (state === 'text') {
          if (char === '[') {
            state = 'citation'
            digits = ''
          } else {
            controller.enqueue(char)
          }
          continue
        }

        if (/\s/.test(char) && digits === '') continue
        if (/\d/.test(char) && digits.length < 9) {
          digits += char
          continue
        }
        if (char === ',' && digits !== '') {
          emitCitation(controller, digits)
          controller.enqueue(', ')
          digits = ''
          continue
        }
        if (char === ']' && digits !== '') {
          emitCitation(controller, digits)
          state = 'text'
          digits = ''
          continue
        }
        controller.enqueue(`[${digits}${char}`)
        state = 'text'
        digits = ''
      }
    },
    flush(controller) {
      if (state === 'citation') controller.enqueue(`[${digits}`)
      if (footnotes.length > 0) {
        controller.enqueue('\n\n')
        for (let i = 0; i < footnotes.length; i++) {
          controller.enqueue(`[^${i + 1}]: ${footnotes[i]}\n`)
        }
      }
    },
  })
}