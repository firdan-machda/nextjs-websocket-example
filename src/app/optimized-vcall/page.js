'use client'

import React, { useRef, useEffect, useState } from 'react';
import Sidebar from './sidebar';


const VideoCall = () => {
  // where the local stream will be stored
  const localStreamRef = useRef(null);
  // where the remote stream will be stored
  const remoteStreamRef = useRef(null)

  const websocketRef = useRef(null)

  const peerConnectionRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const [log, setLog] = useState([]);
  const [candidateQueue, setCandidateQueue] = useState([]);

  const [roomID, setRoomID] = useState("")
  const [username, setUsername] = useState("")
  const [otherUser, setOtherUser] = useState({ username: "", offer: "" })
  
  const [hasTrack, setHasTrack] = useState(false)

  const configuration = {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302"
        ]
      },
    ]
  };

  const fetchUserMedia = async () => {
    setLog(prevLog => [...prevLog, `Fetching user media for ${username}`])
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    localStreamRef.current = stream
  }

  const createPeerConnection = async (offerObj) => {
    setLog(prevLog => [...prevLog, `Creating peer connection for ${username}`])
    peerConnectionRef.current = new RTCPeerConnection(configuration);
    
    const pc = peerConnectionRef.current;

    // setting up video for remote stream
    // when remote stream is received, add it to the remote video element
    remoteStreamRef.current = new MediaStream();
    remoteVideoRef.current.srcObject = remoteStreamRef.current;
    
    // setting up video for local stream
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
    
    pc.onicecandidate = (e) => {
      setLog(prevLog => [...prevLog, `send ice candidate ${username}`])
      console.log('send ice candidate', e.candidate)
      if (!username) {
        console.warn("attempt to send candidate with null username")
      }
      if (e.candidate) {
        sendSignalingMessage(username, { type: 'candidate', candidate: e.candidate });
      }
    };
    
    pc.oniceconnectionstatechange = (e) => {
      console.log('ice connection state change :', pc.iceConnectionState)
      setLog(prevLog => [...prevLog, `ice connection state change ${pc.iceConnectionState}`])
    }

    pc.onsignalingstatechange = (e) => {
      console.log('signaling state change: ', pc.signalingState)
      setLog(prevLog => [...prevLog, `signaling state change: ${pc.signalingState}`])
      if (pc.signalingState === "have-remote-offer") {
        // attempt to process ice candidate queue
        processCandidateQueue()
      }
    }
    
    pc.ontrack = (e) => {
      if (hasTrack){
        return 
      }
      setHasTrack(true)
      setLog(prevLog => [...prevLog, `${username} got a track from other stream`])
      console.log('got a track from other stream')
      e.streams[0].getTracks().forEach(track => {
        remoteStreamRef.current.addTrack(track, remoteStreamRef.current);
        console.log('streaming should start')
        setLog(prevLog => [...prevLog, `streaming should starting ... finger cross`])
      });
    };
        
    if (offerObj) {
      await pc.setRemoteDescription(new RTCSessionDescription(offerObj));
    }
  }

  useEffect(() => {
  }, []);

  useEffect(() => {
    if (roomID !== "") {
      // disable for now
      establishWebsocket()
    }
    return () => { }
  }, [roomID])
   
  async function processCandidateQueue() {

    for (const candidate of candidateQueue) {
      await peerConnectionRef.current.addIceCandidate(candidate);
    }
    setCandidateQueue([]);
  } 

  function establishWebsocket() {
    setLog(prevLog => [...prevLog, `Establishing websocket for ${roomID}`])
    if (typeof window !== "undefined") {
      const ws = new WebSocket(
        `${process.env.NEXT_PUBLIC_WEBSOCKET_HOST}/ws/signaling/${roomID}/`,
      )
      ws.onmessage = (e) => {
        const parsed = JSON.parse(e.data)

        switch (parsed.type) {

          case "user-offer":
            setLog(prevLog => [...prevLog, `Received offer from ${parsed.owner}`])
            handleSignalUserOffer(parsed)
            break
          case "user-answer":
            setLog(prevLog => [...prevLog, `Received answer from ${parsed.owner}`])
            handleSignalUserAnswer(parsed)
            break
          case "user-candidate":
            setLog(prevLog => [...prevLog, `Received candidate from ${parsed.owner}`])
            console.log('got user candidate', parsed)
            handleSignalUserCandidate(parsed)
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
        console.log(e)
        console.info('Disconnected')
      }

      websocketRef.current = ws
    }
  }


  const startCall = async () => {
    setLog(prevLog => [...prevLog, `Starting call for ${username}`])
    if (!username) {
      new Error("cannot call when username is empty")
    }
    if (!roomID) {
      new Error("cannot call when roomID is empty")
    }
    await fetchUserMedia()

    await createPeerConnection()

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    sendSignalingMessage(username, { type: 'offer', sdp: offer.sdp });
  };

  const answerCall = async (offerObj) => {
    setLog(prevLog => [...prevLog, `Answering call for ${username}`])
    
    await fetchUserMedia()
    await createPeerConnection(offerObj)
    const answer = await peerConnectionRef.current.createAnswer({});
    await peerConnectionRef.current.setLocalDescription(answer);
    

    console.log("------ Answering call ------")   
    sendSignalingMessage(username, { type: 'answer', sdp: answer.sdp });
  }

  const handleSignalUserOffer = async (res) => {
    setLog(prevLog => [...prevLog, `Received offer from ${res.owner}`])

    let offer = res.data
    // make sure offer is from the other user
    if (username != res.owner ) {
      console.log("Received offer", res)

      setOtherUser({ username: res.owner, offer: offer })
    }
  }

  const handleSignalUserAnswer = async (res) => {
    setLog(prevLog => [...prevLog, `Received answer from ${res.owner}`])

    let answer = res.data
    // make sure offer is from the other user
    if (username != res.owner) {
      console.log("Received answer", answer)

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer.sdp }));
    }
  }


  const handleSignalUserCandidate = async (res) => {
    setLog(prevLog => [...prevLog, `Received candidate from ${res.owner}`])
    console.log(res)
    let candidate = res.data.candidate
    // make sure candidate is from the other user
    if (username != res.owner) {
      console.log("Received candidate", res, candidate)
      if (peerConnectionRef.current?.remoteDescription) {
        console.log('Adding ICE candidate');
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('Queueing ICE candidate');
        setCandidateQueue(prevQueue => [...prevQueue, candidate]);
      }
    }
  }

  const sendSignalingMessage = (username, message) => {
    setLog(prevLog => [...prevLog, `Sending signaling message from ${username} with message ${message.type}`])
    console.log(username, message)
    // Implement your signaling mechanism here (e.g., WebSocket, HTTP)
    if (username) {
      websocketRef.current?.send(JSON.stringify({ owner: username, type: message.type, data: message }))
    } else {
      new Error("Attempt send signal while username is empty")
    }
  };

  function eClickAnswerBtn(e) {
    e.preventDefault()
    const username = e.currentTarget.id.replace("btn-", "")

    setLog(prevLog => [...prevLog, `Clicked button call for ${otherUser.username}`])


    answerCall(otherUser.offer)
  }


  return (
    <div className="flex flex-col bg-neutral-900 h-screen text-slate-300">
      <div className="w-full max-w-4xl p-4">
        <h1 className="text-2xl font-bold mb-4">Optimized Video Call</h1>
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
        {roomID && <button onClick={startCall} className="mt-4  px-4 py-2 bg-blue-500 text-white rounded">Start Call</button>}
        {otherUser?.username && <button id={`btn-${otherUser.username}`} onClick={eClickAnswerBtn} className="mt-4 ml-2 px-4 py-2 bg-red-500 text-white rounded">Answer {otherUser?.username}</button>}
      </div>
      <Sidebar setParentRoomID={setRoomID} setParentUsername={setUsername} sendSignalingMessage={sendSignalingMessage} />
      <div className="absolute top-0 right-0 max-h-96 max-w-48 overflow-y-auto shadow-lg p-4 bg-gray-100 text-slate-900">
        <h2 className="text-xl font-bold mb-4">Log</h2>
        <ul>
          {log.map((text, index) => (
            <li key={index}> &gt; {text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default VideoCall