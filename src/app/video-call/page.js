'use client'
import LoginForm from "@/components/login-form";
import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css"
import { login, logout } from "@/authService";
import Cookies from "universal-cookie";
import { joinVideoChatroom, getChatroom } from "@/chatroomService";


export default function VideoCall() {
  const configuration = {
    iceServers: [
      {
        urls: "stun:openrelay.metered.ca:80",
      },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
  }
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const websocketRef = useRef(null)
  const rtcPeerConnectionRef = useRef(null)
  const sendChannelRef = useRef(null)
  const [isLogin, setIsLogin] = useState(false)
  const [roomID, setRoomID] = useState("")
  const [chatReady, setChatReady] = useState(false)
  const [chatrooms, setChatrooms] = useState(["asdf"])
  const [chatRestart, setChatRestart] = useState(false)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [micAudio, setMicAudio] = useState(true)
  const [sendingOffer, setSendingOffer] = useState(false)
  const [ignoreOffer, setIgnoreOffer] = useState(false)
  const [politeOffer, setPoliteOffer] = useState(true)
  const cookies = new Cookies()


  useEffect(() => {
    if (chatReady || chatRestart) {
      startConnection()
      setChatRestart(false)
    }
    return () => {
      console.log("call cleanup")
      rtcPeerConnectionRef.current?.close()
      websocketRef.current?.close()
    }
  }, [chatReady, chatRestart])

  useEffect(() => {
    if (roomID !== "") {
      setChatReady(true)
    } else {
      setChatReady(false)
    }

  }, [roomID])

  useEffect(() => {
    getChatroom().then((result) => {
      setChatrooms(result)
    })
  }, [isLogin])

  useEffect(() => {
    const haveCookie = cookies.get("jwt-token") !== undefined
    setIsLogin(haveCookie)
  }, [])

  function sendData(data) {
    websocketRef.current.send(JSON.stringify(data))
  }

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



  function establishWebsocket() {
    if (typeof window !== "undefined") {
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WEBSOCKET_HOST}/ws/video-call/${roomID}/?jwt-token=${cookies.get("jwt-token", "")}`,
      )
      ws.onmessage = (e) => {
        console.log("WS", e.data)
        const parsed = JSON.parse(e.data)
        switch (parsed.type) {
          case "init-handshake":
            createPeerConnection()
            break
          case "user-offer":
          case "user-candidate":
            signalingDataHandler(parsed.data)
            break
          case "user-disconnect":
            console.debug("Closing Peer connection")
            setSendingOffer(false)
            setIgnoreOffer(false)
            rtcPeerConnectionRef.current.close()
            rtcPeerConnectionRef.current = null
            break
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
            // sendECDHKey()
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

      }
      ws.onclose = (e) => {
        console.log('Disconnected')
      }
      websocketRef.current = ws
      // setLoading(false)
    }

  }
  function startConnection() {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          height: 650,
          width: 650,
        },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;
        establishWebsocket()
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
  };

  const setAndSendLocalDescription = (sessionDescription) => {
    rtcPeerConnectionRef.current.setLocalDescription(sessionDescription);
    console.log("Local description set");
    sendData({
      type: "offer",
      data: sessionDescription
    })
  };

  function sendOffer() {
    console.log("Sending offer");
    rtcPeerConnectionRef.current.createOffer().then(setAndSendLocalDescription, (error) => {
      console.error("Send offer failed: ", error);
    });
  };

  function sendAnswer() {
    console.log("Sending answer");
    rtcPeerConnectionRef.current.createAnswer().then(setAndSendLocalDescription, (error) => {
      console.error("Send answer failed: ", error);
    });
  };

  const signalingDataHandler = async (data) => {
    if (data.type === "offer" || data.type === "answer") {
      const offerCollision = (data.type === "offer" && (sendingOffer || rtcPeerConnectionRef.current.signalingState !== "stable"))
      const ignore = (!politeOffer && offerCollision)
      setIgnoreOffer(ignore)
      if (ignore) {
        return
      }
      await rtcPeerConnectionRef.current.setRemoteDescription(data);
      if (data.type === "offer") {
        await rtcPeerConnectionRef.current.setLocalDescription()
        console.debug("sending offer", rtcPeerConnectionRef.current.localDescription)
        sendData({ type: "offer", data: rtcPeerConnectionRef.current.localDescription })
      }

    } else if (data.type === "answer") {
      console.debug("Received answer", data)
      rtcPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === "candidate") {
      try {
        rtcPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        if (!ignoreOffer) {
          throw err;
        }
      }
    } else {
      console.log("Unknown Data");
    }
  };

  async function onNegotiationNeeded() {
    try {
      setSendingOffer(true)
      await rtcPeerConnectionRef.current.setLocalDescription()
      console.debug("sending onnegotiatonneeded", rtcPeerConnectionRef.current.localDescription)
      sendData({
        type: "offer",
        data: rtcPeerConnectionRef.current.localDescription
      })
    } catch (err) {
      console.error(err)
    } finally {
      setSendingOffer(false)
    }
  }

  function handleSendChannelStatusChange(event) {
    if (sendChannelRef.current) {
      const state = sendChannelRef.current.readyState
      if (state === "open") {
        console.debug("channel is open")
      } else {
        console.debug("channel is closed")
      }
    }
  }

  const createPeerConnection = () => {
    try {
      rtcPeerConnectionRef.current = new RTCPeerConnection(configuration);
      sendChannelRef.current = rtcPeerConnectionRef.current.createDataChannel("chat", { negotiated: true, id: 0 })
      sendChannelRef.current.onopen = handleSendChannelStatusChange
      rtcPeerConnectionRef.current.onnegotiationneeded = onNegotiationNeeded 
      rtcPeerConnectionRef.current.onicecandidate = onIceCandidate;
      rtcPeerConnectionRef.current.ontrack = onTrack;
      const localStream = localVideoRef.current.srcObject;
      for (const track of localStream.getTracks()) {
        rtcPeerConnectionRef.current.addTrack(track, localStream);
      }
      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };
  const onIceCandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate");
      sendData({
        type: "candidate",
        data: { type: "candidate", candidate: event.candidate }
      })
    }
  };

  const onTrack = ({ track, streams }) => {
    console.log("Adding remote track", track, streams);

    track.onunmute = () => {
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject.addTrack(track)
        return
      }
      remoteVideoRef.current.srcObject = streams[0]
    }
    track.onended = () => {
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = null
      }

    }
  };
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
  function connectChatroom(e) {
    e.preventDefault()
    if (roomID !== "") {
      // kill wsinstance
      if (websocketRef.current && websocketRef.current.readyState <= 1) {
        websocketRef.current.close()
        rtcPeerConnectionRef.current?.close()
        setChatRestart(true)
      }
      setMessages([])
    }
    console.debug(e.target.value)
    setRoomID(e.target.value)
  }
  async function toggleMic(on) {
    console.debug("Toggling mic", on)
    if (on) {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      const audioTrack = audioStream.getAudioTracks()[0]
      localVideoRef.current.srcObject.addTrack(audioTrack)
      const audioSender = rtcPeerConnectionRef.current.getSenders().find(e => e.track?.kind === 'audio')
      if (audioSender == null) {
        rtcPeerConnectionRef.current.addTrack(audioTrack)
      } else {
        await audioSender.replaceTrack(audioTrack)
      }

    } else {
      for (const audioTrack of localVideoRef.current.srcObject.getAudioTracks()) {
        console.debug("toggling", audioTrack)
        audioTrack.stop()
      }
    }

  }
  function toggleVideo() {
    for (const mediaTrack of localVideoRef.current.srcObject.getVideoTracks()) {
      mediaTrack.enabled = !mediaTrack.enabled
      console.debug("toggling", mediaTrack)
    }
  }
  return <main>
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
        <div className={styles.videoContainer}>
          <div className={styles.video}>
            <video autoPlay muted playsInline ref={localVideoRef} />
          </div>
          <div className={styles.video}>
            <video autoPlay playsInline ref={remoteVideoRef} />
          </div>
        </div>
        <div className={styles.videoController}>
          <button onClick={e => { setMicAudio(prev => !prev); toggleMic(micAudio) }}>Toggle Mic/Mute</button>
          <button onClick={toggleVideo}>Toggle Video</button>
          <div>
            <p>
              Polite: {politeOffer.toString()}
            </p>
            <button onClick={e => setPoliteOffer(prev => !prev)}>Toggle Polite</button>
          </div>
        </div>
      </div>
    </div>
  </main>
}