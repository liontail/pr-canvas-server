import { render } from 'preact'
import { App } from './App.jsx'
import { Home } from './Home.jsx'
import './styles.css'
import './tokens.css'

const root = document.getElementById('app')
root.textContent = ''
render(root.dataset.page === 'home' ? <Home /> : <App canvasId={root.dataset.canvasId} />, root)
