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

  const [roomID, setRoomID] = useState("")

  useEffect(() => {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
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
    if (roomID !== "") {
      establishWebsocket()
    }
    return () => { }
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

          case "user-offer":
          case "user-candidate":
            handleSignalingMessage(parsed.data)
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
      console.log('Received offer', sdp);
      await rtcPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      const answer = await rtcPeerConnectionRef.current.createAnswer();
      await rtcPeerConnectionRef.current.setLocalDescription(answer);
      sendSignalingMessage({ type: 'answer', sdp: answer.sdp });
      processCandidateQueue();
    } else if (type === 'answer') {
      console.log('Received answer', sdp);
      await rtcPeerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
      processCandidateQueue();
    } else if (type === 'candidate') {
      console.log('Received ICE candidate', candidate);
      if (rtcPeerConnectionRef.current.remoteDescription) {
        console.log('Adding ICE candidate');
        await rtcPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('Queueing ICE candidate');
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
    websocketRef.current.send(JSON.stringify({ type: message.type, data: message }))
  };

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl p-4">
        <h1 className="text-2xl font-bold mb-4">Video Call</h1>
        <div className="flex flex-row space-x-4">
          <div className="flex-1">
            <h2 className="text-xl mb-2">local</h2>
            <video ref={localVideoRef} autoPlay playsInline muted className="w-full mb-4" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl mb-2">remote</h2>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full mb-4" />
          </div>
        </div>
        {roomID && <button onClick={startCall} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Start Call</button>}
      </div>
      <Sidebar setRootRoomID={setRoomID} />
    </div>
  );
};

export default VideoCall;