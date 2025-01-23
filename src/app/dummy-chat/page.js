'use client'
import Image from 'next/image'
import styles from './page.module.css'
import { createRef, useEffect, useState } from 'react'
import io from 'socket.io-client'
import Card from '@/components/card'
import Actions from '@/components/actions'
import {
  CSSTransition,
  TransitionGroup,
} from 'react-transition-group';
let socket;

export default function Home() {
  const MAX_TRIES = 3
  const [wsInstance, setWsInstance] = useState(null);
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [choices, setChoices] = useState([])
  
  const [tryReconnectCount, setTryReconnectCount] = useState(0)

  const [delay, setDelay] = useState(0)

  useEffect(() => {
    const objDiv = document.getElementById("messages")
    if (objDiv.children.length > 1) {
      objDiv.children[objDiv.children.length - 1].scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, loading])


  function establishWebsocket() {
    if (typeof window !== "undefined") {
      const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_HOST}/ws/chat/test/`)
      ws.onmessage = (e) => {
        console.log("WS", e.data)
        const parsed = JSON.parse(e.data)
        switch (parsed.type) {
          case "system":
            if (parsed.message == "loading") {
              setLoading(true)
            } else if (parsed.message == "finished-loading") {
              setLoading(false)
            }
            break;
          case "action":
            setChoices(parsed.choices)
            break
          default:
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
    if (tryReconnectCount < MAX_TRIES && wsInstance == null){
      establishWebsocket()
      setTryReconnectCount(x=> x + 1)
    }


    return () => {
      // Cleanup on unmount if ws wasn't closed already
      if (wsInstance && wsInstance?.readyState !== 3) {
        console.log('call cleanup')
        wsInstance.close()
      }
    }
  }, [wsInstance])

  function submit() {
    console.log(wsInstance)
    console.log('attempt to send', wsInstance.readyState, text)
    if (text !== "") {
      wsInstance.send(JSON.stringify({ message: text, owner: "client" }))
      setText("")

    }
  }

  function submitCoinFlipAction(e) {
    const answer = e.target.value
    wsInstance.send(JSON.stringify({ message: "coinflip", answer: answer, owner: "client" }))
    setChoices([])

  }

  console.log(wsInstance?.readyState)

  return (
    <main className={styles.main}>
      <div className={styles.messages}>
        <ul id="messages" className={styles.message_container}>
          <TransitionGroup>
            {
              messages.map((val, index) => {
                const message = val
                let previousMessage;
                if (index > 0) {
                  previousMessage = messages[index - 1]
                }
                const drawAvatar = message.owner == "server" && ((index > 0 && previousMessage.owner !== "server") || index == 0)
                return (
                  <CSSTransition
                    key={index}
                    timeout={1000}
                    classNames={ message.owner == "client" ? "" : "server-message-anim"}
                  >
                    <li key={index} className={styles.message}>
                      <Card
                        message={message.message}
                        avatar={drawAvatar
                          ? <Image src="/media/chatbot.png" width={60} height={60} />
                          : null}
                        userMessage={message.owner == "client"}
                      />
                    </li>
                  </CSSTransition>
                )
              })
            }
            </TransitionGroup>
            <Actions choices={choices} submitAction={submitCoinFlipAction} />
            <CSSTransition
              key={-1}
              timeout={1000}
              classNames=""
              in={loading}
            >
              <>
                {
                  loading &&
                  <li key={-1}>
                    <Card
                      message={<div className={styles.loader}></div>}
                    />
                  </li>
                }
              </>
            </CSSTransition>
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
          disabled={loading || choices.length > 0}
        >
        </textarea>
        <button className={styles.send_button} onClick={submit}><Image src="/media/paper-plane.png" width={60} height={60}></Image></button>
      </div>
    </main>

  )
}
