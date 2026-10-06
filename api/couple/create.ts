import { create } from '../_lib/coupleOps.js'
import { withAuth } from '../_lib/handler.js'

export default withAuth((db, uid) => create(db, uid))
