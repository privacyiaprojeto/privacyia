
import { useNavigate } from 'react-router'

export function AtrizCard({ atriz }) {
  const navigate = useNavigate()

  function handleClick() {
    navigate(`/cliente/atrizes/${atriz.id}`)
  }

  return (
    <div onClick={handleClick}>
      <img src={atriz.avatar} />
      <p>{atriz.nome}</p>
    </div>
  )
}
