import styles from "./login-form.module.css"
export default function LoginForm({ onSubmit, disabled }) {
  return (
    <form onSubmit={onSubmit} className={styles.loginForm} disabled={disabled}>
      <label htmlFor="username">Username</label>
      <input type="text" name="username" id="username"></input>
      <label htmlFor="password">Password</label>
      <input type="password" name="password" id="password"></input>
      <button type="submit" value="Submit" disabled={disabled}>
        Login
      </button>
    </form>
  )
}