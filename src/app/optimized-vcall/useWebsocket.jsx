import { useRef,useEffect } from "react"

export default function useWebsocket({onUserOffer, onSignalAnswer, onSignalCandidate, roomID, setLog}) {
  const websocketRef = useRef(null)
  const allowLog = Boolean(setLog)
  
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
            if (allowLog){
              setLog(prevLog => [...prevLog, `Received offer from ${parsed.owner}`])
            }
            onUserOffer && onUserOffer(parsed)
            break
          case "user-answer":
            if (allowLog){
              setLog(prevLog => [...prevLog, `Received answer from ${parsed.owner}`])
            }
            onSignalAnswer && onSignalAnswer(parsed)
            break
          case "user-candidate":
            if (allowLog){
              setLog(prevLog => [...prevLog, `Received candidate from ${parsed.owner}`])
            }
            console.log('got user candidate', parsed)
            onSignalCandidate && onSignalCandidate(parsed)
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

  useEffect(() => {
    if (roomID !== "") {
      // establish signaling server
      establishWebsocket()
    }
    return () => { }
  }, [roomID])
  
  return websocketRef
}