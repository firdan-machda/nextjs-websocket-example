'use client'
import Image from 'next/image'
import styles from './page.module.css'
import { useEffect, useState } from 'react'
import io from 'socket.io-client'
import Card from '@/components/card'
let socket;

export default function Home() {
  const [wsInstance, setWsInstance] = useState(null);
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)


  function establishWebsocket() {
    if (typeof window !== "undefined") {
      const ws = new WebSocket("ws://localhost:8000/ws/chat/test/")
      ws.onmessage = (e) => {
        console.log("WS", e.data)
        const parsed = JSON.parse(e.data)
        if (parsed.type == "system") {
          if (parsed.message == "loading") {
            setLoading(true)
          } else if (parsed.message == "finished-loading") {
            setLoading(false)
          }
        } else {
          setMessages(arr => [...arr, parsed])
        }
      }
      ws.onopen = (e) => {
        console.log("Connected")
        setLoading(false)
      }
      ws.onclose = (e) => {
        console.log('Disconnected')
      }
      setWsInstance(ws)
    }

  }

  useEffect(() => {
    console.log('call ws')

    setLoading(true)
    establishWebsocket()


    return () => {
      // Cleanup on unmount if ws wasn't closed already
      if (wsInstance?.readyState !== 3) {
        console.log('call cleanup')
        wsInstance.close()
      }
    }
  }, [])

  function submit() {
    console.log(wsInstance)
    console.log('attempt to send', wsInstance.readyState, text)
    if (text !== "") {
      wsInstance.send(JSON.stringify({ message: text, owner: "client" }))
      setText("")
      const objDiv = document.getElementById("messages")
      objDiv.scrollIntoView(false)
    }
  }

  console.log(wsInstance?.readyState)

  return (
    <main className={styles.main}>
      <div id="messages">
        <ul className={styles.message_container}>
          {
            messages.map((val, index) => {
              const message = val
              let previousMessage;
              if (index > 0) {
                previousMessage = messages[index - 1]
              }
              const drawAvatar = message.owner == "server" && ((index > 0 && previousMessage.owner !== "server") || index == 0)
              return (<li key={index} className={styles.message}>
                <Card
                  message={message.message}
                  avatar={drawAvatar
                    ? <Image src="/media/chatbot.png" width={60} height={60} />
                    : null}
                  userMessage={message.owner == "client"}
                />
              </li>)
            })
          }
          {
            loading && <li key={-1}>
              <Card
                message={<div className={styles.loader}></div>}
              >
              </Card>
            </li>
          }
          {
            error && <li>
              {error}
            </li>
          }
        </ul>


      </div>
      <div className={styles.chat_input}>
        <Image src="/media/user.png" width={60} height={60}></Image>
        <textarea
          value={text}
          className={styles.input}
          id="chat-input"
          placeholder="Type here..."
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        >
        </textarea>
        <button className={styles.send_button} onClick={submit}><Image src="/media/paper-plane.png" width={60} height={60}></Image></button>
      </div>
    </main>

  )
}
