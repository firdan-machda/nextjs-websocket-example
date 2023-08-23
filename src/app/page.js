'use client'
import Image from 'next/image'
import styles from './page.module.css'
import { useEffect, useState } from 'react'
import io from 'socket.io-client'
let socket;

export default function Home() {
  const [wsInstance, setWsInstance] = useState(null);
  const [messages, setMessages] = useState([])
  const [text, setText] = useState(null)

  useEffect(() => {
    async function getWs() {
      if (typeof window !== "undefined") {
        const ws = new WebSocket("ws://localhost:8000/ws/chat/")
        ws.onmessage = async function (e) {
          console.log(e.data)
          setMessages(arr => [...arr, e.data])
        }
        ws.onopen = async function (e) {
          console.log("Connected")
        }
        setWsInstance(ws)

      }
      return () => {
        // Cleanup on unmount if ws wasn't closed already
        if (ws?.readyState !== 3)
          ws.close()
      }
    }
    getWs()

  }, [])

  function submit() {
    if (typeof window !== "undefined") {
      wsInstance.send(JSON.stringify(text))
    }
  }
  return (
    <main className={styles.main}>
      <div className={styles.description}>
        <div>
          <a
            href="https://vercel.com?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            By{' '}
            <Image
              src="/vercel.svg"
              alt="Vercel Logo"
              className={styles.vercelLogo}
              width={100}
              height={24}
              priority
            />
          </a>
        </div>
      </div>
        <div>
          <ul>
          {
            messages.map((val, index) => {
              return (<li key={index}>{val}</li>)
            })
          }
          </ul>
          <input id="chat-input" onChange={(e) => setText(e.target.value)}>
          </input>
          <button onClick={submit}>submit</button>
        </div>
    </main>
  )
}
