import type { FC, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface WindowPortalProps {
  children: ReactNode
  title: string
  width?: number
  height?: number
  onClose: () => void
}

export const WindowPortal: FC<WindowPortalProps> = ({
  children,
  title,
  width = 1200,
  height = 600,
  onClose,
}) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const windowRef = useRef<Window | null>(null)

  useEffect(() => {
    // Calculate center position
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    // Open new window
    const newWindow = window.open(
      '',
      '',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes`
    )

    if (!newWindow) {
      console.error('[WindowPortal] Failed to open popup window - blocked by browser?')
      onClose()
      return
    }

    windowRef.current = newWindow

    // Set up the new window's document
    newWindow.document.title = title

    // Copy styles from parent window
    const styleSheets = Array.from(document.styleSheets)
    for (const sheet of styleSheets) {
      try {
        if (sheet.href) {
          // External stylesheet
          const link = newWindow.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = sheet.href
          newWindow.document.head.appendChild(link)
        } else if (sheet.cssRules) {
          // Inline styles
          const style = newWindow.document.createElement('style')
          const rules = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n')
          style.textContent = rules
          newWindow.document.head.appendChild(style)
        }
      } catch (e) {
        // Cross-origin stylesheets will throw, skip them
        console.warn('[WindowPortal] Could not copy stylesheet:', e)
      }
    }

    // Add base styles for the popup
    const baseStyle = newWindow.document.createElement('style')
    baseStyle.textContent = `
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
        background: #0f172a;
        color: #f1f5f9;
        font-family: system-ui, -apple-system, sans-serif;
      }
      #portal-root {
        height: 100%;
        padding: 16px;
        box-sizing: border-box;
      }
    `
    newWindow.document.head.appendChild(baseStyle)

    // Create container for React portal
    const containerDiv = newWindow.document.createElement('div')
    containerDiv.id = 'portal-root'
    newWindow.document.body.appendChild(containerDiv)

    setContainer(containerDiv)

    // Handle window close
    const handleUnload = () => {
      onClose()
    }

    newWindow.addEventListener('beforeunload', handleUnload)

    // Cleanup on unmount
    return () => {
      newWindow.removeEventListener('beforeunload', handleUnload)
      newWindow.close()
      windowRef.current = null
    }
  }, [title, width, height, onClose])

  // Portal children into the new window
  if (!container) {
    return null
  }

  return createPortal(children, container)
}
