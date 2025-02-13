'use client'

import React, { useRef, useEffect, useState } from 'react';
import Sidebar from './sidebar';
import useVidCall from './useVidCall';


const VideoCall = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
    
  const [roomID, setRoomID] = useState("")
  const [username, setUsername] = useState("")
  
  const videoCall = useVidCall({
    localVideoRef, 
    remoteVideoRef, 
    roomID, 
    username
  })

  function eClickAnswerBtn(e) {
    e.preventDefault()

    const username = e.currentTarget.id.replace("btn-", "")
    videoCall.eClickAnswerBtn(username)
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
        {roomID && <button onClick={()=>videoCall.startCall()} className="mt-4  px-4 py-2 bg-blue-500 text-white rounded">Start Call</button>}
        {videoCall.otherUser?.username && <button id={`btn-${videoCall.otherUser.username}`} onClick={eClickAnswerBtn} className="mt-4 ml-2 px-4 py-2 bg-red-500 text-white rounded">Answer {videoCall.otherUser?.username}</button>}
      </div>
      <Sidebar setParentRoomID={setRoomID} setParentUsername={setUsername} sendSignalingMessage={videoCall.sendSignalingMessage} />
      <div className="absolute top-0 right-0 max-h-96 max-w-48 overflow-y-auto shadow-lg p-4 bg-gray-100 text-slate-900">
        <h2 className="text-xl font-bold mb-4">Log</h2>
        <ul>
          {videoCall.log.map((text, index) => (
            <li key={index}> &gt; {text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default VideoCall