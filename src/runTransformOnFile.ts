import { Transform } from './variant'
import jscodeshift from 'jscodeshift'
import { getParserAsync } from 'babel-parse-wild-code'
import Astx, { StatementsMatchArray, MatchArray } from './Astx'
import fs from 'fs-extra'
import Path from 'path'
import memoize from 'lodash/memoize'
import { promisify } from 'util'
import _resolve from 'resolve'
import makeTemplate from './util/template'
const resolve = promisify(_resolve) as any

export type TransformResult = {
  file: string
  source?: string
  transformed?: string
  reports?: any[]
  error?: Error
  matches?: MatchArray<any> | StatementsMatchArray
}

const getPrettier = memoize(
  async (path: string): Promise<any> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const prettier = require(await resolve('prettier', {
        basedir: path,
      }))
      if (
        typeof prettier.format === 'function' &&
        typeof prettier.resolveConfig === 'function'
      )
        return prettier
    } catch (error) {
      // ignore
    }
    return null
  }
)

export const runTransformOnFile = (transform: Transform) => async (
  file: string
): Promise<TransformResult> => {
  try {
    const source = await fs.readFile(file, 'utf8')
    const parser =
      transform.parser || (await getParserAsync(file, { tokens: true }))
    const j = jscodeshift.withParser(parser)
    const template = makeTemplate(j)

    let transformed
    const reports: any[] = []

    let matches: MatchArray<any> | StatementsMatchArray | undefined

    let transformFn = transform.astx

    if (typeof transformFn !== 'function' && transform.find) {
      transformFn = ({ astx }) => {
        matches = astx.findAuto(transform.find as any, {
          where: transform.where,
        })
        if (transform.replace) matches.replace(transform.replace as any)
      }
    }
    if (typeof transformFn === 'function') {
      const root = j(source)
      const options = {
        source,
        path: file,
        j,
        jscodeshift: j,
        report: (msg: any) => {
          reports.push(msg)
        },
        ...template,
        root,
        astx: new Astx(j, root),
      }
      const [_result, prettier] = await Promise.all([
        transformFn(options),
        getPrettier(Path.dirname(file)),
      ])
      transformed = _result
      if (transformed === undefined) transformed = root
      if (transformed instanceof Object) transformed = transformed.toSource()
      if (
        prettier &&
        typeof transformed === 'string' &&
        transformed !== source
      ) {
        const config = (await prettier.resolveConfig(file)) || {}
        if (/\.tsx?$/.test(file)) config.parser = 'typescript'
        transformed = prettier.format(transformed, config)
      }
    } else {
      return {
        file,
        error: new Error(
          'transform file must export either astx or find/replace'
        ),
      }
    }
    return {
      file,
      source,
      transformed,
      reports,
      matches,
    }
  } catch (error) {
    return {
      file,
      error,
    }
  }
}
