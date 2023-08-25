import styles from "./card.module.css"
export default function Card({ avatar, message, userMessage, action }) {
  return (
    <div className={styles.card} style={{ flexDirection: userMessage ? "row-reverse" : "row" }}>

      {!userMessage &&
        <span className={styles.avatar}>
          {avatar ?? null}
        </span>
      }

      <div className={`${styles.content} ${userMessage ? styles.content_user : null} ${action ? styles.action : null}`}>
        {message}
      </div>
    </div>
  )
}