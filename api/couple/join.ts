import { join } from '../_lib/coupleOps.js'
import { withAuth } from '../_lib/handler.js'

export default withAuth((db, uid, body) => join(db, uid, (body as { code?: unknown } | undefined)?.code))
