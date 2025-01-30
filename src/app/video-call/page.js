'use client'

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css"
import Cookies from "universal-cookie";
import Sidebar from "./sidebar"

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
  
  const [chatRestart, setChatRestart] = useState(false)
  const [micAudio, setMicAudio] = useState(true)
  const [sendingOffer, setSendingOffer] = useState(false)
  const [ignoreOffer, setIgnoreOffer] = useState(false)
  const [politeOffer, setPoliteOffer] = useState(true)
  const [audioInputSource, setAudioInputSource] = useState(undefined)
  const [audioOutputSource, setAudioOutputSource] = useState(undefined)
  const [videoSource, setVideoSource] = useState(undefined)

  const [answerPending, setAnswerPending] = useState(false)

  const [audioOutputOptions, setAudioOutputOptions] = useState([])
  const [audioInputOptions, setAudioInputOptions] = useState([])
  const [videoInputOptions, setVideoInputOptions] = useState([])

  const [hasMic, setHasMic] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)

  const [openMic, setOpenMic] = useState(null)
  const [openVideo, setOpenVideo] = useState(null)

  const cookies = new Cookies()


  useEffect(() => {
    if (chatReady || chatRestart) {
      setChatRestart(false)
      startConnection()
    }
    return () => {
      console.log("call cleanup")
      rtcPeerConnectionRef.current?.close()
      websocketRef.current?.close()
    }
  }, [chatReady, chatRestart])


  useEffect(() => {
    console.info("roomID: ", roomID)
    if (roomID !== "") {
      setChatReady(true)
    } else {
      setChatReady(false)
    }
    getDevices()

  }, [roomID])

  useEffect(() => {
    const haveCookie = cookies.get("jwt-token") !== undefined
    setIsLogin(haveCookie)
    if (navigator.mediaDevices) {
      console.debug("setting ondevicechange")
      navigator.mediaDevices.ondevicechange = (e) => {
        getDevices()
      }
    }

  }, [])

  function sendData(data) {
    websocketRef.current.send(JSON.stringify(data))
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
            sendChannelRef.current.close()
            sendChannelRef.current = null
            remoteVideoRef.current.srcObject?.getTracks().forEach(track => {
              track.stop()
              remoteVideoRef.current.srcObject.removeTrack(track)
            })

            break
          default:
            console.warn("Unknown message type", parsed)
            break;
        }
      }

      ws.onopen = (e) => {
        console.info("Connected")
      }

      ws.onclose = (e) => {
        console.info('Disconnected')
      }

      websocketRef.current = ws
      // setLoading(false)
    }
  }

  function startConnection() {
    const audioSource = audioInputSource || undefined
    const videoInputSource = videoSource || undefined
    if (!hasPermission && !(audioSource || videoInputSource)) {
      console.warn("no permission")
      return
    }
    const constraints = {
      video: true,
      audio: micAudio
    }
    if (hasMic && micAudio) {
      constraints['audio'] = { deviceId: audioSource ? { exact: audioSource } : undefined }
    }
    if (hasCamera) {
      constraints['video'] = { deviceId: videoInputSource ? { exact: videoInputSource } : undefined }
    }
    // const constraints = getConstraints()
    console.debug("constraints", constraints)
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;
        establishWebsocket()
        setOpenMic(audioSource)
        setOpenVideo(videoInputSource)
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
  };

  function getConstraints() {
    const audioSource = audioInputSource || undefined
    const videoInputSource = videoSource || undefined
    if (!hasPermission && !(audioSource || videoInputSource)) {
      console.warn("no permission")
      return
    }
    const constraints = { video: true, audio: micAudio }
    let changes = "";
    // const constraints = {
    //   video: true,
    //   audio: micAudio
    // }
    if (hasMic && micAudio && (audioSource != openMic)) {
      constraints['audio'] = { deviceId: audioSource ? { exact: audioSource } : undefined }
      changes = changes.concat("audio");
    }
    if (hasCamera && (videoInputSource != openVideo)) {
      constraints['video'] = { deviceId: videoInputSource ? { exact: videoInputSource } : undefined }
      changes = changes.concat("video");
    }
    return { constraints, changes }
  }

  async function changeIOSource() {
    const { constraints, changes } = getConstraints()
    const stream = await navigator.mediaDevices.getUserMedia(
      constraints
    )
    if (changes == "audio" || changes == "audiovideo") {
      const audioTrack = stream.getAudioTracks()[0]
      for (const audioTrack of localVideoRef.current.srcObject.getAudioTracks()) {
        console.debug("stopping", audioTrack)
        audioTrack.stop()
      }
      localVideoRef.current.srcObject.addTrack(audioTrack)
      if (rtcPeerConnectionRef.current) {
        const audioSender = rtcPeerConnectionRef.current.getSenders().find(e => e.track?.kind === 'audio')
        if (audioSender == null) {
          rtcPeerConnectionRef.current.addTrack(audioTrack)
        } else {
          await audioSender.replaceTrack(audioTrack)
        }
      }
      setOpenMic(audioInputSource)
    }

    if (changes == "video") {
      const videoTrack = stream.getVideoTracks()[0]
      for (const videoTrack of localVideoRef.current.srcObject.getVideoTracks()) {
        videoTrack.stop()
      }
      localVideoRef.current.srcObject.addTrack(videoTrack)
      if (rtcPeerConnectionRef.current) {
        const videoSender = rtcPeerConnectionRef.current.getSenders().find(e => e.track?.kind === 'video')
        if (videoSender == null) {
          rtcPeerConnectionRef.current.addTrack(videoTrack)
        } else {
          await videoSender.replaceTrack(videoTrack)
        }
      }
      setOpenVideo(videoSource)
    }

  }

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
      const pc = rtcPeerConnectionRef.current
      const isStable = (pc.signallingState == 'stable' ||
        (pc.signallingState == 'have-local-offer' && answerPending)
      )
      const offerCollision = (data.type === "offer" && (sendingOffer || !isStable))
      const ignore = (!politeOffer && offerCollision)


      setIgnoreOffer(ignore)
      if (ignore) {
        console.debug("ignoring offer")
        return
      }
      setAnswerPending(data.type === "answer")
      await rtcPeerConnectionRef.current.setRemoteDescription(data);
      setAnswerPending(false)
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
        console.log("received ICE candidate")
        rtcPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.error("candidate error", err)
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

  function onIceConnectionStateChange() {
    console.log("ICE State change", rtcPeerConnectionRef.current.iceConnectionState)
    if (rtcPeerConnectionRef.iceConnectionState === "failed") {
      rtcPeerConnectionRef.restartIce()
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
    console.info('attempting to create peer connection')
    try {
      rtcPeerConnectionRef.current = new RTCPeerConnection(configuration);
      sendChannelRef.current = rtcPeerConnectionRef.current.createDataChannel("chat", { negotiated: true, id: 0 })
      sendChannelRef.current.onopen = handleSendChannelStatusChange
      sendChannelRef.current.onclose = () => {
        console.debug("channel is closed")
      }
      rtcPeerConnectionRef.current.onnegotiationneeded = onNegotiationNeeded
      rtcPeerConnectionRef.current.oniceconnectionstatechange = onIceConnectionStateChange
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
    if (remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject.addTrack(track)
      track.onended = () => {
        if (remoteVideoRef.current.srcObject) {
          remoteVideoRef.current.srcObject.removeTrack(track)
        }
      }
      return
    }
    console.debug("new stream")
    remoteVideoRef.current.srcObject = streams[0]
    track.onended = () => {
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = null
      }
    }
  };

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
    console.log(localVideoRef.current.srcObject)
    console.log(localVideoRef.current.srcObject)
    for (const mediaTrack of localVideoRef.current.srcObject.getVideoTracks()) {
      mediaTrack.enabled = !mediaTrack.enabled
      console.debug("toggling", mediaTrack)
    }
  }


  // Attach audio output device to video element using device/sink ID.
  function attachSinkId(targetSinkId) {
    const sinkId = targetSinkId
    if (typeof remoteVideoRef.current.sinkId !== 'undefined') {
      remoteVideoRef.current.setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId}`);
          // change selected output after success
          setAudioOutputSource(sinkId)
        })
        .catch(error => {
          let errorMessage = error;
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
        });
    } else {
      console.warn('Browser does not support output device selection.');
    }
  }

  async function getDevices() {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(e => console.error(e));
  }

  function gotDevices(deviceInfos) {
    console.log('gotDevices', deviceInfos);
    setHasMic(false)
    setHasCamera(false)
    setHasPermission(false)
    setVideoInputOptions([])
    setAudioInputOptions([])
    for (let i = 0; i !== deviceInfos.length; ++i) {
      const deviceInfo = deviceInfos[i];
      if (deviceInfo.deviceId == '') {
        continue;
      }
      // If we get at least one deviceId, that means user has granted user
      // media permissions.
      setHasPermission(true)
      const newOption = { id: deviceInfo.deviceId, label: "" }
      if (deviceInfo.kind === 'audioinput') {
        setHasMic(true)
        newOption.label = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
        setAudioInputOptions(arr => [...arr, newOption])
        if (!audioInputSource) {
          setAudioInputSource(newOption.id)
        }
      } else if (deviceInfo.kind === 'audiooutput') {
        newOption.label = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
        setAudioOutputOptions(arr => [...arr, newOption])
      } else if (deviceInfo.kind === 'videoinput') {
        setHasCamera(true)
        newOption.label = deviceInfo.label || `camera ${videoSelect.length + 1}`;
        setVideoInputOptions(arr => [...arr, newOption])
        if (!videoSource) {
          setVideoSource(newOption.id)
        }
      } else {
        console.log('Some other kind of source/device: ', deviceInfo);
      }
    }
  }

  return <main style={{ display: "flex" }}>
    <Sidebar setIsLogin={setIsLogin} isLogin={isLogin} websocketRef={websocketRef} chatReady={chatReady} setRootRoomID={setRoomID}/>
    <div className={styles.chatContainer}>    
      <div className={styles.chatRoom}>
        <div className={styles.videoContainer}>
          <div className={styles.video}>
            <h2>Local Video</h2>
            <video autoPlay muted playsInline ref={localVideoRef} />
          </div>
          <div className={styles.video}>
            <h2>Remote Video</h2>
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
          <select value={audioInputSource} onChange={e => { setAudioInputSource(e.target.value); changeIOSource() }}>
            {audioInputOptions.map((value, index) => {
              return <option value={value.id} key={index}>
                {value.label}
              </option>
            })}

          </select>
          <select value={videoSource} onChange={e => { setVideoSource(e.target.value); changeIOSource() }}>
            {videoInputOptions.map((value, index) => {
              return <option value={value.id} key={index}>
                {value.label}
              </option>
            })}
          </select>
          <select value={audioOutputSource} onChange={e => { attachSinkId(e.target.value) }}>
            {audioOutputOptions.map((value, index) => {
              return <option value={value.id} key={index}>
                {value.label}
              </option>
            })}
          </select>
        </div>
      </div>
    </div>
  </main>
}