function listAllAvailableOffer(pc) {
}

function newOfferAwaitingAnswer(pc, offer) {
}

function answerResponse(pc, offer) {
}

function receivedIceCandidate(pc, answer) {
}

export async function handleSignalingMessage(message) {
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
}