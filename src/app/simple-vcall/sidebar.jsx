import { useState, useEffect, useRef } from "react";
import LoginForm from "@/components/login-form";
import { login, logout } from "@/authService";
import { joinVideoChatroom, getChatroom } from "@/chatroomService";
import Cookies from 'universal-cookie';


export default function Sidebar({setParentRoomID, setParentUsername, sendSignalingMessage}) {
  const cookies = new Cookies()

  const [roomID, setRoomID] = useState("")
  const [chatrooms, setChatrooms] = useState([])
  const [username, setUsername] = useState("")
  const [error, setError] = useState("")

   useEffect(() => {
      // set username from cookies
      if (cookies.get('username')){
        setUsername(cookies.get('username'))
        setParentUsername(cookies.get('username'))
      } 
      if (cookies.get('roomID')){
        setRoomID(cookies.get('roomID'))
        setParentRoomID(cookies.get('roomID'))
      }
    }, []);

  async function postCreateSessionID(chatroomId, username) {
    const query = `
    mutation createVideoRoom($chatroomId: String!, $username: String!) {
      createVideoRoom(chatroomId: $chatroomId, username: $username) {
        chatroomId
        alias
      }
    }`
  
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        variables: {
          chatroomId, username
        }
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
    const resJson = await res.json()
    const data = resJson.data.createVideoRoom
    if (!chatrooms.includes(data.chatroomId)) {
      setChatrooms(x => [...x, data.chatroomId]);
    } else {
      setError(`Room ${data.chatroomId} already exists`)
    }
    return data
  }

  async function listChatrooms() {
    const query = `
    query {
      videoRooms
    }`
  
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query
      }),
      headers: {
        'content-type': 'application/json',
      },
    })
    const resJson = await res.json()
    const data = resJson.data.videoRooms
    setChatrooms( x => [...data])
    return data
  }

  function handleCreateSession(event) {
    event.preventDefault()
    if (!username) {
      setError("Please enter a username")
      return
    }
    postCreateSessionID(event.target.videoRoom.value, username)
  }

  function handleChangeUsername(event) {
    event.preventDefault()
    let username = event.target.username.value
    setUsername(username)
    setParentUsername(username)

    cookies.set('username', username)
  }

  function connectChatroom(event) {
    event.preventDefault()
    setRoomID(event.target.value)
    setParentRoomID(event.target.value)
    cookies.set('roomID', event.target.value)
  }
  
  function disconnect(){   
    setRoomID("")
    setParentRoomID("")
    sendSignalingMessage(username, {type: "clear-session"})
  }

  useEffect(() => {
    listChatrooms()
  },[])

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-md">
      <div className="flex justify-between">
        <span className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {username ? `Hello, ${username}` : "Sidebar"} 
        </span>
        <span className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          {roomID ? `Room ID: ${roomID}` : ""}
        </span>
      </div>
      <p className="text-red-500 text-sm my-2">
        {error ? "(ಠ_ಠ) "+error : "ᕙ(`▽´)ᕗ"}
      </p>
      <div className="flex flex-col sm:flex-row space-x-4">
        <div className="flex-1">
          <form className="max-w-sm mx-auto bg-white dark:bg-gray-700 p-4 rounded-lg shadow" onSubmit={handleCreateSession}>
            <div className="mb-4">
              <label htmlFor="video-room" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Session ID
              </label>
              <input
                type="text"
                id="video-room"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                placeholder="UUID string or alias"
                name="videoRoom"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Create
            </button>
          </form>
        </div>
        <div className="flex-1">
          <form className="max-w-sm mx-auto" onSubmit={handleChangeUsername}>
            <div className="mt-5" >
              <label htmlFor="username" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                Username
              </label>
              <input
                type="text"
                id="username"
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="mx-1 my-2 sm:w-auto px-3 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 rounded-lg dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Create
            </button>
            <button
              type="button"
              className="sm:w-auto px-3 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 rounded-lg dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-red-800"
              onClick={() => disconnect()}
            >
              Clear Session
            </button>
          </form>
        </div>
        <div className="flex-1">
          <div>
            <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Chatrooms</h4>
            <ul className="list-none list-inside space-y-2">
              {chatrooms.map((value, index) => (
                <li key={index} className="shadow hover:bg-gray-100 dark:hover:bg-grey-700 rounded-lg">
                  <button
                    value={value}
                    onClick={connectChatroom}
                    className="w-full text-left px-4 py-2 text-blue-500 hover:underline focus:outline-none"
                  >
                    {value}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}