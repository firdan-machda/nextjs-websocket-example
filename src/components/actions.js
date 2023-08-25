import styles from "./actions.module.css"
import Card from "./card"
export default function Actions({ choices, submitAction }) {
  return (<div className={styles.actions}>
    {choices.map((val) => {
      return <Card
        action={true}
        key={val.alias}
        userMessage={true}
        message={<button className={styles.action_button} onClick={submitAction} value={val.alias}>
          {val.name}
        </button>} >
      </Card>
    })}
  </div>
  )
}