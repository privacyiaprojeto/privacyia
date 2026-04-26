import type { Conversa, Mensagem } from '@/features/cliente/chat/types'
import {
  DEFAULT_CURRENT_MOOD,
  DEFAULT_RELATIONSHIP_TYPE,
} from '@/features/cliente/chat/personaOptions'
import { mockAtrizes } from '@/mocks/data/atrizes'

export const conversas: Conversa[] = [
  {
    id: '1',
    atriz: { id: mockAtrizes[0].id, nome: mockAtrizes[0].nome, avatar: mockAtrizes[0].avatar, online: true },
    relationshipType: 'casados',
    currentMood: 'carinhosa',
    ultimaMensagem: 'Oi, tudo bem? 😊',
    ultimaHora: '14:32',
    naoLidas: 2,
  },
  {
    id: '2',
    atriz: { id: mockAtrizes[1].id, nome: mockAtrizes[1].nome, avatar: mockAtrizes[1].avatar, online: true },
    relationshipType: 'amigos',
    currentMood: 'brincalhona',
    ultimaMensagem: 'Obrigada pelo seu apoio!',
    ultimaHora: '11:15',
    naoLidas: 0,
  },
  {
    id: '3',
    atriz: { id: mockAtrizes[2].id, nome: mockAtrizes[2].nome, avatar: mockAtrizes[2].avatar, online: true },
    relationshipType: DEFAULT_RELATIONSHIP_TYPE,
    currentMood: 'provocadora',
    ultimaMensagem: 'Novo conteúdo disponível 🔥',
    ultimaHora: 'Ontem',
    naoLidas: 5,
  },
  {
    id: '4',
    atriz: { id: mockAtrizes[3].id, nome: mockAtrizes[3].nome, avatar: mockAtrizes[3].avatar, online: true },
    relationshipType: 'namorados',
    currentMood: 'romântica',
    ultimaMensagem: 'Obrigada pela mensagem ❤️',
    ultimaHora: 'Seg',
    naoLidas: 0,
  },
  {
    id: '5',
    atriz: { id: mockAtrizes[4].id, nome: mockAtrizes[4].nome, avatar: mockAtrizes[4].avatar, online: true },
    relationshipType: 'mestre/submissa',
    currentMood: 'dominante',
    ultimaMensagem: 'Você viu meu último post?',
    ultimaHora: 'Dom',
    naoLidas: 1,
  },
  {
    id: '6',
    atriz: { id: mockAtrizes[5].id, nome: mockAtrizes[5].nome, avatar: mockAtrizes[5].avatar, online: true },
    relationshipType: 'colegas',
    currentMood: DEFAULT_CURRENT_MOOD,
    ultimaMensagem: 'Até logo! 👋',
    ultimaHora: 'Sáb',
    naoLidas: 0,
  },
]

export const mensagens: Mensagem[] = [
  { id: 'm1', conversaId: '1', conteudo: 'Oi! Tudo bem?', de: 'atriz', criadaEm: '14:28' },
  { id: 'm2', conversaId: '1', conteudo: 'Oi, tudo ótimo! E você?', de: 'cliente', criadaEm: '14:29' },
  { id: 'm3', conversaId: '1', conteudo: 'Aqui também! Obrigada por me seguir 💜', de: 'atriz', criadaEm: '14:30' },
  { id: 'm4', conversaId: '1', conteudo: 'Claro! Adoro seu conteúdo', de: 'cliente', criadaEm: '14:31' },
  { id: 'm5', conversaId: '1', conteudo: 'Oi, tudo bem? 😊', de: 'atriz', criadaEm: '14:32' },

  { id: 'm6', conversaId: '2', conteudo: 'Olá! Obrigada por acompanhar meu trabalho!', de: 'atriz', criadaEm: '11:10' },
  { id: 'm7', conversaId: '2', conteudo: 'Com certeza! Você é incrível', de: 'cliente', criadaEm: '11:12' },
  { id: 'm8', conversaId: '2', conteudo: 'Obrigada pelo seu apoio!', de: 'atriz', criadaEm: '11:15' },

  { id: 'm9',  conversaId: '3', conteudo: 'Oi! Tenho novidades pra você 👀', de: 'atriz', criadaEm: 'Ontem 20:10' },
  { id: 'm10', conversaId: '3', conteudo: 'Sério? O que é?', de: 'cliente', criadaEm: 'Ontem 20:12' },
  { id: 'm11', conversaId: '3', conteudo: 'Novo conteúdo disponível 🔥', de: 'atriz', criadaEm: 'Ontem 20:15' },

  { id: 'm12', conversaId: '4', conteudo: 'Oi! Vi que você assinou meu plano ❤️', de: 'atriz', criadaEm: 'Seg 09:00' },
  { id: 'm13', conversaId: '4', conteudo: 'Sim! Adoro seu trabalho', de: 'cliente', criadaEm: 'Seg 09:05' },
  { id: 'm14', conversaId: '4', conteudo: 'Obrigada pela mensagem ❤️', de: 'atriz', criadaEm: 'Seg 09:10' },

  { id: 'm15', conversaId: '5', conteudo: 'Oi! Postei algo novo hoje 😏', de: 'atriz', criadaEm: 'Dom 18:00' },
  { id: 'm16', conversaId: '5', conteudo: 'Você viu meu último post?', de: 'atriz', criadaEm: 'Dom 18:05' },

  { id: 'm17', conversaId: '6', conteudo: 'Foi ótimo conversar com você!', de: 'cliente', criadaEm: 'Sáb 22:10' },
  { id: 'm18', conversaId: '6', conteudo: 'Até logo! 👋', de: 'atriz', criadaEm: 'Sáb 22:15' },
]
