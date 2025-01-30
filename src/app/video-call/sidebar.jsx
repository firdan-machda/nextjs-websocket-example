import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css"
import LoginForm from "@/components/login-form";
import { login, logout } from "@/authService";
import { joinVideoChatroom, getChatroom } from "@/chatroomService";


export default function Sidebar({setIsLogin, isLogin, chatReady, websocketRef, setRootRoomID }) {

  const [roomID, setRoomID] = useState("")
  const [chatrooms, setChatrooms] = useState([])

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
    });
  }

  async function handleLogout(e) {
    e.preventDefault()
    logout();
    setIsLogin(false);
    setRoomID("");
    setChatrooms([]);
  }

  function connectChatroom(e) {
    e.preventDefault()
    console.info('try to connect to chatroom', e.target.value)
    if (roomID !== "") {
      // kill wsinstance
      if (websocketRef.current && websocketRef.current.readyState <= 1) {
        websocketRef.current.close()
        rtcPeerConnectionRef.current?.close()
        setChatRestart(true)
      }
    }
    setRoomID(e.target.value)
  }

  function handleJoinChatroom(e) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    console.debug(formDataObj)
    joinVideoChatroom(formDataObj["joinChatroomId"]).then((result) => {
      console.debug(result)
      const { chatroomId } = result
      setChatrooms(arr => [...arr, chatroomId])
    })
  }

  function handleCreateChatroom(e) {
    e.preventDefault()
    joinVideoChatroom().then((result) => {
      console.debug(result)
      const { chatroomId } = result
      setChatrooms(arr => [...arr, chatroomId])
    })
  }

  function handleCopyRoomID() {
    navigator.clipboard.writeText(roomID)
  }

  useEffect(() => {
      getChatroom().then((result) => {
        setChatrooms(result)
      })

  }, [isLogin])

  useEffect(() => {
    console.debug('roomID changed', roomID)
    setRootRoomID(roomID)
  }, [roomID])

  return <div className={styles.sidebar}>
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
    <br/>
    <button onClick={handleCopyRoomID} disabled={roomID === ""}>
      Copy RoomID
    </button>
    <div style={{marginTop:"20px"}}>
      <hr/>
      <p>Chat status : {chatReady ? <span style={{color:"green"}}>Ready</span> : <span style={{color:"red"}}>Not Ready</span>}
      </p>
    </div>
  </div>
}