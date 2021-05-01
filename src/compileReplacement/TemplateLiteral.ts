import j, { TemplateLiteral, ASTPath } from 'jscodeshift'
import { getCaptureAs } from '../compileMatcher/Capture'
import { CompiledReplacement } from './'
import { Match } from '../find'
import cloneDeep from 'lodash/cloneDeep'
import { unescapeIdentifier } from './Capture'

function generateValue(cooked: string): { raw: string; cooked: string } {
  return { raw: cooked.replace(/\\|`|\${/g, '\\$&'), cooked }
}

export default function compileTemplateLiteralReplacement(
  path: ASTPath<TemplateLiteral>
): CompiledReplacement | void {
  const pattern = path.node
  if (pattern.quasis.length === 1) {
    const [quasi] = pattern.quasis
    const captureAs = getCaptureAs(quasi.value.cooked)
    if (captureAs) {
      return {
        generate: (match: Match): TemplateLiteral => {
          const captured = match.stringCaptures?.[captureAs]
          return captured
            ? j.templateLiteral(
                [j.templateElement(generateValue(captured), true)],
                []
              )
            : cloneDeep(pattern)
        },
      }
    }
    const unescaped = unescapeIdentifier(quasi.value.cooked)
    if (unescaped !== quasi.value.cooked) quasi.value = generateValue(unescaped)
  }
}
