'use client'

import React, { useRef, useEffect, useState } from 'react';
import Cookies from "universal-cookie";
import Sidebar from './sidebar';

const VideoCall = () => {
  const cookies = new Cookies();

  const websocketRef = useRef(null)
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const rtcPeerConnectionRef = useRef(null);
  const [candidateQueue, setCandidateQueue] = useState([]);

  const [roomID,setRoomID] = useState("")

  useEffect(() => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    rtcPeerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({ type: 'candidate', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log("Adding remote track", event.track, event.streams);
      if (remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject.addTrack(event.track);
      } else {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return () => {
      pc.close();
    };
  }, []);

  useEffect(() => {
    if(roomID !== "") {
      establishWebsocket()
    }
    return () => {}
  }, [roomID])

  function establishWebsocket() {
    if (typeof window !== "undefined") {
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WEBSOCKET_HOST}/ws/video-call/${roomID}/?jwt-token=${cookies.get("jwt-token", "")}`,
      )
      ws.onmessage = (e) => {
        console.log("WS", e.data)
        const parsed = JSON.parse(e.data)

        switch (parsed.type) {
          // case "init-handshake":
          //   createPeerConnection()
          //   break
          case "user-offer":
          case "user-candidate":
            handleSignalingMessage(parsed.data)
            break
          // case "user-disconnect":
          //   console.debug("Closing Peer connection")
          //   setSendingOffer(false)
          //   setIgnoreOffer(false)
          //   rtcPeerConnectionRef.current.close()
          //   rtcPeerConnectionRef.current = null
          //   sendChannelRef.current.close()
          //   sendChannelRef.current = null
          //   remoteVideoRef.current.srcObject?.getTracks().forEach(track => {
          //     track.stop()
          //     remoteVideoRef.current.srcObject.removeTrack(track)
          //   })

          //   break
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

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach(track => rtcPeerConnectionRef.current.addTrack(track, stream));

    const offer = await rtcPeerConnectionRef.current.createOffer();
    await rtcPeerConnectionRef.current.setLocalDescription(offer);
    sendSignalingMessage({ type: 'offer', sdp: offer.sdp });
  };

  const handleSignalingMessage = async (message) => {
    const { type, sdp, candidate } = message;

    if (type === 'offer') {
      await rtcPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      const answer = await rtcPeerConnectionRef.current.createAnswer();
      await rtcPeerConnectionRef.current.setLocalDescription(answer);
      sendSignalingMessage({ type: 'answer', sdp: answer.sdp });
      processCandidateQueue();
    } else if (type === 'answer') {
      await rtcPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      processCandidateQueue();
    } else if (type === 'candidate') {
      if (rtcPeerConnectionRef.current.remoteDescription) {
        await rtcPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        setCandidateQueue(prevQueue => [...prevQueue, candidate]);
      }
    }
  };

  const processCandidateQueue = async () => {
    for (const candidate of candidateQueue) {
      await rtcPeerConnectionRef.current.addIceCandidate(candidate);
    }
    setCandidateQueue([]);
  };

  const sendSignalingMessage = (message) => {
    // Implement your signaling mechanism here (e.g., WebSocket, HTTP)
    websocketRef.current.send(JSON.stringify({type:message.type, data:message}))
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Sidebar setRootRoomID={setRoomID}/>
      <div>
        <h1>Video Call</h1>
        <video ref={localVideoRef} autoPlay playsInline muted />
        <video ref={remoteVideoRef} autoPlay playsInline />
        <button onClick={startCall}>Start Call</button>
      </div>
    </div>
  );
};

export default VideoCall;