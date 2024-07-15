'use client'
import styles from "./page.module.css"
import Cookies from "universal-cookie"
import { useEffect, useState, useRef } from "react"
import { login, logout } from "@/authService"
import LoginForm from "@/components/login-form"
import { getChatroom, joinChatroom } from "@/chatroomService"
import Image from "next/image"
import Card from '@/components/card'
import Actions from '@/components/actions'
import {
  CSSTransition,
  TransitionGroup,
} from 'react-transition-group';
import NotificationServiceWorker from "@/components/notification-service-worker"
import { decrypt, encrypt, exportCryptoKey, importKeyRaw } from "../../../utils/crypto"


export default function LiveChatroom() {
  const cookies = new Cookies()
  const [loading, setLoading] = useState(false)
  const [roomID, setRoomID] = useState("")
  const [chatReady, setChatReady] = useState(false)
  const [isLogin, setIsLogin] = useState(false)
  const [chatrooms, setChatrooms] = useState(["asdf"])
  const [messages, setMessages] = useState([])
  const [text, setText] = useState("")
  const [chatRestart, setChatRestart] = useState(false)
  const [notificationReady, setNotificationReady] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const sharedSecretRef = useRef(null)
  const keyPairRef = useRef(null)
  const websocketRef = useRef(null)

  const handleLogin = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    const { username, password } = formDataObj

    login(username, password).then((result) => {
      // const { token, payload } = result.data.tokenAuth
      // cookies.set("jwt-token", token)
      setIsLogin(true)
      setNotificationReady(true)
    });
  }
  async function submit() {
    console.log(websocketRef.current)
    console.log('attempt to send', websocketRef.current.readyState, text)
    if (text !== "") {
      // encrypt and send
      const { algorithm, iv, message } = await encrypt(text, sharedSecretRef.current)
      websocketRef.current.send(JSON.stringify({ message: message, iv: iv, algorithm: algorithm }))
      setText("")
    }
  }

  async function sendECDHKey() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-384"
      },
      false,
      ["deriveKey"]
    )
    console.debug(keyPair)
    keyPairRef.current = keyPair

    // send as PEM
    const publicKey = await exportCryptoKey(keyPair.publicKey)
    console.debug("public export", publicKey, keyPair.publicKey)


    // await sendPublicKey()
    websocketRef.current.send(JSON.stringify({
      type: "handshake",
      message: publicKey
    }))
  }

  async function handleHandshake(data) {
    // skip handling if public key is the same (Unsafe?)
    console.debug(data.message)
    const otherPublicKey = await importKeyRaw(data.message)
    const secretKey = await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: otherPublicKey,
      },
      keyPairRef.current.privateKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      ["encrypt", "decrypt"]
    );
    sharedSecretRef.current = secretKey

  }

  async function handleMessage(data) {
    const { iv, algorithm, message, type, owner } = data
    const decryptedMessage = await decrypt(message, sharedSecretRef.current, iv, algorithm)
    console.debug(decryptedMessage)
    const newMessage = {
      type: type, owner: owner, message: decryptedMessage
    }
    setMessages(arr => [...arr, newMessage])

  }

  function establishWebsocket() {
    if (typeof window !== "undefined") {
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WEBSOCKET_HOST}/ws/livechat/${roomID}/?jwt-token=${cookies.get("jwt-token", "")}`,
      )
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
          case "init-handshake":
            sendECDHKey()
            break
          case "handshake":
            handleHandshake(parsed)
            break
          case "message":
            handleMessage(parsed)
            break
          default:
            setMessages(arr => [...arr, parsed])
            break;

        }
      }
      ws.onopen = (e) => {
        console.log("Connected")
        setLoading(false)
      }
      ws.onclose = (e) => {
        console.log('Disconnected')
      }
      websocketRef.current = ws
      setLoading(false)
    }

  }

  function handleJoinChatroom(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    console.debug(formDataObj)
    joinChatroom(formDataObj["joinChatroomId"]).then((result) => {
      console.debug(result)
      const { chatroomId } = result
      setChatrooms(arr => [...arr, chatroomId])
    })
  }

  function handleCreateChatroom(e) {
    e.preventDefault()
    joinChatroom().then((result) => {
      console.debug(result)
      const { chatroomId } = result
      setChatrooms(arr => [...arr, chatroomId])
    })
  }

  function connectChatroom(e) {
    e.preventDefault()
    if (roomID !== "") {
      // kill wsinstance
      if (websocketRef.current && websocketRef.current.readyState <= 1) {
        websocketRef.current.close()
        setChatRestart(true)
      }
      setMessages([])
    }
    console.debug(e.target.value)
    setRoomID(e.target.value)
  }

  async function handleLogout(e) {
    e.preventDefault()
    logout();
    setIsLogin(false);
    setRoomID("");
    setChatrooms([]);
    if ('serviceWorker' in navigator) {
      const serviceWorker = await navigator.serviceWorker.ready
      const subscription = await serviceWorker.pushManager.getSubscription()
      const success = await subscription.unsubscribe()
    }
    setNotificationReady(false)
  }

  useEffect(() => {
    const haveCookie = cookies.get("jwt-token") !== undefined
    setIsLogin(haveCookie)
  }, [])

  useEffect(() => {
    if (isLogin) {
      getChatroom().then((result) => {
        setChatrooms(result)
      })
    }
  }, [isLogin])

  useEffect(() => {
    if (roomID !== "") {
      setChatReady(true)
    } else {
      setChatReady(false)
    }

  }, [roomID])

  useEffect(() => {
    if (chatReady || chatRestart) {
      console.log('call ws')

      setLoading(true)
      establishWebsocket()
      setChatRestart(false)
    }




    return () => {
      // Cleanup on unmount if ws wasn't closed already
      if (websocketRef.current !== null && websocketRef.current?.readyState !== 3) {
        console.log('call cleanup')
        websocketRef.current.close()
      }
    }
  }, [chatReady, chatRestart])

  return <main>
    <NotificationServiceWorker serviceWorkerReady={notificationReady} setErrorMessage={setErrorMessage} />
    <div className={styles.chatContainer}>
      <div className={styles.sidebar}>
        Sidebar
        <LoginForm disabled={isLogin} onSubmit={handleLogin} />
        <button disabled={!isLogin} onClick={handleLogout}>Logout</button>

        <div>
          Chatrooms
          <ul>
            {chatrooms.map((value, index) => {
              return <li key={index}><button value={value} onClick={connectChatroom} key={value}>{value}</button></li>
            })}
          </ul>
        </div>

        <form onSubmit={handleJoinChatroom} disabled={!isLogin}>
          <label htmlFor="joinChatroomId">Chatroom ID</label>
          <input type="text" name="joinChatroomId" id="joinChatroomId"></input>
          <button type="submit" value="submit" disabled={!isLogin}>
            Join chatroom
          </button>
        </form>

        <button onClick={handleCreateChatroom} disabled={false}>
          Create new chatroom
        </button>

      </div>
      <div className={styles.chatRoom}>
        {(roomID !== "") && <p>Chatroom {roomID}</p>}
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
                    classNames={message.owner == "client" ? "" : "server-message-anim"}
                  >
                    <li key={index} className={styles.message}>
                      <Card
                        message={message.message}
                        avatar={drawAvatar
                          ? <Image src="/media/chatbot.png" width={60} height={60} />
                          : null}
                        userMessage={message.owner == "client"}
                        name={message.owner}
                      />
                    </li>
                  </CSSTransition>
                )
              })
            }
          </TransitionGroup>
        </ul>
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
      </div>

    </div>


  </main>
}