import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './APP.jsx'
import './index.css'  // <--- 关键！必须这行代码，Tailwind 才会生效！

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)