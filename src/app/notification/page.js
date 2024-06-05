'use client'
import { useEffect, useState } from "react"
import styles from './page.module.css'

export default function NotificationPage() {
  const [token, setToken] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLogin, setIsLogin] = useState(token !== null)
  const [vapidPublicKey, setVapidPublicKey] = useState("")
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false)
  const [status, setStatus] = useState("standby")

  // https://www.digitalocean.com/community/tutorials/how-to-send-web-push-notifications-from-django-applications
  const initialiseState = (reg) => {
    setErrorMessage("")
    setStatus("initialising subscription")
    if (!reg.showNotification) {
      setErrorMessage("Sorry, your browser does not support notification")
      return
    }
    if (Notification.permission === 'denied') {
      setErrorMessage("Please allow permission to use this notification page")
      return
    }
    if (!'PushManager' in window) {
      setErrorMessage("Sorry, your browser does not the Push feature")
      return
    }
    subscribe(reg);
  }

  function urlB64ToUnit8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    const outputData = outputArray.map((output, index) => rawData.charCodeAt(index));

    return outputData;
  }

  const subscribe = async (reg) => {
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      sendSubData(subscription);
      return;
    }

    // need to query for vapid public key
    const key = vapidPublicKey
    const options = {
      userVisibleOnly: true,
      // if key exists, create applicationServerKey property
      ...(key && { applicationServerKey: urlB64ToUnit8Array(key) })
    };

    const sub = await reg.pushManager.subscribe(options);
    sendSubData(sub)
  };

  const sendSubData = async (subscription) => {
    const browser = navigator.userAgent.match(/(firefox|msie|chrome|safari|trident)/ig)[0].toLowerCase();
    const data = JSON.stringify({
      status_type: 'subscribe',
      subscription: subscription.toJSON(),
      browser: browser,
    });

    const query = `
    mutation sendSubscriptionData($postData: JSONString!) {
      subscribePush(postData: $postData) {
        status
      }
    }`

    fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        variables: {
          postData: data
        }
      }),
      headers: {
        'content-type': 'application/json',
        'authorization': `JWT ${token}`,
      },
    }).then(res => res.json())
      .then(result =>  { 
        console.log(result) 
        setStatus("subscribed")
      });

  };

  const handleLogin = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    const { username, password } = formDataObj

    const query = `
    mutation login($username: String!, $password: String!) {
      tokenAuth(username: $username, password: $password) {
        payload
        token
      }
    }`

    fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        variables: {
          username, password
        }
      }),
      headers: {
        'content-type': 'application/json',
      },

    }).then((result) => {
      console.log(result)
      return result.json()
    }).then((result) => {
      if (result.data.tokenAuth){
        const { token, payload } = result.data.tokenAuth
        setToken(token)
      }else {
        alert("Failed to login, wrong username or password")
      }
    });
  }

  const getVapidPublicKey = () => {
    const query = `
    query {
      vapidPublicKey
    }`

    fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
      }),
      headers: {
        'content-type': 'application/json',
        'authorization': `JWT ${token}`,
      },

    }).then((result) => {
      return result.json()
    }).then((result) => {
      setVapidPublicKey(result.data.vapidPublicKey)
      setServiceWorkerReady(true)
    });
  }

  const logout = async () => {
    setToken(null)
    // https://stackoverflow.com/a/33705250
    if ('serviceWorker' in navigator) {
      const serviceWorker = await navigator.serviceWorker.ready
      const subscription = await serviceWorker.pushManager.getSubscription()
      if (!subscription) {
        const success = await subscription.unsubscribe()
        if (!success) {
          setErrorMessage("Failed to unsubscribe")
        }
      }
      // TODO: Instead of making service worker redundant, try to update it to latest state
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          if (registration.active.state !== "redundant") {
            registration.unregister();
          }
        }
      });
      setVapidPublicKey("")
      setServiceWorkerReady(false)
    }

  }

  const sendNotification = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    const { userId, notificationHead, notificationBody } = formDataObj
    const query = `
    mutation sendNotification($userId: Int, $head: String, $body: String) {
      sendNotification(userId: $userId, head: $head, body: $body) {
        status
      } 
    }`
    fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        variables: {
          userId: userId,
          head: notificationHead,
          body: notificationBody
        }
      }),
      headers: {
        'content-type': 'application/json',
      },

    }).then((result) => {
      return result.json()
    }).then((result) => {
      console.log(result)
      if (result.errors) {
        result.errors.forEach((error) => {
          console.log(error)
        })
        return
      } 
      
      if (result.data?.sendNotification.status !== 200) {
        setErrorMessage("Failed to send notification")
        return
      }
    });
  }

  useEffect(() => {
    if (!serviceWorkerReady) {
      return
    }
    console.log("call serviceworker")
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').then((result) => {
        initialiseState(result)
      });
    } else {
      console.log("no serviceworker")
      setErrorMessage("no serviceworker instance, please check if your browser supports service worker")
    }
  }, [serviceWorkerReady])

  useEffect(() => {
    setIsLogin(token !== null)
    if (token !== null) {
      getVapidPublicKey()
    }
  }, [token])

  return <div>
    <div className={styles.loginFormContainer}>
      <h2>Login & Subscribe for Notification</h2>
      <p>Login using username and password created from the server to request VAPID Public Key</p>
      <p>Status: {status}</p>
      <form onSubmit={handleLogin} className={styles.loginForm} disabled={isLogin}>
        <label htmlFor="username">Username</label>
        <input type="text" name="username" id="username"></input>
        <label htmlFor="password">Password</label>
        <input type="password" name="password" id="password"></input>
        <button type="submit" value="Submit" disabled={isLogin}>
          Login
        </button>
      </form>
      <button disabled={!isLogin} onClick={logout}>
        Logout
      </button>
    </div>
    <div className={styles.loginFormContainer}>
      <h2> Send Notification</h2>
      <p> You may use this to send notification to a user ID</p>
      <form onSubmit={sendNotification} className={styles.loginForm}>
        <label htmlFor="userId">User ID</label>
        <input type="text" name="userId" id="userId"></input>
        <label htmlFor="notificationHead">Head</label>
        <input type="text" name="notificationHead" id="notificationHead"></input>
        <label htmlFor="notificationBody">Body</label>
        <textarea rows="4" cols="50" name="notificationBody" id="notificationBody"></textarea>
        <button type="submit" value="Submit">
          Submit
        </button>
      </form>
    </div>

    <p>
      {errorMessage}
    </p>
  </div>
}