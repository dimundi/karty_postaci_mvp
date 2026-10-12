import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import TemplateCreator from './editor/LayeredTemplateEditor'
import DeveloperHome from './developer/DeveloperHome'
import StartPage from './start/StartPage'
import UserClanEditor from './user/UserClanEditor'
import './index.css'
import './editor/editor.css'
import './developer/developer.css'
import './start/start.css'
import './user/user.css'

function DevelopmentApp() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (hash === '#dev') {
    return <DeveloperHome />
  }

  if (hash === '#dev-templates' || hash === '#dev-clans' || hash === '#dev-archetypes') {
    return <TemplateCreator />
  }

  if (hash === '#user') {
    return <UserClanEditor />
  }

  return <StartPage development />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevelopmentApp />
  </StrictMode>,
)
