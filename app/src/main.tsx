import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import StartPage from './start/StartPage'
import UserClanEditor from './user/UserClanEditor'
import './index.css'
import './start/start.css'
import './user/user.css'

function ProductionApp() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash === '#user' ? <UserClanEditor /> : <StartPage development={false} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProductionApp />
  </StrictMode>,
)
