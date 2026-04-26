import { listActresses } from './actress.service.js'

function pick(items, start, size) {
  return items.slice(start, start + size)
}

export async function listDiscoverSections(profileId) {
  const actresses = await listActresses(profileId)

  return [
    { id: 'mais-populares', titulo: 'Mais populares', atrizes: pick(actresses, 0, 8) },
    {
      id: 'online-agora',
      titulo: 'Online agora',
      atrizes: actresses.filter((item) => item.videoUrl).slice(0, 8),
    },
    { id: 'novidades', titulo: 'Novidades', atrizes: [...actresses].reverse().slice(0, 8) },
  ].filter((section) => section.atrizes.length > 0)
}
