'use client'
import { useEffect, useState } from "react"
import Cookies from "universal-cookie"
import styles from './page.module.css'
import { login } from "@/authService"
import LoginForm from "@/components/login-form"

export default function NotificationPage() {
  const cookies = new Cookies()
  const [token, setToken] = useState(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLogin, setIsLogin] = useState(token !== null)
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false)
  const [notificationEnabled, setNotificationEnabled] = useState(false)
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
    const key = process.env.NEXT_PUBLIC_VAPID_KEY
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
        'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}`: "",
      },
    }).then(res => res.json())
      .then(result =>  { 
        console.log(result) 
        setStatus("subscribed")
        setNotificationEnabled(true)
      });

  };

  const handleLogin = (e) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const formDataObj = {}
    formData.forEach((value, key) => { formDataObj[key] = value });
    const { username, password } = formDataObj

    login(username, password).then((result) => {
      const { token, payload } = result.data.tokenAuth
      cookies.set("jwt-token", token)
      setServiceWorkerReady(true)
      setIsLogin(true)
    });
  }

  const logout = async () => {
    setToken(null)
    cookies.remove("jwt-token")
    // https://stackoverflow.com/a/33705250
    if ('serviceWorker' in navigator) {
      const serviceWorker = await navigator.serviceWorker.ready
      const subscription = await serviceWorker.pushManager.getSubscription()
      const success = await subscription.unsubscribe()
      setStatus("standby")
      setNotificationEnabled(false)
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
      if (result.data.sendNotification.status !== 200) {
        setErrorMessage("Failed to send notification")
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
    if (isLogin) {
      getVapidPublicKey()
    }
  }, [isLogin])

  return <div>
    <div className={styles.loginFormContainer}>
      <h2>Login & Subscribe for Notification</h2>
      <p>Login using username and password created from the server to request VAPID Public Key</p>
      <p>Status: {status}</p>
      <p>Notification Ready Status: {notificationEnabled.toString()}</p>
      <LoginForm disabled={isLogin} onSubmit={handleLogin}/>
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
