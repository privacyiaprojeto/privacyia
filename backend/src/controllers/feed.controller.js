import {
  listFeedPosts,
  listFeedSuggestions,
  listFeedTop10,
  togglePostLike,
  togglePostSave,
} from '../services/feed.service.js'

export async function getFeedPostsController(req, res) {
  const data = await listFeedPosts(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getFeedSuggestionsController(_req, res) {
  const data = await listFeedSuggestions()
  return res.status(200).json(data)
}

export async function getFeedTop10Controller(_req, res) {
  const data = await listFeedTop10()
  return res.status(200).json(data)
}

export async function likeFeedPostController(req, res) {
  const data = await togglePostLike(req.auth.profile.id, req.params.postId)
  return res.status(200).json(data)
}

export async function saveFeedPostController(req, res) {
  const data = await togglePostSave(req.auth.profile.id, req.params.postId)
  return res.status(200).json(data)
}
