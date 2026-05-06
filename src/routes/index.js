const router = require("express").Router();
const { authenticate } = require("../middleware/auth");
const { authorize } = require("../middleware/roleCheck");

// Public routes (no auth)
router.use("/public", require("./public.routes"));

// Auth routes
router.use("/auth", require("./auth.routes"));

// Admin routes (all require auth)
router.use("/admin/dashboard", authenticate, require("./dashboard.routes"));
router.use("/admin/departments", authenticate, require("./department.routes"));
router.use("/admin/companies", authenticate, require("./company.routes"));
router.use("/admin/sub-menus", authenticate, require("./subMenuItem.routes"));
router.use(
  "/admin/news-categories",
  authenticate,
  require("./newsCategory.routes"),
);
router.use("/admin/news", authenticate, require("./newsArticle.routes"));
router.use("/admin/slides", authenticate, require("./slide.routes"));
router.use("/admin/offices", authenticate, require("./office.routes"));
router.use("/admin/social-links", authenticate, require("./socialLink.routes"));
router.use(
  "/admin/settings",
  authenticate,
  authorize("admin"),
  require("./siteSetting.routes"),
);
router.use(
  "/admin/users",
  authenticate,
  authorize("admin"),
  require("./user.routes"),
);
router.use("/admin/files", authenticate, require("./file.routes"));
router.use("/admin/visitors", authenticate, require("./visitorsLog.routes"));

// Digitization Module
router.use(
  "/admin/digitization",
  authenticate,
  require("./digitization.routes"),
);

module.exports = router;
