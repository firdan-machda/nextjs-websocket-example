const fetchUserMedia = async () => {
  setLog(prevLog => [...prevLog, `Fetching user media for ${username}`])
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideoRef.current.srcObject = stream;
  localStreamRef.current = stream
}


const createPeerConnection = async (offerObj) => {
  setLog(prevLog => [...prevLog, `Creaasting peer connection for ${username}`])
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
      setCurrentICE(prevICE => [...prevICE, e.candidate])
      sendSignalingMessage(username, { type: 'candidate', candidate: e.candidate });
    }
  };
  pc.oniceconnectionstatechange = (e) => {
    console.log('ice connection state change :', pc.iceConnectionState)
    setLog(prevLog => [...prevLog, `ice connection state change ${pc.iceConnectionState}`])
  }
  pc.onsignalingstatechange = (e) => {
    console.log('signaling state change', e)
    console.log(pc.signalingState)      
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
    console.log(e)
    e.streams[0].getTracks().forEach(track => {
      remoteStreamRef.current.addTrack(track, remoteStreamRef.current);
      console.log('streaming should start')
      setLog(prevLog => [...prevLog, `streaming should starting ... finger cross`])
    });
    // if (remoteVideoRef.current.srcObject) {
      //   remoteVideoRef.current.srcObject.addTrack(event.track);
      // } else {
        //   remoteVideoRef.current.srcObject = event.streams[0];
        // }
  };
      
  if (offerObj) {
    await pc.setRemoteDescription(new RTCSessionDescription(offerObj));
  }
}


const startCall = async (callback) => {
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

    if (callback) {
        callback()
        setCurrentSDP(JSON.stringify(offer.sdp))
    }
};

const answerCall = async (offerObj) => {
  setLog(prevLog => [...prevLog, `Answering call for ${username}`])
  
  await fetchUserMedia()
  await createPeerConnection(offerObj)
  const answer = await peerConnectionRef.current.createAnswer({});
  await peerConnectionRef.current.setLocalDescription(answer);
  

  console.log("------ Answering call ------")
  console.log(offerObj)
  sendSignalingMessage(username, { type: 'answer', sdp: answer.sdp });
}