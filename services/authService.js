import Cookies from "universal-cookie"
const cookies = new Cookies()
export async function login(username, password) {
  const query = `
  mutation login($username: String!, $password: String!) {
    tokenAuth(username: $username, password: $password) {
      payload
      token
    }
  }`

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_HOST}/graphql/`, {
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
  })
  const resJson = await res.json()
  const data = resJson.data.tokenAuth
  const { token } = data
  cookies.set("jwt-token", token, {path: "/"})
  return data
}
export function logout() {
  cookies.remove("jwt-token")
}
