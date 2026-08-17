import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Chettik from './Chettik.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Chettik />
  </StrictMode>,
)
