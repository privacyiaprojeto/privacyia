import { getAdminOperationalDashboard } from '../services/admin-operational-dashboard.service.js'

export async function getAdminOperationalDashboardController(req, res, next) {
  try {
    const result = await getAdminOperationalDashboard({
      limit: req.query?.limit || 10,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
