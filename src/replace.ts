import j, { ASTNode, ASTPath, Collection } from 'jscodeshift'
import t from 'ast-types'
import find, { Match } from './find'
import compileReplacement from './compileReplacement'

export function generateReplacements(
  match: Match,
  replace: ASTNode | ASTNode[] | ((match: Match) => ASTNode | ASTNode[])
): ASTNode | ASTNode[] {
  const replacement = compileReplacement(
    j(typeof replace === 'function' ? replace(match) : replace).paths()[0]
  ).generate(match)
  const ensureSameType =
    match.path.parentPath.node.type === 'ExpressionStatement' ||
    t.namedTypes.Statement.check(match.node)
      ? ensureStatement
      : ensureNotStatement
  if (Array.isArray(replacement))
    return replacement.map(ensureSameType as (node: ASTNode) => ASTNode)
  return ensureSameType(replacement)
}

export function replaceMatches(
  matches: Match[],
  replace: ASTNode | ASTNode[] | ((match: Match) => ASTNode | ASTNode[])
): void {
  for (const match of matches) {
    const replacements = generateReplacements(match, replace)
    if (match.path.parentPath.node.type === 'ExpressionStatement') {
      match.path.parentPath.replace(replacements)
    } else {
      match.path.replace(replacements)
    }
  }
}

function ensureNotStatement(value: ASTNode): ASTNode {
  switch (value.type) {
    case 'ClassDeclaration':
      return { ...value, type: 'ClassExpression' }
    case 'FunctionDeclaration':
      return { ...value, type: 'FunctionExpression' }
    case 'ExpressionStatement':
      return value.expression
  }
  return value
}

function ensureStatement(value: ASTNode): ASTNode {
  switch (value.type) {
    case 'ClassExpression':
      return { ...value, type: 'ClassDeclaration' }
    case 'FunctionExpression':
      return {
        ...value,
        id: value.id || j.identifier('anonymous'),
        type: 'FunctionDeclaration',
      }
  }
  if (t.namedTypes.Expression.check(value)) return j.expressionStatement(value)
  if (t.namedTypes.Statement.check(value)) return value
  throw new Error(`expected an expression or statement, but got: ${value.type}`)
}

function ensureStatements(value: ASTNode | ASTNode[]): ASTNode[] {
  if (Array.isArray(value)) return value.map(ensureStatement)
  return [ensureStatement(value)]
}

export function replaceStatementsMatches(
  matches: Match[],
  replace: ASTNode | ASTNode[] | ((match: Match) => ASTNode | ASTNode[])
): void {
  for (const match of matches) {
    const replacements = ensureStatements(
      compileReplacement(
        j(typeof replace === 'function' ? replace(match) : replace).paths()
      ).generate(match)
    )
    const parent = match.paths[0].parentPath
    let index = match.paths[0].name
    for (const replacement of replacements) {
      parent.insertAt(index++, replacement)
    }
    for (const path of match.paths) path.prune()
  }
}

export type ReplaceOptions = {
  where?: { [captureName: string]: (path: ASTPath) => boolean }
}

export default function replace(
  root: Collection,
  pattern: ASTPath | ASTPath[],
  replace: ASTNode | ASTNode[] | ((match: Match) => ASTNode | ASTNode[]),
  options?: ReplaceOptions
): void {
  if (Array.isArray(pattern) && pattern.length === 1) pattern = pattern[0]
  const matches = find(root, pattern, options)
  if (Array.isArray(pattern) && t.namedTypes.Statement.check(pattern[0].node)) {
    replaceStatementsMatches(matches, replace)
  } else {
    replaceMatches(matches, replace)
  }
}
