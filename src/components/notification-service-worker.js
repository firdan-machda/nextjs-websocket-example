import { useEffect, useState  } from "react"
import Cookies from "universal-cookie"
export default function NotificationServiceWorker({setErrorMessage, serviceWorkerReady}) {
  const cookies = new Cookies()
  // https://www.digitalocean.com/community/tutorials/how-to-send-web-push-notifications-from-django-applications
  const initialiseState = (reg) => {
    setErrorMessage("")
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
        'authorization': cookies.get("jwt-token", false) ? `JWT ${cookies.get("jwt-token")}` : "",
      },
    }).then(res => res.json())
      .then(result => {
        console.log(result)
      });

  };
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
  return <></>
}