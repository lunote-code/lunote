import type { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'

import {
  registerCodeBlockBoundarySession,
  unregisterCodeBlockBoundarySession,
} from './codeBlockBoundaryRegistry'
import { createCodeBlockBoundarySession, type CodeBlockBoundarySession } from './codeBlockBoundarySession'

/** One boundary session per mounted code-block node view. */
export function useCodeBlockBoundary(
  editor: Editor,
  blockPos: number | null,
): CodeBlockBoundarySession {
  const sessionRef = useRef<CodeBlockBoundarySession | null>(null)
  if (sessionRef.current == null) {
    sessionRef.current = createCodeBlockBoundarySession(editor)
  }

  useEffect(() => {
    const session = sessionRef.current
    if (session == null || blockPos == null) return
    registerCodeBlockBoundarySession(editor, blockPos, session)
    return () => {
      unregisterCodeBlockBoundarySession(editor, blockPos)
    }
  }, [blockPos, editor])

  useEffect(() => {
    const session = sessionRef.current
    return () => {
      session?.dispose()
    }
  }, [editor])

  return sessionRef.current
}
