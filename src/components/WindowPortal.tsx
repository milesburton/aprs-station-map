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
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

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
    newWindow.document.title = title

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        if (sheet.href) {
          const link = newWindow.document.createElement('link')
          link.rel = 'stylesheet'
          link.href = sheet.href
          newWindow.document.head.appendChild(link)
        } else if (sheet.cssRules) {
          const style = newWindow.document.createElement('style')
          style.textContent = Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n')
          newWindow.document.head.appendChild(style)
        }
      } catch (e) {
        // Cross-origin stylesheets are inaccessible by design; skip them
        console.warn('[WindowPortal] Could not copy stylesheet:', e)
      }
    }

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

    const containerDiv = newWindow.document.createElement('div')
    containerDiv.id = 'portal-root'
    newWindow.document.body.appendChild(containerDiv)

    setContainer(containerDiv)

    const handleUnload = () => onClose()
    newWindow.addEventListener('beforeunload', handleUnload)

    return () => {
      newWindow.removeEventListener('beforeunload', handleUnload)
      newWindow.close()
      windowRef.current = null
    }
  }, [title, width, height, onClose])

  if (!container) {
    return null
  }

  return createPortal(children, container)
}
