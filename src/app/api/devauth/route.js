//for development authentication
export async function GET(request) {
  return new Response(
    'Unauthorized', { 
      status: 401 ,
      headers:{
        'WWW-authenticate': 'Basic realm="Secure Area"'
      }
    })
}