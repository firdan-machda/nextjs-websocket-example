import Cookies from "universal-cookie"
const cookies = new Cookies()
export async function getChatroom() {
  const query = `
  query getChatRoom{
    chatrooms
  }`

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
    method: 'POST',
    body: JSON.stringify({
      query: query,
    }),
    headers: {
      'content-type': 'application/json',
      'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}` : "",
    },
  })
  const resJson = await res.json()
  const data = resJson.data.chatrooms
  return data
}
export async function joinChatroom(chatroomId = null) {
  const query = `
  mutation joinChatRoom($chatroomId: String){
    joinChatroom(chatroomId: $chatroomId) {
      chatroomId
    }
  }`

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
    method: 'POST',
    body: JSON.stringify({
      query: query,
      variables: {
        chatroomId: chatroomId
      }
    }),
    headers: {
      'content-type': 'application/json',
      'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}` : "",
    },
  })
  const resJson = await res.json()
  const data = resJson.data.joinChatroom
  return data
}
export async function getVideoChatroom() {
  const query = `
  query getChatRoom{
    videoChatrooms
  }`

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
    method: 'POST',
    body: JSON.stringify({
      query: query,
    }),
    headers: {
      'content-type': 'application/json',
      'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}` : "",
    },
  })
  const resJson = await res.json()
  const data = resJson.data.chatrooms
  return data
}
export async function joinVideoChatroom(chatroomID = null) {
  const query = `
  mutation joinVideoChatRoom($chatroomId: String){
    joinVideoChatroom(chatroomId: $chatroomId) {
      chatroomId
    }
  }`

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
    method: 'POST',
    body: JSON.stringify({
      query: query,
      variables: {
        chatroomId: chatroomID
      }
    }),
    headers: {
      'content-type': 'application/json',
      'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}` : "",
    },
  })
  const resJson = await res.json()
  const data = resJson.data.joinChatroom
  return data
}