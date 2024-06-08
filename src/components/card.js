import styles from "./card.module.css"
export default function Card({ avatar, message, userMessage, action, name }) {
  return (
    <div className={styles.card} style={{ flexDirection: userMessage ? "row-reverse" : "row" }}>

      {!userMessage &&
        <span className={styles.avatar}>
          {avatar ?? null}
        </span>
      }

      <div className={`${styles.content} ${userMessage ? styles.content_user : ""} ${action ? styles.action : ""}`}>
        {name &&
          <div className={styles.name}>
            {name}:
          </div>
        }
        {message}
      </div>
    </div>
  )
}